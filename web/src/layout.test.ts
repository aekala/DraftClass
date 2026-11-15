import { describe, expect, it } from "vitest";
import { COMPACT, DESKTOP, FIELD_H, FIELD_W, overlaps, slotBoxes, type Box, type ModeGeometry } from "./formation";
import { SLOTS } from "./lib/lineup";

const describeBox = (b: Box) => `${b.slot}.${b.part}`;

/** Every overlapping pair, assuming every player has a crown, a HOF badge and a max-length name. */
export function collisions(g: ModeGeometry): string[] {
  const boxes = SLOTS.flatMap((s) => slotBoxes(s.id, g));
  const out: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      // The HOF pill is drawn over its own node's ring on purpose.
      if (a.slot === b.slot && [a.part, b.part].includes("hof") && [a.part, b.part].includes("node")) continue;
      if (overlaps(a, b)) out.push(`${describeBox(a)} × ${describeBox(b)}`);
    }
  }
  return out;
}

function outOfBounds(g: ModeGeometry): string[] {
  return SLOTS.flatMap((s) => slotBoxes(s.id, g))
    .filter((b) => b.x0 < 0 || b.y0 < 0 || b.x1 > FIELD_W || b.y1 > FIELD_H)
    .map(describeBox);
}

describe.each([
  ["desktop", DESKTOP],
  ["phone", COMPACT],
])("%s field layout", (_, g) => {
  it("has a position for every lineup slot", () => {
    for (const s of SLOTS) expect(g.positions[s.id], s.id).toBeDefined();
  });

  it("never lets crowns, names, badges or circles overlap", () => {
    expect(collisions(g)).toEqual([]);
  });

  it("keeps everything on the field", () => {
    expect(outOfBounds(g)).toEqual([]);
  });
});
