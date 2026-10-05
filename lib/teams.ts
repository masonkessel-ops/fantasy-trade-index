export const NFL_TEAMS: Record<string, { name: string; city: string; color: string }> = {
  ARI: { city: "Arizona", name: "Cardinals", color: "#97233F" },
  ATL: { city: "Atlanta", name: "Falcons", color: "#A71930" },
  BAL: { city: "Baltimore", name: "Ravens", color: "#241773" },
  BUF: { city: "Buffalo", name: "Bills", color: "#00338D" },
  CAR: { city: "Carolina", name: "Panthers", color: "#0085CA" },
  CHI: { city: "Chicago", name: "Bears", color: "#C83803" },
  CIN: { city: "Cincinnati", name: "Bengals", color: "#FB4F14" },
  CLE: { city: "Cleveland", name: "Browns", color: "#FF3C00" },
  DAL: { city: "Dallas", name: "Cowboys", color: "#003594" },
  DEN: { city: "Denver", name: "Broncos", color: "#FB4F14" },
  DET: { city: "Detroit", name: "Lions", color: "#0076B6" },
  GB: { city: "Green Bay", name: "Packers", color: "#203731" },
  HOU: { city: "Houston", name: "Texans", color: "#A71930" },
  IND: { city: "Indianapolis", name: "Colts", color: "#002C5F" },
  JAX: { city: "Jacksonville", name: "Jaguars", color: "#006778" },
  KC: { city: "Kansas City", name: "Chiefs", color: "#E31837" },
  LAC: { city: "Los Angeles", name: "Chargers", color: "#0080C6" },
  LAR: { city: "Los Angeles", name: "Rams", color: "#003594" },
  LV: { city: "Las Vegas", name: "Raiders", color: "#A5ACAF" },
  MIA: { city: "Miami", name: "Dolphins", color: "#008E97" },
  MIN: { city: "Minnesota", name: "Vikings", color: "#4F2683" },
  NE: { city: "New England", name: "Patriots", color: "#C60C30" },
  NO: { city: "New Orleans", name: "Saints", color: "#D3BC8D" },
  NYG: { city: "New York", name: "Giants", color: "#0B2265" },
  NYJ: { city: "New York", name: "Jets", color: "#125740" },
  PHI: { city: "Philadelphia", name: "Eagles", color: "#004C54" },
  PIT: { city: "Pittsburgh", name: "Steelers", color: "#FFB612" },
  SEA: { city: "Seattle", name: "Seahawks", color: "#69BE28" },
  SF: { city: "San Francisco", name: "49ers", color: "#AA0000" },
  TB: { city: "Tampa Bay", name: "Buccaneers", color: "#D50A0A" },
  TEN: { city: "Tennessee", name: "Titans", color: "#4B92DB" },
  WAS: { city: "Washington", name: "Commanders", color: "#5A1414" },
};

export const TEAM_CODES = Object.keys(NFL_TEAMS).sort();

export function teamLogo(team: string) {
  return `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;
}

export function playerHeadshot(id: string) {
  return `https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`;
}
