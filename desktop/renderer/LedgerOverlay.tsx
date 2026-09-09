import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Command,ViewState} from '../../shared/ui';
import {songQuery} from '../../shared/lyrics';
import {displayDelay,displayTime,ledgerPosition,timedWordFill,highlightMode} from '../../shared/ledger';
import './ledger.css';

type Props={state:ViewState;act:(command:Command)=>Promise<void>;error:string};
function Gear(){return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.7 4.3 10.3 2h3.4l.6 2.3 2 .9 2.1-.7 1.7 2.9-1.6 1.7.2 2.2 1.8 1.4-1.7 2.9-2.3-.4-1.8 1.3-.6 2.3h-3.4l-.6-2.3-2-1-2.1.8-1.7-3 1.6-1.6-.2-2.2L2 8.1l1.7-2.9 2.3.4 1.8-1.3Z" transform="translate(1 1)"/><circle cx="12" cy="12" r="3"/></svg>;}

function Karaoke({text,state}:{text:string;state:ViewState}){
  const ref=useRef<HTMLSpanElement>(null);
  const mode=highlightMode(state.ledger.clock,text);
  const clock=useRef({value:state.ledger.clock,received:performance.now()});
  useLayoutEffect(()=>{clock.current={value:state.ledger.clock,received:performance.now()};},[state.ledger.clock]);
  useEffect(()=>{
    if(mode==='line')return;
    let frame=0;const words=Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-word]')??[]);
    const last=new Map<HTMLElement,string>();
    const paint=()=>{
      const anchor=clock.current;
      const position=ledgerPosition(anchor.value,anchor.received,performance.now());
      words.forEach((word,index)=>{
        const fill=timedWordFill(anchor.value,position,index,words.length),key=fill.toFixed(3);
        if(last.get(word)===key)return;last.set(word,key);
        word.style.color=fill>=1?'var(--accent)':fill<=0?'var(--fg)':'transparent';
        word.style.backgroundImage=fill>0&&fill<1?`linear-gradient(90deg, var(--accent) ${(fill*100).toFixed(2)}%, var(--fg) calc(${(fill*100).toFixed(2)}% + 14px))`:'none';
      });
      frame=requestAnimationFrame(paint);
    };
    frame=requestAnimationFrame(paint);return()=>cancelAnimationFrame(frame);
  },[text,mode]);
  if(mode==='line')return <span className="line-highlight" title="Line timestamps only; no estimated word timing">{text}</span>;
  return <span ref={ref} className="karaoke" aria-label={text}>{text.split(/(\s+)/u).map((part,index)=>/^\s+$/.test(part)?<React.Fragment key={index}>{part}</React.Fragment>:<span data-word key={index} aria-hidden="true">{part}</span>)}</span>;
}

