import {SAMPLE_RATE,SAMPLE_SECONDS,CHUNK_BYTES,wav,eligible} from '../shared/recognition';
import {identity,integer} from '../shared/protocol';
let media:MediaStream|null=null,context:AudioContext|null=null,processor:AudioWorkletNode|null=null,token:string|null=null,timer:ReturnType<typeof setTimeout>|undefined;
let targetTab:number|null=null;
function cancel(){token=null;clearTimeout(timer);processor?.port.postMessage('cancel');}
async function stop(){cancel();media?.getTracks().forEach(t=>t.stop());media=null;await context?.close();context=null;processor=null;targetTab=null;}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(sender.id!==chrome.runtime.id||sender.tab||m?.target!=='offscreen')return;
 if(m.type==='stop'){void stop().then(()=>reply({ok:true}));return true;}
 if(m.type==='cancel'){cancel();reply({ok:true});return;}
 if(m.type==='open'&&typeof m.streamId==='string'&&integer(m.tab)){
  void(async()=>{await stop();targetTab=m.tab;media=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:m.streamId}} as MediaTrackConstraints,video:false});
   context=new AudioContext({sampleRate:SAMPLE_RATE,latencyHint:'interactive'});if(context.sampleRate!==SAMPLE_RATE)throw Error('sample-rate');
   const source=context.createMediaStreamSource(media);source.connect(context.destination); // Tab capture stops native playback; route it exactly once.
   await context.audioWorklet.addModule('capture-worklet.js');processor=new AudioWorkletNode(context,'lyricglass-sample');source.connect(processor);processor.connect(context.destination);
   media.getAudioTracks()[0].addEventListener('ended',()=>{void stop();void chrome.runtime.sendMessage({type:'capture-ended'});},{once:true});await context.resume();reply({ok:true});
  })().catch(async()=>{await stop();reply({ok:false});});return true;
 }
 if(m.type==='sample'&&identity(m.id)&&targetTab!==null&&processor&&context){
  cancel();token=m.id;const current=m.id;
  void(async()=>{const a=await chrome.runtime.sendMessage({type:'capture-anchor',id:current,tab:targetTab});
   if(token!==current||!processor||!context)return;
   const latency=(Date.now()-a?.capturedAt)/1000,uncertainty=.02+latency+context.baseLatency;
   if(!a?.playback||!eligible(a.playback,latency*1000)||!Number.isFinite(uncertainty)||uncertainty>.3)throw Error('anchor');
   const anchor={document:a.document,video:a.playback.videoId,generation:a.playback.generation,start:a.playback.position+latency,seconds:SAMPLE_SECONDS,uncertainty};
   processor.port.onmessage=event=>{if(!(event.data instanceof ArrayBuffer))return;const floats=new Float32Array(event.data);if(token!==current){floats.fill(0);return;}
    void(async()=>{const rms=Math.sqrt(floats.reduce((n,v)=>n+v*v,0)/floats.length);if(rms<.002){floats.fill(0);throw Error('silence');}
     const bytes=wav(floats);floats.fill(0);try{if(token!==current)return;await chrome.runtime.sendMessage({type:'capture-result-begin',id:current,tab:targetTab,...anchor,bytes:bytes.length});
      for(let offset=0,index=0;offset<bytes.length;offset+=CHUNK_BYTES,index++){if(token!==current)return;const data=btoa(String.fromCharCode(...bytes.subarray(offset,offset+CHUNK_BYTES)));await chrome.runtime.sendMessage({type:'capture-result-chunk',id:current,index,data});}
      if(token===current)await chrome.runtime.sendMessage({type:'capture-result-end',id:current});
     }finally{bytes.fill(0);if(token===current)cancel();}
    })().catch(()=>{void chrome.runtime.sendMessage({type:'capture-failed',id:current});cancel();});
   };
   processor.port.postMessage('start');timer=setTimeout(()=>{void chrome.runtime.sendMessage({type:'capture-failed',id:current});cancel();},13000);reply({ok:true});
  })().catch(()=>{void chrome.runtime.sendMessage({type:'capture-failed',id:current});cancel();reply({ok:false});});return true;
 }
});
