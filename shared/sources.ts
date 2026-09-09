import{videoId}from'./protocol';
export const SOURCE_PATTERNS=['https://www.youtube.com/*','https://music.youtube.com/*'];
export function sourceUrl(value:unknown):URL|null{
  if(typeof value!=='string')return null;
  try{const u=new URL(value);return u.protocol==='https:'&&['www.youtube.com','music.youtube.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password?u:null;}catch{return null;}
}
export function watchVideoId(value:string):string|null{const u=sourceUrl(value),id=u?.searchParams.get('v');return u?.pathname==='/watch'&&videoId(id)?id:null;}
export function sourceAllowsVideo(url:unknown,id:string){
  const u=sourceUrl(url);if(!u||!videoId(id))return false;
  const fromUrl=watchVideoId(u.href);
  // Music's persistent player can keep playing while the user browses its library.
  return u.hostname==='music.youtube.com'?(u.pathname==='/watch'?fromUrl===id:true):fromUrl===id;
}
export function canPinSource(url:unknown){const u=sourceUrl(url);return !!u&&(u.hostname==='music.youtube.com'||!!watchVideoId(u.href));}
