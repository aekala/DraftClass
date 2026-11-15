import type { Player, Pos } from "../types";
import { assign } from "./assign";
import { score, type Model, type ScoreParts } from "./scoring";

export type Side = "offense" | "defense";

export interface Slot {
  id: string;
  label: string;
  side: Side;
  /** Position -> fit factor. 1 = natural position; lower = playing out of position. */
  fits: Partial<Record<Pos, number>>;
}

const OT = { OT: 1, OL: 0.95, G: 0.85 };
const G = { G: 1, OL: 0.95, OT: 0.9, C: 0.9 };
const C = { C: 1, OL: 0.9, G: 0.85 };
const DE = { DE: 1, DL: 0.95, OLB: 0.9, DT: 0.85 };
const DT = { DT: 1, DL: 0.95, DE: 0.85 };
const OLB = { OLB: 1, LB: 1, ILB: 0.9, DE: 0.85 };
const MLB = { ILB: 1, LB: 1, OLB: 0.9 };
const CB = { CB: 1, DB: 0.95, S: 0.85 };
const S = { S: 1, DB: 0.95, CB: 0.85 };

export const SLOTS: Slot[] = [
  { id: "QB", label: "QB", side: "offense", fits: { QB: 1 } },
  { id: "RB", label: "RB", side: "offense", fits: { RB: 1, FB: 0.8 } },
  { id: "WR1", label: "WR", side: "offense", fits: { WR: 1 } },
  { id: "WR2", label: "WR", side: "offense", fits: { WR: 1 } },
  { id: "WR3", label: "WR", side: "offense", fits: { WR: 1 } },
  { id: "TE", label: "TE", side: "offense", fits: { TE: 1 } },
  { id: "LT", label: "LT", side: "offense", fits: OT },
  { id: "LG", label: "LG", side: "offense", fits: G },
  { id: "C", label: "C", side: "offense", fits: C },
  { id: "RG", label: "RG", side: "offense", fits: G },
  { id: "RT", label: "RT", side: "offense", fits: OT },
  { id: "LDE", label: "DE", side: "defense", fits: DE },
  { id: "LDT", label: "DT", side: "defense", fits: DT },
  { id: "RDT", label: "DT", side: "defense", fits: DT },
  { id: "RDE", label: "DE", side: "defense", fits: DE },
  { id: "WLB", label: "LB", side: "defense", fits: OLB },
  { id: "MLB", label: "MLB", side: "defense", fits: MLB },
  { id: "SLB", label: "LB", side: "defense", fits: OLB },
  { id: "CB1", label: "CB", side: "defense", fits: CB },
  { id: "CB2", label: "CB", side: "defense", fits: CB },
  { id: "FS", label: "FS", side: "defense", fits: S },
  { id: "SS", label: "SS", side: "defense", fits: S },
];

/** Fits at or above this count as "exact" when position flexibility is off (OL/DL/LB/DB labels included). */
export const STRICT_FIT = 0.95;

export function fitFor(slot: Slot, pos: Pos, model: Model): number | null {
  const f = slot.fits[pos];
  if (f == null) return null;
  if (!model.flex && f < STRICT_FIT) return null;
  return f;
}

export interface Pick {
  player: Player;
  score: ScoreParts;
  fit: number;
  /** score.total × fit: what the assignment maximizes. */
  value: number;
}

export interface Lineup {
  starters: Record<string, Pick | null>;
  bench: Record<string, Pick[]>;
  scores: Map<string, ScoreParts>;
  /** player id -> slot id, for starters. */
  slotOf: Map<string, string>;
  total: number;
}

const BENCH_SIZE = 3;

export function buildLineup(players: Player[], model: Model): Lineup {
  const scores = new Map(players.map((p) => [p.id, score(p, model)]));
  const starters: Record<string, Pick | null> = {};
  const bench: Record<string, Pick[]> = {};
  const slotOf = new Map<string, string>();

  const pickFor = (slot: Slot, p: Player): Pick | null => {
    const fit = fitFor(slot, p.pos, model);
    if (fit == null) return null;
    const s = scores.get(p.id)!;
    return { player: p, score: s, fit, value: s.total * fit };
  };

  for (const side of ["offense", "defense"] as const) {
    const slots = SLOTS.filter((s) => s.side === side);
    const pool = players.filter((p) => slots.some((s) => fitFor(s, p.pos, model) != null));
    const weights = slots.map((s) => pool.map((p) => pickFor(s, p)?.value ?? null));
    const chosen = assign(weights);
    slots.forEach((slot, i) => {
      const col = chosen[i];
      const pick = col >= 0 ? pickFor(slot, pool[col]) : null;
      starters[slot.id] = pick;
      if (pick) slotOf.set(pick.player.id, slot.id);
    });
  }

  for (const slot of SLOTS) {
    bench[slot.id] = players
      .filter((p) => !slotOf.has(p.id))
      .map((p) => pickFor(slot, p))
      .filter((x): x is Pick => x != null)
      .sort((a, b) => b.value - a.value)
      .slice(0, BENCH_SIZE);
  }

  const total = Object.values(starters).reduce((sum, p) => sum + (p?.value ?? 0), 0);
  return { starters, bench, scores, slotOf, total };
}
