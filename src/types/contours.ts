export type Point = [number, number];
export interface RawEdge { points: Point[]; closed: boolean }
export interface RawContours {
  width: number; height: number; edges: RawEdge[]; elapsedMs: number; photoSha256: string;
}
export interface CandidateEdge extends RawEdge {
  id: string; lengthPx: number; bounds: { x: number; y: number; width: number; height: number };
  /** Indices of existing photo vertices. The model selects these; it does not draw new coordinates. */
  nodes: number[];
}
export interface ContourCandidates {
  width: number; height: number; edges: CandidateEdge[]; extractionMs: number; photoSha256: string;
}
export interface ContourExtractor { extract(photo: string, signal?: AbortSignal): Promise<RawContours> }
export interface PixelMask { width: number; height: number; pixels: Uint8Array }
