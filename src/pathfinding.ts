import { BASE, COLS, ROWS, TERRAIN, inside, key } from './data';

const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export function neighbors(index: number) {
  const col = index % COLS, row = Math.floor(index / COLS);
  return DIRECTIONS.filter(([dc, dr]) => inside(col + dc, row + dr)).map(([dc, dr]) => key(col + dc, row + dr));
}

/** Reverse cost field: ordinary routing never crosses a tower. Breach routing
 * is only used for disconnected enemies and prefers destroying fewer towers. */
export function distanceField(occupied: Set<number>, breach = false): Float64Array {
  const distances = new Float64Array(COLS * ROWS).fill(Infinity);
  const visited = new Uint8Array(COLS * ROWS);
  distances[key(BASE.col, BASE.row)] = 0;
  for (let step = 0; step < distances.length; step++) {
    let current = -1, best = Infinity;
    for (let i = 0; i < distances.length; i++) {
      if (!visited[i] && distances[i] < best) { current = i; best = distances[i]; }
    }
    if (current < 0) break;
    visited[current] = 1;
    // In reverse traversal the entry cost belongs to the current tile.
    const cost = occupied.has(current) ? 45 : 1;
    for (const next of neighbors(current)) {
      if (TERRAIN.has(next) || (!breach && occupied.has(next))) continue;
      if (best + cost < distances[next]) distances[next] = best + cost;
    }
  }
  return distances;
}

export function nextCell(index: number, field: Float64Array, occupied: Set<number>, breach: boolean) {
  let result = -1, score = Infinity;
  for (const next of neighbors(index)) {
    if (TERRAIN.has(next) || (!breach && occupied.has(next))) continue;
    const value = field[next] + (occupied.has(next) ? 45 : 1);
    if (value < score) { score = value; result = next; }
  }
  return result;
}
