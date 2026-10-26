import { MAP_BOUNDS } from './data';

export interface Point { x: number; y: number }
export interface Circle extends Point { radius: number }
export interface Obstacle extends Circle { id: string }
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function segmentDistanceSquared(a: Point, b: Point, p: Point) {
  const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared)) : 0;
  return (a.x + t * dx - p.x) ** 2 + (a.y + t * dy - p.y) ** 2;
}
export function clearSegment(a: Point, b: Point, radius: number, obstacles: readonly Circle[]) {
  return obstacles.every(obstacle => segmentDistanceSquared(a, b, obstacle) >= (obstacle.radius + radius) ** 2 - 1e-7);
}

/** Sweep the whole body, not just the endpoint, so fast movement cannot tunnel. */
export function sweepMove(start: Point, delta: Point, radius: number, obstacles: readonly Circle[]): Point {
  const lengthSquared = delta.x ** 2 + delta.y ** 2;
  if (lengthSquared < 1e-12) return { x: start.x, y: start.y };
  let fraction = 1;
  for (const obstacle of obstacles) {
    const x = start.x - obstacle.x, y = start.y - obstacle.y;
    const clearance = radius + obstacle.radius + 0.02;
    const dot = x * delta.x + y * delta.y;
    if (dot >= 0) continue; // Tangential motion and retreat remain possible at contact.
    const c = x * x + y * y - clearance * clearance;
    const discriminant = dot * dot - lengthSquared * c;
    if (discriminant < 0) continue;
    const hit = (-dot - Math.sqrt(discriminant)) / lengthSquared;
    fraction = Math.min(fraction, Math.max(0, hit));
  }
  if (delta.x > 0) fraction = Math.min(fraction, (MAP_BOUNDS.right - radius - start.x) / delta.x);
  if (delta.x < 0) fraction = Math.min(fraction, (MAP_BOUNDS.left + radius - start.x) / delta.x);
  if (delta.y > 0) fraction = Math.min(fraction, (MAP_BOUNDS.bottom - radius - start.y) / delta.y);
  if (delta.y < 0) fraction = Math.min(fraction, (MAP_BOUNDS.top + radius - start.y) / delta.y);
  fraction = Math.max(0, fraction - 1e-6);
  return { x: start.x + delta.x * fraction, y: start.y + delta.y * fraction };
}

interface NavPoint extends Point { staticIndex?: number }
interface Geometry { points: NavPoint[]; visibility: Map<number, boolean> }
interface Graph { points: NavPoint[]; geometry: Geometry; visibility: Map<number, boolean> }
interface Candidate { index: number; cost: number; score: number }

