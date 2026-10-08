export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export type Scoring = "ppr" | "half" | "std";
/** Cookie holding the visitor's scoring format so server pages render the right numbers. */
export const SCORING_COOKIE = "tr_scoring";
export const SCORINGS: { id: Scoring; label: string; short: string }[] = [
  { id: "ppr", label: "PPR", short: "PPR" },
  { id: "half", label: "Half PPR", short: "Half" },
  { id: "std", label: "Standard", short: "Std" },
];

export interface Player {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  position: Position;
  team: string | null;
  age: number | null;
  injuryStatus: string | null;
  injuryBodyPart: string | null;
  yearsExp: number | null;
  number: number | null;
  searchRank: number | null;
  /** depth chart spot on his NFL team, e.g. "SWR" order 1 = starting slot receiver (null if unlisted) */
  depthPos: string | null;
  depthOrder: number | null;
  espnId: string | null;
}

export interface FantasyPoints {
  ppr: number;
  half: number;
  std: number;
}

/** One player's line for one week (trimmed from Sleeper's huge stat objects). */
export interface WeekLine {
  pts: FantasyPoints;
  played: boolean;
  stats: Record<string, number>;
}

export interface NflState {
  season: string;
  week: number;
  seasonType: string;
}

export interface ScheduleGame {
  gameId: string;
  week: number;
  date: string;
  home: string;
  away: string;
  status: string;
}

/** What the trade-value table and detail page render. */
export interface PlayerRole {
  depth: string | null;
  /** share of his team's offensive snaps over his last few games, 0–1 */
  snapShare: number | null;
  targetsPerGame: number;
  carriesPerGame: number;
  /** expected fantasy points per game from that usage */
  expectedPpg: number | null;
  /** % of ESPN leagues starting him this week (null if ESPN doesn't list him) */
  espnStarted: number | null;
}

export interface PlayerValue {
  id: string;
  name: string;
  position: Position;
  team: string | null;
  age: number | null;
  injuryStatus: string | null;
  value: number;
  /** trade weight 0–100: share of the best player's worth (linear, like market trade value); trade fairness uses this */
  power: number;
  /** rank in the FantasyCalc trade market (null if unranked or the market is unavailable) */
  marketRank: number | null;
  /** value change vs. one week ago (null if no history) */
  change: number | null;
  overallRank: number;
  posRank: number;
  ppg: number;
  gamesPlayed: number;
  recentPpg: number | null;
  rosPpg: number;
  rosPoints: number;
  /** projected points per remaining week for a lineup (counts byes, missed games and current injuries) */
  weekly: number;
  /** his role: depth chart spot (e.g. "SWR1"), recent usage and how many ESPN managers start him */
  role: PlayerRole;
  byeWeek: number | null;
  /** trade value after each week of the season (index 0 = week 1) */
  trend: (number | null)[];
  /** fantasy points scored each week for the selected scoring (null = did not play) */
  weekPoints: (number | null)[];
  breakdown: Record<string, number>;
}

export interface ValueBoard {
  season: string;
  week: number;
  scoring: Scoring;
  generatedAt: number;
  players: PlayerValue[];
}

export type LeagueProvider = "sleeper" | "espn" | "yahoo";

/** One team in an imported league. Player IDs are always Sleeper IDs. */
export interface LeagueTeam {
  rosterId: number;
  ownerId: string | null;
  displayName: string;
  teamName: string;
  avatar: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  players: string[];
  starters: string[];
}

/** A league from any platform, normalised to Sleeper-style slots and IDs. */
export interface LeagueDetail {
  leagueId: string;
  name: string;
  season: string;
  totalRosters: number;
  avatar: string | null;
  /** Sleeper slot names: QB, RB, WR, TE, FLEX, SUPER_FLEX, WRRB_FLEX, REC_FLEX, K, DEF, BN, IR */
  rosterPositions: string[];
  scoringSettings: Record<string, number>;
  teams: LeagueTeam[];
  provider?: LeagueProvider;
  /** rosterId of the signed-in user's team, when the platform tells us */
  myRosterId?: number | null;
  /** how many rostered players couldn't be matched to our player database */
  unmatched?: number;
}
