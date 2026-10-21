import type { CandidateEdge, ContourCandidates, PixelMask, Point, RawContours, RawEdge } from '../types/contours.ts';

const finiteUnit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const point = (v: unknown): v is Point => Array.isArray(v) && v.length === 2 && v.every(finiteUnit);
const distance = (a: Point, b: Point, w: number, h: number) => Math.hypot((a[0] - b[0]) * w, (a[1] - b[1]) * h);
export function validateRawContours(value: RawContours): void {
  if (!value || !Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width < 1 || value.height < 1 || Math.max(value.width, value.height) > 1280 || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 || !/^[a-f0-9]{64}$/.test(value.photoSha256) || !Array.isArray(value.edges) || value.edges.length > 96) throw new Error('本地轮廓数据无效。');
  let count = 0;
  for (const edge of value.edges) {
    if (!edge || typeof edge.closed !== 'boolean' || !Array.isArray(edge.points) || edge.points.length < 2 || edge.points.length > 16_000 || !edge.points.every(point)) throw new Error('本地轮廓坐标无效。');
    count += edge.points.length;
  }
  if (count > 60_000) throw new Error('本地轮廓数据过长。');
}
function projectionDistance(p: Point, a: Point, b: Point, w: number, h: number): number {
  const dx = (b[0] - a[0]) * w, dy = (b[1] - a[1]) * h;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * w * dx + (p[1] - a[1]) * h * dy) / (dx * dx + dy * dy || 1)));
  return distance(p, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], w, h);
}
/** Iterative RDP: error is measured in image pixels, never CSS pixels. */
export function simplify(points: Point[], width: number, height: number, tolerance = .8): Point[] {
  if (points.length <= 2) return points.map(p => [...p]);
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!; let farthest = -1, maximum = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = projectionDistance(points[i], points[first], points[last], width, height);
      if (d > maximum) { maximum = d; farthest = i; }
    }
    if (farthest >= 0) { keep[farthest] = 1; stack.push([first, farthest], [farthest, last]); }
  }
  return points.filter((_, i) => keep[i]).map(p => [...p]);
}
function bounds(points: Point[]) {
  let left = 1, top = 1, right = 0, bottom = 0;
  for (const [x, y] of points) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  return { x: left, y: top, width: right - left, height: bottom - top };
}
function length(points: Point[], w: number, h: number) { let n = 0; for (let i = 1; i < points.length; i++) n += distance(points[i - 1], points[i], w, h); return n; }
function inside(p: Point, mask: PixelMask, margin: number): boolean {
  const x = Math.min(mask.width - 1, Math.floor(p[0] * mask.width)), y = Math.min(mask.height - 1, Math.floor(p[1] * mask.height));
  for (let dy = -margin; dy <= margin; dy++) for (let dx = -margin; dx <= margin; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= mask.width || ny >= mask.height || mask.pixels[ny * mask.width + nx] < 192) return false;
  }
  return true;
}
function segmentInside(a: Point, b: Point, mask: PixelMask, margin: number) {
  const steps = Math.max(1, Math.ceil(distance(a, b, mask.width, mask.height)));
  for (let i = 0; i <= steps; i++) if (!inside([a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps], mask, margin)) return false;
  return true;
}
function splitByMask(edge: RawEdge, mask?: PixelMask): RawEdge[] {
  if (!mask) return [edge];
  const points = edge.closed && distance(edge.points[0], edge.points.at(-1)!, mask.width, mask.height) > .01 ? [...edge.points, edge.points[0]] : edge.points;
  const pieces: Point[][] = []; let current: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    if (inside(points[i], mask, 1)) {
      if (current.length && !segmentInside(current[current.length - 1], points[i], mask, 1)) { if (current.length > 1) pieces.push(current); current = []; }
      current.push(points[i]);
    } else { if (current.length > 1) pieces.push(current); current = []; }
  }
  if (current.length > 1) pieces.push(current);
  // Rejoin an uninterrupted seam on a closed contour, never across a hole.
  if (edge.closed && pieces.length > 1 && distance(pieces[0][0], pieces[pieces.length - 1].at(-1)!, mask.width, mask.height) < .01) {
    const tail = pieces.pop()!; pieces[0] = [...tail, ...pieces[0].slice(1)];
  }
  return pieces.map(p => ({ points: p, closed: edge.closed && pieces.length === 1 && distance(p[0], p.at(-1)!, mask.width, mask.height) < .01 }));
}
function sampleIndices(points: Point[], w: number, h: number, closed: boolean): number[] {
  const lengths = [0]; for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i], w, h));
  const result: number[] = [], count = Math.min(8, points.length), total = lengths.at(-1)!;
  for (let i = 0; i < count; i++) {
    const target = total * i / (closed ? count : count - 1);
    let nearest = 0; for (let j = 1; j < lengths.length; j++) if (Math.abs(lengths[j] - target) < Math.abs(lengths[nearest] - target)) nearest = j;
    if (!result.includes(nearest)) result.push(nearest);
  }
  if (!closed && result.at(-1) !== points.length - 1) result.push(points.length - 1);
  return result;
}
function averageGap(a: CandidateEdge, b: CandidateEdge, w: number, h: number): number {
  let sum = 0, count = 0;
  for (const index of a.nodes) {
    let nearest = Infinity;
    for (let j = 1; j < b.points.length; j++) nearest = Math.min(nearest, projectionDistance(a.points[index], b.points[j - 1], b.points[j], w, h));
    sum += nearest; count++;
  }
  return sum / count;
}
function duplicate(a: CandidateEdge, b: CandidateEdge, w: number, h: number): boolean {
  if (a.closed !== b.closed || Math.min(a.lengthPx, b.lengthPx) / Math.max(a.lengthPx, b.lengthPx) < .9) return false;
  if (Math.abs(a.bounds.x - b.bounds.x) * w > 2 || Math.abs(a.bounds.y - b.bounds.y) * h > 2 || Math.abs(a.bounds.width - b.bounds.width) * w > 3 || Math.abs(a.bounds.height - b.bounds.height) * h > 3) return false;
  return averageGap(a, b, w, h) <= 1.2 && averageGap(b, a, w, h) <= 1.2;
}
export function contourCandidates(raw: RawContours, mask?: PixelMask): ContourCandidates {
  validateRawContours(raw); const { width: w, height: h } = raw;
  if (mask && (mask.width !== w || mask.height !== h || mask.pixels.length !== w * h)) throw new Error('照片与精细选区尺寸不一致。');
  // Rectangular crops also have synthetic frame edges. Treat their one-pixel border as excluded.
  const permitted = mask ?? { width: w, height: h, pixels: new Uint8Array(w * h).fill(255) };
  const found: CandidateEdge[] = [];
  for (const edge of raw.edges) for (const piece of splitByMask(edge, permitted)) {
    let source = piece.points.filter((p, i, all) => i === 0 || distance(p, all[i - 1], w, h) > .01);
    if (source.length < 2) continue;
    if (piece.closed) {
      if (distance(source[0], source.at(-1)!, w, h) > .01) source = [...source, source[0]];
      else source[source.length - 1] = source[0];
    }
    const reduced = simplify(source, w, h);
    // Reject excessive complexity rather than silently changing the permitted error.
    if (reduced.length > 384) continue;
    for (const filtered of splitByMask({ points: reduced, closed: piece.closed }, permitted)) {
      const box = bounds(filtered.points), len = length(filtered.points, w, h);
      if (len < 6 || Math.hypot(box.width * w, box.height * h) < 4) continue;
      // Omit artificial crop-frame outlines, but retain edges merely touching a border.
      if (filtered.closed && box.x * w < 2 && box.y * h < 2 && (1 - box.x - box.width) * w < 2 && (1 - box.y - box.height) * h < 2) continue;
      found.push({ ...filtered, id: '', bounds: box, lengthPx: len, nodes: sampleIndices(filtered.points, w, h, filtered.closed) });
    }
  }
  found.sort((a, b) => b.lengthPx - a.lengthPx);
  const unique: CandidateEdge[] = [];
  for (const edge of found) if (!unique.some(old => duplicate(edge, old, w, h))) unique.push(edge);
  // Reserve capacity for local details; longest-only ranking loses eyes and other small features.
  const picked = unique.slice(0, 6), cellCounts = new Map<string, number>();
  for (const edge of unique) {
    const box = edge.bounds, cell = `${Math.min(2, Math.floor((box.x + box.width / 2) * 3))}:${Math.min(2, Math.floor((box.y + box.height / 2) * 3))}`;
    if ((cellCounts.get(cell) ?? 0) < 2) { cellCounts.set(cell, (cellCounts.get(cell) ?? 0) + 1); if (!picked.includes(edge)) picked.push(edge); }
  }
  for (const edge of unique) if (picked.length < 24 && !picked.includes(edge)) picked.push(edge);
  const edges = picked.slice(0, 24).map((edge, i) => ({ ...edge, id: `e${String(i + 1).padStart(2, '0')}` }));
  return { width: w, height: h, edges, extractionMs: raw.elapsedMs, photoSha256: raw.photoSha256 };
}
export function selectEdgePoints(edge: CandidateEdge, part: string, from?: number, to?: number, width = 1, height = 1): Point[] {
  if (part === 'whole') {
    if (from !== undefined || to !== undefined) throw new Error('整条轮廓不需要节点编号。');
    return edge.points;
  }
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from! < 0 || to! < 0 || from! >= edge.nodes.length || to! >= edge.nodes.length) throw new Error('轮廓节点编号无效。');
  const first = edge.nodes[from!], last = edge.nodes[to!];
  if (!edge.closed) {
    if (part !== 'segment') throw new Error('开放轮廓只能选择连续片段。');
    const points = edge.points.slice(Math.min(first, last), Math.max(first, last) + 1);
    return first < last ? points : points.reverse();
  }
  if (part !== 'shortArc' && part !== 'longArc') throw new Error('闭合轮廓只能选择短弧或长弧。');
  const base = edge.points.slice(0, -1), forward: Point[] = [], backward: Point[] = [];
  for (let i = first; ; i = (i + 1) % base.length) { forward.push(base[i]); if (i === last) break; }
  for (let i = first; ; i = (i - 1 + base.length) % base.length) { backward.push(base[i]); if (i === last) break; }
  const forwardShorter = length(forward, width, height) <= length(backward, width, height);
  return (part === 'shortArc') === forwardShorter ? forward : backward;
}
export function pointsPath(points: Point[]): string { return points.map((p, i) => `${i ? 'L' : 'M'} ${p.map(v => Number((v * 1000).toFixed(3))).join(' ')}`).join(' '); }
