import { useEffect, useMemo, useRef, useState } from "react";
import { Field } from "./components/Field";
import { PlayerNode } from "./components/PlayerNode";
import { PlayerPanel } from "./components/PlayerPanel";
import { ScoringPanel } from "./components/ScoringPanel";
import { geometry } from "./formation";
import { buildLineup, fitFor, SLOTS } from "./lib/lineup";
import { score } from "./lib/scoring";
import { readUrl, writeUrl } from "./lib/urlState";
import type { DraftClass } from "./types";

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;
/**
 * GitHub Pages lets browsers reuse files for 10 minutes. After a data rebuild that would
 * pair an old years.json with new class files (or the reverse), so always revalidate:
 * an unchanged file still comes back as a cheap "not modified".
 */
const fetchData = (path: string) => fetch(dataUrl(path), { cache: "no-cache" });
const initial = readUrl(window.location.search);
const COMPACT_QUERY = "(max-width: 560px)";

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** What the side panel shows: a slot's starter (playerId null) or a specific bench player. */
interface Selection {
  slotId: string;
  playerId: string | null;
}

export default function App() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(initial.year);
  const [model, setModel] = useState(initial.model);
  const [cls, setCls] = useState<DraftClass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [tab, setTab] = useState<"player" | "scoring">("scoring");
  const cache = useRef(new Map<number, DraftClass>());
  const compact = useMediaQuery(COMPACT_QUERY);

  useEffect(() => {
    fetchData("years.json")
      .then((r) => r.json())
      .then((ys: number[]) => {
        setYears(ys);
        // Default to a class old enough for careers to have played out.
        setYear((y) => (y != null && ys.includes(y) ? y : ys[Math.max(0, ys.length - 16)]));
      })
      .catch(() => setError("Couldn't load the list of draft years. Run the data pipeline first."));
  }, []);

  useEffect(() => {
    if (year == null) return;
    const hit = cache.current.get(year);
    if (hit) {
      setCls(hit);
      return;
    }
    let live = true;
    fetchData(`${year}.json`)
      .then((r) => r.json())
      .then((c: DraftClass) => {
        cache.current.set(year, c);
        if (live) setCls(c);
      })
      .catch(() => live && setError(`Couldn't load the ${year} draft class.`));
    return () => {
      live = false;
    };
  }, [year]);

  useEffect(() => {
    window.history.replaceState(null, "", writeUrl({ year, model }));
  }, [year, model]);

  const players = useMemo(() => (cls && cls.year === year ? Object.values(cls.players) : []), [cls, year]);
  const lineup = useMemo(() => buildLineup(players, model), [players, model]);
  const maxValue = Math.max(0, ...Object.values(lineup.starters).map((p) => p?.value ?? 0));

  const changeYear = (y: number) => {
    setYear(y);
    setSelection(null);
    setTab("scoring");
  };
  const yearIdx = year == null ? -1 : years.indexOf(year);

  const selectSlot = (slotId: string) => {
    setSelection({ slotId, playerId: null });
    setTab("player");
  };

  // Resolve the side panel's player: a bench player, or whoever currently starts in the slot.
  const slot = selection ? SLOTS.find((s) => s.id === selection.slotId) ?? null : null;
  const viewed = selection
    ? selection.playerId
      ? cls?.players[selection.playerId] ?? null
      : lineup.starters[selection.slotId]?.player ?? null
    : null;
  const viewedPick = viewed && slot
    ? (() => {
        const fit = fitFor(slot, viewed.pos, model);
        const s = lineup.scores.get(viewed.id) ?? score(viewed, model);
        return fit == null ? null : { player: viewed, score: s, fit, value: s.total * fit };
      })()
    : null;

  const filled = Object.values(lineup.starters).filter(Boolean).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>DraftClass</h1>
          <p className="muted">The best starting lineup from each NFL draft class</p>
        </div>

        <div className="controls">
          <div className="year-picker">
            <button className="icon-btn" aria-label="Previous year" disabled={yearIdx <= 0} onClick={() => changeYear(years[yearIdx - 1])}>‹</button>
            <label className="visually-hidden" htmlFor="year">Draft year</label>
            <select id="year" value={year ?? ""} onChange={(e) => changeYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y} draft</option>)}
            </select>
            <button className="icon-btn" aria-label="Next year" disabled={yearIdx < 0 || yearIdx >= years.length - 1} onClick={() => changeYear(years[yearIdx + 1])}>›</button>
          </div>
        </div>
      </header>

      {error && <p className="error" role="alert">{error}</p>}

      <main className="layout">
        <section className="field-card" aria-busy={!cls}>
          <div className="field-meta">
            <span><strong>{year ?? "…"}</strong> class · career value</span>
            <span className="muted">{filled}/22 filled · team value {lineup.total.toFixed(0)}</span>
          </div>
          <Field compact={compact}>
            {SLOTS.map((s) => (
              <PlayerNode
                key={s.id}
                label={s.label}
                side={s.side}
                slotId={s.id}
                pick={lineup.starters[s.id] ?? null}
                maxValue={maxValue}
                selected={selection?.slotId === s.id}
                onSelect={() => selectSlot(s.id)}
                geometry={geometry(compact)}
              />
            ))}
          </Field>
          <p className="legend muted small">
            <span className="dot gold" /> ring = score vs. best in lineup · <svg className="legend-crown" viewBox="-14 -11 28 17" aria-hidden><g className="crown"><path d="M-12 5 L-12 -5 L-6 0 L0 -8 L6 0 L12 -5 L12 5 Z" /></g></svg> Super Bowl wins · HOF = Hall of Fame
          </p>
        </section>

        <aside className="side">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "player"} className={tab === "player" ? "active" : ""} onClick={() => setTab("player")}>Player</button>
            <button role="tab" aria-selected={tab === "scoring"} className={tab === "scoring" ? "active" : ""} onClick={() => setTab("scoring")}>Tune scoring</button>
          </div>
          <div className="tab-body" role="tabpanel">
            {tab === "scoring" && <ScoringPanel model={model} onChange={setModel} />}
            {tab === "player" && viewed && (
              <PlayerPanel
                player={viewed}
                slot={slot}
                pick={viewedPick}
                scoreParts={lineup.scores.get(viewed.id)!}
                isStarter={lineup.slotOf.get(viewed.id) === slot?.id}
                bench={slot ? lineup.bench[slot.id] : []}
                onSelectPlayer={(id) => selection && setSelection({ slotId: selection.slotId, playerId: id })}
                onClose={() => {
                  setSelection(null);
                  setTab("scoring");
                }}
              />
            )}
            {tab === "player" && !viewed && (
              <p className="muted empty-state">
                {selection ? "No eligible player in this class for that spot." : "Click any player on the field to see their stats."}
              </p>
            )}
          </div>
        </aside>
      </main>

      <footer className="muted small">
        Data: <a href="https://github.com/nflverse/nflverse-data">nflverse</a> (draft picks, rosters, season stats) and
        Pro Football Reference's Approximate Value. Season stats from 1999.
      </footer>
    </div>
  );
}
