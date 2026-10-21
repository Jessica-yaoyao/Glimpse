import type { SelectionMask } from '../types/reveal';

/** Presentation only. The continuous selection/AI mask is never textured. */
export function paintChalkSelection(canvas: HTMLCanvasElement, mask: SelectionMask) {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const shortest = Math.min(width, height);
  const pixelScale = Number(canvas.dataset.pixelScale) || 1;
  ctx.clearRect(0, 0, width, height);
  const stamps = new Map<number, HTMLCanvasElement>();
  function stamp(radius: number) {
    const key = Math.round(radius * 10);
    if (stamps.has(key)) return stamps.get(key)!;
    const grain = document.createElement('canvas');
    grain.width = grain.height = Math.ceil(radius * 2 + pixelScale * 2);
    const brush = grain.getContext('2d')!, center = grain.width / 2;
    let seed = 17831 + key;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    // Loose, uneven clumps with exposed photo between them; no solid underpaint.
    for (let i = 0; i < Math.ceil(radius * radius * 1.4 / (pixelScale * pixelScale)); i++) {
      const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * radius;
      const size = pixelScale * (.28 + random() * .7);
      brush.globalAlpha = (.15 + random() * .45) * (1 - .55 * distance / radius);
      brush.fillStyle = '#fff8e6'; // Existing selection outline color.
      brush.beginPath();
      brush.ellipse(center + Math.cos(angle) * distance, center + Math.sin(angle) * distance, size, size * (.6 + random() * .5), angle, 0, Math.PI * 2);
      brush.fill();
    }
    stamps.set(key, grain);
    return grain;
  }
  for (const stroke of mask.strokes) {
    const radius = stroke.radius * shortest;
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = ctx.lineJoin = 'round';ctx.lineWidth = radius * 2;
      ctx.beginPath();
      stroke.points.forEach(([x,y],i) => i ? ctx.lineTo(x*width,y*height) : ctx.moveTo(x*width,y*height));
      if (stroke.points.length === 1) {
        ctx.arc(stroke.points[0][0]*width,stroke.points[0][1]*height,radius,0,Math.PI*2);ctx.fill();
      } else ctx.stroke();
      continue;
    }
    ctx.globalCompositeOperation = 'source-over';
    const grain = stamp(radius), step = Math.max(pixelScale, radius * .38);
    let index = 0, remaining = 0;
    const dab = (x:number,y:number) => {
      ctx.save();ctx.translate(x,y);ctx.rotate(index++ * 2.399963);ctx.drawImage(grain,-grain.width/2,-grain.height/2);ctx.restore();
    };
    dab(stroke.points[0][0]*width,stroke.points[0][1]*height);
    for (let i=1;i<stroke.points.length;i++) {
      const [ax,ay]=stroke.points[i-1], [bx,by]=stroke.points[i];
      const dx=(bx-ax)*width,dy=(by-ay)*height,length=Math.hypot(dx,dy);
      if (!length) continue;
      let distance = step-remaining;
      for (;distance<=length;distance+=step) dab(ax*width+dx*distance/length,ay*height+dy*distance/length);
      remaining = (remaining+length)%step;
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
