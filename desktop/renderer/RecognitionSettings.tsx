import React,{useRef} from 'react';
import type {Command,ViewState} from '../../shared/ui';
export function RecognitionSettings({state:s,act}:{state:ViewState;act:(c:Command)=>Promise<void>}){
 const form=useRef<HTMLFormElement>(null),r=s.recognition;
 if(!r)return null;
 const update=(patch:Partial<typeof r>)=>void act({type:'recognitionSettings',enabled:r.enabled,consent:r.consent,dailyCap:r.dailyCap,...patch});
 return <details className="pairing-details"><summary>Optional audio recognition</summary><div>
  <p>Off by default. When enabled, ten-second audio samples from an explicitly enabled Chrome / Edge tab session are sent to ACRCloud. Its terms and retention policy apply. No microphone or system audio is captured. Firefox keeps metadata matching.</p>
  <p role="status">{r.reason}</p>
  <p>{r.capable?(r.configured?'Credentials protected by Windows.':'ACRCloud project credentials required.'):'Windows secret protection unavailable.'} Capture session: {r.captureActive?'open':'closed'}.</p>
  <form ref={form} onSubmit={event=>{event.preventDefault();const fields=new FormData(event.currentTarget);const command:Command={type:'recognitionConfig',host:String(fields.get('host')??'').trim(),key:String(fields.get('key')??'').trim(),secret:String(fields.get('secret')??'').trim()};event.currentTarget.reset();void act(command);}}>
   <label>ACRCloud project host<input name="host" placeholder="identify-region.acrcloud.com" autoComplete="off" maxLength={200} required/></label>
   <label>Access key<input name="key" type="password" autoComplete="off" maxLength={200} required/></label>
   <label>Access secret<input name="secret" type="password" autoComplete="off" maxLength={200} required/></label>
   <button className="settings-secondary" disabled={!r.capable}>Save protected credentials</button>
   <button type="button" className="settings-secondary" onClick={()=>{form.current?.reset();void act({type:'recognitionRemove'});}}>Remove credentials</button>
  </form>
  <label><input type="checkbox" checked={r.consent} onChange={e=>update({consent:e.target.checked,...(!e.target.checked?{enabled:false}:{})})}/>I consent to sending eligible tab audio samples to ACRCloud.</label>
  <label><input type="checkbox" checked={r.enabled} disabled={!r.configured||!r.consent} onChange={e=>update({enabled:e.target.checked})}/>Enable automatic audio recognition</label>
  <label>Daily request cap (maximum 50)<input type="number" min={0} max={50} value={r.dailyCap} onChange={e=>update({dailyCap:Number(e.target.value)})}/></label>
  <p>Then open the extension on your YouTube tab and choose “Enable audio for this tab.” The session stays open until stopped; it does not buffer samples outside eligible windows. At most two attempts per video are saved across restarts.</p>
 </div></details>;
}
