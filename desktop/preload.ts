import { contextBridge, ipcRenderer } from 'electron';
import type { API, Command, ViewState } from '../shared/ui';
const api:API={getState:()=>ipcRenderer.invoke('lyricglass:state'),getTimingLines:(videoId:string)=>ipcRenderer.invoke('lyricglass:timing-lines',videoId),command:(command:Command)=>ipcRenderer.invoke('lyricglass:command',command),subscribe:(callback:(state:ViewState)=>void)=>{const listener=(_event:unknown,state:ViewState)=>callback(state);ipcRenderer.on('lyricglass:update',listener);return()=>ipcRenderer.removeListener('lyricglass:update',listener);}};
contextBridge.exposeInMainWorld('lyricglass',api);

