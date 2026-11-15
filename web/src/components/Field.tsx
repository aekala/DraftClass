import type { ReactNode } from "react";
import { FIELD_H, FIELD_W, LOS_Y, YARD } from "../formation";

/** Line of scrimmage sits on the offense's own 40. Yard lines are measured from the offense's goal line. */
const LOS_YARD = 40;
const yToScreen = (yd: number) => LOS_Y - (yd - LOS_YARD) * YARD;
// NFL hash marks are 70'9" from each sideline (23.58 yards).
const HASH_X = [23.58 * YARD, FIELD_W - 23.58 * YARD];

export function Field({ children, compact }: { children: ReactNode; compact: boolean }) {
  const top = LOS_YARD + LOS_Y / YARD;
  const bottom = LOS_YARD - (FIELD_H - LOS_Y) / YARD;
  const yards: number[] = [];
  for (let yd = Math.ceil(bottom); yd <= Math.floor(top); yd++) yards.push(yd);

  return (
    <svg
      className={`field${compact ? " compact" : ""}`}
      viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
      role="group"
      aria-label="Starting lineup on a football field. Offense at the bottom, defense at the top."
    >
      <rect width={FIELD_W} height={FIELD_H} className="turf" />
      {yards
        .filter((yd) => yd % 10 === 0)
        .map((yd) => (
          <rect key={`s${yd}`} x={0} y={yToScreen(yd + 5)} width={FIELD_W} height={5 * YARD} className="turf-stripe" />
        ))}
      {yards.map((yd) => {
        const y = yToScreen(yd);
        if (yd % 5 === 0) return <line key={yd} x1={0} x2={FIELD_W} y1={y} y2={y} className="yard-line" />;
        return (
          <g key={yd} className="hash">
            <line x1={4} x2={14} y1={y} y2={y} />
            <line x1={FIELD_W - 14} x2={FIELD_W - 4} y1={y} y2={y} />
            {HASH_X.map((x) => (
              <line key={x} x1={x - 5} x2={x + 5} y1={y} y2={y} />
            ))}
          </g>
        );
      })}
      {yards
        .filter((yd) => yd % 10 === 0 && yd > 0 && yd < 100)
        .map((yd) => {
          const label = String(Math.min(yd, 100 - yd));
          const y = yToScreen(yd);
          return (
            <g key={`n${yd}`} className="yard-number">
              <text x={44} y={y} transform={`rotate(90 44 ${y})`}>{label}</text>
              <text x={FIELD_W - 44} y={y} transform={`rotate(-90 ${FIELD_W - 44} ${y})`}>{label}</text>
            </g>
          );
        })}
      <line x1={0} x2={FIELD_W} y1={LOS_Y} y2={LOS_Y} className="los" />
      <text x={FIELD_W - 10} y={14} className="side-label" textAnchor="end">DEFENSE</text>
      <text x={FIELD_W - 10} y={FIELD_H - 8} className="side-label" textAnchor="end">OFFENSE</text>
      {children}
    </svg>
  );
}
