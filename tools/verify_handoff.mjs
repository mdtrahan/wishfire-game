#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseFailures, failureDiff, scanDiff, diffLines, perfDiff, selectBaseCache } from './verify_handoff_logic.mjs';
import { combatProbes } from './verify_handoff_probe.mjs';
const { parseArgs }=createRequire(import.meta.url)('./playwright_support.js');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024}).trim();

async function run(command,args,cwd,log,env={}) {
  const started=performance.now(),stream=createWriteStream(log);
  const child=spawn(command,args,{cwd,env:{...process.env,PATH:`/opt/homebrew/bin:${process.env.PATH}`,NO_COLOR:'1',...env},stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});
  const status=await new Promise(resolve=>{child.on('error',e=>{stream.write(String(e));resolve(127);});child.on('close',code=>resolve(code??1));});
  await new Promise(resolve=>stream.end(resolve));
  return {command:[command,...args],status,seconds:(performance.now()-started)/1000,log};
}

async function main() {
  const options=parseArgs(process.argv.slice(2));
  if(!options.base||!options.head)throw Error('Usage: node tools/verify_handoff.mjs --base <ref> --head <ref> [--claims claims.json] [--out dir] [--seconds 30] [--seed 7] [--quick] [--cache-dir dir]');
  const quick=options.quick==='true',seconds=quick?Math.min(Number(options.seconds||60),60):Number(options.seconds||30),seed=Number(options.seed||7);
  if(!Number.isFinite(seconds)||seconds<1||seconds>600||!Number.isSafeInteger(seed)||seed<1)throw Error('seconds must be 1..600; seed must be a positive integer');
  const refs={base:git('rev-parse','--verify',`${options.base}^{commit}`),head:git('rev-parse','--verify',`${options.head}^{commit}`)};
  const out=resolve(options.out||join(tmpdir(),`orka-handoff-report-${Date.now()}`));
  const supplied=options.claims?JSON.parse(readFileSync(resolve(options.claims),'utf8')):{};
  if(!supplied||typeof supplied!=='object'||Array.isArray(supplied))throw Error('claims.json must map claim IDs to {probe, max?, min?}');
  for(const [id,c]of Object.entries(supplied))if(!c||typeof c.probe!=='string'||Object.keys(c).some(k=>!['probe','min','max'].includes(k))||['min','max'].some(k=>c[k]!==undefined&&!Number.isFinite(c[k])))throw Error(`Invalid claim ${id}`);
  await mkdir(out,{recursive:true});
  const cacheDir=resolve(options['cache-dir']||join(tmpdir(),'orka-handoff-cache'));
  const cachePath=join(cacheDir,`${refs.base}.json`);
  let savedCache=null;
  if(quick&&existsSync(cachePath))savedCache=JSON.parse(readFileSync(cachePath,'utf8'));
  const temp=await mkdtemp(join(tmpdir(),'orka-handoff-')),created=[],roots={},outputs={},started=performance.now();
  const diff=git('diff','--no-ext-diff','--unified=3',refs.base,refs.head,'--','.',':(exclude)history',':(exclude)output',':(exclude).beads');
  const statuses=git('diff','--name-status','-M',refs.base,refs.head,'--','.',':(exclude)history',':(exclude)output',':(exclude).beads');
  const report={schema:2,mode:quick?'quick':'full',cache:{path:cachePath,baseResultHit:false,baseNpmHit:false},refs,scenario:{chapter:1,seed,seconds,profile:'iPhone 13 native DPR 3',entry:'canonical developer-launch Chapter 1 boss, repeated after encounter end; unchanged combat stats'},out,suites:{},probes:{},errors:[],scan:scanDiff(diff,statuses)};
  try {
    const changed=git('diff','--name-only',refs.base,refs.head,'--','rust').split('\n');
    const crateNames=[...new Set(changed.filter(f=>/^rust\/[^/]+\//.test(f)).map(f=>f.split('/')[1]))].sort();
    const cached=quick?selectBaseCache(savedCache,refs.base):null;
    for(const label of ['base','head']) {
      const tree=join(temp,label),dir=join(out,label);await mkdir(dir,{recursive:true});
      roots[label]=tree;outputs[label]=dir;
      console.log(`${label}: ${refs[label]} preparing isolated worktree`);
      git('worktree','add','--detach','--no-checkout',tree,refs[label]);created.push(tree);
      execFileSync('git',['sparse-checkout','set','--no-cone','--stdin'],{cwd:tree,input:'/*\n!/history/\n!/output/\n!/.beads/*\n/.beads/hooks/\n',stdio:['pipe','ignore','pipe']});
      execFileSync('git',['checkout','--detach',refs[label]],{cwd:tree,stdio:'ignore'});
      const env={CARGO_TARGET_DIR:join(temp,'cargo',label)},steps=[];
      const execute=async(name,cmd,args)=>{console.log(`${label}: ${name}`);const result=await run(cmd,args,tree,join(dir,`${name}.log`),env);steps.push({name,...result});return result;};
      await execute('dependencies','npm',['ci','--ignore-scripts','--prefer-offline','--no-audit','--no-fund']);
      if(existsSync(join(tree,'tools/build_simulation_core_wasm.js')))await execute('wasm-build',process.execPath,['tools/build_simulation_core_wasm.js']);
      if(existsSync(join(tree,'tools/build_offline_release.mjs')))await execute('offline-build',process.execPath,['tools/build_offline_release.mjs']);
      let npm,failures;
      if(label==='base'&&cached){
        console.log('base: reusing SHA-matched npm failure set');
        npm={...cached.npm.step,cached:true,cache:cachePath};steps.push({...npm,name:'npm-test'});
        failures=[...cached.npm.failures];report.cache.baseNpmHit=true;
      } else {
        npm=await execute('npm-test','npm',['test','--','--test-reporter=tap']);
        failures=parseFailures(readFileSync(npm.log,'utf8'));
        if(npm.status&&!failures.length)failures.push('npm::UNPARSED_SUITE_FAILURE');
      }
      const npmFailures=[...failures];
      for(const crate of crateNames) {
        const manifest=`rust/${crate}/Cargo.toml`;
        if(!existsSync(join(tree,manifest))){steps.push({name:`cargo-${crate}`,status:null,note:'crate absent at this ref; review deletion'});continue;}
        const cargo=await execute(`cargo-${crate}`,'cargo',['test','--manifest-path',manifest,'--color','never']);
        const names=parseFailures(readFileSync(cargo.log,'utf8'),`cargo:${crate}`);failures.push(...names);
        if(cargo.status&&!names.length)failures.push(`cargo:${crate}::UNPARSED_SUITE_FAILURE`);
      }
      report.suites[label]={steps,failures:[...new Set(failures)].sort()};
      if(label==='base'){
        savedCache={schema:1,sha:refs.base,npm:{step:npm,failures:npmFailures},
          fullSeconds:savedCache?.sha===refs.base?savedCache.fullSeconds:null,
          result:null};
        await mkdir(cacheDir,{recursive:true});await writeFile(cachePath,JSON.stringify(savedCache)+'\n');
      }
      // Scan actual head sources for unused exports and copies of existing eight-line blocks.
      if(label==='head') {
        const files=execFileSync('git',['ls-files','--','web-runner','src','tools','tests','rust'],{cwd:tree,encoding:'utf8'}).trim().split('\n').filter(f=>/\.(?:[cm]?js|rs)$/.test(f));
        const sources=files.filter(f=>existsSync(join(tree,f))).map(file=>({file,text:readFileSync(join(tree,file),'utf8')}));
        for(const row of diffLines(diff)) {
          const symbol=/export\s+(?:(?:async\s+)?function|class|const|let)\s+(\w+)/.exec(row.text)?.[1];
          if(symbol&&!sources.some(s=>s.file!==row.file&&new RegExp(`\\b${symbol}\\b`).test(s.text)))report.scan.findings.push({kind:'export with no apparent importer (heuristic)',...row});
        }
        const rows=diffLines(diff),index=new Map();
        for(let i=0;i+8<=rows.length;i++){const block=rows.slice(i,i+8);if(block.some((r,j)=>r.file!==block[0].file||r.line!==block[0].line+j))continue;const key=block.map(r=>r.text.trim()).join('\n');if(key.replace(/\W/g,'').length>=80)index.set(key,[]);}
        for(const {file,text}of sources) {
          const lines=text.split('\n').map(l=>l.trim());
          for(let i=0;i+8<=lines.length;i++){const entries=index.get(lines.slice(i,i+8).join('\n'));if(entries)entries.push(`${file}:${i+1}`);}
        }
        for(let i=0;i+8<=rows.length;i++) {
          const block=rows.slice(i,i+8);if(block.some((r,j)=>r.file!==block[0].file||r.line!==block[0].line+j))continue;
          const matches=index.get(block.map(r=>r.text.trim()).join('\n'))||[];
          if(matches.length>1)report.scan.findings.push({kind:'duplicated block (8 lines, head source)',...block[0],matches});
        }
      }
    }
    const probes=await combatProbes(roots,outputs,seconds,seed);
    report.probes={base:probes.base,head:probes.head};report.scenario.runOrder=probes.order;
  } catch(error) {report.errors.push(String(error.stack));}
  finally {
    for(const tree of created.reverse())try {git('worktree','remove','--force',tree);}catch(error){report.errors.push(`Worktree cleanup failed: ${tree}: ${error.message}`);}
    if(!report.errors.some(e=>e.startsWith('Worktree cleanup')))await rm(temp,{recursive:true,force:true});
  }
  report.failures=failureDiff(report.suites.base?.failures||[],report.suites.head?.failures||[]);
  report.claims=Object.fromEntries(['noLingeringEffects','actorsInsideArena','buffsAllowedSides','noClipping','noConsoleErrors'].map(id=>[id,report.probes.head?.claims?.[id]||{status:'FAIL',measured:null,reason:'Probe evidence unavailable'}]));
  for(const [id,c]of Object.entries(supplied)) {
    const probe=report.probes.head?.claims?.[c.probe],value=probe?.measured;
    const pass=probe?.status==='PASS'&&Number.isFinite(value)&&value>=(c.min??-Infinity)&&value<=(c.max??Infinity);
    report.claims[`claim:${id}`]={status:pass?'PASS':'FAIL',probe:c.probe,measured:value??null,min:c.min??null,max:c.max??null};
  }
  report.performance=perfDiff(report.probes.base?.metrics||{},report.probes.head?.metrics||{},report.probes.base?.spreads,report.probes.head?.spreads,{sameRef:refs.base===refs.head});
  const buildFailed=Object.values(report.suites).some(s=>s.steps.some(step=>step.status!==null&&step.status!==0&&!/^(npm-test|cargo-)/.test(step.name)));
  const complete=['base','head'].every(k=>report.probes[k]?.coverage?.complete&&report.suites[k]&&!report.suites[k].failures.some(f=>f.endsWith('UNPARSED_SUITE_FAILURE')));
  report.verdict=complete&&!buildFailed&&!report.errors.length&&!Object.values(report.probes).some(p=>p.errors?.length)&&!report.failures.new.length&&Object.values(report.claims).every(c=>c.status==='PASS')&&!Object.values(report.performance).some(p=>p.regression)?(Object.values(report.performance).some(p=>p.status==='INCONCLUSIVE')?'INCONCLUSIVE':'PASS'):'FAIL';
  report.seconds=(performance.now()-started)/1000;
  report.runtimes={quickSeconds:quick?report.seconds:null,fullSeconds:quick?savedCache?.fullSeconds??null:report.seconds,fullSource:quick?'previous full proof':'this run'};
  if(!quick&&savedCache?.sha===refs.base){savedCache.fullSeconds=report.seconds;await writeFile(cachePath,JSON.stringify(savedCache)+'\n');}
  const bullet=values=>values.length?values.slice(0,12).map(v=>`- ${typeof v==='string'?v:JSON.stringify(v)}`).join('\n')+(values.length>12?`\n- ${values.length-12} more in report.json`:''):'- None';
  const md=`<div style="color:#17202a;background:#ffffff;padding:16px">\n\n# Handoff verification\n\n${refs.base} → ${refs.head}\n\nSeed ${seed}; Chapter 1; ${seconds}s per ref; iPhone 13 DPR 3. Mode ${report.mode}; runtime ${report.seconds.toFixed(1)}s. Quick/full runtimes: ${JSON.stringify(report.runtimes)}. Cache: ${JSON.stringify(report.cache)}. Fresh ABABAB runs; medians and min/max spreads below. Steps use 30 batches of 300 ABI calls after 3 warmup batches, timed with process.hrtime.bigint. Heap growth is retained after forced GC with observer arrays released. Headless Chromium observations; draw bounds are sprite quads.\n\n## Failure sets\n\nNew (${report.failures.new.length}):\n\n${bullet(report.failures.new)}\n\nFixed (${report.failures.fixed.length}):\n\n${bullet(report.failures.fixed)}\n\nStill failing (${report.failures.stillFailing.length}):\n\n${bullet(report.failures.stillFailing)}\n\n## Claims\n\n${bullet(Object.entries(report.claims).map(([id,c])=>`${id}: ${c.status}; measured=${c.measured}`))}\n\n## Performance\n\n${bullet(Object.entries(report.probes).map(([label,p])=>`${label}: frame mean ${p.metrics.frameMean} ms; frames >16.7 ms ${p.metrics.frameDroppedRate}; step mean ${p.metrics.stepMean} ms; retained heap growth ${p.metrics.heapGrowthBytes} bytes`))}\n\n${bullet(Object.entries(report.performance).map(([id,p])=>`${id}: ${p.base} → ${p.head}; delta ${p.deltaPct===null?'unmeasured':p.deltaPct.toFixed?.(2)??p.deltaPct}%; ${p.status}${p.reason?`; ${p.reason}`:''}; absolute delta ${p.delta}; thresholds ${JSON.stringify(p.threshold)}${p.spread?`; spread ${JSON.stringify(p.spread)}`:''}`))}\n\n## Test changes to review\n\n${bullet(report.scan.testChanges)}\n\n## Heuristic scan (${report.scan.findings.length} findings; ordering timers ${report.scan.timerCount})\n\n${bullet(report.scan.findings.slice(0,30).map(f=>`${f.file}:${f.line}: ${f.kind}`))}\n\nFull findings, command statuses and measurements: report.json; per-ref suite logs and trace.json. Findings require human/agent review and do not independently gate PASS.\n\n## Evidence errors\n\n${bullet([...report.errors,...Object.entries(report.probes).flatMap(([k,p])=>p.error?[`${k}: ${p.error}`]:[])])}\n\n</div>\n\nOverall verdict: **${report.verdict}**\n`;
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await writeFile(join(out,'report.md'),md);
  console.log(JSON.stringify({verdict:report.verdict,seconds:report.seconds,runtimes:report.runtimes,cache:report.cache,failures:report.failures,claims:report.claims,performance:report.performance,out},null,2));
  process.exitCode=report.verdict==='PASS'?0:report.verdict==='INCONCLUSIVE'?2:1;
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
