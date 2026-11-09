import {useEffect,useRef,useState} from 'react';
import {Download,Mic,Trash2} from 'lucide-react';
import {fmt} from './model';
import {getPlaybackAudio,getTakeAudio,saveCompatibleAudio,type Take} from './storage';
import {audioBufferToWav,audioDataUrl,audioExtension,usesAppleAudio} from './audio';
export function TakePlayer({take,onDelete,onTimestamp}:{take:Take;onDelete?:(id:string)=>void;onTimestamp?:(label:string)=>void}){
 const [source,setSource]=useState(''),[download,setDownload]=useState(''),[mime,setMime]=useState(take.mime),[error,setError]=useState(''),[working,setWorking]=useState(false),[compatible,setCompatible]=useState(false),[speed,setSpeed]=useState(1);
 const audio=useRef<HTMLAudioElement>(null),original=useRef<Blob|undefined>(undefined),playback=useRef<Blob|undefined>(undefined),fallbackUsed=useRef(false),mounted=useRef(false),urls=useRef(new Set<string>());
 function objectUrl(blob:Blob){const url=URL.createObjectURL(blob);urls.current.add(url);return url;}
 async function playableSource(blob:Blob){
  // Short takes on Apple devices avoid the media element's Blob URL path.
  if(usesAppleAudio()&&blob.size<=12*1024*1024){fallbackUsed.current=true;return audioDataUrl(blob);}
  fallbackUsed.current=false;return objectUrl(blob);
 }
 useEffect(()=>{
  let alive=true;mounted.current=true;setError('');
  Promise.all([getTakeAudio(take.id),getPlaybackAudio(take.id)]).then(async([raw,play])=>{
   if(!alive)return;
   if(!raw||!play){setError('Audio is not available. Keep the take if it was interrupted.');return;}
   original.current=raw;playback.current=play;setDownload(objectUrl(raw));setMime(raw.type);setCompatible(play.type==='audio/wav'&&raw.type!=='audio/wav');
   const next=await playableSource(play);if(alive)setSource(next);
  }).catch(()=>{if(alive)setError('Could not read this recording. Keep your site data and try again.');});
  return()=>{alive=false;mounted.current=false;urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current.clear();};
 },[take.id]);
 async function failed(){
  if(!fallbackUsed.current&&playback.current){fallbackUsed.current=true;setWorking(true);try{const next=await audioDataUrl(playback.current);if(mounted.current){setError('');setSource(next);}return;}catch{/* Show recovery controls below. */}finally{if(mounted.current)setWorking(false);}}
  if(mounted.current)setError('This browser could not play the take. Try compatibility playback below. Your original audio is still saved.');
 }
 async function repair(){
  if(!original.current||working)return;setWorking(true);setError('');let context:AudioContext|undefined;
  try{
   const AudioContextClass=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
   if(!AudioContextClass)throw new Error('No audio decoder is available.');
   context=new AudioContextClass();await context.resume();
   const decoded=await context.decodeAudioData(await original.current.arrayBuffer());
   const wav=audioBufferToWav(decoded);await saveCompatibleAudio(take.id,wav);
   playback.current=wav;const next=await playableSource(wav);if(mounted.current){setSource(next);setCompatible(true);setError('');}
  }catch{if(mounted.current)setError('Compatibility playback could not decode this take. The original is still saved; keep it or download it for recovery.');}
  finally{if(context)await context.close().catch(()=>{});if(mounted.current)setWorking(false);}
 }
 return <article className="take-card"><div className="take-heading"><span><Mic size={13}/>{take.label}</span><div><small>{fmt(take.seconds)}</small>{onDelete&&<button className="icon-btn delete-btn" aria-label={`Delete ${take.label}`} onClick={()=>onDelete(take.id)}><Trash2 size={14}/></button>}</div></div>{take.recovered&&<p className="recovery-note">Recovered after interruption. The ending may be incomplete; check playback.</p>}{source&&<audio ref={audio} controls playsInline preload="metadata" src={source} aria-label={`Playback ${take.label}`} onLoadedMetadata={()=>{if(audio.current)audio.current.playbackRate=speed;setError('')}} onError={()=>void failed()}/>}{working&&<p className="recovery-note" role="status">Preparing compatible audio…</p>}{error&&<div className="inline-error" role="status"><p>{error}</p><button className="compatibility-btn" disabled={working||!original.current} onClick={()=>void repair()}>Try compatibility playback</button></div>}{compatible&&<p className="recovery-note">Using a compatible copy. Your original recording is preserved.</p>}<div className="take-options"><label>Listen at <select aria-label={`Playback speed for ${take.label}`} value={speed} onChange={e=>{setSpeed(Number(e.target.value));if(audio.current)audio.current.playbackRate=Number(e.target.value)}}>{[.75,1,1.25,1.5].map(v=><option key={v} value={v}>{v}×</option>)}</select></label>{onTimestamp&&<button onClick={()=>onTimestamp(`${take.label} @ ${fmt(Math.floor(audio.current?.currentTime||0))}`)}>Note this moment</button>}{download&&<a href={download} download={`nawa-${take.id}.${audioExtension(mime)}`} aria-label={`Download ${take.label}`}><Download size={12}/>Optional download</a>}</div></article>;
}
