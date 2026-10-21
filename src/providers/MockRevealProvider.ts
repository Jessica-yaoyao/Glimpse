import type { RevealInput, RevealOptions, RevealProvider, RevealResult } from '../types/reveal.ts';
import { validSelection } from '../utils/selection.ts';
import { foxPaths } from '../data/fox.ts';
function pause(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export class MockRevealProvider implements RevealProvider {
  readonly kind = 'mock' as const;
  async reveal(input: RevealInput, options: RevealOptions = {}): Promise<RevealResult> {
    if (!validSelection(input.selection)) throw new Error('请先选择一个有效区域。');
    if (!input.perceptionText.trim() || Array.from(input.perceptionText).length > 100) throw new Error('请用 1–100 字描述你看到的形象。');
    for (const step of ['contours', 'relations', 'drawing'] as const) {
      options.onProgress?.(step);
      await pause(1000, options.signal);
    }
    if (input.image.sampleId === 'fox') return {
      interpretation: { subject: 'fox', pose: 'curled up', direction: 'left' },
      mapping: [{ feature: 'head', region: [.30, .52] }, { feature: 'tail', region: [.59, .70] }],
      overlay: { paths: foxPaths },
      notice: '预置案例 · 小狐狸轮廓。你的描述已保留；演示线稿不会随描述变化。',
    };
    const { x, y, width, height } = input.selection;
    return {
      interpretation: { subject: 'experimental contour', pose: 'unspecified', direction: 'unspecified' },
      mapping: [{ feature: 'selected region', region: [x + width / 2, y + height / 2] }],
      overlay: { bounds: input.selection, paths: [
        'M 120 630 Q 160 360 400 230 Q 600 90 790 320 Q 930 570 720 760 Q 500 930 260 750',
        'M 200 600 Q 400 440 520 500 Q 680 580 810 420',
        'M 340 730 Q 550 630 710 690',
      ] },
      notice: '实验线稿 · 这是选区内的通用曲线，用于体验流程，尚未根据照片或描述进行 AI 理解。',
    };
  }
}
