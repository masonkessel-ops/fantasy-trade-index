import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { evaluateTrade, edgeLabel, tradeGrade } from "@/lib/tradeAnalysis";
import { getValueBoard } from "@/lib/values";
import type { PlayerValue, Scoring } from "@/lib/types";

const ids = (v: string | null) => (v ?? "").split(",").filter((x) => /^[A-Za-z0-9]{1,12}$/.test(x)).slice(0, 5);
const POS: Record<string, string> = { QB: "#f472b6", RB: "#2dd4bf", WR: "#60a5fa", TE: "#fb923c", K: "#c084fc", DST: "#94a3b8" };
const VERDICT = { win: ["You win", "#34d399"], lose: ["You lose", "#fb7185"], fair: ["Fair trade", "#facc15"], empty: ["Trade", "#8fa0ba"] } as const;

/** GET /api/og/trade?give=a,b&get=c — the link-preview picture for a shared trade. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const s = sp.get("scoring");
  const scoring: Scoring = s === "half" || s === "std" ? s : "ppr";
  const board = await getValueBoard(scoring);
  const byId = new Map(board.players.map((p) => [p.id, p]));
  const give = ids(sp.get("give")).map((id) => byId.get(id)).filter((p): p is PlayerValue => !!p);
  const get = ids(sp.get("get")).map((id) => byId.get(id)).filter((p): p is PlayerValue => !!p);
  const r = evaluateTrade(give, get);
  const [label, color] = VERDICT[r.verdict];
  const grade = tradeGrade(r.balance);

  const side = (title: string, ps: PlayerValue[], weight: number, accent: string) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: 28, borderRadius: 28, background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: accent, fontWeight: 700, letterSpacing: 3 }}>
        <span>{title}</span>
        <span style={{ color: "#f4f4f8" }}>{weight} wt</span>
      </div>
      {ps.slice(0, 4).map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", padding: "4px 10px", borderRadius: 10, fontSize: 22, fontWeight: 800, color: POS[p.position], background: "rgba(255,255,255,0.06)" }}>{p.position}</div>
          <div style={{ flex: 1, display: "flex", fontSize: 34, fontWeight: 700, color: "#f4f4f8" }}>{p.name}</div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: "#93c5fd" }}>{p.value}</div>
        </div>
      ))}
      {ps.length === 0 && <div style={{ display: "flex", fontSize: 28, color: "#5e5e76" }}>No players</div>}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 56,
          gap: 28,
          background: "radial-gradient(900px 500px at 95% 0%, rgba(59,130,246,0.4), transparent 60%), #050912",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color }}>{label}</div>
            {r.verdict !== "empty" && (
              <div style={{ display: "flex", padding: "6px 18px", borderRadius: 16, fontSize: 44, fontWeight: 800, color: "#f4f4f8", background: "rgba(255,255,255,0.08)" }}>{grade}</div>
            )}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#8fa0ba" }}>{r.verdict === "empty" ? "" : edgeLabel(r)}</div>
        </div>
        <div style={{ display: "flex", gap: 24, flex: 1 }}>
          {side("YOU GIVE", give, Math.round(r.adjGive), "#60a5fa")}
          {side("YOU GET", get, Math.round(r.adjGet), "#facc15")}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#8fa0ba" }}>
          <span style={{ color: "#f4f4f8", fontWeight: 700 }}>Fantasy Trade Index</span>
          <span>Market-priced trade values · {scoring.toUpperCase()}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=600, s-maxage=600" } },
  );
}
