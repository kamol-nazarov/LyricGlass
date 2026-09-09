import{parseLrc}from'./lyrics';
import{ledgerLines}from'./ledger';
import type{ViewState}from'./ui';
// Original demonstration lines and deliberate demo word timestamps. Never real song lyrics.
const samples=['Morning light on the windows','Paper stars above the room','Let the quiet find a rhythm','Little lights are drifting home','Every moment opens slowly','Silver lines across the sky','Leave the noise outside the door','Find a softer place to land','Let another morning in'];
const lines=parseLrc(samples.map((line,i)=>`[${String(Math.floor(i*6/60)).padStart(2,'0')}:${String(i*6%60).padStart(2,'0')}]${line}`).join('\n')).lines;
export function previewState(state:ViewState,elapsed:number):ViewState{
  const position=12+((Math.max(0,elapsed)%24));const frame=ledgerLines(lines,position,0),current=lines[frame.currentIndex];
  const count=current.text.split(/\s+/).length;
  return{...state,settings:{...state.settings,locked:false},videoId:state.videoId??'preview-demo',title:state.videoId?state.title:'Paper Satellites',artist:state.videoId?state.artist:'Demo Ensemble',current:current.text,status:'Sample lyric preview',timingWarning:undefined,
    ledger:{...frame,synced:true,clock:{position,duration:54,rate:1,advancing:true,validForMs:1000,delay:0,lineStart:current.time,lineEnd:current.time+6,words:Array.from({length:count},(_,i)=>({start:current.time+i*6/count,end:current.time+(i+1)*6/count}))}}};
}
export function previewScale(width:number){return Math.min(.72,300/width);}
