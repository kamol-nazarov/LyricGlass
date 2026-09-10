// Frozen 0.3.0 matching/parser baseline from commit 37a2989; synthetic evaluation only.
export interface WordTiming { start:number; end:number|null }
export interface LyricLine { time: number; text: string; words?:WordTiming[] }
export interface Lyrics { lines: LyricLine[]; metadata: Record<string, string>; offset: number }
export function parseLrc(input: string): Lyrics {
  const lines: (LyricLine & { order: number })[] = []; const metadata: Record<string,string> = {}; let offset = 0;
  for (const raw of input.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const meta = raw.match(/^\[([a-z]+):([^\]]*)\]\s*$/i);
    if (meta) { if (meta[1].toLowerCase() === 'offset' && /^[+-]?\d+$/.test(meta[2].trim())) offset = Math.max(-600000, Math.min(600000, Number(meta[2]))); else if (['ar','ti','al','by','length'].includes(meta[1].toLowerCase())) metadata[meta[1].toLowerCase()] = meta[2]; continue; }
    const tags = [...raw.matchAll(/\[(\d{1,4}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const body = raw.replace(/\[\d{1,4}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
    const wordTags=[...body.matchAll(/<(\d{1,4}):(\d{2})(?:[.:](\d{1,3}))?>([^<]*)/g)];
    const stamp=(t:RegExpMatchArray)=>Number(t[1])*60+Number(t[2])+Number((t[3]||'').padEnd(3,'0'))/1000;
    const wordLevel=wordTags.length>0&&wordTags[0].index===0&&wordTags.every(t=>Number(t[2])<60&&t[4].trim().split(/\s+/).length===1)&&wordTags.every((t,i)=>i===0||stamp(t)>=stamp(wordTags[i-1]));
    const visibleBody=body.replace(/<\d{1,4}:\d{2}(?:[.:]\d{1,3})?>/g,'').trim();
    for (const t of tags) if (Number(t[2]) < 60) {
      const time=stamp(t),delta=time-stamp(tags[0]);
      const words=wordLevel?wordTags.flatMap((w,i)=>w[4].trim()?[{start:stamp(w)+delta,end:wordTags[i+1]?stamp(wordTags[i+1])+delta:null}]:[]):undefined;
      lines.push({ time, text:visibleBody, order:lines.length,...(words?{words}:{}) });
    }
  }
  // LRC offset advances timestamps; manual positive delay has the opposite convention.
  const adjusted=(time:number)=>Math.max(0,Math.round(time*1000)-offset)/1000;
  lines.forEach(l => {l.time=adjusted(l.time);l.words?.forEach(word=>{word.start=adjusted(word.start);if(word.end!==null)word.end=adjusted(word.end);});});
  lines.sort((a,b) => a.time-b.time || a.order-b.order);
  const merged: LyricLine[] = [];
  for (const l of lines) { const prev = merged.at(-1); if (prev?.time === l.time) { if (l.text && !prev.text.split('\n').includes(l.text)) {prev.text = [prev.text,l.text].filter(Boolean).join('\n');delete prev.words;} } else merged.push({ time:l.time, text:l.text,...(l.words?{words:l.words}:{}) }); }
  return { lines:merged, metadata, offset };
}
export function selectLines(lines: LyricLine[], position: number, delay = 0, ended = false) {
  if (ended) return { previous: '', current: '', next: '', index: -1 };
  const effective = position - delay/1000;
  let low = 0, high = lines.length;
  while (low < high) { const m = (low+high) >>> 1; if (lines[m].time <= effective) low = m+1; else high = m; }
  const i = low-1;
  return { previous: lines[i-1]?.text || '', current: lines[i]?.text || '', next: lines[i+1]?.text || '', index: i };
}
export interface RecordLyrics { id: number; trackName: string; artistName: string; albumName: string; duration: number; instrumental: boolean; plainLyrics: string | null; syncedLyrics: string | null }
export function timelineOverrun(lines:LyricLine[],duration:number|null,delay=0):number {
  if(duration===null||duration<=0)return 0;
  let last:LyricLine|undefined;
  for(let i=lines.length-1;i>=0;i--)if(lines[i].text.trim()){last=lines[i];break;}
  const finalWord=last?.words?.at(-1);
  const end=last?Math.max(last.time,finalWord?.end??finalWord?.start??last.time):0;
  return last?Math.max(0,end+delay/1000-duration):0;
}
export function recordTimingWarning(record:RecordLyrics):string|undefined{
  if(!record.syncedLyrics)return undefined;
  const overrun=timelineOverrun(parseLrc(record.syncedLyrics).lines,record.duration);
  return overrun>2?`Lyric timestamps exceed this recording by ${Math.ceil(overrun)} seconds.`:undefined;
}
function titleDecoration(value:string) {
  const words=value.toLowerCase().trim().split(/[\s,|/–—-]+/);
  const media=/^(?:video|audio|lyrics?|visuali[sz]er|hd|uhd|4k|8k|1080p|2160p)$/;
  return words.some(word=>media.test(word))&&words.every(word=>media.test(word)||word==='official'||word==='music');
}
export function normalizeTitle(s: string) {
  return s.replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g,(whole,round,square)=>titleDecoration(round??square)?' ':whole)
    .replace(/\s+[-|–—]\s+([^|–—]+)$/,(whole,suffix)=>titleDecoration(suffix)?'':whole).replace(/\s+/g,' ').trim();
}
const canonical = (s:string) => normalizeTitle(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function songQuery(title: string, artist: string) {
  const clean = normalizeTitle(title); const split = clean.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return split && !artist ? { title:split[2], artist:split[1] } : { title:clean, artist };
}
const distinctions = (s:string) => [...s.toLowerCase().matchAll(/\b(live|acoustic|remix|cover|instrumental|sped up|slowed|remaster(?:ed)?)\b/g)].map(x=>x[1]).sort().join('|');
export function matchScore(query: {title:string;artist:string;duration:number|null}, r: RecordLyrics) {
  if(recordTimingWarning(r)||r.syncedLyrics&&timelineOverrun(parseLrc(r.syncedLyrics).lines,query.duration)>2)return 0;
  if (distinctions(query.title) !== distinctions(r.trackName)) return 0;
  if (canonical(query.title) !== canonical(r.trackName)) return 0;
  if (!query.artist || canonical(query.artist) !== canonical(r.artistName)) return .45;
  if (query.duration === null) return .75;
  const d = Math.abs(query.duration-r.duration);
  return d <= 3 ? 1 : d <= 15 ? .93 : d <= 30 ? .85 : .6;
}
export function confidentMatch(q: {title:string;artist:string;duration:number|null}, results: RecordLyrics[]) {
  const ranked = results.map(r=>({r,score:matchScore(q,r)})).sort((a,b)=>b.score-a.score || Number(!!b.r.syncedLyrics)-Number(!!a.r.syncedLyrics));
  if (!ranked.length || ranked[0].score < .85) return null;
  // Equivalent album duplicates are safe; ambiguous recording durations need a manual choice.
  if (ranked[1] && ranked[0].score-ranked[1].score < .08 && Math.abs(ranked[0].r.duration-ranked[1].r.duration)>3) return null;
  return ranked[0].r;
}
