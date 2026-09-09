import type{Playback}from'../shared/protocol';
import type{RecordLyrics}from'../shared/lyrics';
export const playback=(patch:Partial<Playback>={}):Playback=>({videoId:'abcdefghijk',generation:1,seq:1,title:'Test Ensemble - Paper Satellites',artist:'',position:10,duration:180,rate:1,playing:true,seeking:false,buffering:false,ended:false,muted:false,ad:'content',...patch});
export const lyric:RecordLyrics={id:1,trackName:'Paper Satellites',artistName:'Test Ensemble',albumName:'Synthetic',duration:180,instrumental:false,plainLyrics:null,syncedLyrics:'[00:10]Paper lights across the ceiling\n[00:20]Little shadows drift away'};
