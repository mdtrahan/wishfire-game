#!/usr/bin/env node
// Fast tier: syntax, affected deterministic contracts and changed Rust crates.
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, globSync, readFileSync, statSync} from 'node:fs';
import {dirname, basename, resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=file=>existsSync(resolve(root,file))&&statSync(resolve(root,file)).isFile()?readFileSync(resolve(root,file),'utf8'):'';

export function commitPlan(files) {
 files=files.filter(file=>!file.endsWith('.md'));
 const changed=new Set(files), cache=new Map(), browserCache=new Map();
 const metadata=file=>{
  if(cache.has(file))return cache.get(file);
  const text=source(file), deps=[];
  // Imports and file-backed contract fixtures are both dependency edges.
  for(const match of text.matchAll(/['"`]([^'"`\n]+)['"`]/g)){
   const name=match[1];
   if(!name.startsWith('.')&&!/^(tests|src|web-runner|tools|rust)\//.test(name))continue;
   const candidate=relative(root,resolve(root,name.startsWith('.')?dirname(file):'',name));
   if(/\.[\w]+$/.test(candidate))deps.push(candidate);
   else for(const dep of [`${candidate}.js`,`${candidate}.mjs`,`${candidate}.cjs`])if(existsSync(resolve(root,dep))){deps.push(dep);break;}
  }
  const imports=[...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]).filter(name=>name.startsWith('.')).map(name=>relative(root,resolve(root,dirname(file),name)));
  const row={text,deps,imports};cache.set(file,row);return row;
 };
 const browser=(file,visiting=new Set())=>{
  if(browserCache.has(file))return browserCache.get(file);
  if(visiting.has(file))return false;
  visiting.add(file);const {text,imports}=metadata(file);
  const result=/from ['"]playwright['"]|require\(['"]playwright['"]\)|['"][^'"\n]*\/playwright_support\.js['"]/.test(text)||imports.some(dep=>browser(dep,visiting));
  visiting.delete(file);if(result)browserCache.set(file,true);return result;
 };
 const affected=(file,visiting=new Set())=>{
  if(changed.has(file))return true;
  if(visiting.has(file))return false;
  visiting.add(file);const result=metadata(file).deps.some(dep=>affected(dep,visiting));visiting.delete(file);return result;
 };
 const stems=files.map(file=>basename(file).replace(/\.[^.]+$/,''));
 const routing=files.some(file=>/^(\.beads\/hooks\/|package\.json$|tools\/(run_(commit|merge)_tests|enforce_commit_check)|tests\/preCommitRouting)/.test(file));
 const tests=globSync('tests/**/*.test.{js,mjs,cjs}',{cwd:root}).sort().filter(file=>{
  // This contract imports only the gate's pure invariant helper; it never launches a browser.
  if(file!=='tests/uiPresentationLockGateContract.test.js'&&browser(file))return false;
  if(routing&&/\/(preCommitRouting|lampRoster|uiPresentationLockGateContract)\.test\./.test(file))return true;
  return affected(file)||stems.some(stem=>stem.length>3&&metadata(file).text.includes(stem));
 });
 const touchedCrates=[...new Set(files.filter(file=>/^rust\/[^/]+\//.test(file)).map(file=>`rust/${file.split('/')[1]}/Cargo.toml`))].filter(file=>existsSync(resolve(root,file)));
 const sharedRust=files.some(file=>/^rust\/[^/]+$/.test(file))||(files.some(file=>file.startsWith('rust/'))&&!touchedCrates.length);
 const crates=sharedRust?globSync('rust/*/Cargo.toml',{cwd:root}).sort():touchedCrates.sort();
 const syntax=files.filter(file=>/\.[cm]?js$/.test(file)&&existsSync(resolve(root,file)));
 return {syntax,tests,crates};
}

function run(command,args,isolateGit=false){
 const env={...process.env};
 // Tests create their own Git fixtures; hook-local repository vars must stay here.
 if(isolateGit)for(const key of ['GIT_INDEX_FILE','GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR'])delete env[key];
 const result=spawnSync(command,args,{cwd:root,stdio:'inherit',env});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(`${command} exited ${result.status??result.signal}`);
}
export function runCommitTests(args=process.argv.slice(2)){
 const flags=args.filter(arg=>arg!=='--plan');
 if(flags.length&&!(flags.length===2&&flags[0]==='--base'))throw Error('Usage: run_commit_tests.mjs [--plan] [--base <ref>]');
 const diff=flags.length?['diff','--name-only','-z','--diff-filter=ACMRD',`${flags[1]}...HEAD`]:['diff','--cached','--name-only','-z','--diff-filter=ACMRD'];
 const files=execFileSync('git',diff,{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean),plan=commitPlan(files);
 if(args.includes('--plan')){console.log(JSON.stringify(plan,null,2));return;}
 run('git',flags.length?['diff','--check',`${flags[1]}...HEAD`]:['diff','--cached','--check']);
 for(const file of plan.syntax)run(process.execPath,['--check',file]);
 if(plan.tests.length)run(process.execPath,['--import','./tools/ensure_simulation_core.cjs','--test','--test-concurrency=4',...plan.tests],true);
 for(const manifest of plan.crates)run('cargo',['test','--manifest-path',manifest,'--color','never'],true);
 console.log(`Fast tier passed: ${plan.syntax.length} syntax files, ${plan.tests.length} deterministic test files, ${plan.crates.length} Rust crates.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{runCommitTests();}catch(error){console.error(error.message);process.exitCode=1;}
