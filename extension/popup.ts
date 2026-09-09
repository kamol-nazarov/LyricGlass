import { integer, DEFAULT_PORT } from '../shared/protocol';
import { browserApi as chrome } from './browser';
import {canPinSource}from'../shared/sources';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let editing=false;
async function refresh(){const s=await chrome.runtime.sendMessage({type:'status'});if(!editing)$<HTMLInputElement>('port').value=String(s.port);$('status').textContent=s.status;$('pinStatus').textContent=s.pin===null?'Automatic: most recently started audible tab. Paused selection stays selected.':`Pinned to tab ${s.pin}.`;}
$('port').addEventListener('input',()=>editing=true);
$('details').addEventListener('input',()=>{try{const p=JSON.parse($<HTMLTextAreaElement>('details').value);if(integer(p.port,1024,65535))$<HTMLInputElement>('port').value=String(p.port);}catch{}});
$('pair').addEventListener('click',async()=>{try{
  const p=JSON.parse($<HTMLTextAreaElement>('details').value);const port=Number($<HTMLInputElement>('port').value)||DEFAULT_PORT;
  if(p.v!==1||typeof p.secret!=='string'||!/^[a-f0-9]{64}$/.test(p.secret)||!integer(port,1024,65535))throw Error('Paste the pairing details copied from LyricGlass settings.');
  // A visible trusted document can trigger a local-network permission prompt if required.
  try{await fetch(`http://127.0.0.1:${port}/permission`,{signal:AbortSignal.timeout(4000),cache:'no-store'});}catch{ /* Worker status explains blocked/offline connection; credentials remain local. */ }
  const result=await chrome.runtime.sendMessage({type:'pair',secret:p.secret,port});if(!result.ok)throw Error('Pairing details rejected.');$<HTMLTextAreaElement>('details').value='';await refresh();
}catch(e){$('status').textContent=e instanceof Error?e.message:'Pairing failed';}});
$('retry').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'retry'});await refresh();});
$('pin').addEventListener('click',async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});if(!t||!canPinSource(t.url)){$('status').textContent='Open a YouTube or YouTube Music playback tab first.';return;}await chrome.runtime.sendMessage({type:'pin',tab:t.id});await refresh();});
$('unpin').addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'pin',tab:null});await refresh();});
void refresh();const timer=setInterval(()=>void refresh(),2000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
