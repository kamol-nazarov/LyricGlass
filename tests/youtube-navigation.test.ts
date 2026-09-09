import{it,expect,vi}from'vitest';
import{JSDOM}from'jsdom';

it('identifies SPA videos without refresh despite stale head metadata or missing finish events, and resumes after page restore',async()=>{
  vi.useFakeTimers();vi.resetModules();
  const dom=new JSDOM('<meta itemprop="videoId" content="abcdefghijk"><ytd-watch-flexy video-id="abcdefghijk"><ytd-watch-metadata><h1><yt-formatted-string>Test Ensemble - Paper Satellites</yt-formatted-string></h1></ytd-watch-metadata><div id="movie_player"><video class="html5-main-video"></video></div></ytd-watch-flexy>',{url:'https://www.youtube.com/watch?v=abcdefghijk'});
  const messages:any[]=[];let fresh:Function=()=>{};
  vi.stubGlobal('window',dom.window);vi.stubGlobal('document',dom.window.document);vi.stubGlobal('location',dom.window.location);vi.stubGlobal('MutationObserver',dom.window.MutationObserver);
  vi.stubGlobal('browser',{runtime:{sendMessage:async(message:any)=>{messages.push(message);},onMessage:{addListener:(callback:Function)=>fresh=callback}}});
  const video=document.querySelector('video')!;
  Object.defineProperties(video,{paused:{get:()=>false},readyState:{get:()=>4},currentTime:{get:()=>10},duration:{get:()=>180}});
  const latest=()=>messages.filter(m=>m.type==='playback').at(-1)?.playback;
  try{
    await import('../extension/content');await vi.advanceTimersByTimeAsync(2500);expect(latest()).toMatchObject({videoId:'abcdefghijk',ad:'content'});
    document.dispatchEvent(new dom.window.Event('yt-navigate-start'));
    dom.reconfigure({url:'https://www.youtube.com/watch?v=lmnopqrstuv'});
    document.querySelector('ytd-watch-flexy')!.setAttribute('video-id','lmnopqrstuv');
    document.querySelector('h1 yt-formatted-string')!.textContent='Test Ensemble - Quiet City';
    // YouTube's old head meta remains, and yt-navigate-finish never arrives.
    await vi.advanceTimersByTimeAsync(4000);expect(latest()).toMatchObject({videoId:'lmnopqrstuv',title:'Test Ensemble - Quiet City',ad:'content'});
    // A same-title next recording must not be suppressed forever, either.
    dom.reconfigure({url:'https://www.youtube.com/watch?v=0123456789a'});document.querySelector('ytd-watch-flexy')!.setAttribute('video-id','0123456789a');
    await vi.advanceTimersByTimeAsync(5000);expect(latest()).toMatchObject({videoId:'0123456789a',title:'Test Ensemble - Quiet City',ad:'content'});
    window.dispatchEvent(new dom.window.PageTransitionEvent('pagehide',{persisted:true}));const count=messages.length;await vi.advanceTimersByTimeAsync(3000);expect(messages).toHaveLength(count);
    window.dispatchEvent(new dom.window.PageTransitionEvent('pageshow',{persisted:true}));await vi.advanceTimersByTimeAsync(2500);fresh({type:'fresh'},{},()=>{});expect(messages.length).toBeGreaterThan(count);expect(latest()).toMatchObject({videoId:'0123456789a',ad:'content'});
  }finally{window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();vi.resetModules();}
});
