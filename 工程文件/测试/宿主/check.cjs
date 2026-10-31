'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const contract=require('./contract.json'),{extract}=require('../../工具/lib/script-modules.cjs'),{inlineSource}=require('../../工具/lib/inline-source.cjs'),{runContracts}=require('./contracts.cjs');
const root=path.resolve(__dirname,'../..'),cache=path.join(root,'.cache/tt-compat');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function load(source,file){const box=vm.createContext({module:{exports:{}},require:require('node:module').createRequire(file),structuredClone,setTimeout,clearTimeout,AbortSignal,console});vm.runInContext(source,box,{timeout:1000});return box.module.exports;}
function scriptsOf(items,active=true){return (items||[]).flatMap(item=>item.type==='folder'?scriptsOf(item.scripts,active&&item.enabled!==false):[{...item,enabled:active&&item.enabled!==false}]);}
async function checkCard(card){
  const names=Object.keys(contract.modules),found=new Map(),parity=[];
  for(const script of scriptsOf(card.data?.extensions?.tavern_helper?.scripts))for(const entry of extract(script.content||'',names)){
    assert.ok(!found.has(entry.name),'重复兼容模块：'+entry.name);assert.ok(script.enabled,'兼容模块被禁用：'+entry.name);
    const source=fs.readFileSync(path.join(root,'卡片源码',contract.modules[entry.name]),'utf8').replace(/\r\n/g,'\n'),expected=extract(inlineSource(source),[entry.name])[0];
    assert.equal(entry.source.trim(),expected?.source.trim(),'成卡未带入当前维护源：'+entry.name);
    found.set(entry.name,load(entry.source,path.join(root,'卡片源码',contract.modules[entry.name])));parity.push({module:entry.name,script:script.id,sha256:sha(entry.source)});
  }
  assert.deepEqual([...found.keys()].sort(),names.sort(),'成卡缺少兼容模块');
  const behavior=await runContracts(Object.fromEntries(found));
  return {kind:'tt-compatibility-contract-check',at:new Date().toISOString(),cardVersion:card.data.character_version,target:contract.reviewedRelease,status:behavior.warnings.length?'checks-passed-with-known-limitations':'checks-passed',parity,...behavior,realTT:false,realPhone:false};
}
async function upstream(){
  const get=async url=>{const r=await fetch(url,{headers:{'User-Agent':'Cyber2051-compat-check','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('上游核对 HTTP '+r.status);return r;};
  const release=await (await get('https://api.github.com/repos/Darkatse/TauriTavern/releases/latest')).json();
  assert.match(release.tag_name,/^v\d+\.\d+\.\d+(?:[-.][\w.-]+)?$/,'上游标签格式');
  const files=await Promise.all(contract.sources.map(async file=>{
    const url='https://raw.githubusercontent.com/Darkatse/TauriTavern/'+release.tag_name+'/'+file,text=await (await get(url)).text();return {file,url,text,sha256:sha(text)};
  }));
  const source=files.find(f=>f.file.endsWith('st-context.js')).text;
  const report={at:new Date().toISOString(),release:release.tag_name,url:release.html_url,publishedAt:release.published_at,reviewed:release.tag_name===contract.reviewedRelease&&files.every(f=>contract.sourceHashes[f.file]===f.sha256),
    reportedSillyTavern:files.find(f=>f.file.endsWith('compat-version.js')).text.match(/SILLYTAVERN_COMPAT_VERSION\s*=\s*['"]([^'"]+)/)?.[1]||null,
    sourceHints:{messageFormatting:/\bmessageFormatting\b/.test(source),messageFormatter:/\bmessageFormatter\b/.test(source)},
    files:files.map(({text,...f})=>f),note:'只读核对官方稳定版与源码线索，不执行远端代码，不自动修改兼容规则；源码线索不等于运行验收。'};
  fs.mkdirSync(cache,{recursive:true});fs.writeFileSync(path.join(cache,'upstream.json'),JSON.stringify(report,null,2)+'\n');return report;
}
async function main(){
  const args=process.argv.slice(2);assert.ok(args.every((a,i)=>['--upstream','--card','--stdin'].includes(a)||args[i-1]==='--card'),'用法：node check.cjs --upstream 或 --card <JSON>');
  assert.ok(args.includes('--upstream')||args.includes('--card')||args.includes('--stdin'),'请提供 --upstream 或 --card <JSON>');
  assert.ok(!(args.includes('--stdin')&&args.includes('--card')),'--stdin 与 --card 只能选一种输入');
  if(args.includes('--upstream')){const u=await upstream();console.log(JSON.stringify(u,null,2));if(!u.reviewed)process.exitCode=2;}
  if(args.includes('--card')||args.includes('--stdin')){
    const file=args.includes('--stdin')?null:path.resolve(args[args.indexOf('--card')+1]||''),bytes=fs.readFileSync(file||0),report=await checkCard(JSON.parse(bytes));report.input={file,sha256:sha(bytes)};
    fs.mkdirSync(cache,{recursive:true});const output=path.join(cache,'card-'+report.input.sha256.slice(0,12)+'.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({report:output,status:report.status,modules:report.parity.length,cases:report.cases.length,warnings:report.warnings,realTT:false},null,2));
  }
}
module.exports={checkCard,upstream,load};
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
