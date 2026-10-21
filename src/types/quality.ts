import type { RevealReceipt,Selection } from './reveal';
export interface Assessment { recognizable:boolean; grounded:boolean; withinSelection:boolean; preservesPhoto:boolean; reviewedAt:number }
export interface QualityTask { id:string; recordId:string; filename:string; description:string; selection:Selection; originalSha256:string; status:'pending'|'processing'|'failed'|'revealed'; startedAt?:number; ownerPID?:number; elapsedMs?:number; versionId?:string; receipt?:RevealReceipt; failure?:string; assessment?:Assessment }
export interface PairAssessment { distinct:boolean; reviewedAt:number }
export interface QualitySuite { schemaVersion:1; revision?:number; id:string; createdAt:number; tasks:QualityTask[]; excludedFiles:string[]; pairAssessments?:Record<string,PairAssessment>; engine?:'vision-guided-v1'; baselineId?:string; inputProtocolSha256?:string }
