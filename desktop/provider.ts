import { validRecord, type Store } from './store';
import type { RecordLyrics } from '../shared/lyrics';
export class Provider {
  private pending=new Map<string,{promise:Promise<RecordLyrics[]>;signal:AbortSignal}>(); private retryAt=0;
  constructor(private store:Pick<Store,'cacheGet'|'cachePut'>,private request:typeof fetch=fetch,private now=()=>Date.now()){}
  search(title:string,artist='',free=false,signal?:AbortSignal):Promise<RecordLyrics[]> {
    const params=new URLSearchParams(free?{q:title}:{track_name:title,...(artist?{artist_name:artist}:{})});const key=params.toString();
    const cached=this.store.cacheGet(key);if(cached)return Promise.resolve(cached);
    if(this.now()<this.retryAt)return Promise.reject(Error('LRCLIB rate limit: wait before searching again.'));
    const old=this.pending.get(key);if(old&&!old.signal.aborted)return old.promise;
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
    const work=(async()=>{try{
      const res=await this.request(`https://lrclib.net/api/search?${key}`,{headers:{'User-Agent':'LyricGlass/1.0 (personal local Windows utility; https://lrclib.net)'},signal:controller.signal,redirect:'error'});
      if(res.status===429){const seconds=Number(res.headers.get('retry-after'));this.retryAt=this.now()+Math.max(30,Math.min(Number.isFinite(seconds)?seconds:60,3600))*1000;throw Error('LRCLIB rate limit: wait before searching again.');}
      if(!res.ok)throw Error(`LRCLIB unavailable (HTTP ${res.status}). Try again later or import LRC.`);
      // Bound streamed data, including responses without Content-Length.
      const reader=res.body?.getReader();if(!reader)throw Error('LRCLIB returned an empty response.');let total=0;const chunks:Uint8Array[]=[];
      while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>4_000_000){await reader.cancel();throw Error('LRCLIB response exceeded the size limit.');}chunks.push(value);}
      const bytes=new Uint8Array(total);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}const data:unknown=JSON.parse(new TextDecoder().decode(bytes));
      if(!Array.isArray(data)||data.length>100||!data.every(validRecord))throw Error('LRCLIB returned malformed lyric data.');
      const records=data.slice(0,20);this.store.cachePut(key,records);return records;
    }catch(e){if(controller.signal.aborted)throw Error('Lyric request canceled or timed out. Try again or import LRC.');throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(this.pending.get(key)?.signal===controller.signal)this.pending.delete(key);}})();this.pending.set(key,{promise:work,signal:controller.signal});return work;
  }
}
