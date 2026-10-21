import type { ContourExtractor, RawContours } from '../types/contours';
interface Bridge { postMessage(value: Record<string, unknown>): Promise<unknown> }
function bridge(): Bridge | undefined { return typeof window === 'undefined' ? undefined : (window.webkit?.messageHandlers as unknown as Record<string, Bridge> | undefined)?.glimpseContours; }
export function nativeContoursAvailable() { return Boolean(bridge()); }
export class NativeContourExtractor implements ContourExtractor {
  async extract(photo: string, signal?: AbortSignal): Promise<RawContours> {
    if (signal?.aborted) throw new DOMException('轮廓提取已取消。', 'AbortError');
    const native = bridge();
    if (!native) throw new Error('本地轮廓提取需要使用 macOS 增强版应用。');
    const id = `contours-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve, reject) => {
      let done = false;
      const cancel = () => { void native.postMessage({ action: 'cancel', id }).catch(() => {}); };
      const finish = (value?: RawContours, error?: unknown) => {
        if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value!);
      };
      const abort = () => { cancel(); finish(undefined, new DOMException('轮廓提取已取消。', 'AbortError')); };
      const timer = setTimeout(() => { cancel(); finish(undefined, new Error('本地轮廓提取超过10秒，请缩小选区后重试。')); }, 10_000);
      signal?.addEventListener('abort', abort, { once: true });
      native.postMessage({ action: 'extract', id, photo }).then(value => {
        if (!value || typeof value !== 'object') { finish(undefined, new Error('本地轮廓数据无法读取。')); return; }
        finish(value as RawContours);
      }, e => finish(undefined, e instanceof Error ? e : new Error(String(e))));
    });
  }
}
