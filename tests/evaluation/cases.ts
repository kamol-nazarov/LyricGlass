import {lyric} from '../fixtures';
import type {RecordLyrics} from '../../shared/lyrics';
import type {Evidence,Timing} from '../../shared/matching';
export interface Case {name:string;q:Evidence;records:RecordLyrics[];correct:number[];timing?:Timing;adversarial?:boolean}
const q:Evidence={title:lyric.trackName,artist:lyric.artistName,duration:180,provenance:'structured'};
const r=(patch:Partial<RecordLyrics>={})=>({...lyric,...patch});
export const cases:Case[]=[
 {name:'exact',q,records:[r()],correct:[1],timing:'plausible'},
 {name:'duration unknown',q:{...q,duration:null},records:[r()],correct:[1],timing:'uncertain'},
 {name:'intro longer',q:{...q,duration:195},records:[r()],correct:[1],timing:'uncertain'},
 {name:'timeline overrun',q,records:[r({syncedLyrics:'[03:40]Synthetic ending'})],correct:[1],timing:'incompatible'},
 {name:'correct plain before wrong timed',q,records:[r({id:2,artistName:'Another Ensemble'}),r({syncedLyrics:null,plainLyrics:'Synthetic verse'})],correct:[1],timing:'untimed',adversarial:true},
 {name:'wrong artist',q,records:[r({artistName:'Other Band'})],correct:[],adversarial:true},
 {name:'absent artist',q:{...q,artist:'',provenance:'unknown'},records:[r()],correct:[],adversarial:true},
 {name:'short title absent duration',q:{...q,title:'Home',duration:null},records:[r({trackName:'Home'})],correct:[],adversarial:true},
 {name:'short title supported',q:{...q,title:'Home'},records:[r({trackName:'Home'})],correct:[1]},
 {name:'album acoustic trap',q,records:[r({albumName:'Acoustic Sessions'})],correct:[],adversarial:true},
 {name:'live title trap',q,records:[r({trackName:'Paper Satellites (Live)'})],correct:[],adversarial:true},
 {name:'version absent candidate',q:{...q,title:'Paper Satellites (Acoustic)'},records:[r()],correct:[],adversarial:true},
 {name:'live vs studio',q:{...q,title:'Paper Satellites (Live)'},records:[r({trackName:'Paper Satellites (Studio Version)'})],correct:[],adversarial:true},
 {name:'radio vs extended',q:{...q,title:'Paper Satellites (Radio Edit)'},records:[r({trackName:'Paper Satellites (Extended Edit)'})],correct:[],adversarial:true},
 {name:'slowed vs sped up',q:{...q,title:'Paper Satellites (Slowed)'},records:[r({trackName:'Paper Satellites (Sped Up)'})],correct:[],adversarial:true},
 {name:'remaster unknown',q,records:[r({trackName:'Paper Satellites (2024 Remaster)'})],correct:[],adversarial:true},
 {name:'cover',q,records:[r({trackName:'Paper Satellites (Cover)'})],correct:[],adversarial:true},
 {name:'same duration different body',q,records:[r(),r({id:2,syncedLyrics:'[00:10]A different synthetic recording'})],correct:[],adversarial:true},
 {name:'equivalent album copies',q,records:[r({id:2,albumName:'Compilation',syncedLyrics:null,plainLyrics:'Paper lights across the ceiling Little shadows drift away'}),r()],correct:[1,2],timing:'plausible'},
 {name:'artist prefix with structured artist',q:{...q,title:'Test Ensemble - Paper Satellites (Official Video)'},records:[r()],correct:[1]},
 {name:'featured title credit',q:{...q,title:'Paper Satellites (feat. Guest Singer)'},records:[r({artistName:'Test Ensemble feat. Guest Singer'})],correct:[1]},
 {name:'featured contradictory guest',q:{...q,title:'Paper Satellites (feat. Guest Singer)'},records:[r({artistName:'Test Ensemble feat. Different Guest'})],correct:[],adversarial:true},
 {name:'composed unicode',q:{...q,title:'Cafe\u0301 Signals'},records:[r({trackName:'Café Signals'})],correct:[1]},
 {name:'accent fold not proof',q:{...q,title:'Cafe Signals'},records:[r({trackName:'Café Signals'})],correct:[],adversarial:true},
 {name:'non Latin',q:{...q,title:'Тихие огни',artist:'Тестовая группа'},records:[r({trackName:'Тихие огни',artistName:'Тестовая группа'})],correct:[1]},
 {name:'legitimate Live title',q:{...q,title:'Live and Learn'},records:[r({trackName:'Live and Learn'})],correct:[1]},
 {name:'hyphenated title distinct',q:{...q,title:'A-B Song'},records:[r({trackName:'A B Song'})],correct:[],adversarial:true},
 {name:'and versus ampersand not assumed',q:{...q,artist:'Test and Ensemble'},records:[r({artistName:'Test & Ensemble'})],correct:[],adversarial:true},
 {name:'instrumental',q,records:[r({instrumental:true,syncedLyrics:null,plainLyrics:null})],correct:[1],timing:'untimed'},
 {name:'candidate 25',q,records:[...Array.from({length:24},(_,i)=>r({id:i+2,artistName:`Other Artist ${i}`})),r()],correct:[1],timing:'plausible'},
];
