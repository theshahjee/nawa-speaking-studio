import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {appendChunk,createTake,deleteSessionAudio,deleteTake,finaliseTake,getTakeAudio,listTakes,recoverInterruptedTakes,type Take} from '../src/storage.ts';
import {createSession,newDraft,timerAdvance,validateDraft,validSession} from '../src/model.ts';
import {PASSAGES,TRACKS,countWords,filterPassages} from '../src/library.ts';
function meta(id:string,sessionId='test-session'):Take{return{id,sessionId,label:'First take',createdAt:new Date().toISOString(),seconds:0,mime:'audio/webm',status:'recording',chunkCount:0};}
test('audio chunks are combined in order, saved for playback, and removed with their session',async()=>{
 await createTake(meta('ordered'));
 await appendChunk('ordered',1,new Blob(['second'],{type:'audio/webm'}),2);
 await appendChunk('ordered',0,new Blob(['first-'],{type:'audio/webm'}),1);
 const finished=await finaliseTake('ordered',2);
 assert.equal(finished.status,'ready');assert.equal(finished.seconds,2);
 const audio=await getTakeAudio('ordered');assert.equal(await audio!.text(),'first-second');assert.equal(audio!.type,'audio/webm');
 assert.equal((await listTakes('test-session')).length,1);
 await finaliseTake('ordered',99);assert.equal((await listTakes('test-session'))[0].seconds,2);
 await deleteSessionAudio('test-session');assert.equal((await listTakes('test-session')).length,0);assert.equal(await getTakeAudio('ordered'),undefined);
});
test('interrupted captures recover available chunks; empty captures are cleaned up',async()=>{
 await createTake(meta('interrupted','recovery'));await appendChunk('interrupted',0,new Blob(['recover-me']),3);await createTake(meta('empty','recovery'));
 await recoverInterruptedTakes();const rows=await listTakes('recovery');assert.equal(rows.length,1);assert.equal(rows[0].recovered,true);assert.equal(rows[0].status,'ready');assert.equal(await (await getTakeAudio('interrupted'))!.text(),'recover-me');await deleteTake('interrupted');
});
test('an empty recording cannot be reported as a successfully saved take',async()=>{await createTake(meta('no-audio'));await assert.rejects(finaliseTake('no-audio'),/No audio/);await deleteTake('no-audio');});
test('timer accounting includes repeated ticks and clamps at the step boundary',()=>{let t=timerAdvance(0,0,12500,60000);t=timerAdvance(t.elapsed,t.spent,12500,60000);t=timerAdvance(t.elapsed,t.spent,50000,60000);assert.equal(t.elapsed,60000);assert.equal(t.spent,60000);assert.equal(t.complete,true);t=timerAdvance(t.elapsed,t.spent,1000,60000);assert.equal(t.spent,60000);});
test('draft survives serialisation with exact progress, and rejects invalid state',()=>{const d=newDraft();d.phase=2;d.elapsed=17500;d.spent=78000;d.notes='A clearer closing sentence';d.ratings.clarity=4;assert.equal(validateDraft(JSON.parse(JSON.stringify(d))),true);assert.equal(validateDraft({...d,phase:9}),false);assert.equal(validateDraft({...d,elapsed:Infinity}),false);assert.equal(validateDraft({...d,passageId:'missing'}),false);});
test('a journal entry requires four valid self ratings and retains practiced time',()=>{const d=newDraft();assert.throws(()=>createSession(d),/four ratings/);d.ratings={clarity:4,pace:3,confidence:4,control:3};d.spent=72300;const s=createSession(d);assert.equal(s.seconds,72);assert.equal(s.id,d.id);assert.equal(validSession(s),true);assert.equal(validSession({...s,seconds:NaN}),false);});
test('the library offers all tracks, meaningful advanced texts, and discoverable attributed speeches',()=>{assert.equal(new Set(PASSAGES.map(p=>p.id)).size,PASSAGES.length);for(const t of TRACKS){assert.ok(PASSAGES.filter(p=>p.track===t.id).length>=6);assert.ok(PASSAGES.some(p=>p.track===t.id&&p.level==='Advanced'&&countWords(p)>150));}const speeches=filterPassages('','all','all',true);assert.equal(speeches.length,4);assert.ok(speeches.every(p=>p.source?.url.startsWith('https://')));assert.equal(filterPassages('Douglass','english','Advanced',true).length,1);assert.ok(filterPassages('گفتگو','urdu','all',false).length>0);assert.equal(filterPassages('nonsense no reading matches','all','all',false).length,0);});
