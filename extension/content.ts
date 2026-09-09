import { getVideo, watchId, readMetadata, adState, observeChanges,rememberContent,forgetContent } from './adapter';
import type { Playback } from '../shared/protocol';
import { browserApi as chrome } from './browser';
let video:HTMLMediaElement|null=null,id:string|null=null,generation=0,seq=0,buffering=false,seeking=false;
let settleUntil=0,signature='',stableAt=0,priorTrack='',lastTrack='',lastTitle='',lastSent=0,stopped=true,wasAd=false,debounce:ReturnType<typeof setTimeout>|undefined,interval:ReturnType<typeof setInterval>|undefined;
const documentKey=crypto.randomUUID();let removeObserver=()=>{};
const events=['play','pause','playing','waiting','stalled','seeking','seeked','ratechange','durationchange','loadedmetadata','ended','volumechange','emptied'];
function send(){
  if(stopped)return;const now=performance.now();const currentId=watchId();const next=getVideo();
  if(currentId!==id){priorTrack=lastTrack;lastTrack='';lastTitle='';id=currentId;generation++;seq=0;settleUntil=now+1200;signature='';stableAt=now;}
  if(next!==video){if(video)events.forEach(e=>video!.removeEventListener(e,onMedia));video=next;buffering=!!video&&video.readyState<3;seeking=!!video?.seeking;generation++;seq=0;events.forEach(e=>video?.addEventListener(e,onMedia));removeObserver();removeObserver=observeChanges(schedule);settleUntil=now+800;}
  if(!id||!video){void chrome.runtime.sendMessage({type:'gone',document:documentKey}).catch(()=>{});return;}
  const meta=readMetadata(id);const sig=JSON.stringify(meta);if(sig!==signature){signature=sig;stableAt=now;}
  const track=JSON.stringify([meta.title,meta.artist]);
  let ad=adState();if(ad==='ad')wasAd=true;else if(wasAd){wasAd=false;settleUntil=now+1200;}
  // Identity and stable metadata are authoritative; a missing navigation-finish event
  // must not leave the page permanently blocked. Same-title recordings get a longer settle.
  if(ad==='content'&&(!meta.identity||!meta.title||now<settleUntil||now-stableAt<600||(priorTrack===track&&lastTrack===''&&now<settleUntil+1500)))ad='uncertain';
  if(ad==='content'){lastTitle=meta.title;lastTrack=track;priorTrack='';rememberContent(id,meta);}
  const p:Playback={videoId:id,generation,seq:++seq,title:ad==='content'?meta.title:lastTitle,artist:ad==='content'?meta.artist:'',position:ad==='content'&&Number.isFinite(video.currentTime)?Math.max(0,video.currentTime):0,duration:Number.isFinite(video.duration)?video.duration:null,rate:video.playbackRate,playing:!video.paused&&!video.ended,seeking:seeking||video.seeking,buffering:buffering||video.readyState<3,ended:video.ended,muted:video.muted||video.volume===0,ad};
  lastSent=now;void chrome.runtime.sendMessage({type:'playback',document:documentKey,playback:p}).catch(()=>{});
}
function onMedia(event:Event){if(event.type==='emptied')forgetContent();if(event.type==='waiting'||event.type==='stalled'||event.type==='emptied')buffering=true;if(event.type==='playing'||event.type==='seeked'||event.type==='loadedmetadata')buffering=false;if(event.type==='seeking')seeking=true;if(event.type==='seeked')seeking=false;send();}
function schedule(){if(!debounce&&!stopped)debounce=setTimeout(()=>{debounce=undefined;send();},350);}
function navStart(){settleUntil=performance.now()+1200;send();}
function navEnd(){schedule();}
chrome.runtime.onMessage.addListener((m,_sender,reply)=>{if(m?.type==='fresh'){send();reply({ok:!stopped});}});
function start(){
  if(!stopped)return;stopped=false;settleUntil=performance.now()+800;signature='';stableAt=performance.now();
  document.addEventListener('yt-navigate-start',navStart);document.addEventListener('yt-navigate-finish',navEnd);
  removeObserver=observeChanges(schedule);interval=setInterval(()=>{if(performance.now()-lastSent> (video&&!video.paused?1800:5000))send();},1000);send();
}
function stop(){
  if(stopped)return;stopped=true;clearInterval(interval);if(debounce)clearTimeout(debounce);debounce=undefined;removeObserver();events.forEach(e=>video?.removeEventListener(e,onMedia));video=null;forgetContent();
  document.removeEventListener('yt-navigate-start',navStart);document.removeEventListener('yt-navigate-finish',navEnd);void chrome.runtime.sendMessage({type:'gone',document:documentKey}).catch(()=>{});
}
window.addEventListener('pagehide',stop);window.addEventListener('pageshow',event=>{if(event.persisted)start();});start();
