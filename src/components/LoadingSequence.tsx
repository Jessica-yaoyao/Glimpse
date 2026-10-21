import { useEffect, useState } from 'react';
import type { ProcessingStep, RevealInput, RevealProvider, RevealResult } from '../types/reveal';
import { RevealCanvas } from './RevealCanvas';
const messages = { contours: '正在寻找你看到的轮廓…', relations: '正在理解形态关系…', drawing: '正在把想象描出来…' };
export function LoadingSequence({ input, provider, onComplete, onCancel, onFailure }: { input: RevealInput; provider: RevealProvider; onComplete: (result: RevealResult) => void; onCancel: () => void; onFailure?:(message:string)=>void }) {
  const [step, setStep] = useState<ProcessingStep>('contours');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setStep('contours');
    provider.reveal(input, { signal: controller.signal, onProgress: next => { if (!controller.signal.aborted) setStep(next); } })
      .then(result => { if (!controller.signal.aborted) onComplete(result); })
      .catch((e: unknown) => { if (!controller.signal.aborted) { const message=e instanceof Error ? e.message : '请再试一次。';setError(message);onFailure?.(message); } });
    return () => controller.abort();
  }, [input, provider, onComplete, attempt]);
  const { selection: s } = input;
  return <section className="processing page-enter" aria-busy={!error}>
    <p className="eyebrow">REALITY → PERCEPTION → REVEAL</p>
    <h1>{error ? '再给想象一点时间。' : '让那一瞬间，\n慢慢浮现。'}</h1>
    <div className="photo-frame processing-photo" style={{ aspectRatio: `${input.image.width}/${input.image.height}` }}>
      <img src={input.image.src} alt="正在显影的原始照片" />
      <div className="processing-region" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.width * 100}%`, height: `${s.height * 100}%` }} />
      {provider.kind !== 'kimi-code' && step !== 'contours' && <RevealCanvas overlay={{ bounds: s, paths: ['M 100 650 Q 230 260 500 220', 'M 530 230 Q 890 340 830 700'] }} animate faint />}
    </div>
    {error ? <div className="error-state" role="alert"><h2>这次没有成功显现出来。</h2><p>{error}</p><button className="button primary" onClick={() => setAttempt(a => a + 1)}>再试一次</button></div> : <div className="processing-status" role="status"><div className="processing-dots">{Object.keys(messages).map(key => <i key={key} className={key === step ? 'active' : ''} />)}</div><p key={step}>{messages[step]}</p><span>沿着现实的形状，靠近你的想象。</span></div>}
    <button className="text-button cancel" onClick={onCancel}>返回修改描述</button>
    <p className="mode-note">{provider.kind === 'kimi-code' ? '正在等待 Kimi Code 的真实轮廓 · 超时或失败可返回修改' : input.image.mode === 'sample' ? '预置案例演示 · 未连接实时 AI' : '实验模式 · 将展示通用曲线，未连接实时 AI'}</p>
  </section>;
}
