import{describe,it,expect}from'vitest';
import{Sessions,playbackPosition,LatestRequest,STALE_MS}from'../shared/sync';
import{ConnectionState}from'../extension/connection';
import{playback}from'./fixtures';
describe('authoritative snapshots',()=>{
 it('interpolates from a local receipt clock at playback rate',()=>{expect(playbackPosition(playback({rate:2}),100,2100)).toBe(14);});
 it.each([{playing:false},{buffering:true},{seeking:true},{ended:true},{ad:'ad' as const},{ad:'uncertain' as const}])('does not advance frozen state %j',patch=>{expect(playbackPosition(playback(patch),100,2100)).toBe(10);});
 it('takes seeks and speed changes from the next authoritative position',()=>{expect(playbackPosition(playback({position:40,rate:.5}),5000,7000)).toBe(41);expect(playbackPosition(playback({position:2}),7000,8000)).toBe(3);});
 it('stops stale clocks and clamps duration',()=>{expect(playbackPosition(playback(),100,100+STALE_MS)).toBe(10);expect(playbackPosition(playback({position:179}),0,4000)).toBe(180);});
});
describe('tab sessions',()=>{
 it('selects new audible playback, retains a paused selection and honors pins',()=>{const s=new Sessions();s.update('c','browser1',1,'document1',playback(),100);s.update('c','browser1',2,'document2',playback({muted:true}),200);expect(s.current()?.tab).toBe(1);s.update('c','browser1',1,'document1',playback({seq:2,playing:false}),300);expect(s.current()?.tab).toBe(1);s.update('c','browser1',2,'document2',playback({seq:2}),400);expect(s.current()?.tab).toBe(2);s.pin('browser1',1);s.update('c','browser1',2,'document2',playback({seq:3}),500);expect(s.current()?.tab).toBe(1);});
 it('rejects stale sequences and replaced video generations',()=>{const s=new Sessions();s.update('c','browser1',1,'document1',playback({generation:2,videoId:'lmnopqrstuv'}),100);expect(s.update('c','browser1',1,'document1',playback({seq:999}),200)).toBe(false);expect(s.update('c','browser1',1,'document1',playback({generation:2,videoId:'lmnopqrstuv'}),200)).toBe(false);expect(s.current()?.playback.videoId).toBe('lmnopqrstuv');});
 it('does not let a closing replaced connection remove its fresh successor',()=>{const s=new Sessions();s.update('old','browser1',1,'document1',playback(),100);s.update('new','browser1',1,'document1',playback({seq:2,position:40}),200);s.remove('old');expect(s.current()?.playback.position).toBe(40);s.remove('new');expect(s.current()).toBeNull();});
 it('keeps browser instances distinct',()=>{const s=new Sessions();s.update('a','browser1',1,'document1',playback(),100);s.update('b','browser2',1,'document2',playback(),200);expect(s.entries.size).toBe(2);});
});
describe('reconnection and late work',()=>{
 it('drops readiness during disconnect, caps backoff and resets on authentication',()=>{const c=new ConnectionState();expect(c.canSend()).toBe(false);expect(Array.from({length:8},()=>c.nextDelay())).toEqual([1000,2000,4000,8000,16000,30000,30000,30000]);c.connected();expect(c.canSend()).toBe(true);c.disconnected();expect(c.canSend()).toBe(false);c.connected();expect(c.nextDelay()).toBe(1000);});
 it('discards a response belonging to the previous song',async()=>{let resolve!:(x:string)=>void;const gate=new LatestRequest();const applied:string[]=[];const old=gate.run(()=>new Promise<string>(r=>resolve=r),x=>applied.push(x));await gate.run(async()=> 'new',x=>applied.push(x));resolve('old');await old;expect(applied).toEqual(['new']);});
});
