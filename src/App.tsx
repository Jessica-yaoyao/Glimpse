import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { LoadingSequence } from './components/LoadingSequence';
import { Launch } from './pages/Launch';
import { PhotoSource } from './pages/PhotoSource';
import { Observation } from './pages/Observation';
import { introductionComplete,completeIntroduction } from './platform/presentation';
import { Home } from './pages/Home';
import { Capture } from './pages/Capture';
import { Describe } from './pages/Describe';
import { Reveal } from './pages/Reveal';
import { Settings } from './pages/Settings';
import { Journal } from './pages/Journal';
import { Quality } from './pages/Quality';
import { comparisonSuite,loadSuite,saveSuiteWithBase } from './store/quality';
import type { QualitySuite,QualityTask } from './types/quality';
import { InspirationMap } from './pages/InspirationMap';
import { InspirationDetail } from './pages/InspirationDetail';
import { sampleImage } from './data/samples';
import { MockRevealProvider } from './providers/MockRevealProvider';
import { KimiRevealProvider } from './providers/KimiRevealProvider';
import { NativeContourExtractor, nativeContoursAvailable } from './providers/ContourExtractor';
import { isNativeSettings } from './platform/kimiSettings';
import { createRepository, thumbnail } from './store/InspirationRepository';
import { readImage } from './utils/upload';
import { validSelection } from './utils/selection';
import type { Inspiration, InspirationPatch } from './types/inspiration';
import type { AppStage, RevealInput, RevealProvider, RevealResult, Selection, SourceImage, SelectionMask } from './types/reveal';
const defaultProvider: RevealProvider = isNativeSettings() && !window.glimpseDemo ? new KimiRevealProvider() : new MockRevealProvider();
const guidedProvider = new KimiRevealProvider(undefined, undefined, {extractor:new NativeContourExtractor()});
const repository = createRepository();
export default function App({ provider = defaultProvider }: { provider?: RevealProvider }) {
  const [stage, setStage] = useState<AppStage>(window.glimpseStartQuality?'quality':window.glimpseSkipIntro?'home':'splash'), [image,setImage]=useState<SourceImage|null>(null), [selection,setSelection]=useState<Selection|null>(null), [mask,setMask]=useState<SelectionMask|undefined>(), [text,setText]=useState('');
  const [input,setInput]=useState<RevealInput|null>(null), [result,setResult]=useState<RevealResult|null>(null), [error,setError]=useState(''), [busy,setBusy]=useState(false), [uploadMessage,setUploadMessage]=useState('');
  const [introReady,setIntroReady]=useState(Boolean(window.glimpseStartQuality||window.glimpseSkipIntro));
  const [sourceReturn,setSourceReturn]=useState<AppStage>('home'),[journalView,setJournalView]=useState<'calendar'|'timeline'>('calendar'),[introBusy,setIntroBusy]=useState(false);
  const [recordsReady,setRecordsReady]=useState(false);
  const [records,setRecords]=useState<Inspiration[]>([]), [record,setRecord]=useState<Inspiration|null>(null), [saving,setSaving]=useState(false), [saveFailed,setSaveFailed]=useState(false);
  const [qualityViewVersion,setQualityViewVersion]=useState<string|undefined>();
  const [qualityReviewTaskId,setQualityReviewTaskId]=useState<string|undefined>();
  const [suite,setSuite]=useState<QualitySuite|null>(null),[qualityTask,setQualityTask]=useState<QualityTask|null>(null),[qualitySaveFailed,setQualitySaveFailed]=useState(false);
  const [processingProvider,setProcessingProvider] = useState<RevealProvider>(()=>provider);
  const resultQualityTask = result?.receipt ? suite?.tasks.find(task=>task.status==='revealed'&&task.receipt?.requestId===result.receipt?.requestId) : undefined;
  const pendingSuite=useRef<QualitySuite|null>(null);
  const pendingSuiteBase=useRef<QualitySuite|null>(null);
  const submitting=useRef(false), pendingVersion=useRef<Inspiration['versions'][number]|null>(null);
  const mobileCamera=useRef<HTMLInputElement>(null);
  const fileInput=useRef<HTMLInputElement>(null), main=useRef<HTMLElement>(null), uploadId=useRef(0), saveQueue=useRef(Promise.resolve()), currentId=useRef<string|null>(null);
  const refresh=useCallback(async()=>{setRecords(await repository.list());setRecordsReady(true);},[]);
  useEffect(()=>{let active=true;if(!window.glimpseStartQuality&&!window.glimpseSkipIntro)void introductionComplete().then(complete=>{if(active&&complete)setStage(current=>current==='splash'?'home':current);}).catch(()=>{if(active)setError('开屏设置无法读取，可以继续使用并从设置重看。');}).finally(()=>{if(active)setIntroReady(true);});return()=>{active=false;};},[]);
  async function finishIntro(){setIntroBusy(true);try{await completeIntroduction();setStage('home');setError('');}catch{setError('开屏状态未保存，请重试；你的照片和日志仍保留。');}finally{setIntroBusy(false);}}
  function openSource(){setSourceReturn(stage);void navigate('source');}
  function openJournal(view:'calendar'|'timeline'){setJournalView(view);void navigate('journal');}
  useEffect(()=>{void loadSuite().then(setSuite).catch(e=>setError(e.message));void refresh().catch(e=>setError(e instanceof Error?e.message:'照片仓库读取失败，请重新打开应用。'));},[refresh]);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});main.current?.focus({preventScroll:true});document.title=`${{splash:'灵感显影',welcome:'观察引导',observation:'灵感观察',source:'添加记录',home:'灵感显影',capture:'选择区域',describe:'描述你的联想',processing:'正在显影',reveal:'你的显影',settings:'显影设置',journal:'灵感日志',detail:'灵感详情',map:'灵感地图',quality:'质量验收'}[stage]} · Glimpse`;},[stage]);
  async function persist(patch:InspirationPatch, id=currentId.current) {
    if(!id)return;setSaving(true);
    const operation=saveQueue.current.catch(()=>{}).then(async()=>{const value=await repository.patch(id,patch);if(currentId.current===id)setRecord(value);await refresh();});
    saveQueue.current=operation;
    try{await operation;setSaveFailed(false);}catch(e){setSaveFailed(true);setError(e instanceof Error?e.message:'保存失败，修改暂留在当前页面，请重试。');throw e;}finally{setSaving(false);}
  }
  useEffect(()=>{if(!record||!['capture','describe'].includes(stage))return;const timer=setTimeout(()=>{void persist({description:text,selection,mask:mask??null as unknown as SelectionMask}).catch(()=>{});},350);return()=>clearTimeout(timer);},[text,selection,mask,stage,record?.id]);
  function resume(value:Inspiration) {pendingVersion.current=null;currentId.current=value.id;setRecord(value);setImage(value.image);setSelection(value.selection);setMask(value.mask??undefined);setText(value.description);setInput(null);setResult(null);setError('');setSaveFailed(false);setStage(value.selection?'describe':'capture');}
  async function start(source:SourceImage,original:Blob,importId:number){const preview=await thumbnail(source);if(importId!==uploadId.current)return;setQualityTask(null);const value=await repository.create({image:source,original,thumbnail:preview,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});await refresh();if(importId!==uploadId.current)return;resume(value);setStage('capture');}
  async function sample(){const id=++uploadId.current;setBusy(true);setError('');try{const response=await fetch(sampleImage.src);if(!response.ok)throw new Error('示例照片无法打开。');await start(sampleImage,await response.blob(),id);}catch(e){if(id===uploadId.current)setError(e instanceof Error?e.message:'示例保存失败。');}finally{if(id===uploadId.current)setBusy(false);}}
  async function persistSuite(next:QualitySuite){if(pendingSuite.current!==next||!pendingSuiteBase.current)pendingSuiteBase.current=suite;pendingSuite.current=next;try{const saved=await saveSuiteWithBase(next,pendingSuiteBase.current??next);setSuite(saved);if(pendingSuite.current===next){pendingSuite.current=null;pendingSuiteBase.current=null;}setQualitySaveFailed(false);return saved;}catch(e){setQualitySaveFailed(true);setError(e instanceof Error?`${e.message} 当前结果仍保留在页面中。`:'验收记录未保存，请重试保存。');throw e;}}
  const reloadSuite = () => loadSuite(suite?.engine?suite.id:undefined);
  async function switchQuality(enhanced:boolean){if(busy)return;if(pendingSuite.current){setError('请先保存待保存的验收记录，再切换任务集。');return;}setBusy(true);setError('');try{const value=enhanced?await comparisonSuite(true):await loadSuite();setQualityTask(null);setQualityReviewTaskId(undefined);setSuite(value);}catch(e){setError(e instanceof Error?e.message:'对照任务读取失败，请重试。');}finally{setBusy(false);}}
  async function navigate(next:AppStage){uploadId.current++;try{if(['capture','describe'].includes(stage))await persist({description:text,selection,mask:mask??null as unknown as SelectionMask});if(stage==='processing'){if(qualityTask)failed('使用者离开显影页面；计入首次任务失败，已发送请求用量保守保留。');else await persist({status:'draft'});}await saveQueue.current;}catch{return;}setBusy(false);setStage(next);}
  function reviewVersion(versionId:string){const task=suite?.tasks.find(t=>t.status==='revealed'&&t.versionId===versionId);if(!task){setError('对应的验收记录仍在保存，请稍后再评分。');return;}setQualityReviewTaskId(task.id);void navigate('quality');}
  function home(){void navigate('home');}
  function back(){if(stage==='source'){void navigate(sourceReturn);return;}void navigate(stage==='capture'?'home':stage==='describe'?'capture':stage==='processing'||stage==='reveal'?'describe':stage==='detail'?(qualityViewVersion?'quality':'journal'):'home');}
  async function upload(file?:File){if(!file)return;const id=++uploadId.current;setBusy(true);setError('');setUploadMessage(file.size>4*1024*1024?'图片有点大，我们帮你压缩预览，保留原文件。':'正在保存照片…');try{const source=await readImage(file);if(id===uploadId.current)await start(source,file,id);}catch(e){if(id===uploadId.current)setError(e instanceof Error?e.message:'照片打开失败，请重试。');}finally{if(id===uploadId.current)setBusy(false);}}
  async function submit(){if(submitting.current)return;if(pendingSuite.current||saveFailed){setError('请先重试保存当前记录，再发起新的显影。');return;}if(!image||!selection||!validSelection(selection)){setStage('capture');return;}if(!text.trim()){setError('告诉我你刚刚看到了什么。');return;}submitting.current=true;let startedQualitySuite:QualitySuite|undefined;try{if(qualityTask&&(text.trim()!==qualityTask.description||JSON.stringify(selection)!==JSON.stringify(qualityTask.selection)||mask!==undefined))throw new Error('验收任务的描述和区域已固定；请返回验收入口重新打开任务。');if(qualityTask&&suite){await persist({description:text.trim(),selection,mask:mask??null as unknown as SelectionMask});const next={...suite,tasks:suite.tasks.map(task=>task.id===qualityTask.id?{...task,status:'processing' as const,startedAt:Date.now()}:task)};startedQualitySuite=await persistSuite(next);}await persist({description:text.trim(),selection,mask:mask??null as unknown as SelectionMask,status:'processing'});setProcessingProvider(qualityTask&&suite?.engine==='vision-guided-v1'?guidedProvider:provider);setInput({image,selection:{...selection},perceptionText:text.trim(),mask});setResult(null);setStage('processing');}catch(e){if(startedQualitySuite&&qualityTask){const taskId=qualityTask.id;setQualityTask(null);void persistSuite({...startedQualitySuite,tasks:startedQualitySuite.tasks.map(task=>task.id===taskId?{...task,status:'failed' as const,failure:'发起前照片状态保存失败，未发送模型请求。',elapsedMs:task.startedAt?Date.now()-task.startedAt:undefined}:task)}).catch(()=>{});}if(e instanceof Error)setError(e.message);}finally{submitting.current=false;}}
  function failed(message:string){void persist({status:'failed'}).catch(()=>{});if(qualityTask&&suite){const next={...suite,tasks:suite.tasks.map(task=>task.id===qualityTask.id&&task.status!=='revealed'?{...task,status:'failed' as const,failure:message,elapsedMs:task.startedAt?Date.now()-task.startedAt:undefined}:task)};setQualityTask(null);void persistSuite(next).catch(()=>{});}}
  const complete=useCallback((value:RevealResult)=>{setResult(value);setStage('reveal');},[]);
  useEffect(()=>{if(stage!=='reveal'||!input||!result||!record)return;const version={id:crypto.randomUUID(),createdAt:Date.now(),description:input.perceptionText,selection:input.selection,...(input.mask?{mask:input.mask}:{}),result};pendingVersion.current=version;if(qualityTask&&suite){pendingSuite.current={...suite,tasks:suite.tasks.map(task=>task.id===qualityTask.id?{...task,status:'revealed' as const,versionId:version.id,receipt:result.receipt,elapsedMs:task.startedAt?Date.now()-task.startedAt:undefined}:task)};setQualityTask(null);}void persist({status:'revealed',versions:[...record.versions,version]}).then(async()=>{if(pendingSuite.current)await persistSuite(pendingSuite.current);}).catch(()=>{});},[result]);
  async function openRecord(id:string){setQualityViewVersion(undefined);setBusy(true);setError('');try{const value=await repository.get(id);currentId.current=id;setRecord(value);setStage('detail');}catch(e){setError(e instanceof Error?e.message:'记录无法打开。');}finally{setBusy(false);}}
  if(!introReady)return <div className="app-shell" data-stage="initializing"><main aria-busy="true"><p className="quiet-note">正在打开…</p></main></div>;
  return <div className="app-shell" data-stage={stage}>{!['splash','welcome','source'].includes(stage)&&<Header home={stage==='home'} onHome={home} onBack={back} onSettings={stage==='home'?()=>void navigate('settings'):undefined}/>}
    <input ref={mobileCamera} className="camera-file-input" type="file" accept="image/*" capture="environment" aria-label="系统相机照片" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
    <input ref={fileInput} className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" aria-label="上传照片文件" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
    <main ref={main} tabIndex={-1}>{error&&<div className="error-banner" role="alert">{error}<button onClick={()=>setError('')} aria-label="关闭错误提示">×</button></div>}{qualitySaveFailed&&<p className="save-status" role="alert">验收记录保存未完成<button onClick={()=>{if(pendingSuite.current)void persistSuite(pendingSuite.current).catch(()=>{});}}>重试保存验收记录</button><button onClick={()=>void reloadSuite().then(value=>{setSuite(value);pendingSuite.current=null;pendingSuiteBase.current=null;setQualitySaveFailed(false);setError('已重新读取磁盘中的验收记录；照片详情中的显影历史仍保留。');}).catch(e=>setError(e.message))}>保留磁盘验收结果，取消待保存修改</button></p>}{busy&&<p className="upload-status" role="status">{uploadMessage||'正在读取…'}</p>}
      {['capture','describe','reveal'].includes(stage)&&record&&<p className="save-status" role="status">{saving?'正在保存到日志…':saveFailed?'保存未完成':`已保存到日志 · ${new Date(record.uploadedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`}{saveFailed&&<button onClick={()=>void persist({description:text,selection,status:result?'revealed':'draft',mask:mask??null as never,versions:pendingVersion.current&&!record.versions.some(v=>v.id===pendingVersion.current!.id)?[...record.versions,pendingVersion.current]:record.versions}).then(async()=>{if(pendingSuite.current)await persistSuite(pendingSuite.current);}).catch(()=>{})}>重试保存</button>}{saveFailed&&<button onClick={()=>currentId.current&&void openRecord(currentId.current)}>查看磁盘记录</button>}</p>}
      {(stage==='splash'||stage==='welcome')&&<Launch page={stage} busy={introBusy} onNext={()=>stage==='splash'?setStage('welcome'):void finishIntro()} onSkip={()=>void finishIntro()}/>}
      {stage==='home'&&<Home records={records} onSample={()=>void navigate('observation')} onUpload={openSource} onOpen={id=>void openRecord(id)} onJournal={openJournal} busy={busy} live={provider.kind==='kimi-code'}/>}
      {stage==='observation'&&<Observation onSample={()=>void sample()} onUpload={openSource} busy={busy} live={provider.kind==='kimi-code'}/>}
      {stage==='source'&&<PhotoSource onFile={upload} onLibrary={()=>fileInput.current?.click()} onMobileCamera={()=>mobileCamera.current?.click()} onCancel={()=>void navigate(sourceReturn)} busy={busy}/>}
      {stage==='capture'&&image&&<Capture image={image} selection={selection} mask={mask} onMask={setMask} onSelect={setSelection} onNext={()=>setStage('describe')} onUpload={openSource} busy={busy}/>}
      {qualityTask&&stage==='describe'&&<p className="save-status">固定验收任务 · 描述和选区已确定</p>}{stage==='describe'&&image&&selection&&<Describe image={image} selection={selection} text={text} onText={setText} onNext={()=>void submit()} onEdit={()=>setStage('capture')} live={provider.kind==='kimi-code'}/>}
      {stage==='processing'&&input&&<LoadingSequence input={input} provider={processingProvider} onComplete={complete} onFailure={failed} onCancel={()=>{if(qualityTask)failed('使用者取消；计入首次任务失败，已发送请求用量保守保留。');else void persist({status:'draft'}).catch(()=>{});setStage('describe');}}/>}
      {stage==='reveal'&&input&&result&&<Reveal input={input} result={result} onRestart={home} onEdit={()=>setStage('describe')} onReview={resultQualityTask?.versionId?()=>reviewVersion(resultQualityTask.versionId!):undefined}/>}
      {stage==='settings'&&<><Settings/><button className="button secondary replay-intro" onClick={()=>setStage('splash')}>重看开屏 ↗</button><button className="button secondary" onClick={()=>{setQualityReviewTaskId(undefined);setStage('quality');}}>质量验收 · 固定 20 项 ↗</button></>}
      {stage==='quality'&&<>{nativeContoursAvailable()&&<div className="quality-switch" aria-label="验收任务集"><button className="text-button" disabled={busy||!suite?.engine} aria-pressed={!suite?.engine} onClick={()=>void switchQuality(false)}>原版基线</button><button className="text-button" disabled={busy||Boolean(suite?.engine)} aria-pressed={Boolean(suite?.engine)} onClick={()=>void switchQuality(true)}>轮廓增强对照 ↗</button><p className="field-help">对照沿用固定20项，只在你点击「让它显现」时调用 Kimi；重新打开不会重置已有首次结果。候选参考图会增加图片输入 Token，仍计入本轮总量限额。</p></div>}<button className="text-button" onClick={()=>void reloadSuite().then(value=>{if(pendingSuite.current){setError('有尚未保存的验收结果，请先重试保存；重新读取不会丢弃当前结果。');return;}setSuite(value);setError('');}).catch(e=>setError(e.message))}>重新读取本机验收记录 ↻</button><Quality key={suite?.id} suite={suite} initialReviewTaskId={qualityReviewTaskId} onRun={task=>{if(pendingSuite.current){setError('请先重试保存当前验收记录。');return;}if(task.status==='pending'&&provider.kind!=='kimi-code'){setError('质量验收需要 macOS 应用的实时 Kimi Provider。预置演示不计为有效结果。');return;}void repository.get(task.recordId).then(value=>{if(task.status==='revealed'){setQualityViewVersion(task.versionId);setRecord(value);currentId.current=value.id;setStage('detail');return;}setQualityTask(task);resume(value);setSelection(task.selection);setMask(undefined);setText(task.description);setStage('describe');}).catch(e=>setError(e instanceof Error?e.message:'验收照片无法打开，请检查本机记录。'));}} onReview={async(task,assessment)=>{if(!suite)return;if(pendingSuite.current)throw new Error('请先保存待保存的验收记录。');const next={...suite,tasks:suite.tasks.map(t=>t.id===task.id?{...t,assessment}:t)};await persistSuite(next);}} onReviewPair={async(id,assessment)=>{if(!suite)return;if(pendingSuite.current)throw new Error('请先保存待保存的验收记录。');await persistSuite({...suite,pairAssessments:{...suite.pairAssessments,[id]:assessment}});}}/></>}
      {stage==='map'&&<InspirationMap records={records} onOpen={id=>void openRecord(id)}/>}
      {stage==='journal'&&!recordsReady&&<div className="empty-state"><p>正在读取本机照片仓库…</p><button className="text-button" onClick={()=>void refresh().catch(e=>setError(e.message))}>重试读取</button></div>}
      {stage==='journal'&&recordsReady&&<Journal initialView={journalView} records={records} onOpen={id=>void openRecord(id)} onNew={openSource}/>}
      {stage==='detail'&&record&&<InspirationDetail key={`${record.id}-${qualityViewVersion??''}`} selectedVersionId={qualityViewVersion} record={record} reviewableVersionIds={suite?.tasks.filter(t=>t.status==='revealed'&&t.recordId===record.id).flatMap(t=>t.versionId?[t.versionId]:[])} onReview={reviewVersion} onSave={patch=>persist({...patch,location:patch.location??null as never})} onEdit={()=>resume(record)} onDelete={async()=>{await repository.remove(record.id);currentId.current=null;setRecord(null);await refresh();setStage('journal');}} onOriginal={()=>repository.original(record.id)}/>}
    </main>
    {['home','journal','map'].includes(stage)&&<nav className="main-nav" aria-label="主导航"><button aria-current={stage==='home'?'page':undefined} onClick={home}><Icon name="home" size={27}/><span>发现</span></button><button aria-current={stage==='journal'?'page':undefined} onClick={()=>openJournal('calendar')}><Icon name="journal" size={27}/><span>日志 <small>{records.length}</small></span></button><button aria-current={stage==='map'?'page':undefined} onClick={()=>void navigate('map')}><Icon name="map" size={27}/><span>地图</span></button></nav>}
  </div>;
}
