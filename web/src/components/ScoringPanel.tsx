import { defaultModel, presets, type Model } from "../lib/scoring";
interface Props {
  model: Model;
  onChange: (m: Model) => void;
}

type NumKey = { [K in keyof Model]: Model[K] extends number ? K : never }[keyof Model];
type BoolKey = { [K in keyof Model]: Model[K] extends boolean ? K : never }[keyof Model];

function Slider({ label, value, max, step, onChange, disabled, suffix = "" }: {
  label: string; value: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean; suffix?: string;
}) {
  return (
    <label className={`slider${disabled ? " disabled" : ""}`}>
      <span>{label}</span>
      <input type="range" min={0} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))} />
      <output>{suffix === "×" ? `×${value}` : `+${value}`}</output>
    </label>
  );
}

function Switch({ label, checked, onChange, disabled, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string;
}) {
  return (
    <label className={`switch${disabled ? " disabled" : ""}`} title={hint}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden><span className="thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

export function ScoringPanel({ model, onChange }: Props) {
  const set = <K extends NumKey | BoolKey>(k: K, v: Model[K]) => onChange({ ...model, [k]: v });
  const active = presets.find((p) => JSON.stringify(p.model) === JSON.stringify(model))?.id;

  return (
    <div className="scoring-panel">
      <p className="muted">
        Every player starts from a <strong>base value</strong>: career Approximate Value (Pro Football Reference's
        all-position rating). Add or remove the extras below.
      </p>

      <div className="presets" role="group" aria-label="Presets">
        {presets.map((p) => (
          <button key={p.id} className={active === p.id ? "active" : ""} onClick={() => onChange(p.model)} title={p.hint}>
            {p.label}
          </button>
        ))}
      </div>

      <fieldset>
        <legend>Honors</legend>
        <Switch label="All-Pro selections" checked={model.allProOn} onChange={(v) => set("allProOn", v)} />
        <Slider label="Per All-Pro" value={model.allPro} max={15} step={0.5} disabled={!model.allProOn} onChange={(v) => set("allPro", v)} />
        <Switch label="Pro Bowl selections" checked={model.proBowlOn} onChange={(v) => set("proBowlOn", v)} />
        <Slider label="Per Pro Bowl" value={model.proBowl} max={6} step={0.5} disabled={!model.proBowlOn} onChange={(v) => set("proBowl", v)} />
      </fieldset>

      <fieldset>
        <legend>Super Bowls</legend>
        <Switch label="Count Super Bowls" checked={model.sbOn} onChange={(v) => set("sbOn", v)} />
        <Slider label="Per win" value={model.sbWin} max={15} step={0.5} disabled={!model.sbOn} onChange={(v) => set("sbWin", v)} />
        <Slider label="Per loss" value={model.sbLoss} max={10} step={0.5} disabled={!model.sbOn} onChange={(v) => set("sbLoss", v)} />
        <Switch label="Extra credit for the starting QB" checked={model.qbMultOn} disabled={!model.sbOn} onChange={(v) => set("qbMultOn", v)} />
        <Slider label="QB multiplier" value={model.qbMult} max={5} step={0.5} suffix="×" disabled={!model.sbOn || !model.qbMultOn} onChange={(v) => set("qbMult", v)} />
      </fieldset>

      <fieldset>
        <legend>Positions</legend>
        <Switch
          label="Allow close-fit positions"
          checked={model.flex}
          onChange={(v) => set("flex", v)}
          hint="e.g. a guard at center or a safety at corner, at a small penalty"
        />
        <p className="muted small">
          {model.flex
            ? "A guard can play center, a safety can play corner, an edge linebacker can play end. Each counts at 85–90% of their value."
            : "Exact positions only. Some slots may stay empty."}
        </p>
      </fieldset>

      <button className="reset" onClick={() => onChange(defaultModel)} disabled={active === "default"}>
        Reset to default
      </button>
    </div>
  );
}
