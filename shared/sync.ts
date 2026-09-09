import type { Playback } from './protocol';
export const STALE_MS = 12000;
export function playbackPosition(p: Playback, received: number, now: number) {
  const age = Math.max(0, now-received);
  const advance = p.playing && !p.buffering && !p.seeking && !p.ended && p.ad === 'content' && age < STALE_MS;
  return Math.min(p.duration ?? Infinity, p.position + (advance ? age/1000*p.rate : 0));
}
export interface Session { key: string; connection: string; instance: string; tab: number; document: string; playback: Playback; received: number; started: number }
export class Sessions {
  entries = new Map<string, Session>(); selected: string | null = null; pinned: string | null = null;
  update(connection: string, instance: string, tab: number, document: string, p: Playback, now: number) {
    const key = `${instance}:${tab}`, old = this.entries.get(key);
    if (old && old.connection === connection && old.document === document && (p.generation < old.playback.generation || (p.generation === old.playback.generation && (p.seq <= old.playback.seq || p.videoId !== old.playback.videoId)))) return false;
    const starts = p.playing && !p.muted && p.ad === 'content' && (!old || !old.playback.playing || old.playback.muted || old.playback.videoId !== p.videoId);
    const entry:Session = {key,connection,instance,tab,document,playback:p,received:now,started:starts ? now : old?.started ?? 0};
    this.entries.set(key,entry);
    if (this.pinned === key || (!this.pinned && (starts || !this.selected))) this.selected=key;
    return true;
  }
  pin(instance:string, tab:number|null) { this.pinned=tab===null?null:`${instance}:${tab}`; if(this.pinned && this.entries.has(this.pinned)) this.selected=this.pinned; }
  remove(connection:string, tab?:number) { for(const [k,s] of this.entries) if(s.connection===connection && (tab===undefined || tab===s.tab)) { this.entries.delete(k); if(this.selected===k)this.selected=null; if(this.pinned===k)this.pinned=null; } if(!this.selected) this.selected=[...this.entries.values()].sort((a,b)=>b.started-a.started)[0]?.key??null; }
  current() { return this.selected ? this.entries.get(this.selected) ?? null : null; }
}
export class LatestRequest {
  private generation=0;
  invalidate() { return ++this.generation; }
  async run<T>(work:()=>Promise<T>, apply:(result:T)=>void) { const generation=this.invalidate(); const result=await work(); if(generation===this.generation) apply(result); }
}
