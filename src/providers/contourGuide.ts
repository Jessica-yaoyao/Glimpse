import type { ContourCandidates, PixelMask } from '../types/contours.ts';
import type { Crop } from './KimiRevealProvider.ts';
import { contourCandidates } from './contourGeometry.ts';
import type { RawContours } from '../types/contours.ts';

export interface ContourGuide { candidates: ContourCandidates; image: string }
export async function prepareContourGuide(crop: Crop, raw: RawContours, signal?: AbortSignal): Promise<ContourGuide> {
  function active() { if (signal?.aborted) throw new DOMException('轮廓提取已取消。', 'AbortError'); }
  active(); let mask: PixelMask | undefined;
  if (crop.maskDataUrl) {
    const image = new Image(); image.src = crop.maskDataUrl; await image.decode(); active();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); if (!context) throw new Error('精细选区无法读取。');
    context.drawImage(image, 0, 0); const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    mask = { width: canvas.width, height: canvas.height, pixels: Uint8Array.from({ length: canvas.width * canvas.height }, (_, i) => rgba[i * 4]) };
    canvas.width = canvas.height = 0;
  }
  const candidates = contourCandidates(raw, mask);
  if (!candidates.edges.length) throw new Error('这个选区没有足够清晰的照片边缘，请扩大选区或选择更明显的结构。');
  const image = new Image(); image.src = crop.dataUrl; await image.decode(); active();
  if (image.naturalWidth !== raw.width || image.naturalHeight !== raw.height) throw new Error('候选轮廓与当前照片不一致。');
  const canvas = document.createElement('canvas'); canvas.width = raw.width; canvas.height = raw.height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('轮廓参考图无法绘制。');
  context.drawImage(image, 0, 0); context.fillStyle = 'rgba(255,255,248,.58)'; context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.max(raw.width, raw.height) / 512, colors = ['#a54425', '#176254', '#695317', '#3d5370'];
  for (const [i, edge] of candidates.edges.entries()) {
    context.beginPath(); edge.points.forEach((p, index) => { const x = p[0] * raw.width, y = p[1] * raw.height; if (index) context.lineTo(x, y); else context.moveTo(x, y); });
    context.strokeStyle = colors[i % colors.length]; context.lineWidth = Math.max(1, scale * 1.4); context.stroke();
    const anchor = edge.points[edge.nodes[Math.floor(edge.nodes.length / 2)]], x = anchor[0] * raw.width, y = anchor[1] * raw.height;
    const fontSize = Math.max(10, 12 * scale); context.font = `bold ${fontSize}px sans-serif`;
    const boxWidth = context.measureText(edge.id).width + 5 * scale, labelX = Math.min(raw.width - boxWidth, Math.max(0, x + 3 * scale)), labelY = Math.min(raw.height - fontSize - 3 * scale, Math.max(0, y));
    context.fillStyle = 'rgba(255,255,248,.92)'; context.fillRect(labelX, labelY, boxWidth, fontSize + 3 * scale);
    context.fillStyle = colors[i % colors.length]; context.fillText(edge.id, labelX + 2 * scale, labelY + fontSize);
  }
  active(); const dataUrl = canvas.toDataURL('image/jpeg', .85); canvas.width = canvas.height = 0;
  return { candidates, image: dataUrl };
}
