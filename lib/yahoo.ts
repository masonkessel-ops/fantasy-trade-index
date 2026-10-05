import "server-only";
import { cookies } from "next/headers";
import { seal, secureCookie, unseal } from "./seal";

/**
 * "Sign in with Yahoo": Yahoo OAuth 2.0 + Yahoo Fantasy API.
 *
 * Tokens live in an encrypted, httpOnly cookie in the user's own browser.
 * There's no database: signing in just lets the site read your Yahoo leagues.
 * Requires YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET and SESSION_SECRET (see README).
 */

export const SESSION_COOKIE = "fti_yahoo";
export const STATE_COOKIE = "fti_yahoo_state";
const AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const API = "https://fantasysports.yahooapis.com/fantasy/v2";

export interface YahooSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  name: string;
}

const env = (name: string) => process.env[name]?.trim() ?? "";
const clientId = () => env("YAHOO_CLIENT_ID");
const clientSecret = () => env("YAHOO_CLIENT_SECRET");

export function yahooConfigured() {
  return !!(clientId() && clientSecret() && env("SESSION_SECRET"));
}

export function redirectUri(origin: string) {
  return env("YAHOO_REDIRECT_URI") || `${origin}/api/yahoo/callback`;
}

/**
 * Optional OAuth scope. Leave unset: Yahoo grants Fantasy Sports access
 * automatically to apps registered with the "Fantasy Sports - Read" permission,
 * and rejects "fspt-r" as an explicit scope (invalid_scope).
 */
const scope = () => env("YAHOO_SCOPE");

export function authorizeUrl(origin: string, state: string) {
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(origin),
    response_type: "code",
    language: "en-us",
    state,
  });
  if (scope()) q.set("scope", scope());
  return `${AUTH_URL}?${q}`;
}

/* -------------------------------------------------- encrypted session cookie */

export const sealSession = (s: YahooSession) => seal(s);
export const unsealSession = (value: string | undefined) => unseal<YahooSession>(value);
export const sessionCookieOptions = { ...secureCookie, maxAge: 60 * 60 * 24 * 30 };

/* ------------------------------------------------------------- token calls */

async function tokenRequest(params: Record<string, string>, origin: string) {
  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, redirect_uri: redirectUri(origin) }),
    cache: "no-store",
  });
  if (!res.ok) {
    // Yahoo returns e.g. {"error":"invalid_client"} / "invalid_grant" / redirect_uri mismatch. Not secret.
    const body = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string };
    throw new YahooTokenError(String(body.error || `http_${res.status}`).slice(0, 60));
  }
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number; id_token?: string }>;
}

/** Display name from the OpenID id_token, if Yahoo sent one (display only, not used for auth). */
function nameFromIdToken(idToken?: string) {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split(".")[1], "base64url").toString("utf8"));
    return String(payload.nickname || payload.given_name || payload.name || "Yahoo user");
  } catch {
    return "Yahoo user";
  }
}

export async function exchangeCode(code: string, origin: string): Promise<YahooSession> {
  const t = await tokenRequest({ grant_type: "authorization_code", code }, origin);
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + (t.expires_in - 60) * 1000, name: nameFromIdToken(t.id_token) };
}

async function refresh(s: YahooSession, origin: string): Promise<YahooSession> {
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: s.refreshToken }, origin);
  return { ...s, accessToken: t.access_token, refreshToken: t.refresh_token || s.refreshToken, expiresAt: Date.now() + (t.expires_in - 60) * 1000 };
}

/** Thrown when Yahoo rejects the user's token; `message` is Yahoo's oauth_problem code (e.g. token_rejected). */
export class YahooAuthError extends Error {}

/**
 * Pull the useful part out of a Yahoo error response. Yahoo puts it in a JSON
 * description like: Please provide valid credentials. OAuth oauth_problem="token_rejected", realm="yahooapis.com"
 * (and sometimes the WWW-Authenticate header). Returns the oauth_problem code if present.
 */
async function yahooProblem(res: Response, fallback: string) {
  const text = await res.text().catch(() => "");
  let desc = "";
  try {
    const j = JSON.parse(text) as { error?: { description?: string } | string; description?: string };
    desc = (typeof j.error === "object" ? j.error?.description : j.error) ?? j.description ?? "";
  } catch {
    desc = text.match(/<description>([^<]+)</)?.[1] ?? text.slice(0, 200);
  }
  const problem = `${desc} ${res.headers.get("www-authenticate") ?? ""}`.match(/oauth_problem="?([A-Za-z_]+)/)?.[1];
  return (problem || desc.trim() || fallback).slice(0, 200);
}

/** A Yahoo Fantasy API call failed; `message` includes Yahoo's description. */
export class YahooApiError extends Error {}

/** Yahoo refused a token request; `message` is Yahoo's short error code. */
export class YahooTokenError extends Error {}

/**
 * GET from the Yahoo Fantasy API, refreshing the access token when needed.
 * Returns the JSON and the (possibly refreshed) session so the caller can re-set the cookie.
 */
export async function yahooGet(path: string, session: YahooSession, origin: string) {
  let s = session;
  if (Date.now() >= s.expiresAt) s = await refresh(s, origin).catch(() => Promise.reject(new YahooAuthError("token_expired")));
  const call = (token: string) =>
    fetch(`${API}${path}${path.includes("?") ? "&" : "?"}format=json`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  let res = await call(s.accessToken);
  if (res.status === 401) {
    s = await refresh(s, origin).catch(() => Promise.reject(new YahooAuthError("token_expired")));
    res = await call(s.accessToken);
  }
  if (res.status === 401) throw new YahooAuthError(await yahooProblem(res, "token_rejected"));
  if (!res.ok) throw new YahooApiError(`Yahoo API ${res.status}: ${await yahooProblem(res, "unknown")}`);
  return { json: (await res.json()) as unknown, session: s, refreshed: s !== session };
}

/* ------------------------------------------------------- route helpers */


export async function readSession() {
  return unsealSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Persist a refreshed session (or clear it when Yahoo says it's dead). */
export async function writeSession(s: YahooSession | null) {
  const jar = await cookies();
  if (s) jar.set(SESSION_COOKIE, sealSession(s), sessionCookieOptions);
  else jar.delete(SESSION_COOKIE);
}

/** Plain-English explanation for a Yahoo oauth_problem code. */
export function yahooAuthHelp(problem: string) {
  const fix: Record<string, string> = {
    additional_authorization_required:
      "Yahoo won't share fantasy data with this app. The Yahoo app must be created with the \"Fantasy Sports - Read\" permission (it can't be added later), and its Client ID/Secret must be the ones in Vercel. Then sign out and sign in again.",
    token_rejected:
      "Yahoo signed you in but won't let this app read fantasy data. In your Yahoo app (developer.yahoo.com/apps → your app → Edit), turn on API Permissions → Fantasy Sports → Read and save. Then sign out here and sign in with Yahoo again.",
    token_expired: "Your Yahoo sign-in expired. Please sign in again.",
    unable_to_determine_oauth_type: "The site sent Yahoo a malformed request. Please sign in again; if it repeats, this is a bug on our side.",
  };
  return `${fix[problem] ?? "Yahoo wouldn't share your fantasy data. Check that your Yahoo app has Fantasy Sports → Read permission, then sign in again."} (${problem})`;
}
