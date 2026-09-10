import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { settings, type Settings } from '../shared/settings';
import { object, text, number, videoId, extensionOrigin } from '../shared/protocol';
import { MATCHER_VERSION, type RecordLyrics } from '../shared/lyrics';
export const validRecord=(x:unknown):x is RecordLyrics=>object(x)&&number(x.id,0,Number.MAX_SAFE_INTEGER)&&Number.isInteger(x.id)&&text(x.trackName,400)&&text(x.artistName,400)&&text(x.albumName,500)&&number(x.duration,0,604800)&&typeof x.instrumental==='boolean'&&(x.plainLyrics===null||text(x.plainLyrics,200000))&&(x.syncedLyrics===null||text(x.syncedLyrics,200000));
export type Provenance='explicit-selection'|'import'|'metadata'|'recognition'|'legacy-unknown';
export interface Mapping {record:RecordLyrics;recordKey?:string;recognitionId?:string;delays:Record<string,number>;used:number;provenance?:Provenance;matcherVersion?:number;selectedAt?:number;evidence?:string;automatic?:Record<string,{delay:number;acrid:string;at:number}>}
interface Cache {used:number;fetchedAt:number;records:RecordLyrics[]}
interface Data {schemaVersion:2;settings:Settings;secret:string;origin:string|null;mappings:Record<string,Mapping>;cache:Record<string,Cache>;rejected:Record<string,{ids:number[];used:number}>;recognition:{enabled:boolean;consent:boolean;dailyCap:number;day:string;used:number;episodes:Record<string,number>}}
export const POSITIVE_TTL=7*86400000,NEGATIVE_TTL=5*60000;
export class Store {
 data:Data;warning='';private timer:ReturnType<typeof setTimeout>|undefined;private blocked=false;private original:string|undefined;
 constructor(private directory:string,private now=()=>Date.now()){
  let raw:Record<string,unknown>={};
  try{const file=path.join(directory,'data.json');if(fs.existsSync(file)){if(fs.statSync(file).size>40_000_000)throw Error('oversize');this.original=fs.readFileSync(file,'utf8');const value=JSON.parse(this.original);if(!object(value)||value.schemaVersion!==undefined&&value.schemaVersion!==2)throw Error('unsupported schema');raw=value;}}
  catch{this.blocked=true;this.warning='Local data needs recovery. The original data.json is protected; changes will not be saved until it is repaired or moved aside while LyricGlass is closed.';}
  this.data={schemaVersion:2,settings:settings(raw.settings),secret:typeof raw.secret==='string'&&/^[a-f0-9]{64}$/.test(raw.secret)?raw.secret:randomBytes(32).toString('hex'),origin:extensionOrigin(raw.origin)?raw.origin:null,mappings:{},cache:{},rejected:{},recognition:{enabled:false,consent:false,dailyCap:50,day:'',used:0,episodes:{}}};
  if(object(raw.mappings))for(const[id,m]of Object.entries(raw.mappings).slice(0,300))if(videoId(id)&&object(m)&&validRecord(m.record)){
   const delays:Record<string,number>={},automatic:NonNullable<Mapping['automatic']>={};
   if(object(m.delays))for(const[k,v]of Object.entries(m.delays).slice(0,20))if(/^\d{1,16}$/.test(k)&&number(v,-600000,600000))delays[k]=v;
   if(object(m.automatic))for(const[k,v]of Object.entries(m.automatic).slice(0,20))if(/^\d{1,16}$/.test(k)&&object(v)&&number(v.delay,-600000,600000)&&text(v.acrid,100)&&number(v.at,0,Infinity))automatic[k]={delay:v.delay,acrid:v.acrid,at:v.at};
   this.data.mappings[id]={record:m.record,recordKey:(m.record.albumName==='Local LRC import'?'local:':'lrclib:')+m.record.id,recognitionId:text(m.recognitionId,100)?m.recognitionId:undefined,delays,automatic,used:number(m.used,0,Infinity)?m.used:0,provenance:['explicit-selection','import','metadata','recognition','legacy-unknown'].includes(m.provenance as string)?m.provenance as Provenance:'legacy-unknown',matcherVersion:number(m.matcherVersion,0,10000)?m.matcherVersion:0,selectedAt:number(m.selectedAt,0,Infinity)?m.selectedAt:0,evidence:text(m.evidence,1500)?m.evidence:undefined};
  }
  if(object(raw.cache))for(const[k,c]of Object.entries(raw.cache).slice(0,100))if(k.length<1000&&object(c)&&Array.isArray(c.records)&&c.records.length<=100&&c.records.every(validRecord))this.data.cache[k]={records:c.records,used:number(c.used,0,Infinity)?c.used:0,fetchedAt:number(c.fetchedAt,0,Infinity)?c.fetchedAt:0};
  if(object(raw.rejected))for(const[id,r]of Object.entries(raw.rejected).slice(0,250))if(videoId(id)&&object(r)&&Array.isArray(r.ids)&&r.ids.length<=100&&r.ids.every(n=>number(n,0,Number.MAX_SAFE_INTEGER)&&Number.isInteger(n)))this.data.rejected[id]={ids:r.ids,used:number(r.used,0,Infinity)?r.used:0};
  const r=raw.recognition;if(object(r)){Object.assign(this.data.recognition,{enabled:r.enabled===true,consent:r.consent===true,dailyCap:number(r.dailyCap,0,50)?Math.floor(r.dailyCap):50,day:typeof r.day==='string'&&/^\d{4}-\d\d-\d\d$/.test(r.day)?r.day:'',used:number(r.used,0,100000)?Math.floor(r.used):0});if(object(r.episodes))for(const[id,n]of Object.entries(r.episodes).slice(-1000))if(videoId(id)&&number(n,0,2))this.data.recognition.episodes[id]=Math.floor(n);}
  // Back up the exact recoverable input before the first atomic migration write.
  if(raw.schemaVersion===2)this.original=undefined;
 }
 save(){if(this.blocked)return;if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{try{this.flush();}catch{this.warning='Could not save local data. The previous file is retained.';}},300);}
 flush(){if(this.timer)clearTimeout(this.timer);if(this.blocked)throw Error(this.warning);fs.mkdirSync(this.directory,{recursive:true});const target=path.join(this.directory,'data.json');if(this.original!==undefined){const backup=`${target}.pre-v2.bak`;if(!fs.existsSync(backup))fs.writeFileSync(backup,this.original,{flag:'wx'});this.original=undefined;}fs.writeFileSync(`${target}.tmp`,JSON.stringify(this.data));fs.renameSync(`${target}.tmp`,target);}
 cacheGet(key:string){const c=this.data.cache[key];if(!c||this.now()-c.fetchedAt> (c.records.length?POSITIVE_TTL:NEGATIVE_TTL)||c.fetchedAt>this.now())return undefined;c.used=this.now();return c.records;}
 cachePut(key:string,records:RecordLyrics[]){this.data.cache[key]={used:this.now(),fetchedAt:this.now(),records};this.prune(this.data.cache,80,8_000_000);this.save();}
 attach(id:string,record:RecordLyrics,provenance:Provenance='explicit-selection',evidence?:string,recognitionId?:string){const old=this.data.mappings[id];this.data.mappings[id]={record,recordKey:(record.albumName==='Local LRC import'?'local:':'lrclib:')+record.id,recognitionId,delays:old?.delays??{},automatic:old?.automatic??{},used:this.now(),selectedAt:this.now(),provenance,matcherVersion:MATCHER_VERSION,evidence};this.prune(this.data.mappings,250,16_000_000);this.save();}
 delay(id:string){const m=this.data.mappings[id],key=String(m?.record.id);return m?.delays[key]??m?.automatic?.[key]?.delay??0;}
 hasManualDelay(id:string){const m=this.data.mappings[id];return !!m&&Object.hasOwn(m.delays,String(m.record.id));}
 setDelay(id:string,delay:number){const m=this.data.mappings[id];if(m){m.delays[String(m.record.id)]=delay;while(Object.keys(m.delays).length>20)delete m.delays[Object.keys(m.delays)[0]];this.save();}}
 setAutomaticDelay(id:string,delay:number,acrid:string){const m=this.data.mappings[id];if(m&&!this.hasManualDelay(id)){m.automatic??={};m.automatic[String(m.record.id)]={delay,acrid,at:this.now()};this.save();}}
 resetTiming(id:string){const m=this.data.mappings[id];if(m){delete m.delays[String(m.record.id)];if(m.automatic)delete m.automatic[String(m.record.id)];this.save();}}
 rejects(id:string){return this.data.rejected[id]?.ids??[];}
 reject(id:string,recordId:number){const entry=this.data.rejected[id]??{ids:[],used:0};entry.ids=[...new Set([...entry.ids,recordId])].slice(-100);entry.used=this.now();this.data.rejected[id]=entry;this.prune(this.data.rejected,250,100000);this.save();}
 forget(id:string){const m=this.data.mappings[id];if(m)this.reject(id,m.record.id);delete this.data.mappings[id];this.save();}
 recognitionBudget(id:string){const r=this.data.recognition;const day=new Date(this.now()).toISOString().slice(0,10);if(r.day!==day){r.day=day;r.used=0;}return r.used<r.dailyCap&&(r.episodes[id]??0)<2;}
 reserveRecognition(id:string){if(!this.recognitionBudget(id))return false;const r=this.data.recognition;r.used++;r.episodes[id]=(r.episodes[id]??0)+1;while(Object.keys(r.episodes).length>1000)delete r.episodes[Object.keys(r.episodes)[0]];this.flush();return true;}
 private prune<T extends{used:number}>(items:Record<string,T>,limit:number,bytes:number){const oldest=Object.keys(items).sort((a,b)=>items[a].used-items[b].used);while(oldest.length>limit||JSON.stringify(items).length>bytes){const key=oldest.shift();if(!key)break;delete items[key];}}
}
