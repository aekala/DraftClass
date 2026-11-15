import { defaultModel, type Model } from "./scoring";

export interface UrlState {
  year: number | null;
  model: Model;
}

/** Short URL keys for each model field. Only values that differ from the default are written. */
const KEYS: Record<keyof Model, string> = {
  allProOn: "apOn",
  allPro: "ap",
  proBowlOn: "pbOn",
  proBowl: "pb",
  sbOn: "sbOn",
  sbWin: "sbW",
  sbLoss: "sbL",
  qbMultOn: "qbOn",
  qbMult: "qb",
  flex: "flex",
};

export function readUrl(search: string): UrlState {
  const q = new URLSearchParams(search);
  const year = Number(q.get("year")) || null;
  const model: Model = { ...defaultModel };
  for (const [field, key] of Object.entries(KEYS) as [keyof Model, string][]) {
    const raw = q.get(key);
    if (raw == null) continue;
    if (typeof defaultModel[field] === "boolean") {
      (model[field] as boolean) = raw === "1";
    } else {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) (model[field] as number) = n;
    }
  }
  return { year, model };
}

export function writeUrl({ year, model }: UrlState): string {
  const q = new URLSearchParams();
  if (year != null) q.set("year", String(year));
  for (const [field, key] of Object.entries(KEYS) as [keyof Model, string][]) {
    const v = model[field];
    if (v === defaultModel[field]) continue;
    q.set(key, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return `?${q.toString()}`;
}
