import {Sessions,playbackPosition,STALE_MS} from '../shared/sync';
import {parseLrc,selectLines,songQuery,timelineOverrun,type RecordLyrics} from '../shared/lyrics';
import {assess,rankCandidates,confidentMatch,evidenceKey,hypotheses,MATCHER_VERSION,type Evidence,type Timing} from '../shared/matching';
import type {ClientMessage} from '../shared/protocol';
import type {Store,Provenance} from './store';
import {ProviderError,type Provider} from './provider';
import {summarize,type LyricSummary,type TimingLines} from '../shared/ui';
import {ledgerLines,type LedgerState} from '../shared/ledger';
interface Episode {requests:number;fetched:Set<string>;pool:RecordLyrics[];stopped:boolean;failures?:number;retryAt?:number;failedKey?:string}
export interface Trace {at:number;stage:string;requests:number;revision?:string;duration?:number|null;provenance?:string;elapsedMs?:number;cache?:string;candidates?:{id:number;score:number;reasons:string[];conflicts:string[];timing:Timing}[];outcome?:string}
export class Controller {
 sessions=new Sessions();video:string|null=null;record:RecordLyrics|null=null;candidates:RecordLyrics[]=[];status='Play a YouTube song';trace:Trace[]=[];
 private key='';private generation=0;private abort?:AbortController;private parsed=parseLrc('');private attempted='';private evidence:Evidence|null=null;
 private episode:Episode={requests:0,fetched:new Set(),pool:[],stopped:false};private episodes=new Map<string,Episode>();private busy=false;private explicit=false;private timer?:ReturnType<typeof setTimeout>;private timing:Timing='untimed';private suspended=false;
 private summaries=new WeakMap<RecordLyrics,LyricSummary>();
 private summary(r:RecordLyrics){let summary=this.summaries.get(r);if(!summary){summary=summarize(r);this.summaries.set(r,summary);}return summary;}
 constructor(public store:Store,private provider:Provider,private changed:()=>void,private now=()=>performance.now(),private settleMs=400){}
 note(stage:string,outcome?:string){this.trace.push({at:Date.now(),stage,requests:this.episode.requests,duration:this.evidence?.duration,provenance:this.evidence?.provenance,outcome});this.trace=this.trace.slice(-50);}
 message(connection:string,instance:string,m:ClientMessage){if(m.type==='snapshot')this.sessions.update(connection,instance,m.tab,m.document,m.playback,this.now());if(m.type==='remove')this.sessions.remove(connection,m.tab);if(m.type==='pin')this.sessions.pin(instance,m.tab);this.reconcile();}
 disconnect(connection:string){this.sessions.remove(connection);this.reconcile();}
 private cancel(){if(this.busy&&this.episode.failedKey)this.episode.fetched.delete(this.episode.failedKey);this.generation++;this.abort?.abort();this.busy=false;clearTimeout(this.timer);this.timer=undefined;}
 reconcile(){
  const s=this.sessions.current(),key=s?`${s.key}/${s.connection}/${s.document}/${s.playback.videoId}/${s.playback.generation}`:'';
  if(key!==this.key){if(this.video!==s?.playback.videoId)this.episode.pool=[];this.cancel();this.key=key;this.video=s?.playback.videoId??null;this.record=null;this.parsed=parseLrc('');this.candidates=[];this.attempted='';this.evidence=null;this.explicit=false;this.suspended=false;this.trace=[];this.status=s?'Locating lyrics…':'Play a YouTube song';
   this.episode=this.episodes.get(this.video??'')??{requests:0,fetched:new Set(),pool:[],stopped:false};if(this.video)this.episodes.set(this.video,this.episode);while(this.episodes.size>100)this.episodes.delete(this.episodes.keys().next().value!);
   const saved=this.video?this.store.data.mappings[this.video]:undefined;
   if(saved){this.explicit=!saved.provenance||['explicit-selection','import','legacy-unknown'].includes(saved.provenance);if(this.explicit||Object.hasOwn(saved.delays,String(saved.record.id)))this.setRecord(saved.record);else this.episode.pool=[...this.episode.pool,saved.record];}
  }
  if(s&&s.playback.ad==='content'&&s.playback.title&&this.now()-s.received<STALE_MS){
   if(this.episode.stopped&&(this.episode.failures??0)<=1&&this.now()>=(this.episode.retryAt??Infinity)&&this.episode.requests<6&&!this.explicit){this.episode.stopped=false;if(this.episode.failedKey)this.episode.fetched.delete(this.episode.failedKey);this.schedule();}
   const p=s.playback,q=songQuery(p.title,p.artist);const next:Evidence={...q,album:p.album,artists:p.artists,duration:p.duration,provenance:p.provenance??(p.artist?'structured':q.artist?'title-prefix':'unknown')};
   // Sub-second duration jitter and formatting heartbeats do not restart an episode.
   if(this.evidence&&next.duration!==null&&this.evidence.duration!==null&&Math.abs(next.duration-this.evidence.duration)<1)next.duration=this.evidence.duration;
   const revision=evidenceKey(next);if(revision!==this.attempted){this.evidence=next;this.attempted=revision;this.note('metadata-revision');
    if(this.record&&(this.explicit||this.hasManualTiming())){const saved=this.store.data.mappings[this.video!];this.suspended=saved?.provenance==='legacy-unknown'&&assess(next,this.record).conflicts.length>0;this.timing=assess(next,this.record).timing;}
    else {this.record=null;this.parsed=parseLrc('');for(const m of Object.values(this.store.data.mappings)){if(m.matcherVersion===MATCHER_VERSION&&m.provenance!=='legacy-unknown'&&assess(next,m.record).strong)this.episode.pool.push(m.record);}this.episode.pool=[...new Map(this.episode.pool.map(r=>[r.id,r])).values()].slice(0,900);this.evaluate();if(!this.record&&!this.busy&&!this.episode.stopped)this.schedule();}
   }
  }
  this.changed();
 }
 private schedule(){clearTimeout(this.timer);if(this.settleMs===0){void this.resolve();return;}this.timer=setTimeout(()=>{this.timer=undefined;void this.resolve();},this.settleMs);}
 private evaluate(){if(!this.evidence||this.explicit)return false;const rejected=this.video?this.store.rejects?.(this.video)??[]:[],pool=this.episode.pool.filter(r=>!rejected.includes(r.id));const ranked=rankCandidates(this.evidence,pool);this.candidates=ranked.map(r=>r.record).slice(0,20);
  this.trace.push({at:Date.now(),stage:'assessment',requests:this.episode.requests,duration:this.evidence.duration,candidates:ranked.slice(0,30).map(r=>({id:r.record.id,...r.assessment})),outcome:'heuristic; not ground truth'});this.trace=this.trace.slice(-50);
  const chosen=confidentMatch(this.evidence,pool);if(chosen&&this.video){this.store.attach(this.video,chosen,this.evidence.provenance==='recognition'?'recognition':'metadata',evidenceKey(this.evidence),this.evidence.recognitionId);this.setRecord(chosen);return true;}return false;
 }
 private setRecord(r:RecordLyrics){this.record=r;this.parsed=parseLrc(r.instrumental?'':r.syncedLyrics??'');this.timing=this.evidence?assess(this.evidence,r).timing:'plausible';this.status=r.instrumental?'Instrumental':this.parsed.lines.length?(this.timing==='plausible'?'Timed lyrics':'Timing uncertain · untimed lyrics'):r.plainLyrics?'Untimed lyrics — scroll in settings':'Lyrics unavailable';}
 private async resolve(){
  if(!this.video||!this.evidence||this.busy||this.explicit||this.episode.stopped)return;const video=this.video,key=this.key,generation=this.generation;this.abort=new AbortController();const signal=this.abort.signal;this.busy=true;this.status='Locating lyrics…';this.changed();const owns=()=>generation===this.generation&&video===this.video&&key===this.key&&!this.explicit&&!signal.aborted;
  try{while(owns()&&!this.record&&this.episode.requests<6){
    if(this.evaluate())break;const q=this.evidence!;
    const exact=q.album&&q.artist&&q.duration!==null&&this.provider.exact?{title:q.title,artist:q.artist,free:false,stage:'exact',album:q.album,duration:q.duration}:null;
    const next=[...(exact?[exact]:[]),...hypotheses(q)].find(h=>!this.episode.fetched.has(JSON.stringify(h)));if(!next)break;
    const fetchedKey=JSON.stringify(next);this.episode.failedKey=fetchedKey;this.episode.fetched.add(fetchedKey);this.episode.requests++;this.note(next.stage);
    const started=this.now();const results=next.stage==='exact'?await this.provider.exact(next.title,next.artist,q.album!,q.duration!,signal):await this.provider.search(next.title,next.artist,next.free,signal);
    if(!owns())return;this.trace.push({at:Date.now(),stage:'provider-result',requests:this.episode.requests,elapsedMs:Math.max(0,this.now()-started),cache:this.provider.lastCache??'unknown',outcome:results.length?'candidates-returned':'no-match'});this.episode.pool=[...new Map([...this.episode.pool,...results].map(r=>[r.id,r])).values()].slice(0,900);this.evaluate();
   }
   if(owns()&&!this.record)this.status='Lyrics unavailable';
  }catch(e){if(owns()){this.episode.stopped=true;this.episode.failures=(this.episode.failures??0)+1;this.episode.retryAt=this.now()+Math.max(30000,e instanceof ProviderError?e.retryAt-Date.now():0);this.status='Lyrics temporarily unavailable';this.note('provider-failure',e instanceof ProviderError?e.kind:'unavailable');}}
  finally{if(generation===this.generation){this.busy=false;this.changed();}}
 }
 async lookup(title:string,artist='',manual=false){if(!manual){if(!this.evidence)this.evidence={title,artist,duration:this.sessions.current()?.playback.duration??null};return this.resolve();}
  if(!this.video)return;this.cancel();const generation=this.generation,video=this.video;this.abort=new AbortController();this.explicit=true;this.status='Searching lyrics…';try{const records=await this.provider.search(title,artist,true,this.abort.signal);if(generation===this.generation&&video===this.video){this.candidates=rankCandidates(this.evidence??{title,artist,duration:null},records).map(r=>r.record).slice(0,20);this.status=this.record?'Current selection retained':'Lyrics unavailable';}}catch{if(generation===this.generation)this.status='Lyrics temporarily unavailable';}finally{if(generation===this.generation)this.changed();}
 }
 choose(r:RecordLyrics,provenance:Provenance='explicit-selection'){if(!this.video)return;this.cancel();if(this.record&&this.record.id!==r.id)this.store.reject?.(this.video,this.record.id);this.explicit=true;this.suspended=false;this.store.attach(this.video,r,provenance);this.setRecord(r);this.changed();}
 retry(){if(!this.video)return;this.cancel();if(!this.record)this.explicit=false;this.episode={requests:0,fetched:new Set(),pool:this.episode.pool,stopped:false};this.episodes.set(this.video,this.episode);if(!this.explicit){this.record=null;void this.resolve();}this.changed();}
 forget(){if(!this.video)return;this.cancel();this.store.forget(this.video);this.record=null;this.parsed=parseLrc('');this.explicit=false;this.status='Lyrics unavailable';this.changed();}
 isResolving(){return this.busy||!!this.timer;}
 isManual(){return this.explicit;}
 hasManualTiming(){const m=this.video?this.store.data.mappings[this.video]:undefined;return !!m&&Object.hasOwn(m.delays,String(m.record.id));}
 canRecognize(){return !this.explicit&&!this.hasManualTiming()&&!this.isResolving()&&!this.episode.stopped&&!!this.video&&!!this.evidence&&(!this.record||this.timing!=='plausible');}
 recognitionEvidence(q:Evidence){if(this.explicit||this.isResolving())return;this.evidence=q;this.episode.stopped=false;this.record=null;if(!this.evaluate())void this.resolve();}
  timingLines():TimingLines{
    if(!this.video||!this.record)throw Error('Select a lyric record first.');
    return{videoId:this.video,recordId:this.record.id,lines:this.parsed.lines.map((line,index)=>({index,time:line.time,text:line.text})).filter(line=>line.text.trim()).slice(0,2000)};
  }
  align(recordId:number,index:number){
    const s=this.sessions.current(),line=this.parsed.lines[index];
    if(!s||!this.video||this.record?.id!==recordId||!line?.text.trim())throw Error('The selected song or lyric record changed. Choose the line again.');
    const p=s.playback,now=this.now();
    if(now-s.received>=STALE_MS||p.ad!=='content'||p.buffering||p.seeking||p.ended)throw Error('Wait for fresh content playback before aligning lyrics.');
    const delay=Math.round((playbackPosition(p,s.received,now)-line.time)*1000);
    if(Math.abs(delay)>600000)throw Error('This lyric recording is too far from the video timeline. Choose another record.');
    this.store.setDelay(this.video,delay);this.changed();return delay;
  }
  view(){const s=this.sessions.current();let status=this.status;let lines={previous:'',current:'',next:'',index:-1};
    if(s){const p=s.playback;
      if(this.now()-s.received>=STALE_MS)status='Playback source stale — waiting for fresh position';
      else if(p.ad!=='content')status=p.ad==='ad'?'Advertisement — lyrics suspended':'Waiting for content identity';
      else if(p.ended)status='Playback ended';
      else if(p.seeking)status='Seeking…';
      else{lines=selectLines(this.parsed.lines,playbackPosition(p,s.received,this.now()),this.video?this.store.delay(this.video):0);if(p.buffering)status='Buffering';else if(!p.playing)status='Paused';else if(this.parsed.lines.length&&lines.index<0)status='Lyrics begin shortly';}
    }
    const now=this.now(),p=s?.playback,age=s?Math.max(0,now-s.received):STALE_MS;
    const position=s?playbackPosition(s.playback,s.received,now):0,delay=this.video?this.store.delay(this.video):0;
    const timingDuration=p?.ad==='content'?p.duration??this.record?.duration??null:this.record?.duration??null;
    const overrun=timelineOverrun(this.parsed.lines,timingDuration,delay);
    const mapping=this.video?this.store.data.mappings[this.video]:undefined;
    const aligned=!!mapping&&(Object.hasOwn(mapping.delays,String(mapping.record.id))||!!mapping.automatic?.[String(mapping.record.id)]);
    const timingWarning=this.suspended?'Saved match conflicts with current metadata. Change match when convenient.':overrun>2?`Lyrics run ${Math.ceil(overrun)} seconds past this video. Align the vocals or choose another recording.`:!aligned&&this.record?.syncedLyrics&&!this.record.instrumental&&(this.timing!=='plausible'||mapping?.provenance==='recognition')?'Timing uncertain · lyrics available for manual reading.':undefined;
    if(timingWarning&&p?.ad==='content'&&age<STALE_MS&&!p.ended){status=this.suspended?'Lyrics unavailable':overrun>2?'Timing does not fit this video — align or change lyrics':'Timing uncertain · untimed lyrics';lines={previous:'',current:'',next:'',index:-1};}
    const visible=!!p&&age<STALE_MS&&p.ad==='content'&&!p.ended&&!p.seeking&&!timingWarning;
    const frame=ledgerLines(visible?this.parsed.lines:[],position,delay);
    const start=visible?this.parsed.lines[frame.currentIndex]?.time??null:null;
    const end=visible?(this.parsed.lines[frame.currentIndex+1]?.time??(p?.duration===null?null:Math.max(0,(p?.duration??0)-delay/1000))):null;
    const ledger:LedgerState={...frame,synced:visible&&this.parsed.lines.length>0,clock:{position,duration:p?.duration??null,rate:p?.rate??1,advancing:visible&&!!p?.playing&&!p?.buffering,validForMs:Math.max(0,STALE_MS-age),delay,lineStart:start,lineEnd:end,words:visible?this.parsed.lines[frame.currentIndex]?.words:undefined}};
    return{videoId:this.video,title:s?.playback.title??'LyricGlass',artist:s?.playback.artist??'',status,previous:lines.previous,current:lines.current,next:lines.next,plain:this.suspended||this.record?.instrumental?null:timingWarning||!this.record?.syncedLyrics?(this.record?.plainLyrics??this.parsed.lines.map(l=>l.text).filter(Boolean).join('\n'))||null:null,delay,record:this.record?this.summary(this.record):null,candidates:this.candidates.map(r=>this.summary(r)),ledger,timingWarning,diagnostics:this.trace,matchProvenance:mapping?.provenance??'legacy-unknown'};
  }
  close(){this.cancel();}
}
