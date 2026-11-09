import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import 'fake-indexeddb/auto';
import {audioBufferToWav,audioExtension,detectAudioMime,usesAppleAudio,wavHeader} from '../src/audio.ts';
import {appendChunk,createTake,deleteTake,finaliseTake,getPlaybackAudio,getTakeAudio,openAudioDB,recoverInterruptedTakes,saveCompatibleAudio,type Take} from '../src/storage.ts';
test('iPhone, iPad desktop mode, and Safari use compatible capture; desktop Chrome does not',()=>{
 assert.equal(usesAppleAudio('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/142 Mobile','iPhone',5),true);
 assert.equal(usesAppleAudio('Mozilla/5.0 (Macintosh) AppleWebKit Safari','MacIntel',5),true);
 assert.equal(usesAppleAudio('Mozilla/5.0 (Macintosh) AppleWebKit Version/26 Safari','MacIntel',0),true);
 assert.equal(usesAppleAudio('Mozilla/5.0 (Macintosh) AppleWebKit Chrome/140 Safari','MacIntel',0),false);
 assert.equal(usesAppleAudio('Mozilla/5.0 Android AppleWebKit Chrome/140','Linux',5),false);
});
test('WAV headers describe the exact PCM duration and download type',()=>{
 const header=wavHeader(48000,24000),v=new DataView(header);assert.equal(detectAudioMime(header),'audio/wav');assert.equal(v.getUint32(4,true),48036);assert.equal(v.getUint32(24,true),24000);assert.equal(v.getUint32(28,true),48000);assert.equal(v.getUint32(40,true),48000);assert.equal(audioExtension('audio/wav'),'wav');assert.equal(audioExtension('audio/mp4; codecs=mp4a.40.2'),'m4a');assert.throws(()=>wavHeader(-1,24000));
});
test('decoded compatible copies interleave channels and clamp signed PCM safely',async()=>{
 const wav=audioBufferToWav({numberOfChannels:2,length:3,sampleRate:24000,getChannelData:c=>new Float32Array(c?[0,1,-1]:[-2,.5,2])});const b=await wav.arrayBuffer(),v=new DataView(b);assert.equal(wav.type,'audio/wav');assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(40,true),12);assert.deepEqual(Array.from({length:6},(_,i)=>v.getInt16(44+i*2,true)),[-32768,0,16383,32767,32767,-32768]);
});
function processor(rate:number){
 const messages:{type:string;data?:ArrayBuffer}[]=[];let Processor:any;
 vm.runInNewContext(readFileSync(new URL('../src/pcm.worklet.js',import.meta.url),'utf8'),{sampleRate:rate,AudioWorkletProcessor:class{port={onmessage:undefined,postMessage:(m:{type:string;data?:ArrayBuffer})=>messages.push(m)}},registerProcessor:(_name:string,p:any)=>{Processor=p}});
 return {node:new Processor(),messages};
}
test('real worklet resampling maintains sample order, flushes the final short block, and stops',()=>{
 for(const rate of [44100,48000]){
  const {node,messages}=processor(rate);const frames=rate*1.25;
  for(let at=0;at<frames;at+=128){const n=Math.min(128,frames-at);node.process([[new Float32Array(n).fill(.25),new Float32Array(n).fill(.75)]]);}
  node.port.onmessage({data:{type:'stop'}});const buffers=messages.filter(m=>m.type==='pcm').map(m=>m.data!);assert.equal(buffers.length,2);assert.equal(buffers.reduce((n,b)=>n+b.byteLength,0),60000);assert.equal(new DataView(buffers[0]).getInt16(0,true),16383);assert.equal(messages.at(-1)?.type,'stopped');assert.equal(node.process([[new Float32Array(128)]]),false);const count=messages.length;node.port.onmessage({data:{type:'stop'}});assert.equal(messages.length,count);
 }
});
const meta=(id:string):Take=>({id,sessionId:'pcm-test',label:'PCM',createdAt:new Date().toISOString(),seconds:0,mime:'audio/wav',status:'recording',chunkCount:0,encoding:'pcm16',sampleRate:24000});
test('PCM recovery creates a complete WAV instead of treating raw PCM as encoded audio',async()=>{
 await createTake(meta('pcm-recovery'));await appendChunk('pcm-recovery',0,new Blob([new ArrayBuffer(48000)]),1);await appendChunk('pcm-recovery',1,new Blob([new ArrayBuffer(24000)]),1.5);
 await recoverInterruptedTakes();const wav=await getTakeAudio('pcm-recovery');assert.equal(wav?.size,72044);assert.equal(wav?.type,'audio/wav');assert.equal(new DataView(await wav!.arrayBuffer()).getUint32(40,true),72000);assert.equal((await finaliseTake('pcm-recovery')).seconds,1.5);await deleteTake('pcm-recovery');
});
test('legacy Blob records remain readable and compatible copies do not overwrite the original',async()=>{
 const db=await openAudioDB();await createTake({...meta('legacy-audio'),status:'ready',encoding:undefined,mime:'audio/webm'});
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('audio','readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.objectStore('audio').put(new Blob(['original encoded bytes'],{type:'audio/webm'}),'legacy-audio')});
 assert.equal(await (await getTakeAudio('legacy-audio'))!.text(),'original encoded bytes');
 const wav=new Blob([wavHeader(4,24000),new ArrayBuffer(4)],{type:'audio/wav'});await saveCompatibleAudio('legacy-audio',wav);
 assert.equal((await getPlaybackAudio('legacy-audio'))!.type,'audio/wav');assert.equal(await (await getTakeAudio('legacy-audio'))!.text(),'original encoded bytes');await deleteTake('legacy-audio');assert.equal(await getPlaybackAudio('legacy-audio'),undefined);
});
test('new audio is persisted as independent byte buffers rather than browser-backed Blobs',async()=>{
 await createTake({...meta('byte-store'),encoding:undefined,mime:'audio/webm'});await appendChunk('byte-store',0,new Blob(['safe bytes'],{type:'audio/webm'}),1);await finaliseTake('byte-store',1);const db=await openAudioDB();const stored=await new Promise<any>((resolve,reject)=>{const req=db.transaction('audio','readonly').objectStore('audio').get('byte-store');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});assert.ok(stored.bytes instanceof ArrayBuffer);assert.equal(stored.mime,'audio/webm');assert.equal(stored instanceof Blob,false);await deleteTake('byte-store');
});
