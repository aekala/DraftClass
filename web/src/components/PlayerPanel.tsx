import type { Pick, Slot } from "../lib/lineup";
import type { ScoreParts } from "../lib/scoring";
import { portraitUrl } from "../lib/portrait";
import type { Player, Pos, StatLine } from "../types";

type Group = "QB" | "RB" | "REC" | "OL" | "FRONT" | "DB";

const GROUP: Record<Pos, Group> = {
  QB: "QB", RB: "RB", FB: "RB", WR: "REC", TE: "REC",
  OT: "OL", G: "OL", C: "OL", OL: "OL",
  DE: "FRONT", DT: "FRONT", DL: "FRONT", OLB: "FRONT", ILB: "FRONT", LB: "FRONT",
  CB: "DB", S: "DB", DB: "DB",
};

type Col = { key: string; label: string; get: (s: StatLine) => number | string | undefined };
const f = (key: string, label: string): Col => ({ key, label, get: (s) => s[key] });
const tackles: Col = {
  key: "tkl",
  label: "Tkl",
  get: (s) => {
    const solo = Number(s.soloTkl ?? 0);
    const ast = Number(s.astTkl ?? 0);
    return solo + ast || undefined;
  },
};

const SEASON_COLS: Record<Group, Col[]> = {
  QB: [f("cmp", "Cmp"), f("att", "Att"), f("passYds", "Yds"), f("passTd", "TD"), f("int", "Int"), f("rushYds", "Rush"), f("passEpa", "EPA")],
  RB: [f("car", "Car"), f("rushYds", "Yds"), f("rushTd", "TD"), f("rec", "Rec"), f("recYds", "RecYds"), f("recTd", "RecTD")],
  REC: [f("tgt", "Tgt"), f("rec", "Rec"), f("recYds", "Yds"), f("recTd", "TD")],
  OL: [],
  FRONT: [tackles, f("sacks", "Sk"), f("tfl", "TFL"), f("qbHits", "QBH"), f("ff", "FF"), f("defInt", "Int")],
  DB: [tackles, f("defInt", "Int"), f("pd", "PD"), f("ff", "FF"), f("sacks", "Sk")],
};

const CAREER_LABELS: Record<string, string> = {
  passYds: "Pass yds", passTd: "Pass TD", int: "INT thrown", rushYds: "Rush yds", rushTd: "Rush TD",
  rec: "Receptions", recYds: "Rec yds", recTd: "Rec TD", soloTkl: "Solo tackles", defInt: "Interceptions", sacks: "Sacks",
};
const CAREER_KEYS: Record<Group, string[]> = {
  QB: ["passYds", "passTd", "int", "rushYds", "rushTd"],
  RB: ["rushYds", "rushTd", "rec", "recYds", "recTd"],
  REC: ["rec", "recYds", "recTd", "rushYds"],
  OL: [],
  FRONT: ["soloTkl", "sacks", "defInt"],
  DB: ["soloTkl", "defInt", "sacks"],
};

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

interface Props {
  player: Player;
  slot: Slot | null;
  /** The player's pick in the slot being viewed (for fit), if they are eligible there. */
  pick: Pick | null;
  scoreParts: ScoreParts;
  isStarter: boolean;
  bench: Pick[];
  onSelectPlayer: (id: string) => void;
  onClose: () => void;
}

