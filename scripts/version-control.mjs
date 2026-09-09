import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function parseVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw Error('Use a numeric MAJOR.MINOR.PATCH version, such as 0.1.111.');
  const numbers=value.split('.').map(Number);
  if(numbers.some(n=>n>65535))throw Error('Each component must be at most 65535 for browser extension compatibility.');
  return numbers;
}
export function nextVersion(current,kind) {
  const version=parseVersion(current),aliases={major:0,minor:1,patch:2,bugfix:2,hotfix:2};
  let next;
  if(Object.hasOwn(aliases,kind)){const index=aliases[kind];next=version.map((value,i)=>i<index?value:i===index?value+1:0);}
  else next=parseVersion(kind);
  const result=next.join('.');parseVersion(result);
  const first=next.findIndex((value,i)=>value!==version[i]);
  if(first<0||next[first]<version[first])throw Error('The new version must be greater than the current version.');
  return result;
}
export function assertVersions(branch,versions,{commit=false}={}) {
  if(branch==='main'&&commit)throw Error('Do not commit on main. Create a numbered branch with npm run version:new -- patch.');
  if(branch!=='main')parseVersion(branch);
  const version=versions[0];parseVersion(version);
  if(versions.some(value=>value!==version))throw Error('Package, lockfile and extension manifest versions must match.');
  if(branch!=='main'&&branch!==version)throw Error(`Branch ${branch} must match the project version ${version}.`);
  return version;
}
const files=['package.json','package-lock.json','extension/manifest.json','extension/manifest.firefox.json'];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const read=()=>files.map(file=>JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,'')));
function run() {
  process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
  const action=process.argv[2];
  if(action==='install-hooks'){
    if(process.env.CI)return;
    try{git('rev-parse','--show-toplevel');}catch{return;}
    git('config','core.hooksPath','.githooks');console.log('Version branch hooks installed.');return;
  }
  const documents=read();
  if(action==='check'){
    const branch=process.env.LYRICGLASS_BRANCH||git('branch','--show-current');
    const version=assertVersions(branch,[documents[0].version,documents[1].version,documents[1].packages?.['']?.version,documents[2].version,documents[3].version],{commit:process.argv.includes('--commit')});
    console.log(`${branch}: version ${version} is consistent.`);return;
  }
  if(action==='new'){
    const current=git('branch','--show-current');if(!current)throw Error('Check out a branch before creating a version.');
    assertVersions(current,[documents[0].version,documents[1].version,documents[1].packages?.['']?.version,documents[2].version,documents[3].version]);
    if(git('status','--porcelain'))throw Error('Commit or stash your changes before starting a new version.');
    const version=nextVersion(documents[0].version,process.argv[3]??'patch');
    git('switch','-c',version);
    documents.forEach((document,index)=>{document.version=version;if(index===1)document.packages[''].version=version;writeFileSync(files[index],JSON.stringify(document,null,2)+'\n');});
    console.log(`Created ${version}. Version files are updated; commit them with your changes, then push and open a pull request to main.`);return;
  }
  throw Error('Use check, install-hooks, or new <major|minor|patch|hotfix|bugfix|0.1.111>.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{run();}catch(error){console.error(error instanceof Error?error.message:'Version operation failed.');process.exitCode=1;}
}
