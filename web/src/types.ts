/** Canonical positions produced by pipeline/features.py (POS_MAP). */
export type Pos =
  | "QB" | "RB" | "FB" | "WR" | "TE"
  | "OT" | "G" | "C" | "OL"
  | "DE" | "DT" | "DL"
  | "OLB" | "ILB" | "LB"
  | "CB" | "S" | "DB";

export interface SuperBowl {
  season: number;
  won: boolean;
  team: string;
  /** Was this player the starting QB in that Super Bowl? */
  qb: boolean;
}

export type StatLine = Record<string, number | string | undefined>;

export interface Player {
  id: string;
  name: string;
  pos: Pos;
  draftPos: string;
  round: number;
  pick: number;
  team: string;
  college: string | null;
  hof: boolean;
  lastSeason: number;
  av: number;
  allPro: number;
  proBowls: number;
  seasonsStarted: number;
  games: number;
  headshot: string | null;
  career: Record<string, number>;
  sb: SuperBowl[];
  seasons: StatLine[];
}

export interface DraftClass {
  year: number;
  players: Record<string, Player>;
}