class MinHeap {
  private items: Candidate[] = [];
  get length() { return this.items.length; }
  push(item: Candidate) {
    let index = this.items.length; this.items.push(item);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].score <= item.score) break;
      this.items[index] = this.items[parent]; index = parent;
    }
    this.items[index] = item;
  }
  pop(): Candidate {
    const first = this.items[0], last = this.items.pop()!;
    if (this.items.length) {
      let index = 0;
      while (index * 2 + 1 < this.items.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.items.length && this.items[child + 1].score < this.items[child].score) child++;
        if (last.score <= this.items[child].score) break;
        this.items[index] = this.items[child]; index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

/** Continuous body-aware navigation. Static geometry survives tower changes.
 * A* checks visibility only when needed; search() yields bounded work slices
 * instead of constructing every possible edge on the browser's main thread. */
export class Navigator {
  private graphs = new Map<number, Graph>();
  private geometry = new Map<number, Geometry>();
  private dynamic: readonly Obstacle[] = [];
  obstacles: readonly Obstacle[];
  constructor(private readonly terrain: readonly Obstacle[]) { this.obstacles = terrain; }
  setDynamicObstacles(obstacles: readonly Obstacle[]) {
    this.dynamic = obstacles;
    this.obstacles = [...this.terrain, ...obstacles];
    // Only layout-dependent visibility expires. Rock samples and their mutual
    // visibility remain valid for every subsequent build, sale and destruction.
    this.graphs.clear();
  }
  private approach(from: Point, target: Obstacle, radius: number): Point {
    const angle = Math.atan2(from.y - target.y, from.x - target.x);
    const reach = target.radius + radius + 0.8;
    return { x: target.x + Math.cos(angle) * reach, y: target.y + Math.sin(angle) * reach };
  }
  private free(point: Point, radius: number, obstacles = this.obstacles) {
    return point.x >= MAP_BOUNDS.left + radius && point.y >= MAP_BOUNDS.top + radius && point.x <= MAP_BOUNDS.right - radius && point.y <= MAP_BOUNDS.bottom - radius
      && clearSegment(point, point, radius, obstacles);
  }
  directRoute(start: Point, radius: number, targetId = 'base'): Point[] | null {
    const target = this.obstacles.find(obstacle => obstacle.id === targetId);
    if (!target) return null;
    const end = this.approach(start, target, radius);
    return this.free(end, radius) && clearSegment(start, end, radius, this.obstacles) ? [end] : null;
  }
  private samples(obstacles: readonly Obstacle[], radius: number, blockers = this.obstacles): NavPoint[] {
    const points: Point[] = [], sides = 32;
    for (const obstacle of obstacles) {
      // Circumscribed polygon: even the chords clear the actual round body.
      const expanded = (obstacle.radius + radius + 0.35) / Math.cos(Math.PI / sides);
      for (let i = 0; i < sides; i++) {
        const angle = i * Math.PI * 2 / sides;
        const point = { x: obstacle.x + Math.cos(angle) * expanded, y: obstacle.y + Math.sin(angle) * expanded };
        if (this.free(point, radius, blockers)) points.push(point);
      }
    }
    return points;
  }
  private gaps(obstacles: readonly Obstacle[], radius: number, skipStaticPairs = false): Point[] {
    const points: Point[] = [];
    // Preserve narrow, off-angle gaps which uniform perimeter samples could
    // miss. These points depend on actual obstacle geometry, not map spacing.
    for (let i = 0; i < obstacles.length; i++) for (let j = 0; j < i; j++) {
      if (skipStaticPairs && i < this.terrain.length) continue;
      const a = obstacles[i], b = obstacles[j], separation = distance(a, b);
      const gap = separation - a.radius - b.radius - radius * 2;
      if (gap <= 0.05 || gap > radius * 4 + 10) continue;
      const fraction = (a.radius + radius + gap / 2) / separation;
      const point = { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
      if (this.free(point, radius, obstacles)) points.push(point);
    }
    return points;
  }
  private graph(radius: number): Graph {
    const existing = this.graphs.get(radius);
    if (existing) return existing;
    let geometry = this.geometry.get(radius);
    if (!geometry) {
      const points = [...this.samples(this.terrain, radius, this.terrain), ...this.gaps(this.terrain, radius)]
        .map((point, staticIndex) => ({ ...point, staticIndex }));
      geometry = { points, visibility: new Map() }; this.geometry.set(radius, geometry);
    }
    const points = [
      ...geometry.points.filter(point => this.free(point, radius, this.dynamic)),
      ...this.samples(this.dynamic, radius), ...this.gaps(this.obstacles, radius, true),
    ];
    const graph = { points, geometry, visibility: new Map<number, boolean>() };
    this.graphs.set(radius, graph); return graph;
  }
  private visible(graph: Graph, a: number, b: number, radius: number) {
    const key = Math.min(a, b) * graph.points.length + Math.max(a, b);
    const cached = graph.visibility.get(key);
    if (cached !== undefined) return cached;
    const from = graph.points[a], to = graph.points[b];
    let clear: boolean;
    if (from.staticIndex !== undefined && to.staticIndex !== undefined) {
      const staticKey = Math.min(from.staticIndex, to.staticIndex) * graph.geometry.points.length + Math.max(from.staticIndex, to.staticIndex);
      let terrainClear = graph.geometry.visibility.get(staticKey);
      if (terrainClear === undefined) {
        terrainClear = clearSegment(from, to, radius, this.terrain);
        graph.geometry.visibility.set(staticKey, terrainClear);
      }
      clear = terrainClear && clearSegment(from, to, radius, this.dynamic);
    } else clear = clearSegment(from, to, radius, this.obstacles);
    graph.visibility.set(key, clear); return clear;
  }
  *search(start: Point, radius: number, targetId = 'base'): Generator<void, Point[] | null> {
    const target = this.obstacles.find(obstacle => obstacle.id === targetId);
    if (!target) return null;
    const direct = this.directRoute(start, radius, targetId);
    if (direct) return direct;
    yield;
    const graph = this.graph(radius), points = graph.points;
    const costs = new Float64Array(points.length).fill(Infinity), previous = new Int32Array(points.length).fill(-1);
    const visited = new Uint8Array(points.length), queue = new MinHeap();
    const heuristic = (point: Point) => Math.max(0, distance(point, target) - target.radius - radius - 0.8);
    queue.push({ index: -1, cost: 0, score: heuristic(start) });
    yield;
    let work = 0;
    while (queue.length) {
      if (++work % 32 === 0) yield;
      const current = queue.pop(), index = current.index;
      if (index >= 0 && (visited[index] || current.cost !== costs[index])) continue;
      if (index >= 0) visited[index] = 1;
      const from = index < 0 ? start : points[index];
      const end = this.approach(from, target, radius);
      if (this.free(end, radius) && clearSegment(from, end, radius, this.obstacles)) {
        const path: Point[] = [end];
        for (let i = index; i >= 0; i = previous[i]) path.push(points[i]);
        path.reverse();
        const smooth: Point[] = []; let origin = start, first = 0;
        while (first < path.length) {
          let farthest = path.length - 1;
          while (farthest > first && !clearSegment(origin, path[farthest], radius, this.obstacles)) {
            farthest--; if (++work % 32 === 0) yield;
          }
          smooth.push(path[farthest]); origin = path[farthest]; first = farthest + 1;
        }
        return smooth;
      }
      for (let i = 0; i < points.length; i++) {
        if (++work % 32 === 0) yield;
        if (visited[i]) continue;
        const cost = current.cost + distance(from, points[i]);
        if (cost >= costs[i]) continue;
        if (!(index < 0 ? clearSegment(from, points[i], radius, this.obstacles) : this.visible(graph, index, i, radius))) continue;
        costs[i] = cost; previous[i] = index;
        queue.push({ index: i, cost, score: cost + heuristic(points[i]) });
      }
      yield;
    }
    return null;
  }
  // Synchronous convenience for tools/tests. The game advances search() using
  // a shared per-frame budget, including across all fixed simulation substeps.
  route(start: Point, radius: number, targetId = 'base'): Point[] | null {
    const search = this.search(start, radius, targetId);
    let result = search.next();
    while (!result.done) result = search.next();
    return result.value;
  }
}
