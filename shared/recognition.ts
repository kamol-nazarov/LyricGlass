import {number,object,text,identity,integer,videoId,type Playback} from './protocol';
export const SAMPLE_SECONDS=10,SAMPLE_RATE=16000,MAX_AUDIO=384044,CHUNK_BYTES=6000;
export interface Anchor {video:string;generation:number;document:string;start:number;seconds:number;uncertainty:number}
export interface Recognition {acrid:string;title:string;artist:string;album:string;duration:number|null;score:number;sampleBegin?:number;sampleEnd?:number;referenceBegin?:number;referenceEnd?:number}
export function eligible(p:Playback,age:number){return p.ad==='content'&&p.playing&&!p.muted&&!p.seeking&&!p.buffering&&!p.ended&&p.rate===1&&p.isolatedAudio===true&&age>=0&&age<2500;}
export function continuous(a:Playback,b:Playback,elapsed:number){return eligible(b,0)&&a.videoId===b.videoId&&a.generation===b.generation&&Math.abs(b.position-a.position-elapsed)<.6;}
export function offset(anchor:Anchor,r:Recognition){
 const {sampleBegin:sb,sampleEnd:se,referenceBegin:rb,referenceEnd:re}=r;
 if(anchor.uncertainty>.3||r.score<90||sb===undefined||se===undefined||rb===undefined||re===undefined||sb<0||se>anchor.seconds*1000+100||se-sb<3000||rb<0||re<rb||Math.abs((se-sb)-(re-rb))>150)return null;
 const delay=Math.round(anchor.start*1000+sb-rb);return Math.abs(delay)<=600000?delay:null;
}
export function corroborated(a:{anchor:Anchor;result:Recognition},b:{anchor:Anchor;result:Recognition}){
 if(a.result.acrid!==b.result.acrid||a.anchor.video!==b.anchor.video||a.anchor.generation!==b.anchor.generation||a.anchor.document!==b.anchor.document||b.anchor.start<a.anchor.start+a.anchor.seconds)return null;
 const x=offset(a.anchor,a.result),y=offset(b.anchor,b.result);return x!==null&&y!==null&&Math.abs(x-y)<=400?Math.round((x+y)/2):null;
}
export function validAnchor(x:unknown):x is Anchor{return object(x)&&videoId(x.video)&&integer(x.generation)&&identity(x.document)&&number(x.start,0,604800)&&number(x.seconds,8,12)&&number(x.uncertainty,0,.3);}
export function recognitionResults(x:unknown):Recognition[]{
 if(!object(x)||!object(x.status)||!integer(x.status.code))throw Error('malformed');
 if(x.status.code===1001)return [];if(x.status.code!==0)throw Error([3001,3014].includes(x.status.code)?'authentication':x.status.code===3003?'quota':x.status.code===3015?'rate-limit':[3002,3006].includes(x.status.code)?'malformed':'unavailable');
 if(!object(x.metadata)||!Array.isArray(x.metadata.music)||x.metadata.music.length>20)throw Error('malformed');
 return x.metadata.music.map(m=>{
  if(!object(m)||!text(m.acrid,100)||!m.acrid||!text(m.title,400)||!m.title||!Array.isArray(m.artists)||m.artists.length>12||!m.artists.length||!m.artists.every(a=>object(a)&&text(a.name,200))||!number(m.score,0,100))throw Error('malformed');
  const r:Recognition={acrid:m.acrid,title:m.title,artist:m.artists.map(a=>a.name).join(', '),album:object(m.album)&&text(m.album.name,500)?m.album.name:'',duration:number(m.duration_ms,0,604800000)?m.duration_ms/1000:null,score:m.score};
  for(const[key,field]of [['sampleBegin','sample_begin_time_offset_ms'],['sampleEnd','sample_end_time_offset_ms'],['referenceBegin','db_begin_time_offset_ms'],['referenceEnd','db_end_time_offset_ms']] as const)if(m[field]!==undefined){if(!number(m[field],0,604800000))throw Error('malformed');r[key]=m[field];}
  return r;
 }).sort((a,b)=>b.score-a.score);
}
export function recognized(x:Recognition[]){const first=x[0],rival=x.find(r=>r.acrid!==first?.acrid);return first&&first.score>=90&&(!rival||first.score-rival.score>=5)?first:null;}
export function wav(samples:Float32Array){const bytes=new Uint8Array(44+samples.length*2),v=new DataView(bytes.buffer);const put=(at:number,s:string)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));put(0,'RIFF');v.setUint32(4,bytes.length-8,true);put(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,SAMPLE_RATE,true);v.setUint32(28,SAMPLE_RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);put(36,'data');v.setUint32(40,samples.length*2,true);samples.forEach((s,i)=>v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,s))*(s<0?32768:32767)),true));return bytes;}
export function validWav(bytes:Uint8Array,seconds:number){if(bytes.length!==44+Math.round(seconds*SAMPLE_RATE)*2||bytes.length>MAX_AUDIO)return false;const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),s=(a:number,n:number)=>String.fromCharCode(...bytes.slice(a,a+n));return s(0,4)==='RIFF'&&s(8,8)==='WAVEfmt '&&s(36,4)==='data'&&v.getUint32(4,true)===bytes.length-8&&v.getUint32(16,true)===16&&v.getUint16(20,true)===1&&v.getUint16(22,true)===1&&v.getUint32(24,true)===SAMPLE_RATE&&v.getUint32(28,true)===SAMPLE_RATE*2&&v.getUint16(32,true)===2&&v.getUint16(34,true)===16&&v.getUint32(40,true)===bytes.length-44;}
