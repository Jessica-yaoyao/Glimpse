import { useState } from 'react';
import type { RevealInput, RevealResult } from '../types/reveal';
import { RevealCanvas } from './RevealCanvas';
export function RevealSlider({ input, result, replay }: { input: RevealInput; result: RevealResult; replay: number }) {
  const [position, setPosition] = useState(30);
  return <>
    <div className="photo-frame result-photo" style={{ aspectRatio: `${input.image.width}/${input.image.height}` }}>
      <img src={input.image.src} alt="原始照片与 SVG 显影轮廓对比" draggable={false} />
      <div className="reveal-clip" style={{ clipPath: `inset(0 0 0 ${position}%)` }}><RevealCanvas key={replay} overlay={result.overlay} selection={input.selection} mask={input.mask} imageSize={input.image} animate /></div>
      <div className="compare-labels"><span>REALITY</span><span>I SAW <i>✧</i></span></div>
      <div className="compare-divider" style={{ left: `${position}%` }}><span>‹<i />›</span></div>
      <input className="compare-range" type="range" min="0" max="100" step="0.1" value={position} aria-label="Reality 与 I Saw 对比" aria-valuetext={`原图 ${Math.round(position)}%，显影 ${100 - Math.round(position)}%`} onChange={e => setPosition(Number(e.target.value))} />
    </div>
    <p className="slider-hint"><span>↔</span> 左右拖动，看想象从现实中浮现</p>
  </>;
}
