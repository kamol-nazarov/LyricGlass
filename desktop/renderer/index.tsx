import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import type{API,Command,ViewState}from'../../shared/ui';
import'./base.css';
import'./fonts.css';
import{LedgerOverlay}from'./LedgerOverlay';
import{SettingsWindow}from'./SettingsWindow';
declare global{interface Window{lyricglass:API}}
const isSettings=location.hash==='#settings';document.body.className=isSettings?'settings-body':'overlay-body';
function App(){
  const[state,setState]=useState<ViewState|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{const off=window.lyricglass.subscribe(setState);void window.lyricglass.getState().then(setState);return off;},[]);
  async function act(command:Command){setError('');setNotice('');try{const result=await window.lyricglass.command(command);if(!result.ok)setError(result.error??'Action failed');else if(command.type==='copyPairing')setNotice('Pairing details copied. Paste them into the extension popup.');}catch{setError('Desktop connection unavailable. Restart LyricGlass.');}}
  if(!state)return <main className="loading">Opening LyricGlass…</main>;
  return isSettings?<SettingsWindow state={state} act={act} error={error} notice={notice}/>:<LedgerOverlay state={state} act={act} error={error}/>;
}
createRoot(document.getElementById('root')!).render(<App/>);
