import{it,expect,vi}from'vitest';
import{JSDOM}from'jsdom';

it('sends fresh Music snapshots through navigation, rate/seek changes, ads and cleanup',async()=>{
  vi.useFakeTimers();vi.resetModules();
  const dom=new JSDOM('<ytmusic-player video-id="abcdefghijk"><div id="movie_player"><video class="html5-main-video"></video></div></ytmusic-player><ytmusic-player-bar><span class="title">Paper Satellites</span><span class="byline">Test Ensemble • Synthetic Album</span></ytmusic-player-bar>',{url:'https://music.youtube.com/watch?v=abcdefghijk'});
  const messages:any[]=[];let fresh:Function=()=>{};
  vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('location',dom.window.location);vi.stubGlobal('MutationObserver',dom.window.MutationObserver);
  vi.stubGlobal('browser',{runtime:{sendMessage:async(message:any)=>{messages.push(message);},onMessage:{addListener:(callback:Function)=>fresh=callback}}});
  const video=document.querySelector('video')!;let paused=false,position=10;
  Object.defineProperties(video,{paused:{get:()=>paused},readyState:{get:()=>4},currentTime:{get:()=>position},duration:{get:()=>180}});
  const latest=()=>messages.filter(m=>m.type==='playback').at(-1)?.playback;
  const event=(type:string)=>video.dispatchEvent(new dom.window.Event(type));
  try{
    await import('../extension/content');
    expect(latest().ad).toBe('uncertain');await vi.advanceTimersByTimeAsync(2500);
    expect(latest()).toMatchObject({videoId:'abcdefghijk',title:'Paper Satellites',artist:'Test Ensemble',ad:'content',position:10,playing:true});
    video.playbackRate=1.5;event('ratechange');expect(latest().rate).toBe(1.5);
    position=60;event('seeking');expect(latest().seeking).toBe(true);event('seeked');expect(latest()).toMatchObject({position:60,seeking:false});
    paused=true;event('pause');expect(latest().playing).toBe(false);paused=false;event('playing');
    document.querySelector('#movie_player')!.classList.add('ad-showing');fresh({type:'fresh'},{},()=>{});expect(latest()).toMatchObject({ad:'ad',position:0});
    document.querySelector('#movie_player')!.classList.remove('ad-showing');position=65;fresh({type:'fresh'},{},()=>{});expect(latest().ad).toBe('uncertain');await vi.advanceTimersByTimeAsync(2500);expect(latest()).toMatchObject({ad:'content',position:65});
    document.dispatchEvent(new dom.window.Event('yt-navigate-start'));dom.reconfigure({url:'https://music.youtube.com/watch?v=lmnopqrstuv'});fresh({type:'fresh'},{},()=>{});expect(latest().ad).toBe('uncertain');
    document.querySelector('ytmusic-player')!.setAttribute('video-id','lmnopqrstuv');document.querySelector('.title')!.textContent='Quiet City';position=0;document.dispatchEvent(new dom.window.Event('yt-navigate-finish'));await vi.advanceTimersByTimeAsync(3000);expect(latest()).toMatchObject({videoId:'lmnopqrstuv',title:'Quiet City',ad:'content',position:0});
    const generation=latest().generation;dom.reconfigure({url:'https://music.youtube.com/library'});fresh({type:'fresh'},{},()=>{});expect(latest()).toMatchObject({videoId:'lmnopqrstuv',generation,ad:'content'});
    window.dispatchEvent(new dom.window.Event('pagehide'));expect(messages.at(-1).type).toBe('gone');const count=messages.length;await vi.advanceTimersByTimeAsync(5000);expect(messages).toHaveLength(count);
  }finally{window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();vi.resetModules();}
});
