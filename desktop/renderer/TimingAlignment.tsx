import{useEffect,useState}from'react';
import type{Command,TimingLines,ViewState}from'../../shared/ui';
import{displayTime,displayDelay}from'../../shared/ledger';
export function TimingAlignment({state,act,error}:{state:ViewState;act:(command:Command)=>Promise<void>;error:string}){
  const[open,setOpen]=useState(!!state.timingWarning),[data,setData]=useState<TimingLines|null>(null),[selected,setSelected]=useState(-1),[problem,setProblem]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(state.timingWarning)setOpen(true);},[state.timingWarning]);
  useEffect(()=>{
    if(!open||!state.videoId||!state.record?.hasSynced)return;
    let active=true;setData(null);setSelected(-1);setProblem('');
    void window.lyricglass.getTimingLines(state.videoId).then(result=>{if(active)setData(result);}).catch(()=>{if(active)setProblem('Could not load timing lines. Reopen alignment after selecting a record.');});
    return()=>{active=false;};
  },[open,state.videoId,state.record?.id]);
  if(!state.record?.hasSynced)return null;
  return <details className="timing-alignment" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>Align lyrics to the vocals</summary>
    {open&&<div><p>Pause the video at the start of a sung line, select that line below, then click <strong>Align selected line now</strong>. This measures the delay from the playback clock.</p>
      {state.timingWarning&&<p className="alert" role="status">{state.timingWarning}</p>}
      {problem&&<p role="alert">{problem}</p>}{error&&<p role="alert">{error}</p>}
      <label>Line beginning at the current playback position<select size={7} value={selected} onChange={event=>setSelected(Number(event.target.value))} disabled={!data}>
        <option value={-1} disabled>{data?'Choose the line you hear':'Loading lyric timestamps…'}</option>
        {data?.lines.map(line=><option key={line.index} value={line.index}>{displayTime(line.time)} — {line.text}</option>)}
      </select></label>
      <div className="row"><button className="primary" disabled={!data||selected<0||busy} onClick={async()=>{if(!data)return;setBusy(true);try{await act({type:'align',videoId:data.videoId,recordId:data.recordId,index:selected});}finally{setBusy(false);}}}>Align selected line now</button><span>Current delay: {displayDelay(state.delay)}</span></div>
      <p className="hint">This corrects a constant timing shift. If later lines drift or the video skips verses, choose lyrics for that edit or import a matching LRC.</p>
    </div>}
  </details>;
}
