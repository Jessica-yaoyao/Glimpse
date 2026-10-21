import { useId, type CSSProperties } from 'react';
import type { RevealResult, Selection, SelectionMask } from '../types/reveal';
import { maskDataURL } from '../utils/mask';
export function RevealCanvas({ overlay, selection, mask, imageSize, animate = false, faint = false }: { overlay: RevealResult['overlay']; selection?: Selection; mask?:SelectionMask; imageSize?:{width:number;height:number}; animate?: boolean; faint?: boolean }) {
  const id = useId().replace(/:/g, '');
  const bounds = overlay.bounds;
  return <svg className={`reveal-overlay ${animate ? 'draw' : ''} ${faint ? 'faint' : ''}`} viewBox="0 0 1000 1000" preserveAspectRatio="none" fill="none" aria-hidden="true">
    {selection && <defs><clipPath id={id}><rect x={selection.x * 1000} y={selection.y * 1000} width={selection.width * 1000} height={selection.height * 1000} /></clipPath>{mask&&imageSize&&<mask id={`${id}mask`} x="0" y="0" width="1000" height="1000" maskUnits="userSpaceOnUse"><image href={maskDataURL(mask,imageSize)} x="0" y="0" width="1000" height="1000" preserveAspectRatio="none"/></mask>}</defs>}
    <g clipPath={selection ? `url(#${id})` : undefined} mask={mask&&imageSize?`url(#${id}mask)`:undefined}><g transform={bounds ? `translate(${bounds.x * 1000} ${bounds.y * 1000}) scale(${bounds.width} ${bounds.height})` : undefined}>
      {overlay.paths.map((d, i) => <path key={i} d={d} pathLength={1} vectorEffect="non-scaling-stroke" style={{ '--delay': `${i * 110}ms` } as CSSProperties} />)}
    </g></g>
  </svg>;
}
