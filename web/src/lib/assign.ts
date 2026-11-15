/**
 * Maximum-weight assignment (Hungarian algorithm, O(n²·m)).
 *
 * weights[i][j] is the value of putting row i (a lineup slot) on column j (a player);
 * use `null` for "not allowed". Returns, for each row, the chosen column or -1 if the
 * row could not be filled with an allowed column. Each column is used at most once.
 *
 * It first fills as many rows as possible, then maximizes total weight among those
 * choices. That ordering is what we want: an empty slot is worse than any real player.
 */
export function assign(weights: (number | null)[][]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  // Pad with dummy columns so every row can be matched (m >= n).
  const realM = Math.max(0, ...weights.map((r) => r.length));
  const m = Math.max(realM, n);

  let maxW = 0;
  for (const row of weights) for (const w of row) if (w != null && w > maxW) maxW = w;
  // Any forbidden pair costs more than every allowed assignment combined.
  const FORBIDDEN = (maxW + 1) * (n + 1) * 2;
  const cost = (i: number, j: number) => {
    const w = j < weights[i].length ? weights[i][j] : null;
    return w == null ? FORBIDDEN : -w;
  };

  // 1-indexed potentials and matching, following the classic formulation.
  const u = new Float64Array(n + 1);
  const v = new Float64Array(m + 1);
  const p = new Int32Array(m + 1); // p[j] = row matched to column j
  const way = new Int32Array(m + 1);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(m + 1).fill(Infinity);
    const used = new Uint8Array(m + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost(i0 - 1, j - 1) - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const result = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j++) {
    const i = p[j] - 1;
    if (i < 0) continue;
    const col = j - 1;
    const allowed = col < weights[i].length && weights[i][col] != null;
    result[i] = allowed ? col : -1;
  }
  return result;
}
