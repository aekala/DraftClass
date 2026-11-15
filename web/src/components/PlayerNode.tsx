import { useId, useState, type KeyboardEvent } from "react";
import { crownY, displayName, HOF, nameBaseline, NODE_R, RING_R, type ModeGeometry } from "../formation";
import type { Pick, Side } from "../lib/lineup";
import { portraitUrl } from "../lib/portrait";

interface Props {
  slotId: string;
  label: string;
  side: Side;
  pick: Pick | null;
  /** Best value in the lineup, so the score ring is relative to this class. */
  maxValue: number;
  selected: boolean;
  onSelect: () => void;
  /** Positions, text sizes and crown scale for the current screen size. */
  geometry: ModeGeometry;
}

const CIRC = 2 * Math.PI * RING_R;

/** Gold crown with the number of Super Bowl wins on its band. Shape matches CROWN in formation.ts. */
function Crown({ wins, y, scale }: { wins: number; y: number; scale: number }) {
  return (
    <g className="crown" transform={`translate(0 ${y}) scale(${scale})`} aria-hidden>
      <path d="M-12 5 L-12 -5 L-6 0 L0 -8 L6 0 L12 -5 L12 5 Z" />
      <circle cx={-12} cy={-5.5} r={1.6} />
      <circle cx={0} cy={-8.5} r={1.6} />
      <circle cx={12} cy={-5.5} r={1.6} />
      <text y={2.7}>{wins}</text>
    </g>
  );
}

/**
 * The player's face clipped to the node's disc, with a side-coloured edge so offense and
 * defense stay easy to tell apart. Falls back to the position label if the image fails.
 */
function Face({ url, label }: { url: string | null; label: string }) {
  const clipId = useId();
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <text className="node-pos" dy="0.35em">{label}</text>;
  return (
    <>
      <clipPath id={clipId}>
        <circle r={NODE_R} />
      </clipPath>
      <image
        className="node-portrait"
        href={portraitUrl(url, 128)}
        x={-NODE_R}
        y={-NODE_R}
        width={NODE_R * 2}
        height={NODE_R * 2}
        preserveAspectRatio="xMidYMin slice"
        clipPath={`url(#${clipId})`}
        onError={() => setFailed(true)}
      />
      <circle className="node-portrait-edge" r={NODE_R} />
    </>
  );
}

export function PlayerNode({ slotId, label, side, pick, maxValue, selected, onSelect, geometry: g }: Props) {
  const { x, y } = g.positions[slotId];
  const nameY = nameBaseline(g, slotId);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  if (!pick) {
    return (
      <g className="node empty" transform={`translate(${x} ${y})`} aria-label={`${label}: no eligible player in this class`}>
        <circle r={NODE_R} />
        <text className="node-pos" dy="0.35em">{label}</text>
        <text className="node-name" y={nameY}>—</text>
      </g>
    );
  }

  const { player, value } = pick;
  const frac = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  const wins = player.sb.filter((s) => s.won).length;
  const honors = [player.hof && "Hall of Fame", wins > 0 && `${wins} Super Bowl win${wins > 1 ? "s" : ""}`].filter(Boolean);

  return (
    <g
      className={`node ${side}${selected ? " selected" : ""}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${label}: ${player.name}, score ${value.toFixed(1)}${honors.length ? `, ${honors.join(", ")}` : ""}`}
      onClick={onSelect}
      onKeyDown={onKey}
    >
      <g className="node-body" key={player.id}>
        <circle className="node-ring-bg" r={RING_R} />
        <circle
          className="node-ring"
          r={RING_R}
          strokeDasharray={`${frac * CIRC} ${CIRC}`}
          transform="rotate(-90)"
        />
        <circle className="node-disc" r={NODE_R} />
        <Face url={player.headshot} label={label} />
        {player.hof && (
          <g transform={`translate(${HOF.x} ${HOF.y})`}>
            <rect className="badge-hof" x={-HOF.halfWidth} y={-HOF.halfHeight} width={HOF.halfWidth * 2} height={HOF.halfHeight * 2} rx={HOF.halfHeight} />
            <text className="badge-text" dy="0.35em">HOF</text>
          </g>
        )}
        {wins > 0 && <Crown wins={wins} y={crownY(g)} scale={g.crownScale} />}
        <text className="node-name" y={nameY}>{displayName(player.name, g)}</text>
      </g>
    </g>
  );
}
