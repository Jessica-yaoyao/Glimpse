// Build locally, publish compiled files to gh-pages, then let GitHub Pages serve them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(cwd,args,optional=false)=>{
  const r=spawnSync('git',args,{cwd,encoding:'utf8',maxBuffer:4*1024*1024});
  if(!optional&&r.status!==0)throw Error((r.stderr||r.stdout).trim());
  return r;
};
const origin=run(root,['remote','get-url','origin']).stdout.trim();
if(!/^https:\/\/github\.com\/Jessica-yaoyao\/Glimpse(?:\.git)?\/?$/i.test(origin))throw Error('Unexpected origin; this publisher is scoped to Jessica-yaoyao/Glimpse');
if(run(root,['status','--porcelain','--untracked-files=normal']).stdout.trim())throw Error('Commit source changes before deploying so the published source revision is exact');
execFileSync(process.execPath,[path.join(root,'scripts/build-static.mjs')],{cwd:root,stdio:'inherit'});
const revision=run(root,['rev-parse','HEAD']).stdout.trim();
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'glimpse-pages-'));
run(temporary,['init','-b','gh-pages']);run(temporary,['remote','add','origin',origin]);
for(const key of ['user.name','user.email']){
  const value=run(root,['config','--get',key]).stdout.trim();
  if(!value)throw Error('Configure git '+key+' before deploying');
  run(temporary,['config',key,value]);
}
const helper=run(root,['config','--get-all','credential.https://github.com.helper'],true);
if(helper.status===0){
  run(temporary,['config','credential.https://github.com.helper','']);
  for(const value of helper.stdout.trim().split('\n').filter(Boolean))run(temporary,['config','--add','credential.https://github.com.helper',value]);
}
const refs=run(temporary,['ls-remote','--heads','origin','gh-pages']).stdout.trim();
if(refs){
  run(temporary,['fetch','--depth=1','origin','gh-pages']);
  run(temporary,['checkout','-B','gh-pages','FETCH_HEAD']);
  // Only remove prior generated tracked files inside this new temporary checkout.
  for(const relative of run(temporary,['ls-files','-z']).stdout.split('\0').filter(Boolean))fs.unlinkSync(path.join(temporary,relative));
}
const output=path.join(root,'.build/static-site');
for(const name of fs.readdirSync(output))fs.cpSync(path.join(output,name),path.join(temporary,name),{recursive:true});
const metadata={version,sourceRevision:revision,sourceBranch:'main',mode:'static-mock-demo',url:'https://jessica-yaoyao.github.io/Glimpse/'};
fs.writeFileSync(path.join(temporary,'deployment.json'),JSON.stringify(metadata,null,2)+'\n');
run(temporary,['add','--all']);
if(run(temporary,['diff','--cached','--quiet'],true).status!==0)run(temporary,['commit','-m',`Deploy Glimpse v${version} from ${revision.slice(0,7)}`]);
run(temporary,['push','--set-upstream','origin','gh-pages']);
console.log(JSON.stringify({...metadata,deploymentRevision:run(temporary,['rev-parse','HEAD']).stdout.trim()},null,2));
