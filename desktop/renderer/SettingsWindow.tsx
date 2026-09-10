import React,{useEffect,useRef,useState}from'react';
import type{Command,ViewState}from'../../shared/ui';
import type{Settings}from'../../shared/settings';
import{displayDelay,displayTime}from'../../shared/ledger';
import{previewScale,previewState}from'../../shared/preview';
import{LedgerOverlay}from'./LedgerOverlay';
import{TimingAlignment}from'./TimingAlignment';
import{RecognitionSettings}from'./RecognitionSettings';
import{useSettingsNavigation}from'./settings-navigation';
import'./settings.css';

type Props={state:ViewState;act:(command:Command)=>Promise<void>;error:string;notice?:string};
function SectionTitle({index,children}:{index:string;children:React.ReactNode}){return <div className="settings-section-title"><span>{index}</span><h2>{children}</h2></div>;}
function Toggle({label,detail,checked,onChange}:{label:string;detail?:string;checked:boolean;onChange:()=>void}){return <div className="settings-toggle-row"><span>{label}{detail&&<span className="toggle-detail"> · {detail}</span>}</span><button type="button" className="settings-switch" role="switch" aria-label={label} aria-checked={checked} onClick={onChange}><span/></button></div>;}
function Segments<T extends string|number>({label,value,options,onChange}:{label:string;value:T;options:{value:T;label:string}[];onChange:(value:T)=>void}){return <div className="settings-segments" role="group" aria-label={label}>{options.map(option=><button key={option.value} type="button" aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div>;}
function Slider({label,value,unit,min,max,step,onChange}:{label:string;value:number;unit:string;min:number;max:number;step:number;onChange:(value:number)=>void}){
  return <label className="settings-slider"><span className="slider-label"><span>{label}</span><output>{value}{unit}</output></span><input type="range" aria-label={label} min={min} max={max} step={1} value={value} onKeyDown={event=>{if(step>1&&['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(event.key)){event.preventDefault();onChange(Math.max(min,Math.min(max,value+(['ArrowRight','ArrowUp'].includes(event.key)?step:-step))));}}} onChange={event=>{const raw=Number(event.target.value);onChange(raw===min||raw===max?raw:Math.max(min,Math.min(max,value+Math.round((raw-value)/step)*step)));}}/></label>;
}
function Keys({last}:{last:string}){return <span className="kbd-row"><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>{last}</kbd></span>;}
function WindowIcon({type}:{type:'minimize'|'maximize'|'restore'|'close'}){return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">{type==='minimize'?<path d="M1 9h10"/>:type==='close'?<path d="m2 2 8 8M10 2l-8 8"/>:type==='restore'?<><path d="M4 1h7v7H9M1 4h7v7H1Z"/></>:<rect x="1.5" y="1.5" width="9" height="9"/>}</svg>;}

function LivePreview({state}:{state:ViewState}){
  const start=useRef(performance.now()),last=useRef(-1);const[elapsed,setElapsed]=useState(0);
  useEffect(()=>{let frame=0;const update=()=>{const tick=Math.floor((performance.now()-start.current)/100);if(tick!==last.current){last.current=tick;setElapsed(tick/10);}frame=requestAnimationFrame(update);};frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);},[]);
  const theme=state.settings.theme==='system'?state.resolvedTheme??'dark':state.settings.theme;
  return <aside className="settings-preview"><div className="preview-header"><span>LIVE PREVIEW</span><span>{state.settings.width}px · {state.settings.fontSize}px · {theme}</span></div><div className="preview-stage" aria-label="Live appearance preview with sample lyrics"><div className="preview-card-position" style={{width:state.settings.width,transform:`translate(-50%, -50%) scale(${previewScale(state.settings.width)})`}}><LedgerOverlay state={previewState(state,elapsed)} act={async()=>{}} error="" preview/></div><span className="preview-sample-label">SAMPLE LYRICS</span></div><p>Reflects theme, width, text size, opacity and delay as you change them.</p></aside>;
}

export function SettingsWindow({state:s,act,error,notice}:Props){
  useSettingsNavigation(s.settingsNavigation);
  const[query,setQuery]=useState(''),[port,setPort]=useState(String(s.settings.port));
  useEffect(()=>setPort(String(s.settings.port)),[s.settings.port]);
  const change=(patch:Partial<Settings>)=>void act({type:'settings',patch});
  const connected=s.connection.startsWith('Connected');
  const hasTiming=!!s.record?.hasSynced&&!s.timingWarning;
  const delay=(value:number)=>{if(s.videoId)void act({type:'delay',videoId:s.videoId,value:Math.max(-600000,Math.min(600000,value))});};
  return <main className={`settings-shell ${s.settingsMaximized?'is-maximized':''}`}>
    <header className="settings-titlebar"><span className="settings-app-glyph" aria-hidden="true"/><span>LyricGlass · Settings</span><div className="settings-window-buttons"><button aria-label="Minimize settings" onClick={()=>void act({type:'settingsWindow',action:'minimize'})}><WindowIcon type="minimize"/></button><button aria-label={s.settingsMaximized?'Restore settings':'Maximize settings'} onClick={()=>void act({type:'settingsWindow',action:'maximize'})}><WindowIcon type={s.settingsMaximized?'restore':'maximize'}/></button><button className="close-window" aria-label="Close settings" onClick={()=>void act({type:'settingsWindow',action:'close'})}><WindowIcon type="close"/></button></div></header>
    <div className="settings-columns">
      <div className="settings-scroll" id="settings-scroll">
        {(error||notice||s.warning)&&<div className="settings-notice" role={error?'alert':'status'}>{error||notice||s.warning}</div>}
        <section>
          <SectionTitle index="01">Connection</SectionTitle>
          <div className="settings-card browser-status"><span className={`connection-dot ${connected?'connected':''}`}/><div><strong>{connected?'Connected to browser':'Waiting for browser'}</strong><p>{connected?'Extension is reading the active YouTube tab.':'Install or enable the LyricGlass extension, then pair it below.'}</p>{!connected&&<p className="connection-detail">{s.connection}</p>}</div><span className="browser-chip">{s.connectionBrowser??(connected?'Browser':'Offline')}</span></div>
          <details className="pairing-details" open={!s.paired||undefined}><summary>Pairing settings</summary><div><div className="pairing-actions"><button className="settings-primary" onClick={()=>void act({type:'copyPairing'})}>Copy pairing details</button><button className="settings-secondary" onClick={()=>void act({type:'rotatePairing'})}>Reset pairing</button></div><div className="pairing-port"><label>Loopback port<input aria-label="Loopback port" type="number" min="1024" max="65535" value={port} onChange={event=>setPort(event.target.value)}/></label><button className="settings-secondary" onClick={()=>change({port:Number(port)})}>Apply</button></div><p>Paste the copied details into the extension. After changing the port or resetting pairing, copy and paste the new details.</p></div></details>
          <div className="settings-toggle-stack"><Toggle label="Launch at startup" checked={s.settings.launchAtStartup} onChange={()=>change({launchAtStartup:!s.settings.launchAtStartup})}/><Toggle label="Show widget only while a video is playing" checked={s.settings.onlyWhilePlaying} onChange={()=>change({onlyWhilePlaying:!s.settings.onlyWhilePlaying})}/></div>
        </section>
        <section>
          <SectionTitle index="02">Appearance</SectionTitle>
          <div className="settings-appearance-stack">
            <div className="settings-field"><span>Theme</span><Segments label="Theme" value={s.settings.theme} options={[{value:'dark',label:'Dark'},{value:'light',label:'Light'},{value:'system',label:'System'}]} onChange={theme=>change({theme})}/></div>
            <div className="settings-field"><span>Width</span><Segments label="Width" value={s.settings.width} options={[{value:360,label:'Narrow · 360'},{value:400,label:'Ledger · 400'},{value:460,label:'Wide · 460'}]} onChange={width=>change({width})}/></div>
            <Slider label="Text size" value={s.settings.fontSize} unit="px" min={14} max={28} step={1} onChange={fontSize=>change({fontSize})}/>
            <Slider label="Background opacity" value={Math.round(s.settings.opacity*100)} unit="%" min={0} max={100} step={5} onChange={opacity=>change({opacity:opacity/100})}/>
            <div className="settings-toggle-stack"><Toggle label="Text only with shadow" detail="hides the card" checked={s.settings.textOnly} onChange={()=>change({textOnly:!s.settings.textOnly})}/><Toggle label="Karaoke word highlight" checked={s.settings.karaoke} onChange={()=>change({karaoke:!s.settings.karaoke})}/></div>
            <div className="settings-shortcuts"><span className="field-caption">Shortcuts</span><div><span>Show / hide widget</span><Keys last="L"/><span>Lock / unlock position</span><Keys last="K"/></div><p>The tray icon always provides recovery controls.</p></div>
          </div>
        </section>
        <section id="match-section">
          <SectionTitle index="03">Lyric match &amp; timing</SectionTitle>
          <div className="settings-card current-video"><div className="settings-eyebrow">CURRENT VIDEO</div><strong>{s.videoId?s.title:'Play a YouTube video to find lyrics'}</strong><div className="current-match"><span className={`small-dot ${hasTiming?'connected':''}`}/>{s.record?<span>{s.timingWarning?'Timing mismatch':hasTiming?'Synced':s.record.instrumental?'Instrumental':'Plain'} · {s.record.artistName} — {s.record.trackName} · <span className="mono">{s.record.albumName==='Local LRC import'?'Local LRC':`LRCLIB #${s.record.id}`}</span></span>:<span>No lyrics selected</span>}</div></div>
          <form className="settings-search" onSubmit={event=>{event.preventDefault();if(s.videoId)void act({type:'search',videoId:s.videoId,query});}}><input id="match-search" aria-label="Search title and artist" placeholder="Search title and artist…" maxLength={300} value={query} onChange={event=>setQuery(event.target.value)}/><button className="settings-primary" disabled={!s.videoId||!query.trim()}>Search</button><button type="button" className="settings-secondary" disabled={!s.videoId} onClick={()=>void act({type:'import',videoId:s.videoId!})}>Import .lrc</button></form>
          {s.candidates.length>0&&<div className="settings-results" aria-label="Lyric search results">{s.candidates.map(result=><button key={result.id} className={`settings-result ${s.record?.id===result.id?'selected':''}`} aria-pressed={s.record?.id===result.id} title={`${result.artistName} — ${result.trackName}${result.timingWarning?` · ${result.timingWarning}`:''}`} onClick={()=>void act({type:'select',videoId:s.videoId!,id:result.id})}><span className="result-info"><span className="result-title">{result.trackName}</span><span className="result-meta">{result.albumName||result.artistName} · {displayTime(result.duration)} · LRCLIB #{result.id}</span></span><span className={`result-badge ${result.hasSynced&&!result.timingWarning?'synced':''}`}>{result.timingWarning?'Check timing':result.hasSynced?'Synced':'Plain'}</span></button>)}</div>}
          <div className="settings-delay"><div><span>Lyric delay <span className="dim">· saved for this video</span></span><button className="settings-text-button" disabled={!s.record} onClick={()=>void act({type:'resetTiming',videoId:s.videoId!})}>Reset</button></div><div className="settings-stepper"><button disabled={!s.record} aria-label="Lyrics earlier by 250 milliseconds" onClick={()=>delay(s.delay-250)}>−</button><output>{displayDelay(s.delay)}</output><button disabled={!s.record} aria-label="Lyrics later by 250 milliseconds" onClick={()=>delay(s.delay+250)}>+</button></div><p>Positive delay shows lyrics later.</p></div>
          <div className="pairing-actions"><button className="settings-secondary" disabled={!s.videoId} onClick={()=>void act({type:'retryLyrics',videoId:s.videoId!})}>Retry lyrics</button><button className="settings-secondary" disabled={!s.record} onClick={()=>void act({type:'forgetMatch',videoId:s.videoId!})}>Forget match</button><button className="settings-secondary" disabled={!s.record} onClick={()=>void act({type:'resetTiming',videoId:s.videoId!})}>Reset timing</button></div>
          <p>{s.status} · {s.matchProvenance??'No saved decision'}</p>
          <TimingAlignment state={s} act={act} error={error}/>
          {s.record&&s.plain&&<details className="plain-reading"><summary>Untimed lyrics · manual reading</summary><pre>{s.plain}</pre></details>}
          <RecognitionSettings state={s} act={act}/>
          <details className="plain-reading"><summary>Local matching diagnostics</summary><p>Heuristic decisions, not verified accuracy. Export includes only selected song metadata and this bounded trace.</p><button className="settings-secondary" onClick={()=>void act({type:'exportDiagnostics'})}>Export diagnostics</button><pre>{JSON.stringify(s.diagnostics??[],null,2)}</pre></details>
        </section>
      </div>
      <LivePreview state={s}/>
    </div>
    <footer className="settings-footer"><button onClick={()=>void act({type:'providerLink'})}>Lyrics by LRCLIB ↗</button><span title="Track metadata goes to LRCLIB. Optional, consented audio samples go to ACRCloud.">Audio recognition opt-in · Settings stay on this computer</span></footer>
  </main>;
}
