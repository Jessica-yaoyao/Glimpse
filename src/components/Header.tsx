import { Icon } from './Icon';
import { isNativeSettings } from '../platform/kimiSettings';
export function Header({ home, onHome, onBack, onSettings }: { home: boolean; onHome: () => void; onBack: () => void; onSettings?: () => void }) {
  return <header className="header">
    {home ? <button className="brand" onClick={onHome} aria-label="Glimpse 灵感显影首页"><span className="brand-mark"><Icon name="spark" size={27} /></span><span><span className="brand-cn">灵感显影</span>glimpse</span></button>
      : <><button className="icon-button back-button" onClick={onBack} aria-label="返回上一步"><Icon name="back" /></button><button className="wordmark" onClick={onHome} aria-label="回到首页">glimpse</button></>}
    {onSettings ? <button className="settings-entry" onClick={onSettings} aria-label="打开显影设置">设置 ↗</button> : <span className="edition"><i /> {isNativeSettings() && !window.glimpseDemo ? '实时显影 02' : '预置演示'}</span>}
  </header>;
}
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return <nav className="steps" aria-label="显影进度">{['观察', '描述', '显影'].map((label, i) => <span key={label} className={i + 1 <= current ? 'active' : ''} aria-current={current === i + 1 ? 'step' : undefined}><b>{i + 1 < current ? '✓' : `0${i + 1}`}</b>{label}{i < 2 && <i />}</span>)}</nav>;
}
