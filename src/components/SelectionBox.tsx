import { useRef, type PointerEvent } from 'react';
import type { Selection, SourceImage } from '../types/reveal';
import { normalizedPoint, selectionFromPoints, validSelection, type Point } from '../utils/selection';
import { foxRegion } from '../data/fox';
import { Icon } from './Icon';
export function SelectionBox({ image, selection, onChange }: { image: SourceImage; selection: Selection | null; onChange: (value: Selection | null) => void }) {
  const drag = useRef<{ point: Point; previous: Selection | null; id: number } | null>(null);
  const point = (e: PointerEvent<HTMLDivElement>) => normalizedPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  function start(e: PointerEvent<HTMLDivElement>) {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { point: point(e), previous: selection, id: e.pointerId };
    onChange(null);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) onChange(selectionFromPoints(drag.current.point, point(e)));
  }
  function end(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    const next = selectionFromPoints(drag.current.point, point(e));
    onChange(validSelection(next) ? next : drag.current.previous);
    drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId);
  }
  return <>
    <div className="photo-frame selection-surface" style={{ aspectRatio: `${image.width}/${image.height}` }} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { if (drag.current) onChange(drag.current.previous); drag.current = null; }} aria-label="照片框选区域，拖动选择，也可使用下方选取按钮">
      <img src={image.src} alt={image.mode === 'sample' ? '一只落在灰色路面上的橙色塑料袋' : '你上传的照片'} draggable={false} />
      {!selection && <span className="photo-tip"><Icon name="crop" size={16} /> 在照片上拖动，框住那一处</span>}
      {selection && <div className="selection-rect" style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }}><i /><i /><i /><i /><span>你的视线</span></div>}
      <span className="image-number">OBSERVATION / 001</span>
    </div>
    <div className="selection-tools"><span aria-live="polite">{selection && validSelection(selection) ? '已框选 · 再拖动可重选' : '从一个角，拖向另一个角'}</span><button className="text-button" onClick={() => onChange(image.mode === 'sample' ? foxRegion : { x: 0, y: 0, width: 1, height: 1 })}>{image.mode === 'sample' ? '选取主体' : '选择整张'}</button></div>
  </>;
}
