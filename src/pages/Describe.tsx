import { Doodle } from '../design/PaperPhoto';
import { useRef, useState } from 'react';
import { Steps } from '../components/Header';
import { Icon } from '../components/Icon';
import type { SourceImage, Selection } from '../types/reveal';
const hints = [
  { label: '它的方向？', hint: '它面向哪里？朝左、侧着身，还是背对着你…' },
  { label: '它在做什么？', hint: '它在休息、奔跑，还是安静地看着什么…' },
  { label: '哪个地方最像？', hint: '是哪一道边缘、哪片光影，让你有了这个联想？' },
];
export function Describe({ image, selection, text, onText, onNext, onEdit, live = false }: { image: SourceImage; selection: Selection; text: string; onText: (text: string) => void; onNext: () => void; onEdit: () => void; live?: boolean }) {
  const [hint, setHint] = useState(-1);
  const field = useRef<HTMLTextAreaElement>(null);
  return <section className="page-enter"><Steps current={2} /><div className="page-heading"><p className="eyebrow">YOUR IMAGINATION COMES FIRST</p><h1>第一眼，<br />你把它看成了什么？</h1><p>不用描述它实际上是什么。<br />说说那一瞬间，脑海里浮现的形象。</p></div>
    <div className="describe-reference-row"><button className="selected-preview" onClick={onEdit} aria-label="返回修改选区"><div className="preview-photo" style={{aspectRatio:`${image.width}/${image.height}`}}><img src={image.src} alt="已选照片" /><i style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%`, width: `${selection.width * 100}%`, height: `${selection.height * 100}%` }} /></div><span><b>你刚刚停下目光的地方</b><small>{image.mode === 'sample' ? '日常观察 / 001' : '你自己的观察'}</small></span><Icon name="crop" size={18} /></button><Doodle kind="nice-day"/></div>
    <div className="perception-field"><label htmlFor="perception">我看到…</label><textarea id="perception" ref={field} value={text} onChange={e => onText(Array.from(e.target.value).slice(0, 100).join(''))} placeholder={hint === -1 ? '写下你第一眼看到的形象…' : hints[hint].hint} aria-describedby="perception-help perception-count" /><div className="field-bottom"><span>一句话就好，不需要写提示词。</span><span id="perception-count">{Array.from(text).length} / 100</span></div></div>
    <div className="hint-chips" aria-label="描述灵感提示">{hints.map((item, i) => <button key={item.label} className={hint === i ? 'selected' : ''} aria-pressed={hint === i} onClick={() => { setHint(i); field.current?.focus(); }}>{item.label}<span>↗</span></button>)}</div>
    <p id="perception-help" className="hint-description" aria-live="polite">{hint >= 0 ? hints[hint].hint : '没有标准答案。你看到的，就是这次的起点。'}</p>
    <div className="action-dock"><button className="button primary" disabled={!text.trim()} onClick={onNext}><Icon name="spark" />让它显现<Icon name="arrow" /></button><p className="mode-note">{live ? '实时显影 · 发送照片选区与描述给 Kimi Code，保留原图。' : image.mode === 'sample' ? '本例使用预置线稿演示显影体验' : '实验模式 · 使用通用线稿体验，未接入实时 AI'}</p></div>
  </section>;
}
