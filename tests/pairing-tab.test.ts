import{it,expect,vi,afterEach}from'vitest';
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();vi.resetModules();});
it('replies to the trusted extension settings page when opened in a browser tab',async()=>{
 vi.useFakeTimers();const listeners:Record<string,Function>={},local:Record<string,unknown>={};const event=(name:string)=>({addListener:(fn:Function)=>listeners[name]=fn});const origin='chrome-extension://'+'a'.repeat(32);
 const api={runtime:{id:'a'.repeat(32),getURL:(p:string)=>origin+'/'+p,onMessage:event('message'),onStartup:event('startup'),onInstalled:event('installed'),sendMessage:async()=>undefined},storage:{local:{setAccessLevel:async()=>{},get:async()=>local,set:async(v:object)=>Object.assign(local,v)},session:{get:async()=>({}),set:async()=>{}}},tabs:{query:async()=>[],sendMessage:async()=>{},onRemoved:event('removed'),onUpdated:event('updated')},alarms:{onAlarm:event('alarm'),create:async()=>{}}};
 class Socket{static OPEN=1;readyState=0;constructor(public url:string){}close(){}send(){}}
 vi.stubGlobal('browser',undefined);vi.stubGlobal('chrome',api);vi.stubGlobal('WebSocket',Socket);await import('../extension/worker');
 const sender={id:api.runtime.id,url:origin+'/popup.html',tab:{id:7,url:origin+'/popup.html'},frameId:0};
 const reply=vi.fn();expect(listeners.message({type:'status'},sender,reply)).toBe(true);for(let i=0;i<10;i++)await Promise.resolve();expect(reply).toHaveBeenCalledWith(expect.objectContaining({paired:false}));
 const paired=vi.fn();expect(listeners.message({type:'pair',secret:'ab'.repeat(32),port:43281},sender,paired)).toBe(true);for(let i=0;i<20;i++)await Promise.resolve();expect(paired).toHaveBeenCalledWith({ok:true});expect(local.port).toBe(43281);expect(local.secret).toBe('ab'.repeat(32));
 const bad=vi.fn();listeners.message({type:'pair',secret:'cd'.repeat(32),port:43281},{...sender,url:'https://www.youtube.com/watch?v=abcdefghijk'},bad);listeners.message({type:'pair',secret:'cd'.repeat(32),port:43281},{...sender,frameId:1},bad);for(let i=0;i<10;i++)await Promise.resolve();expect(bad).not.toHaveBeenCalled();expect(local.secret).toBe('ab'.repeat(32));
});