export function LedgerOverlay({state:s,act,error}:Props){
  const [open,setOpen]=useState(false);
  const dragging=useRef<number|null>(null);
  const card=useRef<HTMLElement>(null),popover=useRef<HTMLDivElement>(null),gear=useRef<HTMLButtonElement>(null);
  const ledger=useRef<HTMLDivElement>(null),positions=useRef(new Map<number,number>()),lastFrame=useRef({video:s.videoId,index:s.ledger.currentIndex});
  const display=songQuery(s.title,s.artist);
  // Metadata sometimes contains an artist and still prefixes that artist in the title.
  const split=songQuery(s.title,'');
  const track=split.artist&&(!s.artist||split.artist.toLowerCase()===s.artist.toLowerCase())?split.title:display.title;
  const artist=s.artist||split.artist||s.record?.artistName||'';
  const needsMatch=!!s.videoId&&!s.record&&((s.candidates?.length??0)>0||s.status.startsWith('No match'));
  const openMatch=()=>{setOpen(false);void act({type:'openSettings',section:'match'});};
  const delay=(value:number)=>{if(s.videoId)void act({type:'delay',videoId:s.videoId,value:Math.max(-600000,Math.min(600000,value))});};
  const theme=(value:'dark'|'light')=>void act({type:'settings',patch:{theme:value,opacity:value==='light'?.82:.72}});
  const drag=(phase:'start'|'move'|'end',event:React.PointerEvent<HTMLElement>)=>void window.lyricglass.command({type:'drag',phase,x:event.screenX,y:event.screenY});
  const dragStart=(event:React.PointerEvent<HTMLElement>)=>{
    if(s.settings.locked||event.button!==0||(event.target as Element).closest('button,input,select,[role="dialog"]'))return;
    event.preventDefault();dragging.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);drag('start',event);
  };
  const dragEnd=(event:React.PointerEvent<HTMLElement>)=>{if(dragging.current!==event.pointerId)return;dragging.current=null;drag('end',event);};
  useEffect(()=>{const end=()=>{if(dragging.current===null)return;dragging.current=null;void window.lyricglass.command({type:'drag',phase:'end',x:0,y:0});};window.addEventListener('blur',end);return()=>{window.removeEventListener('blur',end);end();};},[]);
  useEffect(()=>{if(s.settings.locked)setOpen(false);},[s.settings.locked]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!popover.current?.contains(event.target as Node)&&!gear.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);gear.current?.focus();}};
    const close=()=>setOpen(false);
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);window.addEventListener('blur',close);
    return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);window.removeEventListener('blur',close);};
  },[open]);
  useLayoutEffect(()=>{
    let resizeTimer:ReturnType<typeof setTimeout>|undefined;
    const measure=()=>{
      const height=card.current?.getBoundingClientRect().height??200;
      const popoverBottom=open&&popover.current?48+popover.current.getBoundingClientRect().height+12:0;
      void window.lyricglass.command({type:'height',value:Math.max(140,Math.min(10000,Math.ceil(Math.max(height,popoverBottom))))});
    };
    // Font-size/padding transitions trigger many observations. Commit the settled
    // measurement, not a native-window resize on every animation frame.
    const observer=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(measure,100);});if(card.current)observer.observe(card.current);if(popover.current)observer.observe(popover.current);measure();
    return()=>{observer.disconnect();clearTimeout(resizeTimer);};
  },[open]);
  useLayoutEffect(()=>{
    const next=new Map<number,number>();
    const animate=lastFrame.current.video===s.videoId&&s.ledger.currentIndex===lastFrame.current.index+1&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    for(const line of ledger.current?.querySelectorAll<HTMLElement>('[data-line-index]')??[]){
      const index=Number(line.dataset.lineIndex),top=line.offsetTop;next.set(index,top);
      const old=positions.current.get(index);
      if(animate&&old!==undefined&&old!==top)line.animate([{transform:`translateY(${old-top}px)`},{transform:'translateY(0)'}],{duration:500,easing:'cubic-bezier(.22,1,.36,1)'});
    }
    positions.current=next;lastFrame.current={video:s.videoId,index:s.ledger.currentIndex};
  },[s.videoId,s.ledger.currentIndex]);
  return <section ref={card} className={`ledger-card ${s.settings.locked?'is-locked':''} ${s.settings.textOnly?'is-text-only':''}`} data-theme={s.settings.theme} onPointerDown={dragStart} onPointerMove={event=>{if(dragging.current===event.pointerId)drag('move',event);}} onPointerUp={dragEnd} onPointerCancel={dragEnd} onLostPointerCapture={dragEnd} style={{'--glass-alpha':s.settings.opacity,'--current-size':`${s.settings.fontSize}px`} as React.CSSProperties}>
    <header className="ledger-header">
      <div className="ledger-heading"><div className="ledger-eyebrow">NOW PLAYING</div><div className="ledger-track" title={`${track}${artist?` · ${artist}`:''}`}><strong>{track}</strong>{artist&&<span> · {artist}</span>}</div></div>
      <button ref={gear} className="ledger-gear" aria-label="Overlay settings" aria-haspopup="dialog" aria-expanded={open} disabled={s.settings.locked} title={s.settings.locked?'Ctrl+Alt+K to unlock':'Overlay settings'} onClick={()=>setOpen(value=>!value)}><Gear/></button>
    </header>
    <div className="lyric-ledger" ref={ledger} aria-label="Lyrics">
      <span className="ledger-marker" aria-hidden="true"/>
      {s.ledger.lines.map(line=><div key={`${s.videoId}:${line.index}`} data-line-index={line.index} className={`ledger-line ${line.relative===0?'is-current':line.relative<0?'is-past':'is-future'} ${Math.abs(line.relative)===2?'is-distant':''}`}>
        {line.relative===0?(line.text?<Karaoke text={line.text} state={s}/>:needsMatch?(!s.settings.locked?<button className="match-prompt" onClick={openMatch}>Choose lyric match →</button>:<span className="ledger-neutral">Unlock with Ctrl+Alt+K to choose lyrics</span>):<span className="ledger-neutral">{s.ledger.currentIndex<0||!s.ledger.synced?s.status:'\u00a0'}</span>):line.text||'\u00a0'}
      </div>)}
    </div>
    <footer className="ledger-footer">
      <span className="ledger-time">{displayTime(s.ledger.clock.position)} / {displayTime(s.ledger.clock.duration)}</span><span className="ledger-spacer"/>
      <span className="ledger-sync" title={`${s.connection} · ${s.status} · ${highlightMode(s.ledger.clock,s.current??'')==='word'?'Word timestamps available':'Line timestamps only'}`}><span className={`sync-dot ${s.ledger.synced?'is-synced':''}`}/>{s.ledger.synced?`${highlightMode(s.ledger.clock,s.current??'')} sync`:'waiting'}</span>
      <span className="delay-chip" title="Positive lyric delay means lyrics appear later">{displayDelay(s.delay)}</span>
    </footer>
    {error&&<p className="ledger-error" role="alert">{error}</p>}
    {open&&!s.settings.locked&&<div ref={popover} className="ledger-popover" role="dialog" aria-label="Overlay settings">
      <button className="open-match" disabled={!s.videoId} onClick={openMatch}>Find / change lyric match →</button>
      <div className="popover-divider"/>
      <div className="popover-row"><span>Lyric delay</span><button className="delay-reset" disabled={!s.record} onClick={()=>delay(0)}>Reset</button></div>
      <div className="delay-stepper"><button aria-label="Lyrics earlier by 250 milliseconds" disabled={!s.record} onClick={()=>delay(s.delay-250)}>−</button><output aria-live="polite">{displayDelay(s.delay)}</output><button aria-label="Lyrics later by 250 milliseconds" disabled={!s.record} onClick={()=>delay(s.delay+250)}>+</button></div>
      <div className="popover-divider"/>
      <div className="popover-row"><span>Lock position</span><button className="lock-switch" role="switch" aria-label="Lock position" aria-checked={s.settings.locked} title="Unlock with Ctrl+Alt+K or the tray menu" onClick={()=>{setOpen(false);void act({type:'lock'});}}><span/></button></div>
      <div className="popover-row"><span>Appearance</span><div className="theme-segments" role="group" aria-label="Appearance">{(['dark','light'] as const).map(value=><button key={value} aria-pressed={s.settings.theme===value} onClick={()=>theme(value)}>{value==='dark'?'Dark':'Light'}</button>)}</div></div>
    </div>}
  </section>;
}

