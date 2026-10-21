export type AppStage = 'splash' | 'welcome' | 'observation' | 'source' | 'home' | 'capture' | 'describe' | 'processing' | 'reveal' | 'settings' | 'journal' | 'detail' | 'map' | 'quality';
export interface MaskStroke { tool: 'brush' | 'eraser'; radius: number; points: [number, number][] }
export interface SelectionMask { base: Selection | null; strokes: MaskStroke[] }
/** Image-relative coordinates, always within 0..1. Never CSS pixels. */
export interface Selection { x: number; y: number; width: number; height: number }
export interface SourceImage { src: string; width: number; height: number; mode: 'sample' | 'upload'; sampleId?: string }
export interface RevealInput { image: SourceImage; selection: Selection; perceptionText: string; mask?: SelectionMask }
export type ProcessingStep = 'contours' | 'relations' | 'drawing';
export interface RevealReceipt {
  provider: 'kimi-code'; requestId: string; model: string; requestedModel: string;
  elapsedMs: number; totalTokens: number | null; promptTokens: number | null; completionTokens: number | null;
  cropSha256: string; descriptionSha256: string; repaired: boolean;
  requestIds?: string[];
  engine?: 'vision-guided-v1'; skillVersion?: string; extractionMs?: number; candidateCount?: number; selectedEdges?: string[];
  guidanceSha256?: string; candidateSummarySha256?: string; instructionSha256?: string;
}
export interface RevealResult {
  interpretation: { subject: string; pose: string; direction: string };
  mapping: { feature: string; region: [number, number] }[];
  /** Declarative SVG paths; UI never injects arbitrary markup. ViewBox: 0 0 1000 1000. */
  overlay: { paths: string[]; bounds?: Selection };
  notice: string;
  receipt?: RevealReceipt;
}
export interface RevealOptions { signal?: AbortSignal; onProgress?: (step: ProcessingStep) => void }
export interface RevealProvider { readonly kind?: 'mock' | 'kimi-code'; reveal(input: RevealInput, options?: RevealOptions): Promise<RevealResult> }
