import {useEffect,useRef,useState} from 'react';
import {appendChunk,createTake,finaliseTake,type Take} from './storage';
export function useRecorder(onSaved:()=>void,onMessage:(s:string)=>void){
 const [recording,setRecording]=useState(false),[busy,setBusy]=useState(false),[seconds,setSeconds]=useState(0);
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setInterval>|null>(null),started=useRef(0),pending=useRef(Promise.resolve()),errors=useRef(false);
 const active=useRef(false);const savedRef=useRef(onSaved),messageRef=useRef(onMessage);savedRef.current=onSaved;messageRef.current=onMessage;
 const clear=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(timer.current)clearInterval(timer.current);timer.current=null;active.current=false;setRecording(false);};
 useEffect(()=>{const unload=()=>{if(recorder.current?.state==='recording')recorder.current.stop();};window.addEventListener('beforeunload',unload);return()=>{window.removeEventListener('beforeunload',unload);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());if(timer.current)clearInterval(timer.current);};},[]);
 async function start(sessionId:string,label:string){
  if(active.current||busy)return;active.current=true;setBusy(true);errors.current=false;setSeconds(0);
  let createdId:string|undefined;
  try{
   if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('Recording needs a browser with microphone support over HTTPS. You can still practise and save notes.');
   const audio=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=audio;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
   const rec=new MediaRecorder(audio,mime?{mimeType:mime}:undefined);recorder.current=rec;started.current=Date.now();let index=0;
   const meta:Take={id:crypto.randomUUID(),sessionId,label,createdAt:new Date().toISOString(),seconds:0,mime:rec.mimeType||mime||'audio/webm',status:'recording',chunkCount:0};
   await createTake(meta);createdId=meta.id;pending.current=Promise.resolve();
   rec.ondataavailable=e=>{if(!e.data.size)return;const chunkIndex=index++;const length=Math.round((Date.now()-started.current)/1000);pending.current=pending.current.then(()=>appendChunk(meta.id,chunkIndex,e.data,length)).catch(()=>{errors.current=true;messageRef.current('Audio could not be fully saved. Keep this tab open and free browser storage.');});};
   rec.onerror=()=>{errors.current=true;messageRef.current('The microphone stopped unexpectedly. Available audio will be recovered from local storage.');if(rec.state==='recording')rec.stop();else clear();};
   rec.onstop=async()=>{const length=Math.round((Date.now()-started.current)/1000);clear();setBusy(true);try{await pending.current;await finaliseTake(meta.id,length,errors.current);savedRef.current();messageRef.current(errors.current?'Available recording saved with an interruption. Listen back before relying on it.':'Take saved automatically on this device.');}catch(e){messageRef.current(e instanceof Error?e.message:'Could not save the recording.');savedRef.current();}finally{setBusy(false);}};
   rec.start(1000);setRecording(true);setBusy(false);timer.current=setInterval(()=>{const s=Math.floor((Date.now()-started.current)/1000);setSeconds(s);if(s>=900&&rec.state==='recording'){messageRef.current('The 15-minute recording limit was reached. Saving your take.');rec.stop();}},250);
  }catch(e){clear();setBusy(false);let msg=e instanceof Error?e.message:'Could not start the microphone.';if(e instanceof DOMException&&e.name==='NotAllowedError')msg='Microphone access was not granted. Allow it in your browser’s site settings, then try again. Notes and timers still work.';if(e instanceof DOMException&&e.name==='NotFoundError')msg='No microphone was found. Connect a microphone, then try again.';if(createdId) savedRef.current();messageRef.current(msg);}
 }
 function stop(){if(recorder.current?.state==='recording'){setBusy(true);recorder.current.stop();}}
 return{recording,busy,seconds,start,stop};
}
