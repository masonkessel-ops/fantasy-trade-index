import "server-only";
import { cookies } from "next/headers";
import { hasSessionSecret, seal, secureCookie, unseal } from "./seal";

/**
 * "Sign in with Google" — OAuth 2.0 / OpenID Connect, no extra libraries.
 * The signed-in user lives in an encrypted httpOnly cookie; their saved team
 * lives in the key-value store (lib/store.ts).
 * Needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET.
 */
export const USER_COOKIE = "fti_user";
export const GOOGLE_STATE_COOKIE = "fti_google_state";

export interface User {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
}

const env = (n: string) => process.env[n]?.trim() ?? "";
export const googleConfigured = () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET") && hasSessionSecret());
const redirectUri = (origin: string) => `${origin}/api/auth/google/callback`;

export function googleAuthorizeUrl(origin: string, state: string) {
  const q = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/** Exchange the code for an ID token and read the user's identity from it. */
export async function googleUserFromCode(code: string, origin: string): Promise<User> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !data.id_token) throw new Error(data.error || `token_${res.status}`);
  // The ID token came straight from Google's token endpoint over TLS, so per
  // Google's docs we can read it without re-verifying the signature; we still
  // check who it was issued to and that it hasn't expired.
  const claims = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
  if (claims.aud !== env("GOOGLE_CLIENT_ID")) throw new Error("wrong_audience");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(String(claims.iss))) throw new Error("wrong_issuer");
  if (Number(claims.exp) * 1000 < Date.now()) throw new Error("expired");
  return {
    sub: String(claims.sub),
    email: String(claims.email ?? ""),
    name: String(claims.given_name || claims.name || claims.email || "You"),
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}

export const sealUser = (u: User) => seal(u);
export const userCookieOptions = secureCookie;

export async function currentUser(): Promise<User | null> {
  return unseal<User>((await cookies()).get(USER_COOKIE)?.value);
}
