import clsx from "clsx";
import { playerRisk } from "@/lib/risk";
import type { PlayerValue } from "@/lib/types";

export function PlayerRiskLine({ p }: { p: PlayerValue }) {
  const r = playerRisk(p);
  return (
    <div className="text-xs text-muted" title={r.reasons.length ? r.reasons.join(", ") : "No major risk factors"}>
      Risk{" "}
      <b className={clsx(r.level === "High" ? "text-down" : r.level === "Medium" ? "text-flame" : "text-up")}>{r.level}</b>
      {r.reasons.length > 0 && <span className="text-faint"> · {r.reasons.join(", ")}</span>}
    </div>
  );
}
