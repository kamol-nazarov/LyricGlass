import { validRecord, type Store } from './store';
import type { RecordLyrics } from '../shared/lyrics';
export type Failure='timeout'|'offline'|'malformed'|'authentication'|'rate-limit'|'canceled'|'unavailable';
export class ProviderError extends Error {constructor(public kind:Failure,message:string,public retryAt=0){super(message);}}
export function retryAfter(value:string|null,now:number){const seconds=value?.trim()&&/^\d+(?:\.\d+)?$/.test(value)?Number(value):NaN;const date=value?Date.parse(value):NaN;return Math.max(now+30000,Number.isFinite(seconds)?now+seconds*1000:Number.isFinite(date)?date:now+60000);}
export async function boundedJson(res:Response,limit:number){const reader=res.body?.getReader();if(!reader)throw new ProviderError('malformed','Provider returned an empty response.');let total=0;const chunks:Uint8Array[]=[];try{while(true){const{done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit)throw new ProviderError('malformed','Provider response exceeded the size limit.');chunks.push(value);}const bytes=new Uint8Array(total);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}try{return JSON.parse(new TextDecoder().decode(bytes)) as unknown;}catch{throw new ProviderError('malformed','Provider returned malformed data.');}}finally{await reader.cancel().catch(()=>{});}}
export class Provider {
 lastCache:'hit'|'miss'='miss';
 private pending=new Map<string,{promise:Promise<RecordLyrics[]>;signal:AbortSignal}>();private retryAt=0;
 constructor(private store:Pick<Store,'cacheGet'|'cachePut'>,private request:typeof fetch=fetch,private now=()=>Date.now()){}
 search(title:string,artist='',free=false,signal?:AbortSignal):Promise<RecordLyrics[]>{const params=new URLSearchParams(free?{q:title}:{track_name:title,...(artist?{artist_name:artist}:{})});return this.lookup('search',params,signal);}
 exact(title:string,artist:string,album:string,duration:number,signal?:AbortSignal){if(!title||!artist||!album||!Number.isFinite(duration)||duration<=0)return Promise.resolve([]);return this.lookup('get',new URLSearchParams({track_name:title,artist_name:artist,album_name:album,duration:String(duration)}),signal);}
 private lookup(endpoint:string,params:URLSearchParams,signal?:AbortSignal):Promise<RecordLyrics[]>{
  const key=(endpoint==='search'?'':`${endpoint}:`)+params.toString();if(signal?.aborted)return Promise.reject(new ProviderError('canceled','Lyric request canceled.'));
  const cached=this.store.cacheGet(key);this.lastCache=cached?'hit':'miss';if(cached)return Promise.resolve(cached);
  if(this.now()<this.retryAt)return Promise.reject(new ProviderError('rate-limit','LRCLIB rate limit: wait before searching again.',this.retryAt));
  const old=this.pending.get(key);if(old&&!old.signal.aborted)return old.promise;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const work=(async()=>{try{
   const res=await this.request(`https://lrclib.net/api/${endpoint}?${params}`,{headers:{'User-Agent':'LyricGlass/0.4.0 (https://github.com/kamol-nazarov/LyricGlass)'},signal:controller.signal,redirect:'error'});
   if(res.status===429){this.retryAt=retryAfter(res.headers.get('retry-after'),this.now());throw new ProviderError('rate-limit','LRCLIB rate limit: wait before searching again.',this.retryAt);}
   if(res.status===404&&endpoint==='get'){this.store.cachePut(key,[]);return [];}
   if(!res.ok)throw new ProviderError(res.status===401||res.status===403?'authentication':'unavailable',`LRCLIB temporarily unavailable (HTTP ${res.status}).`);
   const data=await boundedJson(res,4_000_000);if(controller.signal.aborted)throw new ProviderError('canceled','Lyric request canceled.');
   const records=endpoint==='search'?data:[data];if(!Array.isArray(records)||records.length>100||!records.every(validRecord))throw new ProviderError('malformed','LRCLIB returned malformed lyric data.');
   this.store.cachePut(key,records);return records;
  }catch(e){if(controller.signal.aborted)throw new ProviderError(signal?.aborted?'canceled':'timeout',signal?.aborted?'Lyric request canceled.':'Lyric request timed out.');if(e instanceof ProviderError)throw e;throw new ProviderError('offline','Lyric service temporarily unreachable.');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(this.pending.get(key)?.signal===controller.signal)this.pending.delete(key);}})();this.pending.set(key,{promise:work,signal:controller.signal});return work;
 }
}
