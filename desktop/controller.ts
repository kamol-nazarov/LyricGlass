import { Sessions, playbackPosition, STALE_MS } from '../shared/sync';
import { confidentMatch, parseLrc, selectLines, songQuery, type RecordLyrics } from '../shared/lyrics';
import type { ClientMessage } from '../shared/protocol';
import type { Store } from './store';
import type { Provider } from './provider';
import { summarize } from '../shared/ui';
import { ledgerLines, type LedgerState } from '../shared/ledger';
export class Controller {
  sessions=new Sessions();video:string|null=null;record:RecordLyrics|null=null;candidates:RecordLyrics[]=[];status='Play a YouTube song';
  private key='';private generation=0;private abort?:AbortController;private parsed= parseLrc(''); private attempted='';
  constructor(public store:Store,private provider:Provider,private changed:()=>void,private now=()=>performance.now()){}
  message(connection:string,instance:string,m:ClientMessage){
    if(m.type==='snapshot')this.sessions.update(connection,instance,m.tab,m.document,m.playback,this.now());
    if(m.type==='remove')this.sessions.remove(connection,m.tab);
    if(m.type==='pin')this.sessions.pin(instance,m.tab);
    this.reconcile();
  }
  disconnect(connection:string){this.sessions.remove(connection);this.reconcile();}
  reconcile(){
    const s=this.sessions.current();const key=s?`${s.key}/${s.playback.videoId}`:'';
    if(key!==this.key){this.key=key;this.video=s?.playback.videoId??null;this.generation++;this.abort?.abort();this.record=null;this.parsed=parseLrc('');this.candidates=[];this.attempted='';this.status=s?'Waiting for content metadata':'Play a YouTube song';
      if(this.video){const saved=this.store.data.mappings[this.video];if(saved){saved.used=Date.now();this.setRecord(saved.record);}}
    }
    if(s&&!this.record&&s.playback.ad==='content'&&s.playback.title&&this.now()-s.received<STALE_MS){const q=songQuery(s.playback.title,s.playback.artist);const query=JSON.stringify(q);if(this.attempted!==query){this.attempted=query;void this.lookup(q.title,q.artist,false);}}
    this.changed();
  }
  private setRecord(r:RecordLyrics){this.record=r;this.parsed=parseLrc(r.syncedLyrics??'');this.status=r.instrumental?'Instrumental':this.parsed.lines.length?'Synchronized lyrics':r.plainLyrics?'Untimed lyrics — scroll in settings':'This record has no lyrics';}
  async lookup(title:string,artist='',manual=false){
    if(!this.video)return;const video=this.video;const source=this.sessions.current()?.playback;const duration=source?.ad==='content'?source.duration:null;const generation=++this.generation;this.abort?.abort();this.abort=new AbortController();this.status='Finding lyrics…';this.changed();
    try{const results=await this.provider.search(title,artist,manual,this.abort.signal);if(generation!==this.generation||video!==this.video)return;this.candidates=results;
      const chosen=manual?null:confidentMatch({title,artist,duration},results);
      if(chosen){this.store.attach(video,chosen);this.setRecord(chosen);}else this.status=results.length?'Choose a lyric match in settings':'No match — search or import LRC';
    }catch(e){if(generation===this.generation)this.status=e instanceof Error?e.message:'Lyric provider unavailable';}finally{if(generation===this.generation)this.changed();}
  }
  choose(r:RecordLyrics){if(!this.video)return;this.generation++;this.abort?.abort();this.store.attach(this.video,r);this.setRecord(r);this.changed();}
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
    const visible=!!p&&age<STALE_MS&&p.ad==='content'&&!p.ended&&!p.seeking;
    const frame=ledgerLines(visible?this.parsed.lines:[],position,delay);
    const start=visible?this.parsed.lines[frame.currentIndex]?.time??null:null;
    const end=visible?(this.parsed.lines[frame.currentIndex+1]?.time??(p?.duration===null?null:Math.max(0,(p?.duration??0)-delay/1000))):null;
    const ledger:LedgerState={...frame,synced:visible&&this.parsed.lines.length>0,clock:{position,duration:p?.duration??null,rate:p?.rate??1,advancing:visible&&!!p?.playing&&!p?.buffering,validForMs:Math.max(0,STALE_MS-age),delay,lineStart:start,lineEnd:end,words:visible?this.parsed.lines[frame.currentIndex]?.words:undefined}};
    return{videoId:this.video,title:s?.playback.title??'LyricGlass',artist:s?.playback.artist??'',status,previous:lines.previous,current:lines.current,next:lines.next,plain:!this.record?.syncedLyrics?this.record?.plainLyrics??null:null,delay,record:this.record?summarize(this.record):null,candidates:this.candidates.map(summarize),ledger};
  }
  close(){this.generation++;this.abort?.abort();}
}
