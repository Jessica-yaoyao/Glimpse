import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'.build/static-site');
const run=(file,args)=>execFileSync(process.execPath,[path.join(root,file),...args],{cwd:root,stdio:'inherit'});
run('node_modules/typescript/bin/tsc',['-b']);
run('node_modules/vite/bin/vite.js',['build','--outDir',output]);
// Vite copies the approved PNG icon from public/ on macOS and Linux alike.
fs.writeFileSync(path.join(output,'.nojekyll'),'');
fs.mkdirSync(path.join(output,'licenses'),{recursive:true});
fs.copyFileSync(path.join(root,'desktop/licenses/Xiaolai-OFL.txt'),path.join(output,'licenses/Xiaolai-OFL.txt'));
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const zip=path.join(root,`.build/Glimpse-v${version}-STATIC_SITE.zip`);
// zip updates existing files; remove only this generated archive to avoid stale entries.
if(fs.existsSync(zip))fs.unlinkSync(zip);
execFileSync('zip',['-q','-r',zip,'index.html','assets','favicon.png','licenses','.nojekyll'],{cwd:output,stdio:'inherit'});
console.log(`Built ${zip}`);
