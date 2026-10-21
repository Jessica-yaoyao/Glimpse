import type { QualitySuite } from '../types/quality';
import { mergeSuite } from './qualityMerge';
interface Bridge {postMessage(value:Record<string,unknown>):Promise<unknown>}
function bridge():Bridge|undefined{return (window.webkit?.messageHandlers as unknown as Record<string,Bridge>|undefined)?.glimpseRecords;}
export async function loadSuite(runId?:string):Promise<QualitySuite|null>{const native=bridge();if(native)return await native.postMessage({action:'qualityRead',...(runId?{runId}:{})}) as QualitySuite|null;const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('glimpse-quality',1);req.onupgradeneeded=()=>req.result.createObjectStore('suite');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('验收记录读取失败。'));});return new Promise((resolve,reject)=>{const req=db.transaction('suite').objectStore('suite').get(runId??'current');req.onsuccess=()=>{db.close();resolve(req.result??null)};req.onerror=()=>{db.close();reject(new Error('验收记录读取失败。'))};});}
export async function comparisonSuite(create=false):Promise<QualitySuite|null>{const native=bridge();if(!native)throw new Error('轮廓增强对照需要 macOS 应用。');return await native.postMessage({action:create?'qualityComparisonCreate':'qualityComparisonRead'}) as QualitySuite|null;}
export async function saveSuite(suite:QualitySuite):Promise<QualitySuite>{
 const native=bridge();if(native)return await native.postMessage({action:'qualitySave',suite}) as QualitySuite;
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('glimpse-quality',1);req.onupgradeneeded=()=>req.result.createObjectStore('suite');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('验收记录保存失败。'));});
 return new Promise((resolve,reject)=>{const tx=db.transaction('suite','readwrite'),store=tx.objectStore('suite'),key=suite.engine?suite.id:'current';let saved:QualitySuite,error:Error|undefined;const current=store.get(key);current.onsuccess=()=>{const old=current.result as QualitySuite|undefined;if(old&&((old.revision??0)!==(suite.revision??0)||old.id!==suite.id)){error=new Error('验收记录已在另一窗口更新，请重新读取后继续。当前写入未覆盖已有结果。');tx.abort();return;}saved={...suite,revision:(old?.revision??0)+1};store.put(saved,key);};tx.oncomplete=()=>{db.close();resolve(saved)};tx.onerror=tx.onabort=()=>{db.close();reject(error??new Error('验收记录保存失败。'))};});
}
export async function saveSuiteWithBase(suite:QualitySuite,base:QualitySuite):Promise<QualitySuite>{
 try{return await saveSuite(suite);}catch(firstError){
  const current=await loadSuite(suite.engine?suite.id:undefined);
  // Disk errors should remain explicit; retry only an observed new revision.
  if(!current||(current.revision??0)===(suite.revision??0))throw firstError;
  return saveSuite(mergeSuite(base,suite,current));
 }
}
export function qualityPairs(suite:QualitySuite){return [...new Set(suite.tasks.map(t=>t.recordId))].map(id=>({id,tasks:suite.tasks.filter(t=>t.recordId===id),assessment:suite.pairAssessments?.[id]}));}
export function qualitySummary(suite:QualitySuite){
 const tasks=suite.tasks,completed=tasks.filter(t=>t.status==='revealed'||t.status==='failed'),valid=tasks.filter(t=>t.status==='revealed'&&t.receipt?.provider==='kimi-code'&&(!suite.engine||t.receipt.engine===suite.engine)),reviewed=valid.filter(t=>t.assessment),usable=reviewed.filter(t=>t.assessment&&t.assessment.recognizable&&t.assessment.grounded&&t.assessment.withinSelection&&t.assessment.preservesPhoto),times=completed.map(t=>t.elapsedMs??t.receipt?.elapsedMs).filter((n):n is number=>n!==undefined).sort((a,b)=>a-b),p90=times.length?times[Math.ceil(times.length*.9)-1]:null;
 const pairs=qualityPairs(suite),eligible=pairs.filter(p=>p.tasks.length===2&&p.tasks.every(t=>valid.includes(t))),distinct=eligible.filter(p=>p.assessment?.distinct);
 return {completed:completed.length,valid:valid.length,reviewed:reviewed.length,usable:usable.length,p90,pairsReviewed:eligible.filter(p=>p.assessment).length,distinctPairs:distinct.length,eligiblePairs:eligible.length,passed:tasks.length===20&&completed.length===20&&valid.length>=19&&reviewed.length===valid.length&&usable.length>=16&&times.length===20&&p90!==null&&p90<=25000&&pairs.length===10&&pairs.every(p=>p.tasks.length===2)&&eligible.length>=9&&distinct.length===eligible.length};
}

export async function exportSuite(suite:QualitySuite):Promise<void>{const report={suite,summary:qualitySummary(suite)},native=bridge();if(native){await native.postMessage({action:'qualityExport',report});return;}const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='glimpse-quality-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
