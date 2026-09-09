// @vitest-environment jsdom
import{afterEach,beforeEach,it,expect,vi}from'vitest';
import{act,createElement}from'react';
import{createRoot,type Root}from'react-dom/client';
import{useSettingsNavigation}from'../desktop/renderer/settings-navigation';
import type{SettingsNavigation}from'../shared/ui';
let root:Root,host:HTMLDivElement,scroll:ReturnType<typeof vi.fn>;
function Page({target}:{target:SettingsNavigation}){useSettingsNavigation(target);return createElement('section',{id:'match-section'},createElement('input',{id:'match-search'}));}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);scroll=vi.fn();HTMLElement.prototype.scrollIntoView=scroll;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('opens at matching and focuses search when the settings page mounts',async()=>{await act(async()=>root.render(createElement(Page,{target:{section:'match',request:1}})));expect(document.activeElement?.id).toBe('match-search');expect(scroll).toHaveBeenCalledWith({block:'start',behavior:'instant'});});
it('handles another match request without remounting settings or losing the typed query',async()=>{await act(async()=>root.render(createElement(Page,{target:{section:'match',request:1}})));const input=document.getElementById('match-search') as HTMLInputElement;input.value='Synthetic track';input.blur();await act(async()=>root.render(createElement(Page,{target:{section:'match',request:2}})));expect(document.getElementById('match-search')).toBe(input);expect(input.value).toBe('Synthetic track');expect(document.activeElement).toBe(input);expect(scroll).toHaveBeenCalledTimes(2);});
