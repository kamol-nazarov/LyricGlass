import {createHmac} from 'node:crypto';
import {boundedJson,retryAfter} from './provider';
import {recognitionResults,validWav,type Recognition} from '../shared/recognition';
export interface Credentials {host:string;key:string;secret:string}
export function credentials(x:unknown):Credentials{const c=x as Credentials;if(!c||typeof c.host!=='string'||!/^identify-[a-z0-9-]+\.acrcloud\.(com|cn)$/.test(c.host)||typeof c.key!=='string'||!c.key||c.key.length>200||typeof c.secret!=='string'||!c.secret||c.secret.length>200||/[\r\n]/.test(c.key+c.secret))throw Error('Enter the ACRCloud project host, access key and access secret.');return{host:c.host,key:c.key,secret:c.secret};}
export class ACRCloud {
 private retryAt=0;
 constructor(private request:typeof fetch=fetch,private now=()=>Date.now()){}
 async identify(input:Uint8Array,seconds:number,config:Credentials,signal:AbortSignal):Promise<Recognition[]>{
  const c=credentials(config);if(!validWav(input,seconds))throw Error('invalid-sample');if(this.now()<this.retryAt)throw Error('rate-limit');
  const timestamp=String(Math.floor(this.now()/1000));const signature=createHmac('sha1',c.secret).update(['POST','/v1/identify',c.key,'audio','1',timestamp].join('\n')).digest('base64');
  const form=new FormData();form.set('sample',new Blob([new Uint8Array(input)],{type:'audio/wav'}),'sample.wav');for(const[key,value]of Object.entries({sample_bytes:String(input.length),access_key:c.key,data_type:'audio',signature_version:'1',signature,timestamp}))form.set(key,value);
  const timeout=AbortSignal.timeout(15000);try{const res=await this.request(`https://${c.host}/v1/identify`,{method:'POST',body:form,signal:AbortSignal.any([signal,timeout]),redirect:'error'});
   if(res.status===429){this.retryAt=retryAfter(res.headers.get('retry-after'),this.now());throw Error('rate-limit');}if(res.status===401||res.status===403)throw Error('authentication');if(!res.ok)throw Error('unavailable');return recognitionResults(await boundedJson(res,256000));
  }catch(e){if(signal.aborted)throw Error('canceled');if(timeout.aborted)throw Error('timeout');const message=e instanceof Error?e.message:'';if(message==='rate-limit')this.retryAt=Math.max(this.retryAt,this.now()+60000);if(message==='quota')this.retryAt=Math.max(this.retryAt,this.now()+86400000);throw Error(['rate-limit','quota','authentication','malformed','unavailable'].includes(message)?message:'unavailable');}
 }
}
