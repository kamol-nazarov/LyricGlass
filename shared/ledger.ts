import { selectLines, type LyricLine, type WordTiming } from './lyrics';
export interface LedgerLine extends LyricLine { index:number; relative:number }
export interface LedgerClock {
  position:number; duration:number|null; rate:number; advancing:boolean; validForMs:number;
  delay:number; lineStart:number|null; lineEnd:number|null; words?:WordTiming[];
}
export interface LedgerState { lines:LedgerLine[]; currentIndex:number; synced:boolean; clock:LedgerClock }
export function ledgerLines(lines:LyricLine[],position:number,delay:number) {
  const currentIndex=selectLines(lines,position,delay).index;
  return {currentIndex,lines:Array.from({length:5},(_,slot)=>{
    const index=currentIndex+slot-2;
    return {index,relative:slot-2,time:lines[index]?.time??0,text:lines[index]?.text??''};
  })};
}
// Receipt time is renderer-local. Never compare main/renderer performance.now origins.
export function ledgerPosition(clock:LedgerClock,receivedAt:number,now:number) {
  const elapsed=Math.max(0,now-receivedAt);
  const advance=clock.advancing?Math.min(elapsed,Math.max(0,clock.validForMs))/1000*clock.rate:0;
  return Math.min(clock.duration??Infinity,clock.position+advance);
}
export function lineProgress(clock:LedgerClock,position:number) {
  if(clock.lineStart===null||clock.lineEnd===null||clock.lineEnd<=clock.lineStart)return 0;
  return Math.max(0,Math.min(1,(position-clock.delay/1000-clock.lineStart)/(clock.lineEnd-clock.lineStart)));
}
export function wordFill(progress:number,index:number,count:number) {
  return Math.max(0,Math.min(1,progress*count-index));
}
export function timedWordFill(clock:LedgerClock,position:number,index:number,count:number) {
  const word=clock.words?.length===count?clock.words[index]:undefined;
  // Line timestamps locate the line, not its syllables. Never invent word timing.
  if(!word)return clock.lineStart!==null&&position-clock.delay/1000>=clock.lineStart?1:0;
  const end=word.end??clock.lineEnd,effective=position-clock.delay/1000;
  if(end===null)return effective>=word.start?1:0;
  return end<=word.start?(effective>=end?1:0):Math.max(0,Math.min(1,(effective-word.start)/(end-word.start)));
}
export function highlightMode(clock:LedgerClock,text:string):'word'|'line'{
  const count=text.trim()?text.trim().split(/\s+/u).length:0;
  return count>0&&clock.words?.length===count?'word':'line';
}
export function displayTime(seconds:number|null) {
  if(seconds===null||!Number.isFinite(seconds))return '–:––';
  const n=Math.max(0,Math.floor(seconds));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
}
export function displayDelay(ms:number) {return `${ms>0?'+':ms<0?'−':''}${Math.abs(ms)} ms`;}
