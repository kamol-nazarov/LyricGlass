import {eligible,continuous} from '../shared/recognition';
import {identity,parseMessage,VERSION,type Playback} from '../shared/protocol';
import {sourceUrl} from '../shared/sources';
export class CaptureSession {
 tab:number|null=null;reason='Audio session is off';private request:any=null;private last?:{p:Playback;at:number;document:string};private desktop=false;
 constructor(private send:(m:unknown)=>void,private api:typeof chrome=chrome){}
 ready(supported:boolean){this.desktop=supported;if(!supported)this.reason='Update the desktop app for optional audio recognition';}
 async enable(){if(!this.desktop)throw Error('Update or connect the desktop app first.');if(!this.api.tabCapture||!this.api.offscreen)throw Error('Tab capture requires Chrome / Edge 120 or newer.');
  const[tab]=await this.api.tabs.query({active:true,currentWindow:true});if(tab?.id===undefined||!sourceUrl(tab.url))throw Error('Open a YouTube tab first.');
  await this.stop();const contexts=await this.api.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType]});if(contexts.length)await this.api.offscreen.closeDocument();
  await this.api.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA' as chrome.offscreen.Reason],justification:'User-enabled audio-only capture of this YouTube tab for optional song recognition'});
  try{const streamId=await this.api.tabCapture.getMediaStreamId({targetTabId:tab.id});const result=await this.api.runtime.sendMessage({target:'offscreen',type:'open',streamId,tab:tab.id});if(!result?.ok)throw Error('capture');this.tab=tab.id;this.reason='Audio session open for this tab. Samples are taken only when eligible.';this.send({v:VERSION,type:'capture-state',tab:tab.id,active:true});}
  catch{await this.stop();throw Error('Could not start tab audio. Open this popup on the YouTube tab and try again.');}
 }
 async stop(){const tab=this.tab;this.tab=null;this.cancel();this.last=undefined;try{await this.api.runtime.sendMessage({target:'offscreen',type:'stop'});await this.api.offscreen?.closeDocument();}catch{}if(tab!==null)this.send({v:VERSION,type:'capture-state',tab,active:false});this.reason='Audio session is off';}
 cancel(){this.request=null;if(this.api.offscreen)void this.api.runtime.sendMessage({target:'offscreen',type:'cancel'}).catch(()=>{});}
 playback(tab:number,document:string,p:Playback){if(tab!==this.tab)return;const now=Date.now();if(this.request&&(!eligible(p,0)||this.last&&(document!==this.last.document||!continuous(this.last.p,p,(now-this.last.at)/1000)))){this.send({v:VERSION,type:'capture-error',id:this.request.id});this.cancel();}this.last={p,at:now,document};}
 async fromDesktop(m:any){if(m.type==='capture-stop'){await this.stop();return;}if(m.type==='capture-cancel'){this.cancel();return;}
  if(m.type!=='capture-request'||!identity(m.id))return;
  if(this.tab!==m.tab||!this.last||!eligible(this.last.p,Date.now()-this.last.at)||this.last.document!==m.document||this.last.p.videoId!==m.video||this.last.p.generation!==m.generation){this.send({v:VERSION,type:'capture-error',id:m.id});return;}
  this.request=m;try{const result=await this.api.runtime.sendMessage({target:'offscreen',type:'sample',id:m.id});if(!result?.ok)throw Error('sample');}catch{this.send({v:VERSION,type:'capture-error',id:m.id});this.cancel();}
 }
 async fromOffscreen(m:any){if(m.type==='capture-ended'){await this.stop();return{ok:true};}const request=this.request;if(!request||m.id!==request.id)return{ok:false};
  if(m.type==='capture-anchor'){const a=await this.api.tabs.sendMessage(request.tab,{type:'capture-anchor'});if(this.request!==request||!a?.playback||!eligible(a.playback,Date.now()-a.capturedAt)||a.playback.videoId!==request.video||a.playback.generation!==request.generation||this.last?.document!==request.document)return{ok:false};return{...a,document:request.document};}
  const types:Record<string,string>={'capture-result-begin':'sample-begin','capture-result-chunk':'sample-chunk','capture-result-end':'sample-end','capture-failed':'capture-error'};const type=types[m.type];if(!type)return{ok:false};
  if(type==='sample-begin'&&(m.tab!==request.tab||m.document!==request.document||m.video!==request.video||m.generation!==request.generation)){this.cancel();return{ok:false};}
  const value={...m,v:VERSION,type};if(!parseMessage(JSON.stringify(value))){this.cancel();return{ok:false};}this.send(value);if(type==='sample-end'||type==='capture-error')this.request=null;return{ok:true};
 }
}
