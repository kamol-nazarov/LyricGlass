import { validPlayback, integer, identity, DEFAULT_PORT, VERSION } from '../shared/protocol';
import { ConnectionState } from './connection';
import { browserApi as chrome } from './browser';
import { CredentialVault } from './credentials';
import { SOURCE_PATTERNS,sourceUrl,sourceAllowsVideo } from '../shared/sources';
import {CaptureSession} from './capture-session';
const capture=new CaptureSession(send,chrome);
let socket:WebSocket|null=null,reconnect:ReturnType<typeof setTimeout>|undefined,heartbeat:ReturnType<typeof setInterval>|undefined,authTimer:ReturnType<typeof setTimeout>|undefined;
let config:{secret?:string;port?:number;instance?:string;pin?:number|null}={};let status='Not paired',lastPong=0;
const state=new ConnectionState();const docs=new Map<number,{current:string;retired:Set<string>}>();
const tabUrls=new Map<number,string>();
const firefox=chrome.runtime.getURL('').startsWith('moz-extension://');
const vault=firefox?new CredentialVault():null;
const initialized=(async()=>{
  if(!firefox)await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  config={...await chrome.storage.local.get(firefox?['port','instance']:['secret','port','instance']),...await chrome.storage.session.get(['pin'])};
  if(vault)config.secret=await vault.read();
  if(!identity(config.instance)){config.instance=crypto.randomUUID();await chrome.storage.local.set({instance:config.instance});}
})();
void initialized.catch(()=>{status='Private pairing storage unavailable. Check browser storage permissions, then reload the extension.';});
function send(m:unknown){if(state.canSend()&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(m));}
async function fresh(){const tabs=await chrome.tabs.query({url:SOURCE_PATTERNS});for(const t of tabs)if(t.id!==undefined)void chrome.tabs.sendMessage(t.id,{type:'fresh'}).catch(()=>{});}
function connect(){
  reconnect=undefined;if(socket||!config.secret)return;
  status='Connecting…';const ws=socket=new WebSocket(`ws://127.0.0.1:${config.port??DEFAULT_PORT}/`);
  authTimer=setTimeout(()=>ws.close(),6000);
  ws.onopen=()=>ws.send(JSON.stringify({v:VERSION,type:'auth',secret:config.secret,instance:config.instance}));
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}if(m.v!==VERSION)return;if(m.type==='ready'){
    clearTimeout(authTimer);state.connected();capture.ready(m.captureVersion===1);status='Connected';lastPong=Date.now();docs.clear();send({v:VERSION,type:'pin',tab:config.pin??null});void fresh();
    heartbeat=setInterval(()=>{if(Date.now()-lastPong>45000){ws.close();return;}send({v:VERSION,type:'heartbeat'});void fresh();},20000);
  }else if(m.type==='pong')lastPong=Date.now();else if(state.canSend())void capture.fromDesktop(m);};
  ws.onerror=()=>{status='Cannot reach desktop. Check app, port and local-network permission.';};
  ws.onclose=e=>{if(socket!==ws)return;void capture.stop();socket=null;state.disconnected();clearTimeout(authTimer);clearInterval(heartbeat);status=e.code===4003?'Pairing rejected. Copy fresh details from the desktop.':'Disconnected — retrying';if(e.code!==4003)reconnect=setTimeout(connect,state.nextDelay());};
}
async function restart(){await capture.stop();clearTimeout(reconnect);clearTimeout(authTimer);clearInterval(heartbeat);const old=socket;socket=null;old?.close();state.disconnected();connect();}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.id!==chrome.runtime.id)return;
  if(sender.tab){
    const frameUrl=sourceUrl(sender.url),currentUrl=sourceUrl(tabUrls.get(sender.tab.id!)??sender.tab.url??sender.url);
    if(sender.frameId!==0||!frameUrl||!currentUrl||frameUrl.origin!==currentUrl.origin||(sender.documentLifecycle&&sender.documentLifecycle!=='active'))return;
    const tab=sender.tab.id!;const doc=sender.documentId??(identity(m?.document)?m.document:undefined);
    if(m?.type==='playback'&&validPlayback(m.playback)&&identity(m.document)){
      if(!sourceAllowsVideo(currentUrl.href,m.playback.videoId))return;
      const document=doc??m.document;const known=docs.get(tab);if(known?.retired.has(document)&&sender.documentLifecycle!=='active')return;
      known?.retired.delete(document);
      if(!known)docs.set(tab,{current:document,retired:new Set()});else if(known.current!==document){known.retired.add(known.current);known.current=document;}
      send({v:VERSION,type:'snapshot',tab,document,playback:m.playback});
      capture.playback(tab,document,m.playback);
    }else if(m?.type==='gone'&&(!docs.get(tab)||docs.get(tab)?.current===doc)){send({v:VERSION,type:'remove',tab});}
    void initialized.then(()=>{if(!socket&&!reconnect)connect();}).catch(()=>{});return;
  }
  if(sender.url===chrome.runtime.getURL('offscreen.html')){void capture.fromOffscreen(m).then(reply).catch(()=>reply({ok:false}));return true;}
  if(sender.url!==chrome.runtime.getURL('popup.html'))return;
  void initialized.then(async()=>{
    if(m?.type==='status')reply({status,port:config.port??DEFAULT_PORT,paired:!!config.secret,pin:config.pin??null,captureCapable:!firefox,captureActive:capture.tab!==null,captureReason:capture.reason});
    else if(m?.type==='capture-enable'&&!firefox){try{await capture.enable();reply({ok:true});}catch(e){reply({ok:false,error:e instanceof Error?e.message:'Capture unavailable'});}}
    else if(m?.type==='capture-disable'){await capture.stop();reply({ok:true});}
    else if(m?.type==='pair'&&typeof m.secret==='string'&&/^[a-f0-9]{64}$/.test(m.secret)&&integer(m.port,1024,65535)){
      if(vault){await vault.write(m.secret);await chrome.storage.local.set({port:m.port});}else await chrome.storage.local.set({secret:m.secret,port:m.port});
      config.secret=m.secret;config.port=m.port;await restart();reply({ok:true});
    }else if(m?.type==='pin'&&(m.tab===null||integer(m.tab,0,2**31-1))){config.pin=m.tab;await chrome.storage.session.set({pin:m.tab});send({v:VERSION,type:'pin',tab:m.tab});await fresh();reply({ok:true});}
    else if(m?.type==='retry'){await restart();reply({ok:true});}else reply({ok:false});
  }).catch(()=>reply(m?.type==='status'?{status,port:DEFAULT_PORT,paired:false,pin:null}:{ok:false}));return true;
});
chrome.tabs.onUpdated.addListener((tab,change)=>{if(!change.url)return;if(tab===capture.tab){capture.cancel();if(!sourceUrl(change.url))void capture.stop();}if(sourceUrl(change.url)){tabUrls.set(tab,change.url);void chrome.tabs.sendMessage(tab,{type:'fresh'}).catch(()=>{});}else{tabUrls.delete(tab);docs.delete(tab);send({v:VERSION,type:'remove',tab});}});
chrome.tabs.onRemoved.addListener(tab=>{if(tab===capture.tab)void capture.stop();tabUrls.delete(tab);docs.delete(tab);send({v:VERSION,type:'remove',tab});if(config.pin===tab){config.pin=null;void chrome.storage.session.set({pin:null});}});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='reconnect')void initialized.then(()=>{if(!socket)connect();}).catch(()=>{});});
chrome.runtime.onStartup.addListener(()=>void initialized.then(connect).catch(()=>{}));
chrome.runtime.onInstalled.addListener(()=>void initialized.then(connect).catch(()=>{}));
void initialized.then(async()=>{await chrome.alarms.create('reconnect',{periodInMinutes:.5});connect();}).catch(()=>{});
