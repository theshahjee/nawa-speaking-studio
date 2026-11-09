import {useEffect,useRef,useState} from 'react';
import {appendChunk,createTake,deleteTake,finaliseTake,type Take} from './storage';
import {usesAppleAudio} from './audio';
import {PCM_SAMPLE_RATE,startPcmCapture} from './pcmCapture';
export function useRecorder(onSaved:()=>void,onMessage:(s:string)=>void){
 const [recording,setRecording]=useState(false),[busy,setBusy]=useState(false),[seconds,setSeconds]=useState(0);
 const native=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),context=useRef<AudioContext|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),started=useRef(0),active=useRef(false),stopping=useRef(false),stopCapture=useRef<(()=>void)|null>(null);
 const savedRef=useRef(onSaved),messageRef=useRef(onMessage);savedRef.current=onSaved;messageRef.current=onMessage;
 function release(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(timer.current)clearInterval(timer.current);timer.current=null;if(context.current){void context.current.close().catch(()=>{});context.current=null;}native.current=null;stopCapture.current=null;active.current=false;stopping.current=false;setRecording(false);}
 useEffect(()=>{const unload=()=>stopCapture.current?.();window.addEventListener('pagehide',unload);return()=>{window.removeEventListener('pagehide',unload);stopCapture.current?.();};},[]);
 async function start(sessionId:string,label:string){
  if(active.current||busy)return;active.current=true;setBusy(true);setSeconds(0);let createdId:string|undefined;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone recording requires HTTPS and browser support. Notes and timers still work.');
   const compatible=usesAppleAudio();
   // Create/resume in the click gesture, before microphone permission resolves.
   if(compatible){const AudioContextClass=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!AudioContextClass)throw new Error('Compatible recording needs an up-to-date Safari browser.');context.current=new AudioContextClass();void context.current.resume().catch(()=>{});}
   const input=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=input;
   let media:MediaRecorder|undefined;
   if(!compatible){if(typeof MediaRecorder==='undefined')throw new Error('This browser cannot record audio. Try an up-to-date Safari or Chrome browser.');const playable=document.createElement('audio');const mime=['audio/webm;codecs=opus','audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m)&&playable.canPlayType(m)!=='');media=new MediaRecorder(input,mime?{mimeType:mime}:undefined);native.current=media;}
   const meta:Take={id:crypto.randomUUID(),sessionId,label,createdAt:new Date().toISOString(),seconds:0,mime:compatible?'audio/wav':media!.mimeType||'audio/webm',status:'recording',chunkCount:0,...(compatible?{encoding:'pcm16',sampleRate:PCM_SAMPLE_RATE}:{})};
   await createTake(meta);createdId=meta.id;started.current=Date.now();let index=0,pending=Promise.resolve(),interrupted=false,finishing=false;
   function warn(message:string){interrupted=true;messageRef.current(message);}
   function chunk(blob:Blob){if(!blob.size)return;const n=index++,length=(Date.now()-started.current)/1000;pending=pending.then(()=>appendChunk(meta.id,n,blob,length)).catch(()=>warn('Audio storage failed. Available audio will be saved; free device storage before recording again.'));}
   async function finish(){if(finishing)return;finishing=true;setBusy(true);setRecording(false);if(timer.current)clearInterval(timer.current);timer.current=null;
    try{await pending;await finaliseTake(meta.id,(Date.now()-started.current)/1000,interrupted);savedRef.current();messageRef.current(interrupted?'Available audio saved after an interruption. Check the ending.':'Take saved automatically on this device.');}
    catch(e){if(!index)await deleteTake(meta.id).catch(()=>{});messageRef.current(e instanceof Error?e.message:'Could not save this recording.');savedRef.current();}
    finally{release();setBusy(false);}
   }
   if(compatible){
    const pcm=await startPcmCapture(context.current!,input,chunk,message=>{warn(message);stopCapture.current?.();});
    stopCapture.current=()=>{if(stopping.current)return;stopping.current=true;setBusy(true);void pcm.stop().catch(()=>warn('The recording was interrupted; available audio will be kept.')).then(finish);};
   }else{
    media!.ondataavailable=e=>chunk(e.data);media!.onstop=()=>void finish();media!.onerror=()=>{warn('The microphone stopped unexpectedly. Available audio will be saved.');if(media!.state==='recording')stopCapture.current?.();};
    stopCapture.current=()=>{if(stopping.current)return;stopping.current=true;setBusy(true);if(media!.state==='recording')media!.stop();else void finish();};
    media!.start(1000);
   }
   started.current=Date.now();setRecording(true);setBusy(false);
   timer.current=setInterval(()=>{const s=Math.floor((Date.now()-started.current)/1000);setSeconds(s);if(s>=900)stopCapture.current?.();},250);
  }catch(e){release();setBusy(false);if(createdId)await deleteTake(createdId).catch(()=>{});let message=e instanceof Error?e.message:'Could not start recording.';if(e instanceof DOMException&&e.name==='NotAllowedError')message='Microphone access was not granted. Allow it in the browser’s site settings, then try again. Notes and timers still work.';if(e instanceof DOMException&&e.name==='NotFoundError')message='No microphone was found. Connect a microphone, then try again.';messageRef.current(message);}
 }
 return {recording,busy,seconds,start,stop:()=>stopCapture.current?.()};
}
