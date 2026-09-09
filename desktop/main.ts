import { app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage,globalShortcut,clipboard,dialog,shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Store } from './store';
import { Provider } from './provider';
import { Bridge } from './bridge';
import { Controller } from './controller';
import { settings,recoverBounds } from '../shared/settings';
import { object,number,integer,text,videoId } from '../shared/protocol';
import { parseLrc } from '../shared/lyrics';
import type { ViewState,SettingsNavigation } from '../shared/ui';
import { OverlayDrag } from '../shared/overlay-drag';
import { OverlayLayout } from './overlay-layout';
const overlayDrag=new OverlayDrag();
let overlayLayout:OverlayLayout|undefined;
app.setName('LyricGlass');
let overlay:BrowserWindow|null=null,panel:BrowserWindow|null=null,tray:Tray|null=null,store:Store,controller:Controller,bridge:Bridge,quitting=false,connection='Starting bridge',overlayHeight=280;
let previous='',pulse:ReturnType<typeof setInterval>;const warnings:string[]=[];
const shortcuts=['Ctrl+Alt+L — show / hide','Ctrl+Alt+K — lock / unlock'];
let settingsNavigation:SettingsNavigation={section:'general',request:0};
const index=path.resolve(__dirname,'../renderer/index.html');const indexURL=pathToFileURL(index).href;
const areas=()=>[screen.getPrimaryDisplay(),...screen.getAllDisplays().filter(d=>d.id!==screen.getPrimaryDisplay().id)].map(d=>d.workArea);
function view():ViewState{return{settings:store.data.settings,connection,warning:[store.warning,...warnings].filter(Boolean).join(' '),...controller.view(),paired:!!store.data.origin,shortcuts,settingsNavigation};}
function broadcast(){if(!store||!controller)return;const state=view(),serialized=JSON.stringify(state);if(serialized===previous)return;previous=serialized;for(const w of[overlay,panel])if(w&&!w.isDestroyed())w.webContents.send('lyricglass:update',state);}
function secureWindow(w:BrowserWindow){w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());w.webContents.on('will-attach-webview',e=>e.preventDefault());w.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));w.webContents.session.setPermissionCheckHandler(()=>false);}
function applyOverlay(){if(!overlay)return;const s=store.data.settings;overlay.setAlwaysOnTop(true,'floating');overlay.setIgnoreMouseEvents(s.locked,{forward:true});overlay.setFocusable(!s.locked);if(s.visible)overlay.showInactive();else overlay.hide();menu();broadcast();}
function finishDrag(){overlayDrag.end();overlayLayout?.endDrag();}
function resizeOverlay(){overlayLayout?.resize(store.data.settings.width,overlayHeight);}
function position(reset=false){if(!overlay)return;finishDrag();if(reset){store.data.settings.x=null;store.data.settings.y=null;}const b=recoverBounds(store.data.settings,overlayHeight,areas());overlay.setBounds(b);store.data.settings.x=b.x;store.data.settings.y=b.y;store.save();broadcast();}
function toggleLock(){finishDrag();store.data.settings.locked=!store.data.settings.locked;store.save();applyOverlay();}
function toggleVisible(){finishDrag();store.data.settings.visible=!store.data.settings.visible;store.save();applyOverlay();}
function showSettings(section:'general'|'match'='general'){settingsNavigation={section,request:settingsNavigation.request+1};broadcast();if(panel){panel.setTitle(section==='match'?'LyricGlass • Choose lyrics':'LyricGlass • Settings');panel.show();panel.focus();return;}panel=new BrowserWindow({width:850,height:820,minWidth:620,minHeight:560,show:false,title:section==='match'?'LyricGlass • Choose lyrics':'LyricGlass • Settings',backgroundColor:'#101c24',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});secureWindow(panel);const settingsWindow=panel;settingsWindow.once('ready-to-show',()=>{if(!settingsWindow.isDestroyed()){settingsWindow.show();settingsWindow.focus();}});panel.on('page-title-updated',event=>event.preventDefault());void panel.loadFile(index,{hash:'settings'});panel.on('closed',()=>panel=null);}
function menu(){tray?.setContextMenu(Menu.buildFromTemplate([{label:store.data.settings.visible?'Hide overlay':'Show overlay',click:toggleVisible},{label:store.data.settings.locked?'Unlock overlay':'Lock (click through)',click:toggleLock},{label:'Choose lyric match…',click:()=>showSettings('match')},{label:'Settings & pairing',click:()=>showSettings()},{label:'Reset position',click:()=>{store.data.settings.visible=true;position(true);applyOverlay();}},{type:'separator'},{label:'Quit LyricGlass',click:()=>app.quit()}]));}
function senderOK(e:Electron.IpcMainInvokeEvent){const w=BrowserWindow.fromWebContents(e.sender);return !!w&&(w===overlay||w===panel)&&e.senderFrame===e.sender.mainFrame&&e.senderFrame.url.split('#')[0]===indexURL;}
async function command(e:Electron.IpcMainInvokeEvent,c:unknown){
  if(!senderOK(e)||!object(c)||!text(c.type,40))return{ok:false,error:'Request rejected'};
  try{
    const isPanel=panel?.webContents===e.sender;
    if(['copyPairing','rotatePairing','search','select','import','align'].includes(c.type)&&!isPanel)throw Error('Open settings to perform this action.');
    if(['search','select','import','delay','align'].includes(c.type)&&(!videoId(c.videoId)||c.videoId!==controller.video))throw Error('The selected video changed. Try again.');
    switch(c.type){
      case 'drag':{
        if(overlay?.webContents!==e.sender||store.data.settings.locked||!number(c.x,-100000,100000)||!number(c.y,-100000,100000)||!['start','move','end'].includes(c.phase as string))throw Error('Invalid drag');
        if(c.phase==='start'){const b=overlay.getBounds();overlayLayout?.beginDrag();overlayDrag.start(c.x,c.y,b.x,b.y,performance.now());}
        else if(c.phase==='end')finishDrag();
        else{const next=overlayDrag.move(c.x,c.y,performance.now());if(next)overlayLayout?.moveTo(next.x,next.y);else finishDrag();}
        return{ok:true};
      }
      case 'openSettings':if(c.section!==undefined&&c.section!=='match')throw Error('Invalid settings section');showSettings(c.section??'general');break;
      case 'lock':toggleLock();break;
      case 'visibility':toggleVisible();break;
      case 'resetPosition':position(true);break;
      case 'copyPairing':clipboard.writeText(JSON.stringify({v:1,port:store.data.settings.port,secret:store.data.secret}));break;
      case 'rotatePairing':store.data.secret=randomBytes(32).toString('hex');store.data.origin=null;store.save();bridge.start();break;
      case 'settings':{
        if(!object(c.patch)||Object.keys(c.patch).some(k=>!(isPanel?['port','opacity','textOnly','fontSize','width','theme']:['theme','opacity']).includes(k)))throw Error('Invalid settings');
        const next=settings({...store.data.settings,...c.patch});for(const[k,v]of Object.entries(c.patch))if(next[k as keyof typeof next]!==v)throw Error('Setting outside allowed range');
        const oldPort=store.data.settings.port;store.data.settings=next;store.save();resizeOverlay();if(oldPort!==next.port)bridge.start();applyOverlay();break;
      }
      case 'height':if(overlay?.webContents!==e.sender||!integer(c.value,140,10000))throw Error('Invalid size');if(Math.abs(overlayHeight-c.value)>2){overlayHeight=c.value;resizeOverlay();}break;
      case 'search':if(!text(c.query,300)||!c.query.trim())throw Error('Enter a title and artist');await controller.lookup(c.query.trim(),'',true);break;
      case 'select':{if(!integer(c.id))throw Error('Invalid lyric ID');const r=controller.candidates.find(x=>x.id===c.id);if(!r)throw Error('Search again to choose this match');controller.choose(r);break;}
      case 'align':if(!integer(c.recordId)||!integer(c.index))throw Error('Invalid timing line');controller.align(c.recordId,c.index);break;
      case 'delay':if(!number(c.value,-600000,600000))throw Error('Delay must be between -600000 and +600000 ms');store.setDelay(c.videoId as string,Math.round(c.value));break;
      case 'import':{
        const id=controller.video!;const choice=await dialog.showOpenDialog(panel!,{title:'Import lyrics for the selected YouTube video',filters:[{name:'LRC lyrics',extensions:['lrc']}],properties:['openFile']});
        if(choice.canceled)break;const file=choice.filePaths[0];if(path.extname(file).toLowerCase()!=='.lrc'||(await fs.stat(file)).size>200000)throw Error('Choose an LRC file smaller than 200 KB');
        const source=await fs.readFile(file,'utf8'),parsed=parseLrc(source);if(!parsed.lines.length)throw Error('This file has no valid LRC timestamps');if(controller.video!==id)throw Error('Video changed during import. Try again.');
        const p=controller.sessions.current()?.playback;controller.choose({id:Date.now(),trackName:parsed.metadata.ti||p?.title||'Imported LRC',artistName:parsed.metadata.ar||'',albumName:'Local LRC import',duration:p?.duration??0,instrumental:false,plainLyrics:null,syncedLyrics:source});break;
      }
      case 'providerLink':await shell.openExternal('https://lrclib.net');break;
      default:throw Error('Unknown action');
    }broadcast();return{ok:true};
  }catch(error){return{ok:false,error:error instanceof Error?error.message:'Action failed'};}
}
if(!app.requestSingleInstanceLock())app.quit();else{
  app.on('second-instance',(_event,argv)=>{if(store)showSettings(argv.includes('--match')?'match':'general');});
  void app.whenReady().then(()=>{
    store=new Store(app.getPath('userData'));controller=new Controller(store,new Provider(store),broadcast);
    overlay=new BrowserWindow({...recoverBounds(store.data.settings,overlayHeight,areas()),frame:false,transparent:true,resizable:false,maximizable:false,minimizable:false,hasShadow:false,skipTaskbar:true,show:false,alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
    overlayLayout=new OverlayLayout(overlay,position=>{store.data.settings.x=position.x;store.data.settings.y=position.y;store.save();});
    secureWindow(overlay);overlay.on('close',e=>{if(!quitting){e.preventDefault();store.data.settings.visible=false;store.save();applyOverlay();}});
    overlay.on('move',()=>{if(!quitting)overlayLayout?.capture();});
    overlay.once('ready-to-show',()=>{position();applyOverlay();});void overlay.loadFile(index);
    // Small bundled raster icon is generated from source bytes, independent of remote assets.
    const pixels=Buffer.alloc(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;const line=Math.abs(y-(10+Math.sin(x/5)*3))<2||Math.abs(y-(21+Math.sin(x/5)*3))<2;pixels[i]=line?180:24;pixels[i+1]=line?230:39;pixels[i+2]=line?215:47;pixels[i+3]=255;}
    tray=new Tray(nativeImage.createFromBitmap(pixels,{width:32,height:32}));tray.setToolTip('LyricGlass — lyrics above your work');tray.on('double-click',()=>showSettings());menu();
    if(!globalShortcut.register('Control+Alt+L',toggleVisible))warnings.push('Ctrl+Alt+L is unavailable; use the tray to show/hide.');
    if(!globalShortcut.register('Control+Alt+K',toggleLock))warnings.push('Ctrl+Alt+K is unavailable; use the tray to unlock.');
    ipcMain.handle('lyricglass:state',e=>{if(!senderOK(e))throw Error('Request rejected');return view();});ipcMain.handle('lyricglass:command',command);ipcMain.handle('lyricglass:timing-lines',(e,id)=>{if(!senderOK(e)||e.sender!==panel?.webContents||!videoId(id)||id!==controller.video)throw Error('Selected video changed or request rejected');return controller.timingLines();});
    bridge=new Bridge(store,s=>{connection=s;broadcast();},(c,i,m)=>controller.message(c,i,m),c=>controller.disconnect(c));bridge.start();
    pulse=setInterval(broadcast,100);screen.on('display-removed',()=>position());screen.on('display-metrics-changed',()=>position());
    if(process.argv.includes('--match'))showSettings('match');else if(!store.data.origin)showSettings();
  }).catch(()=>{dialog.showErrorBox('LyricGlass could not start','Check local data permissions and reinstall dependencies.');app.quit();});
  app.on('window-all-closed',()=>{});
  app.on('before-quit',()=>{quitting=true;clearInterval(pulse);overlayLayout?.capture();controller?.close();bridge?.stop();globalShortcut.unregisterAll();tray?.destroy();try{store?.flush();}catch{}});
}





