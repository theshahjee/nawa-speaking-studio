import {detectAudioMime,wavHeader} from './audio.ts';
export type Take = {id:string;sessionId:string;label:string;createdAt:string;seconds:number;mime:string;status:'recording'|'ready';recovered?:boolean;chunkCount:number;encoding?:'pcm16';sampleRate?:number};
const DB_NAME='nawa-local-audio-v2';
let connection:Promise<IDBDatabase>|undefined;
export function openAudioDB():Promise<IDBDatabase>{
 if(!connection) connection=new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new Error('Audio storage is unavailable in this browser.'));return;}
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{const db=req.result;db.createObjectStore('takes',{keyPath:'id'});db.createObjectStore('audio');db.createObjectStore('chunks',{keyPath:['takeId','index']});};
  req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();connection=undefined;};resolve(req.result);};
  req.onerror=()=>{connection=undefined;reject(req.error||new Error('Could not open audio storage.'));};
  req.onblocked=()=>reject(new Error('Close other Nawa tabs to update audio storage.'));
 });
 return connection;
}
function complete(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('Audio storage transaction was cancelled.'));tx.onerror=()=>reject(tx.error||new Error('Your browser could not save the audio.'));});}
function request<T>(r:IDBRequest<T>){return new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
const chunkRange=(id:string)=>IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]);
export async function createTake(take:Take){const db=await openAudioDB();const tx=db.transaction('takes','readwrite');const done=complete(tx);tx.objectStore('takes').add(take);await done;}
export async function appendChunk(id:string,index:number,blob:Blob,seconds:number){
 // Copy while the capture Blob is alive; persist bytes, not file-backed handles.
 const bytes=await blob.arrayBuffer();const db=await openAudioDB();const tx=db.transaction(['chunks','takes'],'readwrite');const done=complete(tx);
 tx.objectStore('chunks').put({takeId:id,index,bytes,mime:blob.type});const meta=tx.objectStore('takes').get(id);
 meta.onsuccess=()=>{if(meta.result)tx.objectStore('takes').put({...meta.result,seconds:Math.max(meta.result.seconds,seconds),chunkCount:Math.max(meta.result.chunkCount,index+1)});};await done;
}
export async function listTakes(sessionId?:string):Promise<Take[]>{const db=await openAudioDB();const tx=db.transaction('takes','readonly');const rows=await request<Take[]>(tx.objectStore('takes').getAll());return rows.filter(t=>!sessionId||t.sessionId===sessionId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}
export async function finaliseTake(id:string,seconds?:number,recovered=false):Promise<Take>{
 const db=await openAudioDB();const read=db.transaction(['takes','chunks'],'readonly');const metaReq=read.objectStore('takes').get(id);const chunkReq=read.objectStore('chunks').getAll(chunkRange(id));const [meta,chunks]=await Promise.all([request<Take|undefined>(metaReq),request<{index:number;blob?:Blob;bytes?:ArrayBuffer;mime?:string}[]>(chunkReq)]);
 if(!meta)throw new Error('Recording no longer exists.');
 if(meta.status==='ready')return meta;
 if(!chunks.length)throw new Error('No audio was captured. Check the microphone and try again.');
 chunks.sort((a,b)=>a.index-b.index);
 const buffers=await Promise.all(chunks.map(async c=>c.bytes??await c.blob!.arrayBuffer()));
 const length=buffers.reduce((n,b)=>n+b.byteLength,0);
 const blob=meta.encoding==='pcm16'?new Blob([wavHeader(length,meta.sampleRate||24000),...buffers],{type:'audio/wav'}):new Blob(buffers,{type:detectAudioMime(buffers[0],meta.mime||chunks[0].mime||chunks[0].blob?.type)});
 if(!blob.size)throw new Error('The recording is empty. Please try again.');
 const next:Take={...meta,mime:blob.type,seconds:meta.encoding==='pcm16'?length/((meta.sampleRate||24000)*2):seconds??meta.seconds,status:'ready',recovered};
 const stored={bytes:await blob.arrayBuffer(),mime:blob.type};
 const tx=db.transaction(['takes','audio','chunks'],'readwrite');const done=complete(tx);tx.objectStore('takes').put(next);tx.objectStore('audio').put(stored,id);tx.objectStore('chunks').delete(chunkRange(id));await done;return next;
}
type StoredAudio=Blob|{bytes:ArrayBuffer;mime:string};
async function readAudio(key:string):Promise<Blob|undefined>{
 const db=await openAudioDB();const tx=db.transaction('audio','readonly');const value=await request<StoredAudio|undefined>(tx.objectStore('audio').get(key));
 if(!value)return undefined;
 const bytes=value instanceof Blob?await value.arrayBuffer():value.bytes;
 const mime=value instanceof Blob?value.type:value.mime;
 return new Blob([bytes],{type:detectAudioMime(bytes,mime)});
}
export async function getTakeAudio(id:string){return readAudio(id);}
export async function getPlaybackAudio(id:string){return await readAudio(id+':wav')??await readAudio(id);}
export async function saveCompatibleAudio(id:string,blob:Blob){
 const bytes=await blob.arrayBuffer();if(detectAudioMime(bytes)!=='audio/wav')throw new Error('Compatible audio must be a WAV file.');
 const db=await openAudioDB();const tx=db.transaction(['audio','takes'],'readwrite');const done=complete(tx);const check=tx.objectStore('takes').get(id);
 check.onsuccess=()=>{if(check.result)tx.objectStore('audio').put({bytes,mime:'audio/wav'},id+':wav');};await done;
}
export async function deleteTake(id:string){const db=await openAudioDB();const tx=db.transaction(['takes','audio','chunks'],'readwrite');const done=complete(tx);tx.objectStore('takes').delete(id);tx.objectStore('audio').delete(id);tx.objectStore('audio').delete(id+':wav');tx.objectStore('chunks').delete(chunkRange(id));await done;}
export async function deleteSessionAudio(sessionId:string){for(const take of await listTakes(sessionId))await deleteTake(take.id);}
export async function recoverInterruptedTakes(){for(const take of await listTakes())if(take.status==='recording'){if(take.chunkCount){await finaliseTake(take.id,undefined,true);}else{await deleteTake(take.id);}}}
