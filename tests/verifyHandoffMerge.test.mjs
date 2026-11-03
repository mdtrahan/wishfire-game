import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyFile, mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Exercise the actual CLI and report verdict; replace only expensive external work.
const base='a'.repeat(40),head='b'.repeat(40);
async function handoff({quick=false,status=0,receipt='present'}={}) {
  const dir=await mkdtemp(join(tmpdir(),'handoff-merge-contract-'));
  try {
    await mkdir(join(dir,'tools'));
    for(const file of ['verify_handoff.mjs','verify_handoff_logic.mjs','playwright_support.js'])
      await copyFile(new URL(`../tools/${file}`,import.meta.url),join(dir,'tools',file));
    await writeFile(join(dir,'tools/verify_handoff_probe.mjs'),`
      import {PERF_THRESHOLDS,summarizeMetrics} from './verify_handoff_logic.mjs';
      export async function combatProbes() {
        const metrics=Object.fromEntries(Object.keys(PERF_THRESHOLDS).map(key=>[key,100]));
        const probe={...summarizeMetrics([metrics,metrics,metrics].map(metrics=>({metrics}))),
          coverage:{complete:true},errors:[],claims:Object.fromEntries(
            ['noLingeringEffects','actorsInsideArena','buffsAllowedSides','noClipping','noConsoleErrors']
            .map(key=>[key,{status:'PASS',measured:0}]))};
        return {base:probe,head:probe,order:['base','head','base','head','base','head']};
      }
    `);
    await writeFile(join(dir,'stubs.mjs'),`
      import cp from 'node:child_process';
      import {syncBuiltinESMExports} from 'node:module';
      import {appendFileSync,mkdirSync,rmSync} from 'node:fs';
      import {join} from 'node:path';
      const spawn=cp.spawn;
      cp.execFileSync=(cmd,args,options)=>{
        if(cmd!=='git')throw Error('Unexpected fixture command: '+cmd);
        if(args[0]==='rev-parse')return args[2].startsWith('pinned-base')?'${base}':'${head}';
        if(args[0]==='worktree'&&args[1]==='add')mkdirSync(args.at(-2),{recursive:true});
        if(args[0]==='worktree'&&args[1]==='remove'&&process.env.RECEIPT==='missing-log')
          rmSync(join(process.env.CONTRACT_OUT,'head/merge-tests.log'),{force:true});
        return '';
      };
      cp.spawn=(cmd,args,options)=>{
        appendFileSync(process.env.CONTRACT_CALLS,JSON.stringify({cmd,args,cwd:options.cwd})+'\\n');
        const merge=cmd==='npm'&&args[1]==='test:merge';
        return spawn(process.execPath,['-e',
          'console.log('+JSON.stringify(merge?'stub heavy owner proof':'TAP version 13\\n1..0')+');process.exit('+
          (merge?Number(process.env.MERGE_STATUS):0)+')'],options);
      };
      syncBuiltinESMExports();
    `);
    const out=join(dir,'out'),cache=join(dir,'cache'),callsFile=join(dir,'calls.jsonl');
    await mkdir(cache);
    if(quick)await writeFile(join(cache,`${base}.json`),JSON.stringify({schema:1,sha:base,
      npm:{step:{status:0,log:'cached-base.log'},failures:[]},fullSeconds:99}));
    const cli=join(dir,'tools/verify_handoff.mjs');
    if(receipt==='missing'||receipt==='stale') {
      const source=await readFile(cli,'utf8');
      const changed=receipt==='missing'?source.replace(/^.*if\(label==='head'\)report\.mergeTier=.*\n/m,''):
        source.replace('report.mergeTier={base:refs.base,head:refs.head,','report.mergeTier={base:"stale",head:refs.head,');
      assert.notEqual(changed,source,'receipt negative control must mutate the CLI');
      await writeFile(cli,changed);
    }
    const result=spawnSync(process.execPath,['--import',join(dir,'stubs.mjs'),cli,
      '--base','pinned-base','--head','candidate','--out',out,'--cache-dir',cache,...(quick?['--quick']:[])],
      {encoding:'utf8',timeout:20_000,env:{...process.env,CONTRACT_OUT:out,
        CONTRACT_CALLS:callsFile,MERGE_STATUS:String(status),RECEIPT:receipt}});
    assert.ifError(result.error);
    assert.ok([0,1].includes(result.status),result.stderr||result.stdout);
    const report=JSON.parse(await readFile(join(out,'report.json'),'utf8'));
    return {exit:result.status,report,markdown:await readFile(join(out,'report.md'),'utf8'),
      log:receipt==='present'?await readFile(report.mergeTier.log,'utf8'):null,
      calls:(await readFile(callsFile,'utf8')).trim().split('\n').map(line=>JSON.parse(line))};
  } finally {await rm(dir,{recursive:true,force:true});}
}

for(const quick of [false,true])for(const status of [0,23])
  test(`handoff ${quick?'cached quick':'full'} requires the pinned head merge tier (exit ${status})`,async()=>{
    const {exit,report,markdown,log,calls}=await handoff({quick,status});
    assert.deepEqual(report.errors,[]);
    assert.equal(report.cache.baseNpmHit,quick);
    assert.equal(report.verdict,status===0?'PASS':'FAIL');
    assert.equal(exit,status===0?0:1);
    const merge=calls.filter(call=>call.cmd==='npm'&&call.args[1]==='test:merge');
    assert.equal(merge.length,1);
    assert.deepEqual(merge[0].args,['run','test:merge','--','--base',base]);
    assert.equal(merge[0].cwd.split('/').at(-1),'head');
    assert.equal(report.mergeTier.base,base);assert.equal(report.mergeTier.head,head);
    assert.equal(report.mergeTier.status,status);
    assert.equal(report.suites.head.steps.find(step=>step.name==='merge-tests').status,status);
    assert.match(log,/stub heavy owner proof/);
    assert.ok(markdown.includes(report.mergeTier.log));
    assert.ok(markdown.includes(base)&&markdown.includes(head));
  });

for(const receipt of ['missing','stale','missing-log'])
  test(`handoff rejects ${receipt} merge-tier evidence with passing suites and probes`,async()=>{
    const {exit,report}=await handoff({receipt});
    assert.deepEqual(report.errors,[]);
    assert.deepEqual(report.failures,{new:[],fixed:[],stillFailing:[]});
    assert.equal(report.verdict,'FAIL');assert.equal(exit,1);
  });
