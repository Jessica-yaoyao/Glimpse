import { PaperPhoto } from '../design/PaperPhoto';
import { useState } from 'react';
import type { Inspiration } from '../types/inspiration';
import { dayKey, statusLabel } from '../utils/dates';
import { ReferenceArt } from '../design/ReferenceArt';
export function Journal({ records, onOpen, onNew, initialView = 'calendar' }: { initialView?:'calendar'|'timeline'; records: Inspiration[]; onOpen: (id:string)=>void; onNew:()=>void }) {
  const [selected, setSelected] = useState(dayKey(Date.now()));
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState<'calendar'|'timeline'>(initialView);
  const first = new Date(month.getFullYear(), month.getMonth(), 1), offset = (first.getDay()+6)%7;
  const counts = new Map<string, Inspiration[]>(); for (const record of records) { const key = dayKey(record.occurredAt); counts.set(key, [...(counts.get(key) ?? []), record]); }
  const items = view === 'calendar' ? counts.get(selected) ?? [] : records;
  const shift = (delta:number) => { const next = new Date(month.getFullYear(), month.getMonth()+delta, 1); setMonth(next); setSelected(dayKey(next)); };
  return <section className={`journal page-enter journal-${view}`}><p className="eyebrow">THE THINGS YOU ALMOST MISSED</p><h1>灵感日志</h1><p className="journal-intro">一闪而过，也有迹可循。</p>
    <div className="journal-toolbar"><span>{records.length} 次发现</span><div className="segmented"><button aria-pressed={view==='calendar'} onClick={()=>setView('calendar')}>月历</button><button aria-pressed={view==='timeline'} onClick={()=>setView('timeline')}>时间轴</button></div></div>
    {view==='calendar' && <div className="calendar"><div className="month-nav"><button aria-label="上个月" onClick={()=>shift(-1)}>‹</button><strong>{month.getFullYear()} / {String(month.getMonth()+1).padStart(2,'0')}</strong><button aria-label="下个月" onClick={()=>shift(1)}>›</button></div><div className="calendar-grid" role="group" aria-label="选择日志日期">{['一','二','三','四','五','六','日'].map(day=><span className="weekday" key={day}>{day}</span>)}{Array.from({length:42},(_,i)=>{ const date = new Date(month.getFullYear(),month.getMonth(),i-offset+1),key=dayKey(date), list=counts.get(key)??[], outside=date.getMonth()!==month.getMonth(); return <button key={key} data-day={key} className={`calendar-day ${outside?'outside':''} ${selected===key?'selected':''}`} aria-label={`${key}，${list.length} 次发现`} aria-pressed={selected===key} onClick={()=>{setSelected(key);if(outside)setMonth(new Date(date.getFullYear(),date.getMonth(),1));}}><span>{date.getDate()}</span>{list.length>0 && <><img src={list[0].thumbnail} alt="当日照片" /><small>{list.length}</small></>}</button>;})}</div></div>}
    <div className="timeline-heading"><h2>{view==='calendar'?selected.replaceAll('-',' / '):'所有发现'}</h2><span>{items.length} 条</span></div>
    <div className="timeline">{items.map((record,i)=><div className="timeline-row" key={record.id}>{view==='timeline' && (i===0||dayKey(items[i-1].occurredAt)!==dayKey(record.occurredAt)) && <h3>{dayKey(record.occurredAt)}</h3>}{view==='timeline'&&<time>{new Date(record.occurredAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}</time>}<button className="journal-card" onClick={()=>onOpen(record.id)} data-record-id={record.id}><>{view==='timeline'?<PaperPhoto src={record.thumbnail} id={record.id}/>:<img src={record.thumbnail} alt="记录的照片" />}</><span><strong>{record.description||'还没说出口的联想'}</strong>{view==='calendar'&&<time>{new Date(record.occurredAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}</time>}<small>{record.placeName||'地点未填写'} · {statusLabel[record.status]}{record.image.mode==='sample'?' · 示例':''}</small><small>{record.location?'已标位置':'位置未记录'}</small></span><b>↗</b></button></div>)}</div>
    {!items.length && <div className="empty-state"><ReferenceArt kind="cat" /><p>{records.length?'这一天，还没有记录。':'你的每一次观察，会留在这里。'}</p><button className="text-button" onClick={onNew}>去发现一点什么 ↗</button></div>}
    <p className="quiet-note">按发现时间排列 · 日期显示采用本机时区</p>
  </section>;
}