export function PlayerPanel({ player: p, slot, pick, scoreParts: s, isStarter, bench, onSelectPlayer, onClose }: Props) {
  const group = GROUP[p.pos];
  const cols = SEASON_COLS[group];
  const wins = p.sb.filter((x) => x.won);
  const losses = p.sb.filter((x) => !x.won);
  const fit = pick?.fit ?? 1;
  const careerKeys = CAREER_KEYS[group].filter((k) => p.career[k]);
  const initials = p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <article className="player-panel" aria-label={`${p.name} details`}>
      <header className="pp-head">
        {p.headshot ? (
          <img className="pp-photo" src={portraitUrl(p.headshot, 160)} alt="" loading="lazy" />
        ) : (
          <div className="pp-photo pp-initials" aria-hidden>{initials}</div>
        )}
        <div className="pp-id">
          <h2>{p.name}</h2>
          <p className="muted">
            {p.pos === p.draftPos ? p.pos : `${p.pos} (drafted as ${p.draftPos})`}
            {p.college && ` · ${p.college}`}
          </p>
          <p className="muted">
            Round {p.round}, {ordinal(p.pick)} overall · {p.team} · {p.games} games · last played {p.lastSeason}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close player details">×</button>
      </header>

      <div className="pp-badges">
        {!isStarter && slot && <span className="chip">Backup at {slot.label}</span>}
        {p.hof && <span className="chip gold">Hall of Fame</span>}
        {p.allPro > 0 && <span className="chip">{p.allPro}× All-Pro</span>}
        {p.proBowls > 0 && <span className="chip">{p.proBowls}× Pro Bowl</span>}
        {wins.length > 0 && <span className="chip gold" title={wins.map((w) => `${w.season} ${w.team}${w.qb ? " (starting QB)" : ""}`).join(", ")}>{wins.length}× Super Bowl champ</span>}
        {losses.length > 0 && <span className="chip" title={losses.map((w) => `${w.season} ${w.team}`).join(", ")}>{losses.length}× Super Bowl runner-up</span>}
      </div>

      <section>
        <h3>Score breakdown</h3>
        <table className="breakdown">
          <tbody>
            <tr><td>Career Approximate Value</td><td>{fmt(s.base)}</td></tr>
            <tr><td>All-Pro bonus</td><td>{fmt(s.allPro)}</td></tr>
            <tr><td>Pro Bowl bonus</td><td>{fmt(s.proBowl)}</td></tr>
            <tr><td>Super Bowl bonus</td><td>{fmt(s.superBowl)}</td></tr>
            {fit < 1 && <tr><td>Out of position at {slot?.label} (×{fit})</td><td>−{fmt(s.total * (1 - fit))}</td></tr>}
            <tr className="total"><td>Lineup value</td><td>{fmt(s.total * fit)}</td></tr>
          </tbody>
        </table>
      </section>

      {careerKeys.length > 0 && (
        <section>
          <h3>Career</h3>
          <dl className="career">
            {careerKeys.map((k) => (
              <div key={k}><dt>{CAREER_LABELS[k]}</dt><dd>{fmt(p.career[k])}</dd></div>
            ))}
            <div><dt>Seasons started</dt><dd>{p.seasonsStarted}</dd></div>
          </dl>
        </section>
      )}

      {p.seasons.length > 0 && cols.length > 0 && (
        <section>
          <h3>By season</h3>
          <div className="table-scroll">
            <table className="seasons">
              <thead>
                <tr><th>Yr</th><th>Tm</th><th>G</th>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {p.seasons.map((row) => (
                  <tr key={String(row.season) + row.team}>
                    <td>{row.season}</td><td>{row.team}</td><td>{row.g}</td>
                    {cols.map((c) => {
                      const v = c.get(row);
                      return <td key={c.key}>{v == null ? "" : typeof v === "number" ? fmt(v) : v}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {group === "OL" && (
        <p className="note">Linemen don't get box-score stats. Games, seasons started, and Approximate Value are the best public measures.</p>
      )}
      {group !== "OL" && p.seasons.length === 0 && (
        <p className="note">Season-by-season stats are only available from 1999 on.</p>
      )}

      {slot && bench.length > 0 && (
        <section>
          <h3>Next best at {slot.label}</h3>
          <ul className="bench">
            {bench.map((b) => (
              <li key={b.player.id}>
                <button onClick={() => onSelectPlayer(b.player.id)}>
                  <span>{b.player.name} <span className="muted">{b.player.pos}</span></span>
                  <span className="num">{fmt(b.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
