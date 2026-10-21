import type { ContourCandidates, Point } from '../types/contours.ts';
import type { RevealReceipt, RevealResult, Selection } from '../types/reveal.ts';
import { pointsPath, selectEdgePoints } from './contourGeometry.ts';

export const CONTOUR_ENGINE = 'vision-guided-v1' as const;
export const CONTOUR_SKILL = 'glimpse-photo-grounding-v1' as const;
export interface EdgeChoice { edgeId: string; feature: string; part: 'whole' | 'segment' | 'shortArc' | 'longArc'; from?: number; to?: number }
interface GuidedOutline { interpretation: string; strokes: EdgeChoice[] }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export class UnsupportedPerceptionError extends Error {}
export function candidateSummary(candidates: ContourCandidates): string {
  const rounded = (v: number) => Number(v.toFixed(4));
  return JSON.stringify(candidates.edges.map(edge => ({
    id: edge.id, closed: edge.closed, bounds: Object.fromEntries(Object.entries(edge.bounds).map(([k, v]) => [k, rounded(v)])),
    nodes: edge.nodes.map(index => edge.points[index].map(rounded)),
  })));
}
export function parseGuidedOutline(content: string, candidates: ContourCandidates): GuidedOutline {
  if (content.length > 20_000) throw new Error('轮廓选择数据过长。');
  const data: unknown = JSON.parse(content);
  if (!record(data) || !text(data.interpretation, 600) || !Array.isArray(data.strokes) || data.strokes.length > 15) throw new Error('轮廓选择结构不完整。');
  if (data.strokes.length === 0) throw new UnsupportedPerceptionError('当前照片边缘不足以表达这个联想。照片和描述已保留，请尝试更明显的结构。');
  const seen = new Set<string>();
  for (const choice of data.strokes) {
    if (!record(choice) || !text(choice.edgeId, 3) || !text(choice.feature, 150) || typeof choice.part !== 'string') throw new Error('轮廓选择字段无效。');
    const edge = candidates.edges.find(edge => edge.id === choice.edgeId);
    if (!edge) throw new Error('选择了不存在的照片边缘。');
    const selected = selectEdgePoints(edge, choice.part, choice.from as number | undefined, choice.to as number | undefined, candidates.width, candidates.height);
    if (selected.length < 2) throw new Error('轮廓片段过短。');
    const identity = `${choice.edgeId}:${choice.part}:${[choice.from, choice.to].sort().join(':')}`;
    if (seen.has(identity)) throw new Error('重复选择了同一轮廓片段。');
    seen.add(identity);
  }
  return data as unknown as GuidedOutline;
}
export function guidedResult(outline: GuidedOutline, candidates: ContourCandidates, bounds: Selection, receipt: RevealReceipt): RevealResult {
  const points: Point[][] = outline.strokes.map(choice => selectEdgePoints(candidates.edges.find(edge => edge.id === choice.edgeId)!, choice.part, choice.from, choice.to, candidates.width, candidates.height));
  return {
    interpretation: { subject: outline.interpretation, pose: '', direction: '' },
    mapping: outline.strokes.map((choice, index) => {
      const p = points[index][Math.floor(points[index].length / 2)];
      return { feature: choice.feature, region: [bounds.x + p[0] * bounds.width, bounds.y + p[1] * bounds.height] };
    }),
    overlay: { paths: points.map(pointsPath), bounds }, notice: outline.interpretation,
    receipt: { ...receipt, engine: CONTOUR_ENGINE, skillVersion: CONTOUR_SKILL, extractionMs: candidates.extractionMs, candidateCount: candidates.edges.length, selectedEdges: outline.strokes.map(choice => choice.edgeId) },
  };
}
