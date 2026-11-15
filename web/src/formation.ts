/**
 * Field geometry, in SVG viewBox units. 12 units = 1 yard, so the 640-wide field is
 * a full 53⅓-yard sideline-to-sideline view. Offense is below the line of scrimmage
 * (moving up the screen), defense above it.
 *
 * Every node can carry a crown (Super Bowl wins) above it and a name below it, so
 * positions are spaced for the worst case: every player wearing a crown and every
 * name at the maximum length. layout.test.ts checks this for both screen sizes.
 */
export const FIELD_W = 640;
export const FIELD_H = 820;
export const YARD = 12;
export const LOS_Y = 420;

export const NODE_R = 23;
export const RING_R = NODE_R + 4;
/** Ring radius plus half its stroke: the node's visual edge. */
export const OUTER_R = RING_R + 2;

export interface ModeGeometry {
  /** Name font size (viewBox units) and the longest name allowed before it is cut with "…". */
  nameFont: number;
  maxChars: number;
  /** Widest a name can render at maxChars, measured across every drafted player since 1980. */
  maxNameWidth: number;
  /** Text box relative to the baseline (measured), plus the outline halo. */
  nameAscent: number;
  nameDescent: number;
  nameHalo: number;
  /** Baselines for names below the node; "low" names sit one line further down. */
  nameBelow: number;
  nameLow: number;
  crownScale: number;
  /** Slots whose name drops to the low line so it can't touch its neighbour's. */
  lowNames: ReadonlySet<string>;
  positions: Record<string, { x: number; y: number }>;
}

/** Hall of Fame pill: centre and half-size, kept inside the node's outer edge at top-left. */
export const HOF = { x: -16, y: -22, halfWidth: 13, halfHeight: 7 };

/** Crown shape in its own units, before scaling. Its bottom edge sits at y = CROWN.bottom. */
export const CROWN = { halfWidth: 13.6, top: -10.6, bottom: 5.5 };
const CROWN_GAP = 3;

/** Crown's vertical offset from the node centre, leaving CROWN_GAP above the ring. */
export function crownY(g: ModeGeometry): number {
  return -OUTER_R - CROWN_GAP - CROWN.bottom * g.crownScale;
}

const DESKTOP_POSITIONS = {
  // Offense: 11 personnel, shotgun. TE on the right.
  WR1: { x: 54, y: 469 },
  LT: { x: 196, y: 469 },
  LG: { x: 258, y: 469 },
  C: { x: 320, y: 469 },
  RG: { x: 382, y: 469 },
  RT: { x: 444, y: 469 },
  TE: { x: 518, y: 478 },
  WR3: { x: 128, y: 552 },
  WR2: { x: 596, y: 520 },
  QB: { x: 320, y: 569 },
  RB: { x: 398, y: 618 },
  // Defense: 4-3 over. Strong side (SLB, SS) toward the TE.
  LDE: { x: 155, y: 371 },
  LDT: { x: 265, y: 371 },
  RDT: { x: 375, y: 371 },
  RDE: { x: 485, y: 371 },
  CB1: { x: 54, y: 345 },
  CB2: { x: 596, y: 371 },
  WLB: { x: 210, y: 273 },
  MLB: { x: 320, y: 263 },
  SLB: { x: 466, y: 273 },
  FS: { x: 236, y: 165 },
  SS: { x: 420, y: 172 },
};

/** Phones: bigger text and crowns need more room between rows. */
const COMPACT_POSITIONS = {
  WR1: { x: 56, y: 484 },
  LT: { x: 196, y: 484 },
  LG: { x: 258, y: 484 },
  C: { x: 320, y: 484 },
  RG: { x: 382, y: 484 },
  RT: { x: 444, y: 484 },
  TE: { x: 530, y: 500 },
  WR3: { x: 130, y: 604 },
  WR2: { x: 584, y: 654 },
  QB: { x: 320, y: 656 },
  RB: { x: 430, y: 702 },
  LDE: { x: 155, y: 362 },
  LDT: { x: 265, y: 362 },
  RDT: { x: 375, y: 362 },
  RDE: { x: 485, y: 362 },
  CB1: { x: 56, y: 330 },
  CB2: { x: 584, y: 330 },
  WLB: { x: 208, y: 241 },
  MLB: { x: 320, y: 230 },
  SLB: { x: 464, y: 241 },
  FS: { x: 230, y: 108 },
  SS: { x: 410, y: 116 },
};

export const DESKTOP: ModeGeometry = {
  nameFont: 12,
  maxChars: 10,
  maxNameWidth: 83,
  nameAscent: 12.4,
  nameDescent: 2.2,
  nameHalo: 1.5,
  nameBelow: 45,
  nameLow: 64,
  crownScale: 1,
  lowNames: new Set(["LG", "RG", "TE"]),
  positions: DESKTOP_POSITIONS,
};

export const COMPACT: ModeGeometry = {
  nameFont: 19,
  maxChars: 7,
  maxNameWidth: 99,
  nameAscent: 19.6,
  nameDescent: 3.5,
  nameHalo: 2,
  nameBelow: 54,
  nameLow: 84,
  crownScale: 1.6,
  lowNames: new Set(["LG", "RG", "TE"]),
  positions: COMPACT_POSITIONS,
};

export function geometry(compact: boolean): ModeGeometry {
  return compact ? COMPACT : DESKTOP;
}

export function nameBaseline(g: ModeGeometry, slotId: string): number {
  return g.lowNames.has(slotId) ? g.nameLow : g.nameBelow;
}

function lastName(name: string): string {
  const parts = name.replace(/\b(Jr\.?|Sr\.?|II|III|IV)$/i, "").trim().split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

/** Last name, cut to the mode's maximum length with an ellipsis. */
export function displayName(name: string, g: ModeGeometry): string {
  const last = lastName(name);
  return last.length > g.maxChars ? `${last.slice(0, g.maxChars - 1)}…` : last;
}

// ---------------------------------------------------------------- collision boxes

export interface Box {
  slot: string;
  part: "node" | "crown" | "name" | "hof";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Worst-case boxes for one slot: crown and Hall of Fame badge present, longest name. */
export function slotBoxes(slot: string, g: ModeGeometry): Box[] {
  const { x, y } = g.positions[slot];
  const cy = y + crownY(g);
  const s = g.crownScale;
  const half = g.maxNameWidth / 2 + g.nameHalo;
  const b = y + nameBaseline(g, slot);
  return [
    { slot, part: "node", x0: x - OUTER_R, y0: y - OUTER_R, x1: x + OUTER_R, y1: y + OUTER_R },
    { slot, part: "crown", x0: x - CROWN.halfWidth * s, y0: cy + CROWN.top * s, x1: x + CROWN.halfWidth * s, y1: cy + CROWN.bottom * s },
    { slot, part: "name", x0: x - half, y0: b - g.nameAscent - g.nameHalo, x1: x + half, y1: b + g.nameDescent + g.nameHalo },
    // HOF pill sits over its own node's ring by design.
    { slot, part: "hof", x0: x + HOF.x - HOF.halfWidth, y0: y + HOF.y - HOF.halfHeight, x1: x + HOF.x + HOF.halfWidth, y1: y + HOF.y + HOF.halfHeight },
  ];
}

export function overlaps(a: Box, b: Box, margin = 1): boolean {
  return a.x0 < b.x1 + margin && b.x0 < a.x1 + margin && a.y0 < b.y1 + margin && b.y0 < a.y1 + margin;
}
