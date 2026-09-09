// @vitest-environment jsdom
import{it,expect,vi}from'vitest';
import{act,createElement}from'react';
import{createRoot}from'react-dom/client';
import{TimingAlignment}from'../desktop/renderer/TimingAlignment';
import type{ViewState}from'../shared/ui';
it('requires an explicit vocal-line choice and sends its video/record identity for alignment',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('lyricglass',{getTimingLines:async()=>({videoId:'abcdefghijk',recordId:1,lines:[{index:0,time:65.95,text:'Synthetic opening'},{index:1,time:140,text:'Synthetic current line'}]})});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),command=vi.fn(async()=>{});
  try{await act(async()=>root.render(createElement(TimingAlignment,{state:{videoId:'abcdefghijk',record:{id:1,hasSynced:true},timingWarning:'Timing mismatch',delay:0}as ViewState,act:command,error:''})));
    const button=host.querySelector('button')!;expect(button.disabled).toBe(true);const select=host.querySelector('select')!;await act(async()=>{select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(button.disabled).toBe(false);await act(async()=>button.click());expect(command).toHaveBeenCalledWith({type:'align',videoId:'abcdefghijk',recordId:1,index:1});
  }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
