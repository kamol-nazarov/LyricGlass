import { object, number, integer } from './protocol';
export interface Settings { port:number; locked:boolean; visible:boolean; opacity:number; textOnly:boolean; fontSize:number; width:number; x:number|null; y:number|null; theme:'dark'|'light' }
export const defaults:Settings={port:43821,locked:false,visible:true,opacity:.72,textOnly:false,fontSize:18,width:400,x:null,y:null,theme:'dark'};
export function settings(input:unknown):Settings {
  const x=object(input)?input:{};
  return { port:integer(x.port,1024,65535)?x.port:defaults.port, locked:typeof x.locked==='boolean'?x.locked:false, visible:typeof x.visible==='boolean'?x.visible:true,
    opacity:number(x.opacity,0,1)?x.opacity:(x.theme==='light'?.82:defaults.opacity),textOnly:typeof x.textOnly==='boolean'?x.textOnly:false,fontSize:integer(x.fontSize,18,42)?x.fontSize:18,
    width:[400,420,560,720].includes(x.width as number)?x.width as number:400,x:number(x.x,-100000,100000)?x.x:null,y:number(x.y,-100000,100000)?x.y:null,theme:x.theme==='light'?'light':'dark' };
}
export interface Rect {x:number;y:number;width:number;height:number}
export function recoverBounds(s:Settings,height:number,areas:Rect[]):Rect {
  const primary=areas[0] ?? {x:0,y:0,width:1920,height:1080};
  const area=areas.find(a=>s.x!==null&&s.y!==null&&s.x<a.x+a.width&&s.x+s.width>a.x&&s.y<a.y+a.height&&s.y+height>a.y)??primary;
  const width=Math.min(s.width,area.width), h=Math.min(height,area.height);
  const positioned=s.x!==null&&s.y!==null&&areas.some(a=>s.x!<a.x+a.width&&s.x!+s.width>a.x&&s.y!<a.y+a.height&&s.y!+height>a.y);
  return {x:Math.round(positioned?Math.max(area.x,Math.min(s.x!,area.x+area.width-width)):area.x+(area.width-width)/2),y:Math.round(positioned?Math.max(area.y,Math.min(s.y!,area.y+area.height-h)):Math.max(area.y,area.y+area.height-h-24)),width,height:h};
}
