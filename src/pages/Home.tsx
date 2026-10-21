import { useState } from 'react';
import type { Inspiration } from '../types/inspiration';
import { dayKey } from '../utils/dates';
import { sampleImage } from '../data/samples';
import { ReferenceArt } from '../design/ReferenceArt';
import { Icon } from '../components/Icon';
export function Home({ records, onSample, onUpload, onOpen, onJournal, busy, live=false }: { records:Inspiration[]; onSample:()=>void; onUpload:()=>void; onOpen:(id:string)=>void; onJournal:(view:'calendar'|'timeline')=>void; busy:boolean; live?:boolean }) {
  const [searching,setSearching]=useState(false),[query,setQuery]=useState('');
  const now=new Date(),days=new Set(records.map(r=>dayKey(r.occurredAt)));let streak=0;const cursor=new Date(now.getFullYear(),now.getMonth(),now.getDate());if(!days.has(dayKey(cursor)))cursor.setDate(cursor.getDate()-1);while(days.has(dayKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
  const month=records.filter(r=>{const date=new Date(r.occurredAt);return date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth();}).length;
  const filtered=records.filter(r=>`${r.description} ${r.placeName} ${dayKey(r.occurredAt)}`.includes(query.trim()));
  return <section className="home dashboard page-enter">
    <div className="dashboard-tools"><button className="icon-button" aria-label="搜索记录" aria-expanded={searching} onClick={()=>{setSearching(!searching);setQuery('');}}><Icon name="search" size={28}/></button><button className="new-circle" aria-label="添加一条记录" onClick={onUpload} disabled={busy}><Icon name="plus" size={32}/></button></div>
    {searching&&<div className="home-search"><label htmlFor="home-search">找一个记得的瞬间</label><input autoFocus id="home-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="联想、地点或日期…" type="search"/></div>}
    <div className="dashboard-note"><p>今天也辛苦了，<br/>还好你在记录。</p><ReferenceArt kind="dog"/></div>
    <div className="dashboard-stats"><button onClick={()=>onJournal('timeline')}><strong>{records.length}</strong><span>总记录</span></button><button onClick={()=>onJournal('calendar')}><strong>{month}</strong><span>本月</span></button><div><strong>{streak}</strong><span>连续天数</span></div></div>
    <div className="recent-heading"><h1 className="hand-underline">{query?'寻找瞬间':'最近记录'}</h1><button className="text-button" onClick={()=>onJournal('timeline')}>查看全部 ›</button></div>
    <div className="recent-grid">{(query?filtered:filtered.slice(0,4)).map(r=><button className="recent-card" key={r.id} data-record-id={r.id} onClick={()=>onOpen(r.id)}><div className="photo-frame"><img src={r.thumbnail} alt="记录的照片"/></div><strong>{r.description||'还没说出口的联想'}</strong><time>{new Date(r.occurredAt).getMonth()+1}月{new Date(r.occurredAt).getDate()}日</time></button>)}{!records.length&&!query&&<><button className="recent-card" onClick={onSample}><div className="photo-frame"><img src={sampleImage.src} alt="日常观察示例"/><span className="demo-label">示例照片</span></div><strong>换个眼光，再看一眼。</strong><small>先试一下 ↗</small></button><button className="empty-photo" onClick={onUpload}><Icon name="plus" size={38}/><span>拍下你的日常</span><small>添加第一条记录</small></button></>}</div>
    {query&&!filtered.length&&<p className="empty-state">没有找到这个瞬间，换个词试试。</p>}
    {records.length>0&&<button className="text-button observation-entry" onClick={onSample}>先试一下 · 换个眼光 ↗</button>}
    <p className="home-footnote">{live?'Kimi Code 实时显影 · 你来想象，AI 沿着原图描绘。':'预置演示 · macOS 应用支持 Kimi Code 实时显影。'}</p>
  </section>;
}
