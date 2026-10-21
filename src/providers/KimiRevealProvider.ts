import type { RevealInput, RevealOptions, RevealProvider, RevealReceipt, RevealResult, Selection } from '../types/reveal.ts';
import { validSelection } from '../utils/selection.ts';
import { outlineResult, parseOutline } from './revealSchema.ts';
import { validMask,renderMask,maskBounds } from '../utils/mask.ts';
import type { ContourExtractor } from '../types/contours.ts';
import { prepareContourGuide } from './contourGuide.ts';
import { candidateSummary, CONTOUR_ENGINE, CONTOUR_SKILL, guidedResult, parseGuidedOutline, UnsupportedPerceptionError } from './guidedOutline.ts';
export interface Crop { dataUrl: string; bounds: Selection; maskDataUrl?: string }
export interface TransportRequest { action: 'reveal'; id: string; photo: string; description: string; mask?: string; repair?: string; guidance?: { engine: typeof CONTOUR_ENGINE; skillVersion: typeof CONTOUR_SKILL; photo: string; candidates: string } }
export interface TransportReply { content: string; receipt: Omit<RevealReceipt, 'repaired'> }
export interface RevealTransport { send(request: TransportRequest, signal?: AbortSignal): Promise<TransportReply> }
interface NativeBridge { postMessage(message: Record<string, unknown>): Promise<unknown> }
declare global { interface Window { glimpseDemo?: boolean } }
function nativeBridge(): NativeBridge | undefined {
  return (window.webkit?.messageHandlers as unknown as Record<string, NativeBridge> | undefined)?.glimpseReveal;
}
export function nativeRevealAvailable() { return !window.glimpseDemo && Boolean(nativeBridge()); }
function abortError() { return new DOMException('显影已取消。', 'AbortError'); }
function assertActive(signal?: AbortSignal) { if (signal?.aborted) throw abortError(); }
export class NativeRevealTransport implements RevealTransport {
  async send(request: TransportRequest, signal?: AbortSignal): Promise<TransportReply> {
    assertActive(signal);
    const bridge = nativeBridge();
    if (!bridge) throw new Error('实时显影需要使用 macOS 应用。');
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value?: TransportReply, error?: unknown) => {
        if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value!);
      };
      const cancel = () => { void bridge.postMessage({ action: 'cancel', id: request.id }).catch(() => {}); };
      const abort = () => { cancel(); finish(undefined, abortError()); };
      const timer = setTimeout(() => { cancel(); finish(undefined, new Error('显影等待超过 55 秒，请稍后重试。已发送请求的用量会保守预留。')); }, 55_000);
      signal?.addEventListener('abort', abort, { once: true });
      bridge.postMessage({ ...request }).then(value => {
        if (!value || typeof value !== 'object' || !('content' in value) || typeof value.content !== 'string' || !('receipt' in value)) { finish(undefined, new Error('无法读取 Kimi 返回的显影结果。')); return; }
        const reply = value as TransportReply;
        const receipt = reply.receipt;
        if (!receipt || receipt.provider !== 'kimi-code' || receipt.requestId !== request.id || typeof receipt.model !== 'string' || typeof receipt.requestedModel !== 'string' || !Number.isFinite(receipt.elapsedMs) || !/^[a-f0-9]{64}$/.test(receipt.cropSha256) || !/^[a-f0-9]{64}$/.test(receipt.descriptionSha256) || (receipt.totalTokens !== null && (!Number.isInteger(receipt.totalTokens) || receipt.totalTokens < 0))) { finish(undefined, new Error('Kimi 请求凭据不完整，请重新显影。')); return; }
        finish(reply);
      }, error => finish(undefined, error instanceof Error ? error : new Error(String(error))));
    });
  }
}
export async function cropSelection(input: RevealInput, signal?: AbortSignal): Promise<Crop> {
  assertActive(signal);
  const image = new Image(); image.src = input.image.src; await image.decode(); assertActive(signal);
  if (input.mask && !validMask(input.mask)) throw new Error('选区笔触无效，请重新涂选。');
  const fullMask = input.mask ? renderMask(input.mask,image.naturalWidth,image.naturalHeight) : undefined;
  const selection = fullMask ? maskBounds(fullMask) : input.selection;
  if (!selection) throw new Error('选区为空，请重新框选或涂选。');
  const x = Math.floor(selection.x * image.naturalWidth), y = Math.floor(selection.y * image.naturalHeight);
  const width = Math.min(image.naturalWidth - x, Math.ceil((selection.x + selection.width) * image.naturalWidth) - x);
  const height = Math.min(image.naturalHeight - y, Math.ceil((selection.y + selection.height) * image.naturalHeight) - y);
  if (width < 1 || height < 1) throw new Error('选区太小，请重新选择。');
  const scale = Math.min(1, 1280 / Math.max(width, height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('照片选区无法读取，请重新打开照片。');
  context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);
  let maskDataUrl: string | undefined;
  if(fullMask){const maskCanvas=document.createElement('canvas');maskCanvas.width=canvas.width;maskCanvas.height=canvas.height;const maskContext=maskCanvas.getContext('2d')!;maskContext.drawImage(fullMask,x,y,width,height,0,0,canvas.width,canvas.height);context.globalCompositeOperation='destination-in';context.drawImage(maskCanvas,0,0);context.globalCompositeOperation='destination-over';context.fillStyle='#dedbd1';context.fillRect(0,0,canvas.width,canvas.height);context.globalCompositeOperation='source-over';maskContext.globalCompositeOperation='destination-over';maskContext.fillStyle='#000';maskContext.fillRect(0,0,canvas.width,canvas.height);maskDataUrl=maskCanvas.toDataURL('image/png');}
  const dataUrl = canvas.toDataURL('image/jpeg', .88); canvas.width = canvas.height = 0;
  return { dataUrl, maskDataUrl, bounds: { x: x / image.naturalWidth, y: y / image.naturalHeight, width: width / image.naturalWidth, height: height / image.naturalHeight } };
}
export class KimiRevealProvider implements RevealProvider {
  readonly kind = 'kimi-code' as const;
  private readonly transport: RevealTransport;
  private readonly crop: typeof cropSelection;
  private readonly contours?: { extractor: ContourExtractor; prepare?: typeof prepareContourGuide };
  constructor(transport: RevealTransport = new NativeRevealTransport(), crop: typeof cropSelection = cropSelection, contours?: { extractor: ContourExtractor; prepare?: typeof prepareContourGuide }) { this.transport = transport; this.crop = crop; this.contours = contours; }
  async reveal(input: RevealInput, options: RevealOptions = {}): Promise<RevealResult> {
    if (!validSelection(input.selection)) throw new Error('请先选择一个有效区域。');
    if (!input.perceptionText.trim() || Array.from(input.perceptionText).length > 100) throw new Error('请用 1–100 字描述你看到的形象。');
    assertActive(options.signal); options.onProgress?.('contours');
    const crop = await this.crop(input, options.signal); assertActive(options.signal);
    const guide = this.contours ? await (this.contours.prepare ?? prepareContourGuide)(crop, await this.contours.extractor.extract(crop.dataUrl, options.signal), options.signal) : undefined;
    assertActive(options.signal); options.onProgress?.('relations');
    let repair: string | undefined;
    const receipts: Omit<RevealReceipt, 'repaired'>[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const id = `reveal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const reply = await this.transport.send({ action: 'reveal', id, photo: crop.dataUrl, description: input.perceptionText.trim(), ...(crop.maskDataUrl ? {mask:crop.maskDataUrl} : {}), ...(guide ? { guidance: { engine: CONTOUR_ENGINE, skillVersion: CONTOUR_SKILL, photo: guide.image, candidates: candidateSummary(guide.candidates) } } : {}), ...(repair ? { repair } : {}) }, options.signal);
      receipts.push(reply.receipt);
      assertActive(options.signal);
      if (guide && (reply.receipt.cropSha256 !== guide.candidates.photoSha256 || reply.receipt.engine !== CONTOUR_ENGINE || reply.receipt.skillVersion !== CONTOUR_SKILL)) throw new Error('轮廓候选与请求凭据不一致，已停止后续请求。');
      try {
        const sum = (field: 'totalTokens' | 'promptTokens' | 'completionTokens') => receipts.some(receipt => receipt[field] === null) ? null : receipts.reduce((total, receipt) => total + receipt[field]!, 0);
        const receipt = { ...reply.receipt, totalTokens: sum('totalTokens'), promptTokens: sum('promptTokens'), completionTokens: sum('completionTokens'), elapsedMs: receipts.reduce((total, receipt) => total + receipt.elapsedMs, 0), requestIds: receipts.map(receipt => receipt.requestId), repaired: attempt === 1 };
        const result = guide ? guidedResult(parseGuidedOutline(reply.content, guide.candidates), guide.candidates, crop.bounds, receipt) : outlineResult(parseOutline(reply.content), crop.bounds, receipt);
        options.onProgress?.('drawing'); return result;
      } catch (error) {
        if (error instanceof UnsupportedPerceptionError) throw error;
        if (attempt === 1) throw new Error('Kimi 返回的轮廓仍不符合坐标与结构要求。照片和描述已保留，可以重新显影。');
        repair = reply.content.slice(0, 20_000);
      }
    }
    throw new Error('这次没有获得有效轮廓。');
  }
}
