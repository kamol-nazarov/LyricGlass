import {canonical,normalizeTitle,songQuery,parseLrc,timelineOverrun,type RecordLyrics} from './lyrics';
export const MATCHER_VERSION=2;
export type Timing='plausible'|'uncertain'|'incompatible'|'untimed';
export interface Evidence {title:string;artist:string;duration:number|null;album?:string;artists?:string[];provenance?:'structured'|'title-prefix'|'unknown'|'recognition';revision?:string;recognitionId?:string}
export interface Assessment {score:number;strong:boolean;reasons:string[];conflicts:string[];timing:Timing;availability:'timed'|'plain'|'instrumental'|'none'}
const qualifier=/\b(live|acoustic|cover|remix|instrumental|radio edit|extended(?: mix| edit)?|slowed(?: down)?|sped[ -]up|remaster(?:ed)?|studio(?: version)?)\b/gi;
// Only explicit parenthetical/suffix context denotes a version. "Live and Let..." is a title.
export function recordingTitle(input:string){
 let features:string[]=[];const versions:string[]=[];
 const part=(body:string)=>{const kinds=[...body.matchAll(qualifier)].map(m=>m[1].toLowerCase().replace(/remastered/,'remaster'));
  if(kinds.length){versions.push(...kinds);return true;}return false;};
 let title=normalizeTitle(input).replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g,(whole,a,b)=>{const body=a??b;if(/^(?:feat\.?|ft\.?|featuring)\s+/i.test(body)){features.push(body.replace(/^(?:feat\.?|ft\.?|featuring)\s+/i,''));return ' ';}return part(body)?' ':whole;});
 title=title.replace(/\s+[-–—]\s+(.+)$/,(whole,body)=>part(body)?' ':whole);
 title=title.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i,(_whole,body)=>{features.push(body);return '';});
 return {title:normalizeTitle(title),versions:[...new Set(versions)].sort(),features};
}
export function credits(artist:string,extra:string[]=[]){return [...new Set([artist,...extra].flatMap(a=>a.split(/\s+(?:feat\.?|ft\.?|featuring)\s+|\s*[,;]\s*/i)).map(canonical).filter(Boolean))].sort();}
const tokens=(s:string)=>new Set(canonical(s).split(/\s+/));
function titleSimilarity(a:string,b:string){if(canonical(a)===canonical(b))return 1;const x=tokens(a),y=tokens(b);if(x.size<4||y.size<4)return 0;return [...x].filter(t=>y.has(t)).length/Math.max(x.size,y.size);}
export function assess(q:Evidence,r:RecordLyrics):Assessment{
 const query=songQuery(q.title,q.artist),a=recordingTitle(query.title),b=recordingTitle(r.trackName);
 const qa=credits(query.artist,[...(q.artists??[]),...a.features]),ra=credits(r.artistName,b.features),artist=qa.length>0&&qa.join('|')===ra.join('|');
 const title=titleSimilarity(a.title,b.title),reasons:string[]=[],conflicts:string[]=[];
 const albumVersions=recordingTitle(`record (${r.albumName})`).versions;
 const variants=[...new Set([...b.versions,...albumVersions])];
 const mismatch=a.versions.length>0&&b.versions.length>0&&a.versions.join('|')!==b.versions.join('|');
 if(title<.85)conflicts.push('title-conflict');if(qa.length&&!artist)conflicts.push('artist-conflict');if(mismatch)conflicts.push('recording-version-conflict');
 const missingVersion=a.versions.some(v=>!variants.includes(v))||variants.some(v=>!a.versions.includes(v));
 if(missingVersion)reasons.push('recording-version-unconfirmed');
 if(title===1)reasons.push('exact-title');else if(title>=.85)reasons.push('conservative-token-title');
 if(artist)reasons.push('artist-credits-agree');else if(!qa.length)reasons.push('artist-unknown');
 const d=q.duration===null?null:Math.abs(q.duration-r.duration),album=!!q.album&&canonical(q.album)===canonical(r.albumName);
 const short=tokens(a.title).size<2||canonical(a.title).length<7;
 let score=title*.64+(artist?.30:0)+(album?.035:0)+(d!==null&&d<=3?.025:0);
 if(missingVersion)score-=.18;if(d!==null&&d>30){score-=.15;reasons.push('recording-length-unconfirmed');}if(conflicts.length)score=0;
 const strong=score>=.93&&artist&&!missingVersion&&(!short||(d!==null&&d<=3&&(q.provenance!=='unknown')))&&(title===1||(album&&d!==null&&d<=3));
 const parsed=!r.instrumental&&r.syncedLyrics?parseLrc(r.syncedLyrics).lines:[];
 const overrun=timelineOverrun(parsed,r.duration)>2||timelineOverrun(parsed,q.duration)>2;
 const timing:Timing=!parsed.length?'untimed':overrun?'incompatible':d===null||d>3||missingVersion?'uncertain':'plausible';
 reasons.push(d===null?'duration-unknown':d<=3?'duration-close':'duration-difference',`timing-${timing}`);
 return {score,strong,reasons,conflicts,timing,availability:r.instrumental?'instrumental':parsed.length?'timed':r.plainLyrics?'plain':'none'};
}
const body=(r:RecordLyrics)=>canonical(r.plainLyrics??parseLrc(r.syncedLyrics??'').lines.map(l=>l.text).join(' '));
export function equivalent(a:RecordLyrics,b:RecordLyrics){return a.id===b.id||(canonical(a.trackName)===canonical(b.trackName)&&credits(a.artistName).join('|')===credits(b.artistName).join('|')&&Math.abs(a.duration-b.duration)<=2&&a.instrumental===b.instrumental&&(!a.syncedLyrics||!b.syncedLyrics||a.syncedLyrics.trim()===b.syncedLyrics.trim())&&!!body(a)&&body(a)===body(b)&&recordingTitle(`x (${a.albumName})`).versions.join('|')===recordingTitle(`x (${b.albumName})`).versions.join('|'));}
export function rankCandidates(q:Evidence,records:RecordLyrics[]){
 return [...new Map(records.map(r=>[r.id,r])).values()].map(record=>({record,assessment:assess(q,record)})).sort((a,b)=>b.assessment.score-a.assessment.score||(equivalent(a.record,b.record)?Number(b.assessment.timing==='plausible')-Number(a.assessment.timing==='plausible')||Number(!!b.record.syncedLyrics)-Number(!!a.record.syncedLyrics):0)||a.record.id-b.record.id);
}
export function confidentMatch(q:Evidence,records:RecordLyrics[]){const ranked=rankCandidates(q,records),first=ranked[0];if(!first?.assessment.strong)return null;const rival=ranked.slice(1).find(r=>!equivalent(first.record,r.record));return rival&&first.assessment.score-rival.assessment.score<.08?null:first.record;}
export const matchScore=(q:Evidence,r:RecordLyrics)=>assess(q,r).score;
export function evidenceKey(q:Evidence){return JSON.stringify([canonical(q.title),credits(q.artist,q.artists),q.album?canonical(q.album):'',q.duration===null?null:Math.round(q.duration),q.provenance]);}
export function hypotheses(q:Evidence){
 const structured=songQuery(q.title,q.artist),base=recordingTitle(structured.title).title;
 const list=[{...structured,free:false,stage:'structured'},{title:base,artist:structured.artist,free:false,stage:'normalized'},
 {title:base.normalize('NFD').replace(/\p{M}/gu,''),artist:structured.artist.normalize('NFD').replace(/\p{M}/gu,''),free:false,stage:'accent-query'},
 {title:[structured.artist,structured.title].filter(Boolean).join(' '),artist:'',free:true,stage:'broad'},
 {title:structured.title,artist:'',free:false,stage:'title-only'}];
 const seen=new Set<string>();return list.filter(h=>{const key=JSON.stringify([canonical(h.title),canonical(h.artist),h.free]);if(!h.title||seen.has(key))return false;seen.add(key);return true;}).slice(0,5);
}
