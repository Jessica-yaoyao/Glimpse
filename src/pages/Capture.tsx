import { Steps } from '../components/Header';
import { SelectionEditor } from '../components/SelectionEditor';
import { Icon } from '../components/Icon';
import { validSelection } from '../utils/selection';
import type { SourceImage, Selection, SelectionMask } from '../types/reveal';
export function Capture({ image, selection, mask, onMask, onSelect, onNext, onUpload, busy }: { image: SourceImage; selection: Selection | null; mask?: SelectionMask; onMask: (mask:SelectionMask)=>void; onSelect: (s: Selection | null) => void; onNext: () => void; onUpload: () => void; busy: boolean }) {
  return <section className="page-enter"><Steps current={1} /><div className="page-heading"><p className="eyebrow">FOLLOW YOUR EYES</p><h1>哪里让你<br />看走眼了？</h1><p>框选或涂选让你产生联想的区域。<br />笔触可以勾勒你脑海中的抽象轮廓。</p></div>
    <SelectionEditor image={image} selection={selection} mask={mask} onChange={(next,value)=>{onSelect(next);onMask(value);}} />
    <p className="quiet-note"><span>01 /</span> 先观察，再告诉我你看到了什么。</p>
    <div className="action-dock"><button className="button primary" onClick={onNext} disabled={!selection || !validSelection(selection)}>就是这里<Icon name="arrow" /></button><button className="text-button" onClick={onUpload} disabled={busy}>{busy ? '正在打开照片…' : '换一张照片'}</button></div>
  </section>;
}
