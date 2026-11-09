export type Take = {id:string;sessionId:string;label:string;createdAt:string;seconds:number;mime:string;status:'recording'|'ready';recovered?:boolean;chunkCount:number};
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
export async function appendChunk(id:string,index:number,blob:Blob,seconds:number){const db=await openAudioDB();const tx=db.transaction(['chunks','takes'],'readwrite');const done=complete(tx);tx.objectStore('chunks').put({takeId:id,index,blob});const meta=tx.objectStore('takes').get(id);meta.onsuccess=()=>{if(meta.result)tx.objectStore('takes').put({...meta.result,seconds,chunkCount:index+1});};await done;}
export async function listTakes(sessionId?:string):Promise<Take[]>{const db=await openAudioDB();const tx=db.transaction('takes','readonly');const rows=await request<Take[]>(tx.objectStore('takes').getAll());return rows.filter(t=>!sessionId||t.sessionId===sessionId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}
export async function finaliseTake(id:string,seconds?:number,recovered=false):Promise<Take>{
 const db=await openAudioDB();const read=db.transaction(['takes','chunks'],'readonly');const metaReq=read.objectStore('takes').get(id);const chunkReq=read.objectStore('chunks').getAll(chunkRange(id));const [meta,chunks]=await Promise.all([request<Take|undefined>(metaReq),request<{index:number;blob:Blob}[]>(chunkReq)]);
 if(!meta)throw new Error('Recording no longer exists.');
 if(meta.status==='ready')return meta;
 if(!chunks.length)throw new Error('No audio was captured. Check the microphone and try again.');
 chunks.sort((a,b)=>a.index-b.index);const blob=new Blob(chunks.map(c=>c.blob),{type:meta.mime||chunks[0].blob.type});
 if(!blob.size)throw new Error('The recording is empty. Please try again.');
 const next:Take={...meta,seconds:seconds??meta.seconds,status:'ready',recovered};
 const tx=db.transaction(['takes','audio','chunks'],'readwrite');const done=complete(tx);tx.objectStore('takes').put(next);tx.objectStore('audio').put(blob,id);tx.objectStore('chunks').delete(chunkRange(id));await done;return next;
}
export async function getTakeAudio(id:string):Promise<Blob|undefined>{const db=await openAudioDB();const tx=db.transaction('audio','readonly');return request<Blob|undefined>(tx.objectStore('audio').get(id));}
export async function deleteTake(id:string){const db=await openAudioDB();const tx=db.transaction(['takes','audio','chunks'],'readwrite');const done=complete(tx);tx.objectStore('takes').delete(id);tx.objectStore('audio').delete(id);tx.objectStore('chunks').delete(chunkRange(id));await done;}
export async function deleteSessionAudio(sessionId:string){for(const take of await listTakes(sessionId))await deleteTake(take.id);}
export async function recoverInterruptedTakes(){for(const take of await listTakes())if(take.status==='recording'){if(take.chunkCount){await finaliseTake(take.id,undefined,true);}else{await deleteTake(take.id);}}}
