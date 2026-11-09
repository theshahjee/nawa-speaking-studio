export const PCM_SAMPLE_RATE=24000;
export async function startPcmCapture(context:AudioContext,stream:MediaStream,onChunk:(blob:Blob)=>void,onError:(message:string)=>void){
 if(!context.audioWorklet)throw new Error('Compatible recording needs a browser with AudioWorklet support. Open the studio in an up-to-date Safari browser.');
 await context.audioWorklet.addModule(new URL('./pcm.worklet.js',import.meta.url).href);
 const input=context.createMediaStreamSource(stream),node=new AudioWorkletNode(context,'nawa-pcm'),mute=context.createGain();mute.gain.value=0;
 let completed=false,finish:(()=>void)|undefined;
 node.port.onmessage=e=>{if(e.data?.type==='pcm')onChunk(new Blob([e.data.data],{type:'application/octet-stream'}));else if(e.data?.type==='stopped'){completed=true;finish?.();}};
 node.onprocessorerror=()=>{onError('Audio processing stopped unexpectedly. Available audio will be saved.');finish?.();};
 input.connect(node);node.connect(mute);mute.connect(context.destination);
 return {sampleRate:PCM_SAMPLE_RATE,async stop(){
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{if(!completed)await new Promise<void>(resolve=>{finish=resolve;timeout=setTimeout(()=>{onError('The audio stream was interrupted. Available audio will be saved.');resolve();},2000);node.port.postMessage({type:'stop'});});}
  finally{if(timeout)clearTimeout(timeout);input.disconnect();node.disconnect();mute.disconnect();node.port.close();}
 }};
}
