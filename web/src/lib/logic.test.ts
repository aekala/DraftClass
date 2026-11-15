import { describe, expect, it } from "vitest";
import type { Player, Pos } from "../types";
import { assign } from "./assign";
import { buildLineup, SLOTS, STRICT_FIT } from "./lineup";
import { defaultModel, score } from "./scoring";

/** Exhaustive search, for checking the Hungarian result on small inputs. */
function bruteForce(w: (number | null)[][]): { filled: number; total: number } {
  let best = { filled: -1, total: -Infinity };
  const m = Math.max(...w.map((r) => r.length));
  const go = (i: number, used: Set<number>, filled: number, total: number) => {
    if (i === w.length) {
      if (filled > best.filled || (filled === best.filled && total > best.total)) best = { filled, total };
      return;
    }
    go(i + 1, used, filled, total); // leave row empty
    for (let j = 0; j < m; j++) {
      const v = w[i][j];
      if (v == null || used.has(j)) continue;
      used.add(j);
      go(i + 1, used, filled + 1, total + v);
      used.delete(j);
    }
  };
  go(0, new Set(), 0, 0);
  return best;
}

function evaluate(w: (number | null)[][], cols: number[]) {
  let filled = 0;
  let total = 0;
  cols.forEach((c, i) => {
    if (c >= 0) {
      filled++;
      total += w[i][c]!;
    }
  });
  return { filled, total };
}

describe("assign", () => {
  it("beats greedy on the tackle/guard example", () => {
    // rows: RT, LG. cols: A (tackle who can play guard), B (tackle only), C (guard only)
    const w = [
      [80, 70, null],
      [72, null, 40],
    ];
    expect(assign(w)).toEqual([1, 0]); // B at RT, A at LG = 142
  });

  it("leaves a row empty when nothing is allowed", () => {
    expect(assign([[5, null], [null, null]])).toEqual([0, -1]);
  });

  it("matches brute force on random matrices", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 300; t++) {
      const n = 1 + Math.floor(rand() * 4);
      const m = 1 + Math.floor(rand() * 5);
      const w = Array.from({ length: n }, () =>
        Array.from({ length: m }, () => (rand() < 0.3 ? null : Math.round(rand() * 100))),
      );
      const cols = assign(w);
      const used = cols.filter((c) => c >= 0);
      expect(new Set(used).size).toBe(used.length);
      expect(evaluate(w, cols)).toEqual(bruteForce(w));
    }
  });
});

let nextId = 0;
function player(pos: Pos, av: number, extra: Partial<Player> = {}): Player {
  const id = `p${nextId++}`;
  return {
    id, name: id, pos, draftPos: pos, round: 1, pick: 1, team: "XXX", college: null, hof: false,
    lastSeason: 2020, av, allPro: 0, proBowls: 0, seasonsStarted: 1, games: 1, headshot: null,
    career: {}, sb: [], seasons: [], ...extra,
  };
}

describe("scoring", () => {
  const p = player("QB", 100, {
    allPro: 1, proBowls: 2,
    sb: [{ season: 2010, won: true, team: "X", qb: true }, { season: 2012, won: false, team: "X", qb: false }],
  });

  it("adds every component", () => {
    const s = score(p, defaultModel);
    expect(s).toEqual({ base: 100, allPro: 4, proBowl: 3, superBowl: 3 * 2 + 1, total: 114 });
  });

  it("drops the Super Bowl bonus when switched off", () => {
    expect(score(p, { ...defaultModel, sbOn: false }).superBowl).toBe(0);
  });
});

describe("buildLineup", () => {
  const cls = [
    player("QB", 90), player("QB", 50),
    player("RB", 40), player("FB", 30),
    ...[60, 55, 50, 45].map((av) => player("WR", av)),
    player("TE", 30),
    player("OT", 70), player("OT", 20), player("G", 80), player("G", 10), player("C", 15), player("OL", 25),
    player("DE", 60), player("OLB", 70), player("DT", 50), player("DT", 40), player("ILB", 30),
    player("LB", 35), player("OLB", 25), player("CB", 45), player("DB", 20), player("S", 50), player("S", 40),
  ];

  it("never uses a player twice and fills every slot it can", () => {
    const l = buildLineup(cls, defaultModel);
    const ids = Object.values(l.starters).filter(Boolean).map((p) => p!.player.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(l.starters.QB!.player.av).toBe(90);
  });

  it("with exact positions only, never plays anyone out of position", () => {
    const l = buildLineup(cls, { ...defaultModel, flex: false });
    for (const slot of SLOTS) {
      const pick = l.starters[slot.id];
      if (pick) expect(slot.fits[pick.player.pos]).toBeGreaterThanOrEqual(STRICT_FIT);
    }
    // Only one DE in the class, so the second DE slot stays empty without flexibility.
    expect([l.starters.LDE, l.starters.RDE].filter(Boolean)).toHaveLength(1);
  });

  it("uses close fits when flexibility is on", () => {
    const l = buildLineup(cls, defaultModel);
    expect(l.starters.LDE && l.starters.RDE).toBeTruthy();
  });
});
