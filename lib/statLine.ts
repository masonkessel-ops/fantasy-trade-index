/** One-line box score summary for a player's game, e.g. "22/31, 284 yd, 2 TD · 4-21 rush". */
export function statLine(s: Record<string, number>, pos: string) {
  const n = (k: string) => s[k] ?? 0;
  if (pos === "K") return `${n("fgm")}/${n("fga")} FG · ${n("xpm")} XP`;
  if (pos === "DST")
    return (
      [`${n("pts_allow")} pts allowed`, n("sack") && `${n("sack")} sk`, n("int") && `${n("int")} INT`, n("fum_rec") && `${n("fum_rec")} FR`, n("def_td") && `${n("def_td")} TD`]
        .filter(Boolean)
        .join(" · ") || "—"
    );
  const parts: string[] = [];
  if (n("pass_att")) parts.push(`${n("pass_cmp")}/${n("pass_att")}, ${n("pass_yd")} yd, ${n("pass_td")} TD${n("pass_int") ? `, ${n("pass_int")} INT` : ""}`);
  if (n("rush_att")) parts.push(`${n("rush_att")} car, ${n("rush_yd")} yd${n("rush_td") ? `, ${n("rush_td")} TD` : ""}`);
  if (n("rec_tgt") || n("rec")) parts.push(`${n("rec")}/${n("rec_tgt")} rec, ${n("rec_yd")} yd${n("rec_td") ? `, ${n("rec_td")} TD` : ""}`);
  return parts.join(" · ") || "—";
}
