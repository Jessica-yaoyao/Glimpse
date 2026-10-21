import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mergeSuite} from './qualityMerge.ts';
import type {QualitySuite} from '../types/quality.ts';
const fixture=():QualitySuite=>({schemaVersion:1,id:'fixed',createdAt:0,revision:1,excludedFiles:[],tasks:Array.from({length:20},(_,i)=>({id:`task-${i}`,recordId:`photo-${i}`,filename:'photo.jpg',description:'固定联想',selection:{x:.1,y:.1,width:.8,height:.8},originalSha256:'a'.repeat(64),status:'pending'}))});
test('independent task edits rebase without losing another window result',()=>{
 const base=fixture(),proposed=structuredClone(base),current=structuredClone(base);
 proposed.tasks[0].status='processing';proposed.tasks[0].startedAt=5;
 current.tasks[1].status='failed';current.tasks[1].failure='真实失败';current.revision=2;
 const merged=mergeSuite(base,proposed,current);
 assert.equal(merged.tasks[0].status,'processing');assert.deepEqual(merged.tasks[1],current.tasks[1]);assert.equal(merged.revision,2);
});
test('a changed first outcome cannot be replaced by a stale result',()=>{
 const base=fixture(),proposed=structuredClone(base),current=structuredClone(base);
 proposed.tasks[0].status='revealed';current.tasks[0].status='failed';
 assert.throws(()=>mergeSuite(base,proposed,current),/另一窗口更新/);
});
test('same persisted outcome is idempotent',()=>{
 const base=fixture(),proposed=structuredClone(base);proposed.tasks[0].status='failed';
 assert.deepEqual(mergeSuite(base,proposed,proposed).tasks,proposed.tasks);
});
test('different fixed task collection is rejected',()=>{
 const base=fixture(),current=fixture();current.id='other';
 assert.throws(()=>mergeSuite(base,base,current),/任务集已变化/);
});
test('pair review preserves another window task outcome',()=>{
 const base=fixture(),proposed=structuredClone(base),current=structuredClone(base);
 proposed.pairAssessments={'photo-0':{distinct:true,reviewedAt:5}};current.tasks[1].status='failed';
 const merged=mergeSuite(base,proposed,current);
 assert.equal(merged.pairAssessments?.['photo-0'].distinct,true);assert.equal(merged.tasks[1].status,'failed');
});
test('conflicting pair ratings stay explicit',()=>{
 const base=fixture(),proposed=structuredClone(base),current=structuredClone(base);
 proposed.pairAssessments={'photo-0':{distinct:true,reviewedAt:5}};
 current.pairAssessments={'photo-0':{distinct:false,reviewedAt:6}};
 assert.throws(()=>mergeSuite(base,proposed,current),/对比评阅已/);
});
