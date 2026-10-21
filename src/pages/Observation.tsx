import { Icon } from '../components/Icon';
import { sampleImage } from '../data/samples';
import { ReferenceArt } from '../design/ReferenceArt';
export function Observation({ onSample, onUpload, busy, live = false }: { onSample: () => void; onUpload: () => void; busy: boolean; live?: boolean }) {
  return <section className="home page-enter">
    <div className="home-heading"><p className="eyebrow"><span /> A LITTLE SHIFT IN HOW YOU SEE</p><h1>你刚刚，<br />把它看成<span className="hand-underline">什么了？</span></h1><div className="home-note"><p className="intro">有些东西本来不是它。<br />但那一瞬间，你确实看见了它。</p><ReferenceArt kind="dog" /></div></div>
    <button className="sample-card" onClick={onSample} aria-label="观察示例照片">
      <div className="photo-frame home-photo"><img src={sampleImage.src} alt="灰色路面上的橙色塑料袋，等待你的观察" /><span className="sample-badge">日常观察 <i>NO. 001</i></span><span className="viewfinder"><i /><i /><i /><i /></span><span className="photo-bottom">换个眼光，再看一眼。<Icon name="arrow" size={18} /></span></div>
      <div className="sample-caption"><span>一张照片，不止一种看法。</span><span>LOOK CLOSER ↗</span></div>
    </button>
    <div className="home-actions"><button className="button primary" onClick={onUpload} disabled={busy}><Icon name="plus" />{busy ? '正在打开照片…' : '上传一张照片'}<Icon name="arrow" /></button><button className="button secondary" onClick={onSample}><Icon name="spark" />先试一个例子<span className="button-meta">约 30 秒</span></button></div>
    <p className="home-footnote">{live ? 'Kimi Code 实时显影 · 你来想象，AI 沿着原图描绘。' : '预置演示 · macOS 应用支持 Kimi Code 实时显影。'}</p>
    <footer className="home-footer"><span>REALITY <i>→</i> PERCEPTION <i>→</i> REVEAL</span><span>保留现实，也保留你的看法。</span></footer>
  </section>;
}
