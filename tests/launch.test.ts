import{describe,it,expect}from'vitest';
import{initialSettingsPage}from'../shared/launch';
describe('console-free installed launch',()=>{
 it('starts installed copies without opening a settings window, paired or unpaired',()=>{expect(initialSettingsPage([],true,true)).toBeNull();expect(initialSettingsPage([],false,true)).toBeNull();});
 it('opens settings only when explicitly requested in an installed copy',()=>{expect(initialSettingsPage(['--settings'],true,true)).toBe('general');expect(initialSettingsPage(['--match'],true,true)).toBe('match');});
 it('keeps first-run setup available during development',()=>{expect(initialSettingsPage([],false,false)).toBe('general');expect(initialSettingsPage([],true,false)).toBeNull();});
});
