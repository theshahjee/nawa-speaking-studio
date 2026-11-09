// Audio bytes are copied out of browser-backed Blobs before persisting or playing.
// This avoids retaining MediaRecorder/IndexedDB Blob backing handles in WebKit.
export function usesAppleAudio(ua:string=navigator.userAgent,platform:string=navigator.platform,touchPoints:number=navigator.maxTouchPoints){
 return /iPad|iPhone|iPod/.test(ua)||(platform==='MacIntel'&&touchPoints>1)||(/AppleWebKit/.test(ua)&&!/Chrome|Chromium|Edg|OPR|Android/.test(ua));
}
export function detectAudioMime(bytes:ArrayBuffer,fallback='audio/webm'){
 const v=new Uint8Array(bytes);const text=(start:number,length:number)=>String.fromCharCode(...v.subarray(start,start+length));
 if(text(0,4)==='RIFF'&&text(8,4)==='WAVE')return 'audio/wav';
 if(text(4,4)==='ftyp')return 'audio/mp4';
 if(v[0]===0x1a&&v[1]===0x45&&v[2]===0xdf&&v[3]===0xa3)return 'audio/webm';
 if(text(0,4)==='OggS')return 'audio/ogg';
 if(text(0,3)==='ID3'||(v[0]===0xff&&(v[1]&0xe0)===0xe0))return 'audio/mpeg';
 return fallback||'application/octet-stream';
}
export function audioExtension(mime:string){if(/wav|wave/.test(mime))return 'wav';if(/mp4|aac|m4a/.test(mime))return 'm4a';if(/mpeg|mp3/.test(mime))return 'mp3';if(/ogg/.test(mime))return 'ogg';return 'webm';}
export function wavHeader(dataBytes:number,sampleRate:number,channels=1){
 if(dataBytes<0||dataBytes>0xffffffff-36||!Number.isInteger(dataBytes)||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000||!Number.isInteger(channels)||channels<1||channels>8)throw new Error('Invalid WAV audio dimensions.');
 const bytes=new ArrayBuffer(44),v=new DataView(bytes);const str=(at:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
 str(0,'RIFF');v.setUint32(4,dataBytes+36,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,dataBytes,true);return bytes;
}
export function audioBufferToWav(audio:Pick<AudioBuffer,'numberOfChannels'|'length'|'sampleRate'|'getChannelData'>){
 const channels=audio.numberOfChannels,bytes=new ArrayBuffer(audio.length*channels*2),v=new DataView(bytes),inputs=Array.from({length:channels},(_,c)=>audio.getChannelData(c));let offset=0;
 for(let i=0;i<audio.length;i++)for(let c=0;c<channels;c++){const s=Math.max(-1,Math.min(1,inputs[c][i]));v.setInt16(offset,s<0?s*32768:s*32767,true);offset+=2;}
 return new Blob([wavHeader(bytes.byteLength,audio.sampleRate,channels),bytes],{type:'audio/wav'});
}
export async function freshAudioBlob(blob:Blob,fallback=blob.type){const bytes=await blob.arrayBuffer();return new Blob([bytes],{type:detectAudioMime(bytes,fallback)});}
export function audioDataUrl(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error||new Error('Could not read the recording.'));r.readAsDataURL(blob);});}
