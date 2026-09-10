// @vitest-environment jsdom
import{afterEach,beforeEach,describe,it,expect,vi}from'vitest';
import{act,createElement}from'react';
import{createRoot,type Root}from'react-dom/client';
import{LedgerOverlay}from'../desktop/renderer/LedgerOverlay';
import{settings}from'../shared/settings';
import{ledgerLines}from'../shared/ledger';
import{parseLrc}from'../shared/lyrics';
import type{Command,ViewState}from'../shared/ui';
let root:Root,host:HTMLDivElement,state:ViewState,commands:Command[],frames:Map<number,FrameRequestCallback>,frameId:number,resizeCallbacks:Function[];
const lines=parseLrc('[00:00]Morning paper\n[00:05]Silver ink\n[00:10]Little lights drift away\n[00:15]Open windows\n[00:20]Day begins').lines;
function render(){root.render(createElement(LedgerOverlay,{state,act:dispatch,error:''}));}
async function dispatch(command:Command){commands.push(command);if(command.type==='settings')state={...state,settings:settings({...state.settings,...command.patch})};if(command.type==='lock')state={...state,settings:{...state.settings,locked:!state.settings.locked}};if(command.type==='delay')state={...state,delay:command.value};if(command.type==='resetTiming')state={...state,delay:0};render();}
const gear=()=>host.querySelector<HTMLButtonElement>('[aria-label="Overlay settings"]')!;
const click=async(button:HTMLElement)=>{await act(async()=>button.click());};
beforeEach(async()=>{
  resizeCallbacks=[];vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{constructor(callback:Function){resizeCallbacks.push(callback);}observe(){}disconnect(){}});
  vi.stubGlobal('matchMedia',()=>({matches:false}));frames=new Map();frameId=0;
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{const id=++frameId;frames.set(id,callback);return id;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));vi.spyOn(performance,'now').mockReturnValue(0);
  vi.stubGlobal('lyricglass',{command:vi.fn(async()=>({ok:true}))});
  HTMLElement.prototype.setPointerCapture=vi.fn();
  host=document.createElement('div');document.body.append(host);root=createRoot(host);commands=[];
  state={settings:settings({}),videoId:'abcdefghijk',title:'Test Ensemble - Paper Satellites',artist:'',delay:250,status:'Synchronized lyrics',connection:'Connected',record:{id:1},ledger:{...ledgerLines(lines,12,250),synced:true,clock:{position:12,duration:30,rate:1,advancing:true,validForMs:3000,delay:250,lineStart:10,lineEnd:15}}} as ViewState;
  await act(async()=>render());
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('compact popover behavior with mocked desktop boundary',()=>{
 it('keeps an unresolved result quiet and exposes matching through the gear',async()=>{state={...state,record:null,status:'Lyrics unavailable',candidates:[{id:1} as ViewState['candidates'][number]],ledger:{...state.ledger,...ledgerLines([],0,0),synced:false}};await act(async()=>render());expect(host.querySelector('.match-prompt')).toBeNull();expect(host.textContent).toContain('Lyrics unavailable');expect(commands).toEqual([]);await click(gear());await click(host.querySelector<HTMLButtonElement>('.open-match')!);expect(commands.at(-1)).toEqual({type:'openSettings',section:'match'});});
 it('provides matching from the gear even when lyrics are already selected',async()=>{await click(gear());const change=host.querySelector<HTMLButtonElement>('.open-match')!;expect(change.disabled).toBe(false);await click(change);expect(commands.at(-1)).toEqual({type:'openSettings',section:'match'});expect(host.querySelector('[role="dialog"]')).toBeNull();});
 it('retains the same card and active drag when the lyric line advances',async()=>{
  const card=host.querySelector('.ledger-card')!;
  const pointer=(type:string)=>{const e=new MouseEvent(type,{bubbles:true,button:0,screenX:100,screenY:200});Object.defineProperty(e,'pointerId',{value:1});return e;};
  await act(async()=>card.dispatchEvent(pointer('pointerdown')));
  state={...state,current:'Open windows',ledger:{...state.ledger,...ledgerLines(lines,16,0),clock:{...state.ledger.clock,position:16,lineStart:15,lineEnd:20}}};await act(async()=>render());
  expect(host.querySelector('.ledger-card')).toBe(card);expect(host.querySelector('.line-highlight')?.textContent).toBe('Open windows');
  expect(vi.mocked(window.lyricglass.command).mock.calls.filter(([c])=>c.type==='drag'&&c.phase==='end')).toHaveLength(0);
  await act(async()=>card.dispatchEvent(pointer('pointermove')));expect(window.lyricglass.command).toHaveBeenCalledWith({type:'drag',phase:'move',x:100,y:200});
  await act(async()=>card.dispatchEvent(pointer('pointerup')));expect(window.lyricglass.command).toHaveBeenCalledWith({type:'drag',phase:'end',x:100,y:200});
 });
 it('coalesces lyric animation measurements into one settled resize',async()=>{
  vi.useFakeTimers();let height=250;vi.spyOn(host.querySelector('.ledger-card')!,'getBoundingClientRect').mockImplementation(()=>({height}) as DOMRect);
  vi.mocked(window.lyricglass.command).mockClear();const notify=resizeCallbacks[0];notify();height=280;notify();height=240;notify();expect(window.lyricglass.command).not.toHaveBeenCalled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(100);});expect(window.lyricglass.command).toHaveBeenCalledTimes(1);expect(window.lyricglass.command).toHaveBeenCalledWith({type:'height',value:240});
 });
 it('drags from the card, excludes controls, and closes settings when the card is clicked',async()=>{
  const pointer=(type:string)=>{const e=new MouseEvent(type,{bubbles:true,button:0,screenX:100,screenY:200});Object.defineProperty(e,'pointerId',{value:1});return e;};
  await click(gear());await act(async()=>gear().dispatchEvent(pointer('pointerdown')));expect(vi.mocked(window.lyricglass.command).mock.calls.some(([c])=>c.type==='drag')).toBe(false);
  await act(async()=>host.querySelector('.ledger-track')!.dispatchEvent(pointer('pointerdown')));expect(host.querySelector('[role="dialog"]')).toBeNull();expect(window.lyricglass.command).toHaveBeenCalledWith({type:'drag',phase:'start',x:100,y:200});
  await act(async()=>host.querySelector('.ledger-card')!.dispatchEvent(pointer('pointerup')));expect(window.lyricglass.command).toHaveBeenCalledWith({type:'drag',phase:'end',x:100,y:200});
 });
 it('opens by gear, closes by gear, outside click and Escape',async()=>{
  expect(host.querySelector('[role="dialog"]')).toBeNull();await click(gear());expect(host.querySelector('[role="dialog"]')).not.toBeNull();await click(gear());expect(host.querySelector('[role="dialog"]')).toBeNull();
  await click(gear());await act(async()=>document.body.dispatchEvent(new Event('pointerdown',{bubbles:true})));expect(host.querySelector('[role="dialog"]')).toBeNull();
  await click(gear());await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(host.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(gear());
 });
 it('keeps popover open for internal clicks and applies ±250 ms and reset to this video',async()=>{
  await click(gear());const plus=host.querySelector<HTMLButtonElement>('[aria-label="Lyrics later by 250 milliseconds"]')!;
  await act(async()=>plus.dispatchEvent(new Event('pointerdown',{bubbles:true})));expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  await click(plus);expect(host.querySelector('output')?.textContent).toBe('+500 ms');expect(commands.at(-1)).toEqual({type:'delay',videoId:'abcdefghijk',value:500});
  await click(host.querySelector('[aria-label="Lyrics earlier by 250 milliseconds"]')!);expect(state.delay).toBe(250);await click(host.querySelector('.delay-reset')!);expect(state.delay).toBe(0);
 });
 it('switches theme through the typed API and reflects the selected segment',async()=>{
  await click(gear());const buttons=Array.from(host.querySelectorAll<HTMLButtonElement>('.theme-segments button'));await click(buttons[1]);expect(commands.at(-1)).toEqual({type:'settings',patch:{theme:'light',opacity:.82}});expect(host.querySelector('.ledger-card')?.getAttribute('data-theme')).toBe('light');expect(buttons[1].getAttribute('aria-pressed')).toBe('true');await click(buttons[0]);expect(state.settings.theme).toBe('dark');
 });
 it('preserves native click-through lock command, closes popover, and can recover after external unlock',async()=>{
  await click(gear());await click(host.querySelector('[role="switch"]')!);expect(commands.at(-1)).toEqual({type:'lock'});expect(gear().disabled).toBe(true);expect(host.querySelector('[role="dialog"]')).toBeNull();
  state={...state,settings:{...state.settings,locked:false}};await act(async()=>render());expect(gear().disabled).toBe(false);await click(gear());expect(host.querySelector('[role="dialog"]')).not.toBeNull();
 });
 it('paints complete and partially sung words on animation frames and cleans up animation work',async()=>{
  state={...state,current:'Little lights drift away',ledger:{...state.ledger,clock:{...state.ledger.clock,words:[{start:10,end:11},{start:11,end:13},{start:13,end:14},{start:14,end:15}]}}};await act(async()=>render());
  const pending=[...frames.entries()];for(const[id,callback]of pending){frames.delete(id);callback(0);}
  const words=host.querySelectorAll<HTMLElement>('[data-word]');expect(words).toHaveLength(4);expect(words[0].style.color).toBe('var(--accent)');expect(words[1].style.color).toBe('transparent');expect(words[1].style.backgroundImage).toContain('linear-gradient');expect(words[2].style.color).toBe('var(--fg)');
  await act(async()=>root.unmount());expect(frames.size).toBe(0);root=createRoot(host);
 });
 it('highlights only the current line without running an estimated word animation',()=>{expect(host.querySelector('.line-highlight')?.textContent).toBe('Little lights drift away');expect(host.querySelectorAll('[data-word]')).toHaveLength(0);expect(frames.size).toBe(0);expect(host.querySelector('.ledger-sync')?.textContent).toBe('line sync');});
});
