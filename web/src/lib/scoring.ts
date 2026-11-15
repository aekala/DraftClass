import type { Player } from "../types";

/** Everything the user can tune. Flat so it encodes cleanly into the URL. */
export interface Model {
  allProOn: boolean;
  allPro: number;
  proBowlOn: boolean;
  proBowl: number;
  sbOn: boolean;
  sbWin: number;
  sbLoss: number;
  qbMultOn: boolean;
  qbMult: number;
  /** Allow close-fit positions (G at C, S at CB, OLB at DE...). Off = exact positions only. */
  flex: boolean;
}

export const defaultModel: Model = {
  allProOn: true,
  allPro: 4,
  proBowlOn: true,
  proBowl: 1.5,
  sbOn: true,
  sbWin: 3,
  sbLoss: 1,
  qbMultOn: true,
  qbMult: 2,
  flex: true,
};

export const presets: { id: string; label: string; hint: string; model: Model }[] = [
  { id: "default", label: "Default", hint: "Career value plus a modest bonus for honors and rings", model: defaultModel },
  {
    id: "production",
    label: "Pure production",
    hint: "Only on-field value. No honors, no rings",
    model: { ...defaultModel, allProOn: false, proBowlOn: false, sbOn: false, qbMultOn: false },
  },
  {
    id: "hardware",
    label: "Hardware",
    hint: "Honors and Super Bowls count for a lot",
    model: { ...defaultModel, allPro: 8, proBowl: 3, sbWin: 8, sbLoss: 3, qbMult: 2 },
  },
];

export interface ScoreParts {
  base: number;
  allPro: number;
  proBowl: number;
  superBowl: number;
  total: number;
}

export function score(p: Player, model: Model): ScoreParts {
  const base = p.av;
  const allPro = model.allProOn ? model.allPro * p.allPro : 0;
  const proBowl = model.proBowlOn ? model.proBowl * p.proBowls : 0;

  let superBowl = 0;
  if (model.sbOn) {
    for (const sb of p.sb) {
      const mult = sb.qb && model.qbMultOn ? model.qbMult : 1;
      superBowl += (sb.won ? model.sbWin : model.sbLoss) * mult;
    }
  }

  const total = base + allPro + proBowl + superBowl;
  return { base, allPro, proBowl, superBowl, total };
}
