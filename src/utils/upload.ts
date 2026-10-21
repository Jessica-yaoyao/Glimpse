import type { SourceImage } from '../types/reveal';
import { assetDataURL } from '../store/InspirationRepository';
export async function readImage(file: File): Promise<SourceImage> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif','image/heic','image/heif'].includes(file.type)) throw new Error('请选择 JPG、PNG、WebP、AVIF 或 HEIC 照片。');
  if (file.size > 30 * 1024 * 1024) throw new Error('照片超过 30 MB，请选择一张小一些的照片。');
  const native=(window.webkit?.messageHandlers as unknown as Record<string,{postMessage(value:Record<string,unknown>):Promise<unknown>}>|undefined)?.glimpseRecords;
  if(native)return await native.postMessage({action:'prepare',original:await assetDataURL(file)}) as SourceImage;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法读取照片。');
    context.fillStyle = '#f4f1ea'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { src: canvas.toDataURL('image/jpeg', .88), width: canvas.width, height: canvas.height, mode: 'upload' };
  } catch { throw new Error('这张照片没有成功打开，再试一次。'); }
  finally { URL.revokeObjectURL(url); }
}
