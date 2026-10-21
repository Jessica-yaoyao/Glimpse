import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contourCandidates, simplify, selectEdgePoints, validateRawContours } from './contourGeometry.ts';
import { candidateSummary, guidedResult, parseGuidedOutline } from './guidedOutline.ts';
import type { PixelMask, Point, RawContours } from '../types/contours.ts';
import { NativeContourExtractor } from './ContourExtractor.ts';
const raw = (points: Point[], closed = false): RawContours => ({ width: 200, height: 100, edges: [{ points, closed }], elapsedMs: 13, photoSha256: 'a'.repeat(64) });
function circle(cx: number, cy: number, radius: number): Point[] { return Array.from({ length: 201 }, (_, i) => [cx + Math.cos(i * Math.PI / 100) * radius, cy + Math.sin(i * Math.PI / 100) * radius]); }
function pixelDistance(p: Point, a: Point, b: Point, w: number, h: number) {
  const dx = (b[0] - a[0]) * w, dy = (b[1] - a[1]) * h, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * w * dx + (p[1] - a[1]) * h * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot((p[0] - a[0] - (b[0] - a[0]) * t) * w, (p[1] - a[1] - (b[1] - a[1]) * t) * h);
}
test('pixel-weighted simplification preserves corners and an independent maximum-error bound on non-square photos', () => {
  const source: Point[] = Array.from({ length: 700 }, (_, i) => [i / 700, .5 + .1 * Math.sin(i / 70)]);
  const reduced = simplify(source, 1200, 80);
  assert.ok(reduced.length < source.length / 8);
  for (const p of source) assert.ok(Math.min(...reduced.slice(1).map((b, i) => pixelDistance(p, reduced[i], b, 1200, 80))) <= .800001);
  const corner: Point[] = [[.1, .1], [.2, .1], [.2, .2], [.3, .2]];
  assert.deepEqual(simplify(corner, 1200, 80), corner);
});
test('mask holes never create a shortcut through erased pixels, and a fully erased mask yields no candidates', () => {
  const mask: PixelMask = { width: 200, height: 100, pixels: new Uint8Array(20_000).fill(255) };
  for (let y = 35; y <= 65; y++) for (let x = 85; x <= 115; x++) mask.pixels[y * 200 + x] = 0;
  const candidates = contourCandidates(raw([[.1, .5], [.4, .5], [.6, .5], [.9, .5]]), mask);
  assert.equal(candidates.edges.length, 2);
  for (const edge of candidates.edges) for (let i = 1; i < edge.points.length; i++) {
    const a = edge.points[i - 1], b = edge.points[i];
    for (let step = 0; step <= 200; step++) { const x = Math.floor((a[0] + (b[0] - a[0]) * step / 200) * 200), y = Math.floor((a[1] + (b[1] - a[1]) * step / 200) * 100); assert.equal(mask.pixels[y * 200 + x], 255); }
  }
  assert.equal(contourCandidates(raw([[.1, .5], [.4, .5]]), { ...mask, pixels: new Uint8Array(20_000) }).edges.length, 0);
});
test('dark/light duplicate edges merge, nested details survive, crop frame is discarded', () => {
  const outer = circle(.5, .5, .3), inner = circle(.5, .5, .2);
  const candidates = contourCandidates({ ...raw(outer, true), edges: [{ points: outer, closed: true }, { points: outer.map(([x, y]) => [x + .001, y]), closed: true }, { points: inner, closed: true }, { points: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], closed: true }] });
  assert.equal(candidates.edges.length, 2); assert.ok(candidates.edges.some(e => e.bounds.width < .45));
  for (const edge of candidates.edges) assert.deepEqual(edge.points[0], edge.points.at(-1));
});
test('closed arcs use existing vertices, and complementary arcs share only their endpoints', () => {
  const edge = contourCandidates(raw(circle(.5, .5, .3), true)).edges[0];
  const short = selectEdgePoints(edge, 'shortArc', 0, 2, 200, 100), long = selectEdgePoints(edge, 'longArc', 0, 2, 200, 100);
  assert.deepEqual(short[0], long[0]); assert.deepEqual(short.at(-1), long.at(-1));
  assert.ok(short.length < long.length);
  for (const p of [...short, ...long]) assert.ok(edge.points.includes(p));
  assert.throws(() => selectEdgePoints(edge, 'shortArc', 0, 99)); assert.throws(() => selectEdgePoints(edge, 'segment', 0, 2));
});
test('model chooses IDs and nodes; final SVG, provenance and full-photo anchors come from local photo vertices', () => {
  const candidates = contourCandidates(raw([[.1, .2], [.3, .4], [.8, .4]]));
  const outline = parseGuidedOutline(JSON.stringify({ interpretation: '石缝像侧脸', strokes: [{ edgeId: 'e01', feature: '石缝对应鼻梁', part: 'whole' }] }), candidates);
  const receipt = { provider: 'kimi-code' as const, requestId: 'reveal-test', model: 'k3-256k', requestedModel: 'k3-256k', elapsedMs: 30, totalTokens: 100, promptTokens: 70, completionTokens: 30, cropSha256: 'a'.repeat(64), descriptionSha256: 'b'.repeat(64), repaired: false };
  const result = guidedResult(outline, candidates, { x: .2, y: .1, width: .5, height: .7 }, receipt);
  assert.equal(result.overlay.paths[0], 'M 100 200 L 300 400 L 800 400');
  assert.deepEqual(result.mapping[0].region, [.2 + .3 * .5, .1 + .4 * .7]);
  assert.equal(result.receipt?.candidateCount, 1); assert.equal(result.receipt?.engine, 'vision-guided-v1');
  assert.equal(JSON.parse(candidateSummary(candidates))[0].nodes.length, 3);
  for (const strokes of [[{ edgeId: 'e99', feature: 'missing', part: 'whole' }], [{ edgeId: 'e01', feature: 'invalid', part: 'whole', from: 0 }], [{ edgeId: 'e01', feature: 'invalid', part: '<script>' }]]) assert.throws(() => parseGuidedOutline(JSON.stringify({ interpretation: 'test', strokes }), candidates));
});
test('malformed native data is rejected rather than normalized or truncated', () => {
  assert.throws(() => validateRawContours({ ...raw([[.1, .1], [.2, .2]]), width: 1281 }));
  assert.throws(() => validateRawContours(raw([[NaN, .1], [.2, .2]])));
  assert.throws(() => validateRawContours(raw([[1.01, .1], [.2, .2]])));
  assert.throws(() => contourCandidates(raw([[.1, .1], [.2, .2]]), { width: 1, height: 1, pixels: new Uint8Array(1) }));
});
test('native extraction cancellation cancels only its ID and ignores a late reply without invoking a model', async () => {
  const actions: string[] = []; let complete: (v: RawContours) => void = () => {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { webkit: { messageHandlers: { glimpseContours: { postMessage: async (v: Record<string, unknown>) => { actions.push(`${v.action}:${v.id}`); if (v.action === 'cancel') return {}; return new Promise<RawContours>(resolve => { complete = resolve; }); } } } } } });
  const controller = new AbortController(), pending = new NativeContourExtractor().extract('photo', controller.signal); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' }); complete(raw([[.1, .1], [.2, .2]]));
  assert.equal(actions.length, 2); assert.equal(actions[0].replace('extract:', ''), actions[1].replace('cancel:', ''));
  Reflect.deleteProperty(globalThis, 'window');
});
