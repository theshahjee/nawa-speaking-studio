// Self-contained AudioWorklet: mono PCM16 at 24 kHz, flushed once per second.
// No codec/container encoder is involved. Output is silent to avoid feedback.
class NawaPCMProcessor extends AudioWorkletProcessor {
 constructor(){
  super();this.outputRate=24000;this.ratio=sampleRate/this.outputRate;this.frame=0;this.next=0;this.previous=0;this.buffer=new ArrayBuffer(this.outputRate*2);this.view=new DataView(this.buffer);this.used=0;this.finished=false;
  this.port.onmessage=e=>{if(e.data?.type==='stop'&&!this.finished){this.flush();this.finished=true;this.port.postMessage({type:'stopped'});}};
 }
 flush(){if(!this.used)return;const data=this.buffer.slice(0,this.used*2);this.port.postMessage({type:'pcm',data},[data]);this.used=0;}
 push(value){const s=Math.max(-1,Math.min(1,value));this.view.setInt16(this.used*2,s<0?s*32768:s*32767,true);this.used++;if(this.used===this.outputRate)this.flush();}
 process(inputs){
  if(this.finished)return false;
  const channels=inputs[0];if(!channels?.length)return true;const frames=channels[0].length;
  for(let i=0;i<frames;i++){
   let value=0;for(let c=0;c<channels.length;c++)value+=channels[c][i]||0;value/=channels.length;
   while(this.next<=this.frame){const fraction=this.frame===0?1:this.next-(this.frame-1);this.push(this.previous+(value-this.previous)*fraction);this.next+=this.ratio;}
   this.previous=value;this.frame++;
  }
  return true;
 }
}
registerProcessor('nawa-pcm',NawaPCMProcessor);
