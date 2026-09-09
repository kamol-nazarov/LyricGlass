import type { AdState } from '../shared/protocol';
import {videoId}from'../shared/protocol';
import {sourceUrl,watchVideoId}from'../shared/sources';
// All YouTube-specific DOM knowledge lives here. No page-world script injection.
const music=()=>sourceUrl(location.href)?.hostname==='music.youtube.com';
function watchRoot(id:string|null){return id?Array.from(document.querySelectorAll('ytd-watch-flexy')).find(node=>node.getAttribute('video-id')===id&&!node.hasAttribute('hidden')&&node.getAttribute('aria-hidden')!=='true'):undefined;}
function player(){const root=music()?document.querySelector('ytmusic-player'):watchRoot(watchVideoId(location.href));return root?root.querySelector('#movie_player'):document.querySelector('#movie_player');}
let rememberedMusic:{id:string;title:string;artist:string;video:HTMLMediaElement|null;src:string}|null=null;
function musicMetadata(){
  const bar=document.querySelector('ytmusic-player-bar');
  const title=bar?.querySelector('.title')?.textContent?.trim()??'';
  const byline=bar?.querySelector('.byline')?.textContent?.trim()??'';
  const artists=Array.from(bar?.querySelectorAll<HTMLAnchorElement>('.byline a[href*="/channel/"], .byline a[href*="/browse/UC"]')??[]).map(a=>a.textContent?.trim()??'').filter(Boolean);
  return {title:title.slice(0,400),artist:(artists.length?[...new Set(artists)].join(', '):byline.split(/\s*[•·]\s*/)[0].trim()).slice(0,200)};
}
function retainedMusicId(){const meta=musicMetadata(),video=getVideo();return rememberedMusic&&rememberedMusic.video===video&&rememberedMusic.src===(video?.currentSrc??'')&&rememberedMusic.title===meta.title&&rememberedMusic.artist===meta.artist?rememberedMusic.id:null;}
export function rememberContent(id:string,meta:{title:string;artist:string}){if(music()){const video=getVideo();rememberedMusic={id,...meta,video,src:video?.currentSrc??''};}}
export function forgetContent(){rememberedMusic=null;}
function musicIds(){
  const ids:string[]=[];
  for(const selector of['ytmusic-player[video-id]','ytmusic-player-bar[video-id]']){const id=document.querySelector(selector)?.getAttribute('video-id');if(videoId(id))ids.push(id);}
  for(const link of document.querySelectorAll<HTMLAnchorElement>('ytmusic-player .ytp-title-link[href], ytmusic-player .ytp-title-text > a[href], ytmusic-player-bar .title a[href]')){
    try{const id=watchVideoId(new URL(link.getAttribute('href')!,location.href).href);if(id)ids.push(id);}catch{/* Ignore malformed page links. */}
  }
  // Artwork is another read-only identity signal when the player remains on a browse page.
  for(const img of document.querySelectorAll<HTMLImageElement>('ytmusic-player-bar img')){const match=img.src.match(/^https:\/\/i\d?\.ytimg\.com\/vi(?:_webp)?\/([\w-]{11})\//);if(match)ids.push(match[1]);}
  return [...new Set(ids)];
}
export function watchId(url=location.href):string|null{
  const u=sourceUrl(url);if(!u)return null;
  if(u.hostname!=='music.youtube.com')return watchVideoId(url);
  const id=watchVideoId(url);if(id)return id;
  const ids=musicIds();return ids.length===1?ids[0]:ids.length===0?retainedMusicId():null;
}
export function getVideo(){const root=music()?document.querySelector('ytmusic-player'):watchRoot(watchVideoId(location.href));return root?root.querySelector<HTMLMediaElement>('video.html5-main-video, video, audio'):document.querySelector<HTMLMediaElement>('#movie_player video.html5-main-video');}
export function readMetadata(id:string){
  if(music()){
    const {title,artist}=musicMetadata();
    const ids=musicIds();const fromUrl=watchVideoId(location.href);
    const identity=!!title&&(ids.length?ids.length===1&&ids[0]===id:fromUrl===id||retainedMusicId()===id)&&(!fromUrl||fromUrl===id);
    return{title:title.slice(0,400),artist:artist.slice(0,200),identity};
  }
  // YouTube may retain an inactive watch container and stale head meta after SPA navigation.
  const flexy=watchRoot(id);
  const title=flexy?.querySelector<HTMLElement>('ytd-watch-metadata h1 yt-formatted-string, #info-contents h1 yt-formatted-string')?.textContent?.trim()??'';
  const domId=flexy?.getAttribute('video-id');
  // A channel is not an artist. Only use explicitly labelled music credits where exposed.
  let artist='';
  for(const row of flexy?.querySelectorAll('ytd-metadata-row-renderer')??[]){
    const label=row.querySelector('#title')?.textContent?.trim().toLowerCase();
    if(label==='artist'||label==='artists')artist=row.querySelector('#content')?.textContent?.trim()??'';
  }
  return {title:title.slice(0,400),artist:artist.slice(0,200),identity:domId===id&&watchVideoId(location.href)===id};
}
export function adState():AdState {
  const activePlayer=player();
  if(!activePlayer)return 'uncertain';
  if(activePlayer.classList.contains('ad-showing')||activePlayer.classList.contains('ad-interrupting'))return 'ad';
  const visibleAd=activePlayer.querySelector<HTMLElement>('.ytp-ad-player-overlay, .ytp-ad-text');
  if(visibleAd&&visibleAd.getClientRects().length)return 'ad';
  return 'content';
}
export function observeChanges(changed:()=>void){
  const observer=new MutationObserver(changed);
  // Limit attribute observation to identity changes; player ad classes have a separate observer.
  observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['video-id']});
  const activePlayer=player();
  const adObserver=new MutationObserver(changed);if(activePlayer)adObserver.observe(activePlayer,{attributes:true,attributeFilter:['class']});
  return()=>{observer.disconnect();adObserver.disconnect();};
}
