import{describe,it,expect}from'vitest';
import{parseVersion,nextVersion,assertVersions}from'../scripts/version-control.mjs';
describe('numbered version branches',()=>{
 it('uses major for fundamental releases, minor for features, patch for fixes',()=>{expect(nextVersion('0.1.111','major')).toBe('1.0.0');expect(nextVersion('0.1.111','minor')).toBe('0.2.0');expect(nextVersion('0.1.111','patch')).toBe('0.1.112');expect(nextVersion('0.1.111','hotfix')).toBe('0.1.112');expect(nextVersion('0.1.111','bugfix')).toBe('0.1.112');});
 it('accepts explicit newer versions and rejects decreases or incompatible components',()=>{expect(nextVersion('0.1.0','0.1.111')).toBe('0.1.111');expect(()=>nextVersion('0.2.0','0.1.111')).toThrow('greater');expect(()=>nextVersion('0.1.0','0.1.0')).toThrow('greater');expect(()=>parseVersion('0.01.1')).toThrow();expect(()=>nextVersion('0.1.65535','patch')).toThrow('65535');});
 it('requires every version file to match the numeric branch',()=>{expect(assertVersions('0.1.111',Array(5).fill('0.1.111'))).toBe('0.1.111');expect(()=>assertVersions('0.1.111',['0.1.0'])).toThrow('must match');expect(()=>assertVersions('0.1.0',['0.1.0','0.1.1'])).toThrow('versions must match');expect(()=>assertVersions('feature/foo',['0.1.0'])).toThrow('numeric');});
 it('allows checking main but prevents committing directly to it',()=>{expect(assertVersions('main',['0.1.0'])).toBe('0.1.0');expect(()=>assertVersions('main',['0.1.0'],{commit:true})).toThrow('Do not commit on main');});
});
