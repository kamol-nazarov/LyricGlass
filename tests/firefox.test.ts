import{describe,it,expect,vi,afterEach}from'vitest';
import{IDBFactory}from'fake-indexeddb';
import{CredentialVault}from'../extension/credentials';
import{extensionOrigin}from'../shared/protocol';
import{authenticate}from'../desktop/auth';
import{playback}from'./fixtures';
const origin='moz-extension://12345678-1234-1234-abcd-123456789abc';
const secret='ab'.repeat(32);
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();vi.resetModules();});
describe('Firefox pairing boundary',()=>{
 it('accepts exact Firefox origins while retaining the secret and exact-origin binding',()=>{
  const auth={v:1 as const,type:'auth' as const,secret,instance:'browser1'};
  expect(extensionOrigin(origin)).toBe(true);expect(authenticate(origin,null,secret,auth)).toBe(true);
  expect(authenticate(origin,origin,secret,auth)).toBe(true);
  expect(authenticate(origin,'moz-extension://aaaaaaaa-1234-1234-abcd-123456789abc',secret,auth)).toBe(false);
  expect(authenticate(origin,'chrome-extension://'+'a'.repeat(32),secret,auth)).toBe(false);
  expect(authenticate(origin,null,'cd'.repeat(32),auth)).toBe(false);
 });
 it.each([origin+'/',origin+'/popup.html',origin+'?secret=abc','moz-extension://youtube.com','moz-extension://123','https://'+origin.slice(16)])('rejects lookalike or non-origin values %s',value=>expect(extensionOrigin(value)).toBe(false));
 it('persists secrets in extension-origin IndexedDB across background instances',async()=>{
  const factory=new IDBFactory();const first=new CredentialVault(factory);
  expect(await first.read()).toBeUndefined();await first.write(secret);
  expect(await new CredentialVault(factory).read()).toBe(secret);
  await new CredentialVault(factory).write('cd'.repeat(32));expect(await first.read()).toBe('cd'.repeat(32));
 });
 it('rejects invalid credentials without replacing a saved secret',async()=>{
  const vault=new CredentialVault(new IDBFactory());await vault.write(secret);
  await expect(vault.write('short')).rejects.toThrow('Invalid pairing');expect(await vault.read()).toBe(secret);
 });
 it('uses Firefox promise APIs, keeps secrets out of shared storage, and removes sessions without documentId',async()=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval']});
  const local:Record<string,unknown>={},session:Record<string,unknown>={};const listeners:Record<string,Function>={};
  const area=(data:Record<string,unknown>)=>({get:async(keys:string[])=>Object.fromEntries(keys.filter(k=>k in data).map(k=>[k,data[k]])),set:async(values:Record<string,unknown>)=>Object.assign(data,values)});
  const event=(name:string)=>({addListener:(callback:Function)=>listeners[name]=callback});
  const firefox={runtime:{id:'lyricglass@local.invalid',getURL:(p:string)=>origin+'/'+p,onMessage:event('message'),onStartup:event('startup'),onInstalled:event('installed')},storage:{local:area(local),session:area(session)},tabs:{query:async()=>[],sendMessage:async()=>{},onRemoved:event('removed'),onUpdated:event('updated')},alarms:{onAlarm:event('alarm'),create:async()=>{}}};
  const sockets:FakeSocket[]=[];
  class FakeSocket{static OPEN=1;readyState=1;sent:any[]=[];onopen=()=>{};onmessage=(e:any)=>{};onclose=(e:any)=>{};onerror=()=>{};constructor(public url:string){sockets.push(this);}send(value:string){this.sent.push(JSON.parse(value));}close(){this.readyState=3;this.onclose({code:1000});}}
  vi.stubGlobal('browser',firefox);vi.stubGlobal('chrome',{});vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('WebSocket',FakeSocket);
  await import('../extension/worker');
  const fromPopup=(message:unknown)=>new Promise<any>(resolve=>listeners.message(message,{id:firefox.runtime.id,url:origin+'/popup.html'},resolve));
  expect((await fromPopup({type:'status'})).paired).toBe(false);
  expect(await fromPopup({type:'pair',secret,port:43821})).toEqual({ok:true});
  expect(local).not.toHaveProperty('secret');expect(await new CredentialVault().read()).toBe(secret);
  const ws=sockets[0];expect(ws.url).toBe('ws://127.0.0.1:43821/');ws.onopen();expect(ws.sent[0]).toMatchObject({type:'auth',secret});
  ws.onmessage({data:JSON.stringify({v:1,type:'ready'})});
  const sender={id:firefox.runtime.id,url:'https://www.youtube.com/watch?v=abcdefghijk',tab:{id:9},frameId:0};
  listeners.message({type:'playback',document:'document1',playback:playback()},sender,()=>{});
  expect(ws.sent.at(-1)).toMatchObject({type:'snapshot',document:'document1',tab:9});
  listeners.message({type:'gone',document:'document1'},sender,()=>{});
  expect(ws.sent.at(-1)).toEqual({v:1,type:'remove',tab:9});
  const musicSender={...sender,url:'https://music.youtube.com/library',tab:{id:10}};
  listeners.message({type:'playback',document:'document2',playback:playback({seq:2})},musicSender,()=>{});
  expect(ws.sent.at(-1)).toMatchObject({type:'snapshot',tab:10,document:'document2'});
  // sender.url may still describe the initial document during same-document navigation.
  const navigatedSender={...sender,tab:{id:9,url:'https://www.youtube.com/watch?v=lmnopqrstuv'}};
  listeners.message({type:'playback',document:'document1',playback:playback({videoId:'lmnopqrstuv',generation:2,seq:3})},navigatedSender,()=>{});
  expect(ws.sent.at(-1)).toMatchObject({type:'snapshot',tab:9,playback:{videoId:'lmnopqrstuv'}});
  listeners.updated(9,{url:'https://www.youtube.com/watch?v=0123456789a'});
  listeners.message({type:'playback',document:'document1',playback:playback({videoId:'0123456789a',generation:3,seq:4})},sender,()=>{});
  expect(ws.sent.at(-1)).toMatchObject({type:'snapshot',tab:9,playback:{videoId:'0123456789a'}});
  const count=ws.sent.length;listeners.message({type:'pair',secret:'cd'.repeat(32),port:43821},sender,()=>{});
  expect(ws.sent).toHaveLength(count);expect(await new CredentialVault().read()).toBe(secret);
  expect(await fromPopup({type:'status'})).not.toHaveProperty('secret');
  // Closing the fake socket clears the real background heartbeat before this test ends.
  ws.close();
 });
});
