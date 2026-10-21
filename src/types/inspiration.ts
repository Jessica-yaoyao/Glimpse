import type { RevealResult, Selection, SourceImage, SelectionMask } from './reveal';
export interface GeoLocation { latitude: number; longitude: number; coordinateSystem: 'WGS84'; source: 'exif' | 'current' | 'manual'; recordedAt: number; accuracy?: number }
export interface RevealVersion { id: string; createdAt: number; description: string; selection: Selection; mask?: SelectionMask; result: RevealResult }
export interface Inspiration {
  schemaVersion: 1; id: string; status: 'draft' | 'processing' | 'revealed' | 'failed';
  image: SourceImage; thumbnail: string; originalSha256: string; originalMime: string;
  uploadedAt: number; occurredAt: number; updatedAt: number; timezone: string;
  capturedAt?: number; capturedLocal?: string; capturedOffset?: string;
  placeName: string; location?: GeoLocation; description: string; selection: Selection | null; mask?: SelectionMask;
  versions: RevealVersion[];
}
export type InspirationPatch = Partial<Pick<Inspiration, 'status' | 'occurredAt' | 'placeName' | 'location' | 'description' | 'selection' | 'mask' | 'versions'>>;
export interface ImportPhoto { image: SourceImage; original: Blob; thumbnail: string; timezone: string }
export interface InspirationRepository {
  list(): Promise<Inspiration[]>; get(id: string): Promise<Inspiration>;
  create(input: ImportPhoto): Promise<Inspiration>; patch(id: string, patch: InspirationPatch): Promise<Inspiration>;
  remove(id: string): Promise<void>; original(id: string): Promise<string>;
}
