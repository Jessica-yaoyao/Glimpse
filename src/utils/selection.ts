import type { Selection } from '../types/reveal.ts';
export interface Point { x: number; y: number }
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function normalizedPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): Point {
  return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) };
}
export function selectionFromPoints(a: Point, b: Point): Selection {
  const x1 = clamp(a.x), y1 = clamp(a.y), x2 = clamp(b.x), y2 = clamp(b.y);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}
export function validSelection(s: Selection): boolean {
  return [s.x, s.y, s.width, s.height].every(Number.isFinite) && s.x >= 0 && s.y >= 0 && s.width >= .035 && s.height >= .035 && s.x + s.width <= 1.000001 && s.y + s.height <= 1.000001;
}
