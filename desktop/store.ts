import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { settings, type Settings } from '../shared/settings';
import { object, text, number, videoId, extensionOrigin } from '../shared/protocol';
import type { RecordLyrics } from '../shared/lyrics';
export const validRecord=(x:unknown):x is RecordLyrics=>object(x)&&number(x.id,0,Number.MAX_SAFE_INTEGER)&&Number.isInteger(x.id)&&text(x.trackName,400)&&text(x.artistName,400)&&text(x.albumName,500)&&number(x.duration,0,604800)&&typeof x.instrumental==='boolean'&&(x.plainLyrics===null||text(x.plainLyrics,200000))&&(x.syncedLyrics===null||text(x.syncedLyrics,200000));
export interface Mapping { record:RecordLyrics; delays:Record<string,number>; used:number }
interface Data { settings:Settings; secret:string; origin:string|null; mappings:Record<string,Mapping>; cache:Record<string,{used:number;records:RecordLyrics[]}> }
export class Store {
  data:Data; warning=''; private timer:ReturnType<typeof setTimeout>|undefined;
  constructor(private directory:string) {
    let raw:Record<string,unknown>={};
    try { const f=path.join(directory,'data.json'); if(fs.existsSync(f)) { if(fs.statSync(f).size>40_000_000)throw Error('oversize'); const x=JSON.parse(fs.readFileSync(f,'utf8')); if(object(x))raw=x; } } catch { this.warning='Local data could not be read; defaults loaded. The original is retained as data.json until settings are saved.'; }
    this.data={settings:settings(raw.settings),secret:typeof raw.secret==='string'&&/^[a-f0-9]{64}$/.test(raw.secret)?raw.secret:randomBytes(32).toString('hex'),origin:extensionOrigin(raw.origin)?raw.origin:null,mappings:{},cache:{}};
    if(object(raw.mappings)) for(const [id,m]of Object.entries(raw.mappings).slice(0,300)) if(videoId(id)&&object(m)&&validRecord(m.record)) {const delays:Record<string,number>={}; if(object(m.delays))for(const[k,v]of Object.entries(m.delays).slice(0,20))if(number(v,-600000,600000))delays[k]=v;this.data.mappings[id]={record:m.record,delays,used:number(m.used,0,Infinity)?m.used:0};}
    if(object(raw.cache))for(const[k,v]of Object.entries(raw.cache).slice(0,100))if(k.length<1000&&object(v)&&Array.isArray(v.records)&&v.records.length<=20&&v.records.every(validRecord))this.data.cache[k]={used:number(v.used,0,Infinity)?v.used:0,records:v.records};
  }
  save() { if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{try{this.flush();}catch{this.warning='Could not save local data. Check disk space and permissions.';}},300); }
  flush() { if(this.timer)clearTimeout(this.timer);fs.mkdirSync(this.directory,{recursive:true});const target=path.join(this.directory,'data.json');fs.writeFileSync(`${target}.tmp`,JSON.stringify(this.data));fs.renameSync(`${target}.tmp`,target); }
  cacheGet(key:string) { const c=this.data.cache[key];if(!c)return undefined;c.used=Date.now();this.save();return c.records; }
  cachePut(key:string,records:RecordLyrics[]) { if(!records.length)return;this.data.cache[key]={used:Date.now(),records};this.prune(this.data.cache,80,8_000_000);this.save(); }
  attach(id:string,record:RecordLyrics) { this.data.mappings[id]={record,delays:this.data.mappings[id]?.delays??{},used:Date.now()};this.prune(this.data.mappings,250,16_000_000);this.save(); }
  delay(id:string) { const m=this.data.mappings[id];return m?.delays[String(m.record.id)]??0; }
  setDelay(id:string,delay:number) { const m=this.data.mappings[id];if(m){m.delays[String(m.record.id)]=delay;while(Object.keys(m.delays).length>20)delete m.delays[Object.keys(m.delays)[0]];this.save();} }
  private prune<T extends {used:number}>(items:Record<string,T>,limit:number,bytes:number) { const oldest=Object.keys(items).sort((a,b)=>items[a].used-items[b].used);while(oldest.length>limit||JSON.stringify(items).length>bytes){const k=oldest.shift();if(!k)break;delete items[k];} }
}
