import {randomUUID} from 'node:crypto';
import {eligible,continuous,recognized,corroborated,validWav,validAnchor,type Anchor,type Recognition} from '../shared/recognition';
import {assess,recordingTitle} from '../shared/matching';
import type {ClientMessage,Playback} from '../shared/protocol';
import type {Controller} from './controller';
import type {RecognitionVault} from './recognition-vault';
import {ACRCloud} from './acrcloud';
interface Pending {id:string;key:string;instance:string;connection:string;document:string;tab:number;p:Playback;at:number;last:Playback;lastAt:number;anchor?:Anchor;size:number;parts:Buffer[];bytes:number;abort:AbortController;uploading:boolean}
export class Recognizer {
 private sessions=new Map<string,{tab:number;connection:string}>();private pending?:Pending;private first?:{anchor:Anchor;result:Recognition};private nextAt=0;private stopped=new Set<string>();reason='Recognition is off';
 constructor(private controller:Controller,private vault:RecognitionVault,private send:(instance:string,m:unknown)=>boolean,private provider=new ACRCloud(),private now=()=>performance.now()){}
 state(){const r=this.controller.store.data.recognition;return{enabled:r.enabled,consent:r.consent,dailyCap:r.dailyCap,configured:this.vault.configured(),capable:this.vault.available(),captureActive:this.sessions.size>0,reason:this.reason};}
 private valid(p:Pending){const s=this.controller.sessions.current();return !!s&&s.key===p.key&&s.connection===p.connection&&s.document===p.document&&s.playback.videoId===p.p.videoId&&s.playback.generation===p.p.generation&&eligible(s.playback,this.now()-s.received)&&!this.controller.isManual()&&!this.controller.hasManualTiming?.();}
 cancel(stopSession=false){const p=this.pending;if(p){p.abort.abort();p.parts.forEach(b=>b.fill(0));this.send(p.instance,{type:'capture-cancel',id:p.id});if(!this.controller.record)this.controller.status='Lyrics unavailable';}this.pending=undefined;if(stopSession){for(const[instance]of this.sessions)this.send(instance,{type:'capture-stop'});this.sessions.clear();this.first=undefined;}}
 retry(){this.cancel();const video=this.controller.video;if(video){this.stopped.delete(video);delete this.controller.store.data.recognition.episodes[video];this.controller.store.save();}this.first=undefined;}
 disconnect(connection:string){for(const[i,s]of this.sessions)if(s.connection===connection)this.sessions.delete(i);if(this.pending?.connection===connection)this.cancel();}
 tick(){
  const r=this.controller.store.data.recognition,s=this.controller.sessions.current();
  if(!r.enabled||!r.consent||!this.vault.configured()){this.reason=!r.enabled?'Recognition is off':!r.consent?'Audio transmission consent is required':'Configure ACRCloud in settings';this.cancel(true);return;}
  if(this.pending){const p=this.pending;if(!this.valid(p)||this.now()-p.at>30000){this.reason='Sample discarded after playback changed';this.cancel();}else if(s&&s.received!==p.lastAt){if(!continuous(p.last,s.playback,(s.received-p.lastAt)/1000)){this.cancel();this.reason='Sample discarded after a discontinuity';}else{p.last=s.playback;p.lastAt=s.received;}}return;}
  if(!s||this.controller.isManual()||this.controller.hasManualTiming?.()||this.controller.isResolving()||!this.controller.canRecognize()&&this.first?.anchor.video!==s.playback.videoId){this.reason='Metadata resolution is sufficient or still running';return;}
  const session=this.sessions.get(s.instance);if(!session||session.tab!==s.tab||session.connection!==s.connection){this.reason='Enable audio for this tab in the Chrome / Edge extension';return;}
  if(!eligible(s.playback,this.now()-s.received)){this.reason='Waiting for isolated, uninterrupted content at normal speed';return;}
  if(this.stopped.has(s.playback.videoId)||!this.controller.store.recognitionBudget(s.playback.videoId)){this.reason='Recognition attempt or daily limit reached';return;}
  if(this.now()<this.nextAt)return;
  // Reserve before requesting capture; invalid windows cannot cause an unlimited capture loop.
  try{if(!this.controller.store.reserveRecognition(s.playback.videoId))return;}catch{this.reason='Recognition budget could not be saved';return;}
  const p:Pending={id:randomUUID(),key:s.key,instance:s.instance,connection:s.connection,document:s.document,tab:s.tab,p:s.playback,at:this.now(),last:s.playback,lastAt:s.received,size:0,parts:[],bytes:0,abort:new AbortController(),uploading:false};this.pending=p;this.reason='Identifying audio…';this.controller.status=this.reason;this.controller.note('recognition-capture');
  if(!this.send(s.instance,{type:'capture-request',id:p.id,tab:s.tab,document:s.document,video:s.playback.videoId,generation:s.playback.generation})){this.cancel();this.reason='Capture connection unavailable';}
 }
 message(connection:string,instance:string,m:ClientMessage){
  if(m.type==='capture-state'){if(m.active)this.sessions.set(instance,{tab:m.tab,connection});else{this.sessions.delete(instance);if(this.pending?.instance===instance)this.cancel();}return;}
  const p=this.pending;if(!p||p.instance!==instance||p.connection!==connection||!('id'in m)||m.id!==p.id||!this.valid(p))return;
  if(m.type==='capture-error'){this.reason='Capture unavailable or contaminated';this.stopped.add(p.p.videoId);this.cancel();return;}
  if(m.type==='sample-begin'){
   if(p.anchor||p.uploading||m.tab!==p.tab||m.document!==p.document||m.video!==p.p.videoId||m.generation!==p.p.generation||!validAnchor(m)||m.start<p.p.position-1||m.start>p.p.position+4){this.cancel();return;}
   p.anchor={video:m.video,document:m.document,generation:m.generation,start:m.start,seconds:m.seconds,uncertainty:m.uncertainty};p.size=m.bytes;
  }else if(m.type==='sample-chunk'){
   if(!p.anchor||p.uploading||m.index!==p.parts.length){this.cancel();return;}const bytes=Buffer.from(m.data,'base64');p.bytes+=bytes.length;if(p.bytes>p.size){bytes.fill(0);this.cancel();return;}p.parts.push(bytes);
  }else if(m.type==='sample-end'){
   if(!p.anchor||p.uploading||p.bytes!==p.size){this.cancel();return;}const bytes=Buffer.concat(p.parts);p.parts.forEach(b=>b.fill(0));p.parts=[];
   if(!validWav(bytes,p.anchor.seconds)){bytes.fill(0);this.cancel();return;}p.uploading=true;void this.identify(p,bytes);
  }
 }
 private async identify(p:Pending,bytes:Buffer){
  try{const results=await this.provider.identify(bytes,p.anchor!.seconds,this.vault.read(),p.abort.signal);if(this.pending!==p||!this.valid(p))return;const result=recognized(results);if(!result){this.stopped.add(p.p.videoId);this.reason='No confident audio identification';this.controller.note('recognition','no-confident-result');return;}
   const contentDuration=this.controller.sessions.current()!.playback.duration;
   this.controller.recognitionEvidence({title:result.title,artist:result.artist,album:result.album,duration:contentDuration,provenance:'recognition',recognitionId:result.acrid});
   const previous=this.first;this.first={anchor:p.anchor!,result};const record=this.controller.record;
   const compatible=record&&assess({title:result.title,artist:result.artist,album:result.album,duration:result.duration,provenance:'recognition'},record);
   const delay=previous?corroborated(previous,this.first):null;
   const altered=recordingTitle(p.p.title).versions.some(v=>/slowed|sped|remix|extended|radio/.test(v));
   if(delay!==null&&record&&compatible?.strong&&compatible.timing==='plausible'&&!altered){this.controller.store.setAutomaticDelay(p.p.videoId,delay,result.acrid);this.reason='Audio anchors agree; lyric timestamps remain provider supplied';this.controller.note('alignment','corroborated');}
   else{this.reason=previous?'Audio identified; timing remains uncertain':'Audio identified; waiting for an independent alignment window';this.controller.note('alignment',previous?'uncertain':'one-window');}
  }catch(e){if(this.pending===p&&!p.abort.signal.aborted){this.stopped.add(p.p.videoId);const kind=e instanceof Error&&['rate-limit','quota','authentication','authentication-or-quota','malformed','timeout','canceled'].includes(e.message)?e.message:'unavailable';this.reason=`Recognition ${kind}`;this.controller.note('recognition',kind);}}
  finally{bytes.fill(0);if(this.pending===p){this.pending=undefined;this.nextAt=this.now()+3000;if(!this.controller.record)this.controller.status='Lyrics unavailable';}}
 }
}
