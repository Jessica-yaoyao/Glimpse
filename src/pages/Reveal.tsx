import { useState } from 'react';
import { Steps } from '../components/Header';
import { Icon } from '../components/Icon';
import { RevealSlider } from '../components/RevealSlider';
import type { RevealInput, RevealResult } from '../types/reveal';
export function Reveal({ input, result, onRestart, onEdit, onReview }: { input: RevealInput; result: RevealResult; onRestart: () => void; onEdit: () => void; onReview?: () => void }) {
  const [replay, setReplay] = useState(0);
  return <section className="page-enter"><Steps current={3} /><div className="page-heading result-heading"><p className="eyebrow"><span /> A GLIMPSE, MADE VISIBLE</p><h1>让你看到的，<br />留在现实里。</h1><p>照片还是那张照片，多了一点你的想象。</p></div>
    <RevealSlider key={replay} input={input} result={result} replay={replay} />
    {onReview && <button className="button primary quality-review-entry" onClick={onReview}>评分这次结果 ↗</button>}
    <div className="perception-result"><span className="quote-mark">“</span><p className="eyebrow">那一瞬间，我看到</p><p className="user-quote">{input.perceptionText}</p><div className="quote-footer"><span>YOUR PERCEPTION / 001</span><button className="text-button" onClick={onEdit}>修改描述 ↗</button></div></div>
    <p className="result-notice">{result.notice}</p>
    {result.receipt && <div className="reveal-receipt" data-provider="kimi-code" data-engine={result.receipt.engine??'original'} data-request-id={result.receipt.requestId} data-model={result.receipt.model} data-elapsed-ms={result.receipt.elapsedMs} data-total-tokens={result.receipt.totalTokens ?? 'unknown'} data-crop-sha256={result.receipt.cropSha256} data-description-sha256={result.receipt.descriptionSha256}>
      <strong>Kimi Code · 实时显影</strong><span>{result.receipt.model} · {result.receipt.totalTokens === null ? '用量未知，已保守预留' : `${result.receipt.totalTokens.toLocaleString()} Token`} · {(result.receipt.elapsedMs / 1000).toFixed(1)} 秒</span>
      <details><summary>本次请求信息</summary><p>模型选项：{result.receipt.requestedModel}<br />请求编号：{(result.receipt.requestIds ?? [result.receipt.requestId]).join(' / ')}<br />输入：{result.receipt.promptTokens ?? '未知'} Token · 输出：{result.receipt.completionTokens ?? '未知'} Token<br />{result.receipt.engine?'轮廓增强对照 · 本地提取照片边缘，Kimi 选择连续片段。':'轮廓来自本次照片选区与描述的返回。'}{result.receipt.engine&&<><br />本地提取：{result.receipt.extractionMs} ms · 候选 {result.receipt.candidateCount} 条<br />指引版本：{result.receipt.skillVersion}</>}{result.receipt.repaired&&<><br />经过一次结构修复；展示的用量包含两次请求。</>}</p></details>
    </div>}
    <div className="result-actions"><button className="button primary" onClick={() => setReplay(n => n + 1)}><Icon name="reset" />再看一次显影</button><button className="button secondary" onClick={onRestart}>开启下一次观察<Icon name="arrow" /></button></div>
    <p className="ending-note">世界没有变。你的看法，被留下了。</p>
  </section>;
}
