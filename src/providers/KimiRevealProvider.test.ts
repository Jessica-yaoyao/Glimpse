import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KimiRevealProvider, NativeRevealTransport } from './KimiRevealProvider.ts';
import type { TransportReply, TransportRequest, RevealTransport } from './KimiRevealProvider.ts';
import { parseOutline } from './revealSchema.ts';
import type { RevealInput } from '../types/reveal.ts';
import { contourCandidates } from './contourGeometry.ts';
const outline = { interpretation: '沿照片结构表达用户的联想', anchors: [{feature:'头',point:[.2,.4]},{feature:'耳',point:[.3,.2]},{feature:'尾',point:[.8,.8]}], paths: Array.from({length:5},(_,index)=>[{op:'M',p:[.1,.1+index*.1]},{op:'Q',p:[.2,.3,.7,.8]}]) };
const input: RevealInput = {image:{src:'original-source',width:1200,height:800,mode:'upload'},selection:{x:.1,y:.2,width:.7,height:.5},perceptionText:'一只狐狸'};
const crop = async () => ({dataUrl:'data:image/jpeg;base64,selected-crop',bounds:input.selection});
function reply(request: TransportRequest, content = JSON.stringify(outline)): TransportReply {return {content,receipt:{provider:'kimi-code',requestId:request.id,model:'kimi-for-coding',requestedModel:'kimi-for-coding',elapsedMs:50,totalTokens:100,promptTokens:40,completionTokens:60,cropSha256:'a'.repeat(64),descriptionSha256:'b'.repeat(64)}};}
test('live provider transmits selected photo and user description, returns normalized SVG and provenance',async()=>{
 const sent:TransportRequest[]=[],steps:string[]=[];
 const transport:RevealTransport={send:async request=>{sent.push(request);return reply(request);}};
 const result=await new KimiRevealProvider(transport,crop).reveal(input,{onProgress:step=>steps.push(step)});
 assert.equal(sent.length,1);assert.equal(sent[0].photo,'data:image/jpeg;base64,selected-crop');assert.equal(sent[0].description,input.perceptionText);
 assert.deepEqual(result.overlay.bounds,input.selection);assert.equal(result.mapping[0].region[0],.1+.2*.7);assert.equal(result.mapping[0].region[1],.2+.4*.5);
 assert.deepEqual(steps,['contours','relations','drawing']);assert.equal(result.receipt?.provider,'kimi-code');assert.equal(result.receipt?.repaired,false);assert.equal(input.image.src,'original-source');
});
test('auth, network and budget failures never fall back to preset paths',async()=>{
 for(const failure of ['鉴权失败','连接失败','预算不足'])await assert.rejects(new KimiRevealProvider({send:async()=>{throw new Error(failure);}},crop).reveal(input),new RegExp(failure));
});
test('malformed outline is repaired once, while repeated invalid response fails instead of rendering',async()=>{
 const requests:TransportRequest[]=[];
 const result=await new KimiRevealProvider({send:async request=>{requests.push(request);return reply(request,requests.length===1?'not-json':JSON.stringify(outline));}},crop).reveal(input);
 assert.equal(requests.length,2);assert.equal(requests[1].repair,'not-json');assert.notEqual(requests[0].id,requests[1].id);assert.equal(result.receipt?.repaired,true);assert.equal(result.receipt?.totalTokens,200);assert.equal(result.receipt?.requestIds?.length,2);
 let calls=0;
 await assert.rejects(new KimiRevealProvider({send:async request=>{calls++;return reply(request,'{"paths":[]}');}},crop).reveal(input),/仍不符合/);assert.equal(calls,2);
});
test('schema rejects executable strings, non-finite/out-of-region points and excessive paths',()=>{
 const altered=structuredClone(outline);altered.paths[0][1].p[0]=1.01;
 assert.throws(()=>parseOutline(JSON.stringify(altered)),/坐标/);
 assert.throws(()=>parseOutline('NaN'));
 assert.throws(()=>parseOutline(JSON.stringify({...outline,paths:Array(16).fill(outline.paths[0])})),/结构/);
 assert.throws(()=>parseOutline(JSON.stringify({...outline,paths:Array(5).fill([{op:'M',p:[0,0]},{op:'<script>',p:[.2,.3]}])})),/曲线/);
});
test('cancellation after response prevents repair, result and subsequent progress',async()=>{
 const controller=new AbortController();let calls=0;
 const provider=new KimiRevealProvider({send:async request=>{calls++;controller.abort();return reply(request,'bad-json');}},crop);
 await assert.rejects(provider.reveal(input,{signal:controller.signal}),{name:'AbortError'});assert.equal(calls,1);
});
test('invalid selection and blank description cause no crop or API request',async()=>{
 let calls=0;
 const provider=new KimiRevealProvider({send:async request=>{calls++;return reply(request);}},crop);
 await assert.rejects(provider.reveal({...input,selection:{...input.selection,width:0}}));await assert.rejects(provider.reveal({...input,perceptionText:' '}));assert.equal(calls,0);
});
test('native transport cancels the same request and ignores a late successful response',async()=>{
 const actions:string[]=[];let complete:(value:TransportReply)=>void=()=>{};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{webkit:{messageHandlers:{glimpseReveal:{postMessage:async(message:Record<string,unknown>)=>{
  actions.push(`${message.action}:${message.id}`);
  if(message.action==='cancel')return {cancelled:true};
  return new Promise<TransportReply>(resolve=>{complete=resolve;});
 }}}}}});
 const request:TransportRequest={action:'reveal',id:'reveal-cancel-test',photo:'crop',description:'fox'};
 const controller=new AbortController();const pending=new NativeRevealTransport().send(request,controller.signal);controller.abort();
 await assert.rejects(pending,{name:'AbortError'});complete(reply(request));await new Promise(resolve=>setTimeout(resolve,5));
 assert.deepEqual(actions,['reveal:reveal-cancel-test','cancel:reveal-cancel-test']);
 Reflect.deleteProperty(globalThis,'window');
});
test('native transport rejects a reply for a different request rather than rendering it',async()=>{
 const request:TransportRequest={action:'reveal',id:'reveal-active-test',photo:'crop',description:'fox'};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{webkit:{messageHandlers:{glimpseReveal:{postMessage:async()=>reply({...request,id:'reveal-stale-test'})}}}}});
 await assert.rejects(new NativeRevealTransport().send(request),/凭据不完整/);
 Reflect.deleteProperty(globalThis,'window');
});
const rawContours = {width:200,height:100,edges:[{points:[[.1,.2],[.3,.4],[.8,.4]] as [number,number][],closed:false}],elapsedMs:13,photoSha256:'a'.repeat(64)};
const enhanced = {extractor:{extract:async()=>rawContours},prepare:async()=>({candidates:contourCandidates(rawContours),image:'candidate-guide'})};
test('guided provider sends original crop plus candidate guide and creates SVG only from selected photo vertices',async()=>{
 const sent:TransportRequest[]=[];
 const result=await new KimiRevealProvider({send:async request=>{sent.push(request);return {...reply(request,JSON.stringify({interpretation:'石缝像侧脸',strokes:[{edgeId:'e01',feature:'鼻梁',part:'whole'}]})),receipt:{...reply(request).receipt,engine:'vision-guided-v1',skillVersion:'glimpse-photo-grounding-v1'}};}},crop,enhanced).reveal(input);
 assert.equal(sent.length,1);assert.equal(sent[0].photo,'data:image/jpeg;base64,selected-crop');assert.equal(sent[0].guidance?.photo,'candidate-guide');assert.ok(sent[0].guidance?.candidates.includes('e01'));
 assert.equal(result.overlay.paths[0],'M 100 200 L 300 400 L 800 400');assert.equal(result.receipt?.engine,'vision-guided-v1');
});
test('no local geometry or an unsupported perception fails honestly without a template or a semantic retry',async()=>{
 let calls=0;
 const transport:RevealTransport={send:async request=>{calls++;return {...reply(request,JSON.stringify({interpretation:'没有足够依据',strokes:[]})),receipt:{...reply(request).receipt,engine:'vision-guided-v1',skillVersion:'glimpse-photo-grounding-v1'}};}};
 await assert.rejects(new KimiRevealProvider(transport,crop,{...enhanced,extractor:{extract:async()=>{throw new Error('提取失败')}}}).reveal(input),/提取失败/);assert.equal(calls,0);
 await assert.rejects(new KimiRevealProvider(transport,crop,enhanced).reveal(input),/不足以表达/);assert.equal(calls,1);
});
