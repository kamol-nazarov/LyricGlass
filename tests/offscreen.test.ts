import{it,expect,vi,afterEach}from'vitest';
let stop:()=>Promise<any>=async()=>{};
afterEach(async()=>{await stop();vi.unstubAllGlobals();vi.resetModules();});
it('captures only tab audio, routes playback once, buffers only requested windows and clears resources',async()=>{
 let listener:Function=()=>{},ended:Function=()=>{};const source={connect:vi.fn()},track={stop:vi.fn(),addEventListener:vi.fn((_event,fn)=>ended=fn)},media={getTracks:()=>[track],getAudioTracks:()=>[track]};let node:any;
 class Context{sampleRate=16000;baseLatency=.01;destination={};audioWorklet={addModule:vi.fn(async()=>{})};createMediaStreamSource=vi.fn(()=>source);resume=vi.fn(async()=>{});close=vi.fn(async()=>{});}
 class Processor{port={postMessage:vi.fn(),onmessage:null as any};connect=vi.fn();constructor(){node=this;}}
 const output:any[]=[];const getUserMedia=vi.fn(async()=>media);
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});vi.stubGlobal('AudioContext',Context);vi.stubGlobal('AudioWorkletNode',Processor);
 vi.stubGlobal('chrome',{runtime:{id:'extension',onMessage:{addListener:(fn:Function)=>listener=fn},sendMessage:vi.fn(async(m:any)=>{output.push(m);if(m.type==='capture-anchor')return{document:'document1',capturedAt:Date.now(),playback:{videoId:'abcdefghijk',generation:1,position:42,rate:1,playing:true,muted:false,seeking:false,buffering:false,ended:false,ad:'content',isolatedAudio:true}};return{ok:true};})}});
 await import('../extension/offscreen');const call=(m:any)=>new Promise<any>(reply=>listener({target:'offscreen',...m},{id:'extension'},reply));stop=()=>call({type:'stop'});
 expect(await call({type:'open',tab:1,streamId:'synthetic-stream'})).toEqual({ok:true});expect(getUserMedia).toHaveBeenCalledWith({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:'synthetic-stream'}},video:false});expect(source.connect).toHaveBeenCalledTimes(2);expect(node.port.postMessage).not.toHaveBeenCalledWith('start');
 expect(await call({type:'sample',id:'request01'})).toEqual({ok:true});expect(node.port.postMessage).toHaveBeenCalledWith('start');const floats=new Float32Array(160000).fill(.1);node.port.onmessage({data:floats.buffer});for(let i=0;i<150;i++)await Promise.resolve();expect(output.some(m=>m.type==='capture-result-begin'&&m.start>=42)).toBe(true);expect(output.some(m=>m.type==='capture-result-end')).toBe(true);expect(floats.every(n=>n===0)).toBe(true);await stop();expect(track.stop).toHaveBeenCalled();
});
