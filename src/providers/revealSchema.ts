import type { RevealReceipt, RevealResult, Selection } from '../types/reveal.ts';
interface Command { op: 'M' | 'L' | 'Q' | 'C'; p: number[] }
interface Outline { interpretation: string; anchors: { feature: string; point: [number, number] }[]; paths: Command[][] }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function point(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1; }
function text(value: unknown, max: number): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
export function parseOutline(content: string): Outline {
  if (content.length > 64_000) throw new Error('轮廓数据过长。');
  const data: unknown = JSON.parse(content);
  if (!record(data) || !text(data.interpretation, 600) || !Array.isArray(data.anchors) || data.anchors.length < 3 || data.anchors.length > 20 || !Array.isArray(data.paths) || data.paths.length < 5 || data.paths.length > 15) throw new Error('轮廓结构不完整。');
  for (const anchor of data.anchors) {
    if (!record(anchor) || !text(anchor.feature, 150) || !Array.isArray(anchor.point) || anchor.point.length !== 2 || !anchor.point.every(point)) throw new Error('轮廓锚点坐标无效。');
  }
  let commandCount = 0;
  for (const path of data.paths) {
    if (!Array.isArray(path) || path.length < 2 || path.length > 12) throw new Error('轮廓路径长度无效。');
    for (const [index, command] of path.entries()) {
      if (!record(command) || typeof command.op !== 'string' || !['M', 'L', 'Q', 'C'].includes(command.op) || (index === 0 ? command.op !== 'M' : command.op === 'M') || !Array.isArray(command.p) || command.p.length !== ({ M: 2, L: 2, Q: 4, C: 6 } as Record<string, number>)[command.op] || !command.p.every(point)) throw new Error('轮廓曲线或坐标无效。');
      commandCount++;
    }
  }
  if (commandCount > 150) throw new Error('轮廓过于复杂。');
  return data as unknown as Outline;
}
export function outlineResult(outline: Outline, bounds: Selection, receipt: RevealReceipt): RevealResult {
  const paths = outline.paths.map(path => path.map(command => `${command.op} ${command.p.map(value => Number((value * 1000).toFixed(3))).join(' ')}`).join(' '));
  return {
    interpretation: { subject: outline.interpretation, pose: '', direction: '' },
    mapping: outline.anchors.map(anchor => ({ feature: anchor.feature, region: [bounds.x + anchor.point[0] * bounds.width, bounds.y + anchor.point[1] * bounds.height] })),
    overlay: { paths, bounds }, notice: outline.interpretation, receipt,
  };
}
