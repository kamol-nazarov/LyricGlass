import type { Settings } from './settings';
import {recordTimingWarning,type RecordLyrics} from './lyrics';
import type { LedgerState } from './ledger';
export type LyricSummary=Omit<RecordLyrics,'plainLyrics'|'syncedLyrics'>&{hasSynced:boolean;timingWarning?:string};
export function summarize(r:RecordLyrics):LyricSummary{const{plainLyrics:_plain,syncedLyrics,...summary}=r;return{...summary,hasSynced:!!syncedLyrics,timingWarning:recordTimingWarning(r)};}
export interface TimingLines {videoId:string;recordId:number;lines:{index:number;time:number;text:string}[]}
export interface SettingsNavigation {section:'general'|'match';request:number}
export interface ViewState {settings:Settings;connection:string;warning:string;videoId:string|null;title:string;artist:string;status:string;previous:string;current:string;next:string;plain:string|null;delay:number;record:LyricSummary|null;candidates:LyricSummary[];paired:boolean;shortcuts:string[];ledger:LedgerState;settingsNavigation?:SettingsNavigation;timingWarning?:string}
export type Command = {type:'settings';patch:Partial<Settings>}|{type:'lock'}|{type:'visibility'}|{type:'openSettings';section?:'match'}|{type:'resetPosition'}|{type:'copyPairing'}|{type:'rotatePairing'}|{type:'search';videoId:string;query:string}|{type:'select';videoId:string;id:number}|{type:'import';videoId:string}|{type:'delay';videoId:string;value:number}|{type:'align';videoId:string;recordId:number;index:number}|{type:'providerLink'}|{type:'height';value:number}|{type:'drag';phase:'start'|'move'|'end';x:number;y:number};
export interface API { getState():Promise<ViewState>;getTimingLines(videoId:string):Promise<TimingLines>;command(command:Command):Promise<{ok:boolean;error?:string}>;subscribe(callback:(state:ViewState)=>void):()=>void }

