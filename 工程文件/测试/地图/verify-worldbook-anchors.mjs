import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {applyWorldbookAnchors} from "../../卡片源码/地图/worldbook-anchors.mjs";
import {syncDistrictFacts} from "../../卡片源码/地图/district-refinement.mjs";

const engineeringRoot=fileURLToPath(new URL("../..",import.meta.url)),worldbookDir=path.join(engineeringRoot,"卡片源码/字段快照/components/worldbook");
const central=fs.readFileSync(new URL('../../卡片源码/地图/central-data.js',import.meta.url),'utf8'),original=JSON.parse(central.slice(central.indexOf('=')+1).replace(/;\s*$/,''));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),clone=x=>structuredClone(x),groups=[],check=(name,fn)=>{fn();groups.push(name);};
const data=clone(original),receipt=applyWorldbookAnchors(data),targetIds=new Set(receipt.placeIds);
const bare=value=>{const next=clone(value);for(const n of next.nodes)if(targetIds.has(n.id))delete n.worldbookAnchor;return next;};

check('当前正式五条稳定ID匹配22份短事实，六点之外及原节点字段完全保持',()=>{
  assert.deepEqual(receipt.sources.map(s=>s.entryId),[3,21,37,38,44]);assert.equal(receipt.factCount,22);assert.equal(targetIds.size,6);
  assert.equal(JSON.stringify(bare(data)),JSON.stringify(bare(original)));
  for(const n of data.nodes){if(!targetIds.has(n.id)){assert.deepEqual(n,original.nodes.find(old=>old.id===n.id));continue;}
    assert.equal(n.worldbookAnchor.status,'canon-excerpt');assert.equal(n.worldbookAnchor.placesScope,'RiNG社区及既有边界地点');assert.match(n.worldbookAnchor.mapGroupingNote,/仅用于地点检索/);
    for(const fact of n.worldbookAnchor.facts){const source=n.worldbookAnchor.sources.find(s=>s.entryId===fact.entryId),body=fs.readFileSync(path.resolve(engineeringRoot,source.component),'utf8');assert.ok(body.includes(fact.text));assert.ok(fact.text.length<=100);}
  }
  for(const s of receipt.sources){assert.equal(sha(fs.readFileSync(path.resolve(engineeringRoot,s.component))),s.sha256);const metaBytes=fs.readFileSync(path.resolve(engineeringRoot,s.component.replace(/\.txt$/,'.json'))),meta=JSON.parse(metaBytes);assert.equal(sha(metaBytes),s.metaSha256);assert.deepEqual(s.keys,meta.keys);assert.equal(s.enabled,meta.enabled);assert.equal(s.constant,meta.constant);}
});
check('用途/格局/馆内规则/既有人物日常均锚定；不投放剧情事件或更新指令',()=>{
  const facts=id=>data.nodes.find(n=>n.id===id).worldbookAnchor.facts.map(f=>f.text).join('\n');
  assert.match(facts('space-site'),/2049年年末正式关闭.*改建为停车场/);assert.match(facts('circle'),/Live House/);assert.match(facts('circle'),/约500人/);
  assert.match(facts('ring-live'),/地上三层、地下三层/);assert.match(facts('ring-live'),/地下一层.*公共广场/);assert.match(facts('ring-live'),/地下二层.*乐器店.*来生/);assert.match(facts('ring-live'),/各方承认.*馆方安保.*重装武器留在场外.*内置武装须收起并保持关闭/);assert.match(facts('beni-street'),/红花街归属暗池.*商户雇人.*警方主要驻守外围街口/);
  assert.equal(data.nodes.find(n=>n.id==='ring-live').worldbookAnchor.facts[1].title,'馆内停火规则');
  assert.match(facts('ring-live'),/负责人是真次凛凛子/);assert.match(facts('ring-live'),/订单系统与CiRCLE共通/);assert.match(facts('ring-live'),/要乐奈常泡在地下二层的乐器店.*自习吉他/);assert.match(facts('ring-live'),/所有工作人员和常客都认识她/);assert.match(facts('ring-live'),/广场的一角留给了她/);
  assert.match(facts('space-site'),/对要乐奈来说.*旧址门口逗留/);assert.match(facts('ring-community'),/二手实体乐器.*地下隧道内排练、写歌/);
  for(const n of data.nodes.filter(n=>targetIds.has(n.id)))assert.doesNotMatch(JSON.stringify(n.worldbookAnchor.facts),/CRYCHIC|宣告退队|UpdateVariable|replaceMvuData|injectPrompts|重要事件/);
});
check('相同来源再次应用完全幂等，receipt一致',()=>{
  const once=JSON.stringify(data);assert.deepEqual(applyWorldbookAnchors(data),receipt);assert.equal(JSON.stringify(data),once);
});
check('当前地图同步楼层、暗池检索归属及治安，保留点位与建筑几何',()=>{
  const next=clone(original),r=syncDistrictFacts(next),ids=new Set(r.placeIds);
  assert.equal(r.factCount,33);assert.equal(ids.size,16);
  const by=id=>next.nodes.find(n=>n.id===id);
  assert.equal(by('beni-street').group,'underpool');assert.equal(by('circle').group,'underpool');
  assert.equal(by('beni-street').dims.find(d=>d.k==='治安').v,'2 · 失序');
  assert.equal(by('ring-instruments').floor,'地下二层');assert.equal(by('ring-records').floor,'地下二层');
  assert.equal(by('ring-basement-bar').floor,'地下三层');
  assert.equal(by('ring-cafe').floor,'地上1—3层配套区');assert.equal(by('ring-studio').floor,'地上1—3层配套区');
  assert.match(by('ring-live').desc,/地下一层.*公共广场/);assert.match(by('ring-live').desc,/地下二层.*来生/);
  for(const key of Object.keys(original).filter(k=>k!=='nodes'))assert.deepEqual(next[key],original[key],key);
  for(const n of next.nodes){const old=original.nodes.find(o=>o.id===n.id);assert.deepEqual(n.at,old.at);assert.deepEqual(n.placement,old.placement);if(!ids.has(n.id))assert.deepEqual(n,old);}
  const once=JSON.stringify(next);assert.deepEqual(syncDistrictFacts(next),r);assert.equal(JSON.stringify(next),once);
});

// Memory fixtures exercise the public filesystem API without writing any files.
const fixtureDir=path.join(engineeringRoot,"卡片源码/地图/__worldbook_anchor_fixture__"),fixtureBase=new Map();
for(const s of receipt.sources){const bodyPath=path.resolve(engineeringRoot,s.component),stem=path.basename(bodyPath,'.txt');fixtureBase.set(stem+'.txt',fs.readFileSync(bodyPath));fixtureBase.set(stem+'.json',fs.readFileSync(bodyPath.replace(/\.txt$/,'.json')));}
function fixture(files,fn,{onRead,onList}={}){
  const savedRead=fs.readFileSync,savedList=fs.readdirSync,counts=new Map();
  fs.readdirSync=function(dir,...args){if(path.resolve(String(dir))!==fixtureDir)return savedList.call(fs,dir,...args);onList?.(files);return [...files.keys()];};
  fs.readFileSync=function(filename,...args){const actual=path.resolve(String(filename));if(path.dirname(actual)!==fixtureDir)return savedRead.call(fs,filename,...args);const name=path.basename(actual),count=(counts.get(name)||0)+1;counts.set(name,count);onRead?.(name,count,files);assert.ok(files.has(name),'Fixture missing '+name);const bytes=Buffer.from(files.get(name));return args[0]==='utf8'?bytes.toString('utf8'):bytes;};
  try{return fn();}finally{fs.readFileSync=savedRead;fs.readdirSync=savedList;}
}
const seed=()=>new Map([...fixtureBase].map(([k,v])=>[k,Buffer.from(v)]));
const rejectWithoutMutation=(files,pattern,options)=>fixture(files,()=>{const candidate=clone(original),before=JSON.stringify(candidate);assert.throws(()=>applyWorldbookAnchors(candidate,{worldbookDir:fixtureDir}),pattern);assert.equal(JSON.stringify(candidate),before);},options);
const sourceById=id=>receipt.sources.find(s=>s.entryId===id),stemById=id=>path.basename(sourceById(id).component,'.txt');

check('正文中的停车事实缺失时拒绝，六点均不部分写入',()=>{
  const files=seed(),body=stemById(21)+'.txt';files.set(body,Buffer.from(files.get(body).toString('utf8').replace('改建为停车场','改建为营业场馆')));rejectWithoutMutation(files,/Missing canon excerpt/);
});
check('重复稳定ID拒绝，不能按文件序号或最后一份覆盖',()=>{
  const files=seed();files.set('999.json',Buffer.from(JSON.stringify({id:44,comment:'重复ID'})));files.set('999.txt',Buffer.from('其他正文'));rejectWithoutMutation(files,/Duplicate stable worldbook entry ID: 44/);
});
check('组件序号挪位仍按稳定ID解析，042的实际ID44不混淆',()=>{
  const files=seed(),old=stemById(44);files.set('944.json',files.get(old+'.json'));files.set('944.txt',files.get(old+'.txt'));files.delete(old+'.json');files.delete(old+'.txt');
  fixture(files,()=>{const next=clone(original),r=applyWorldbookAnchors(next,{worldbookDir:fixtureDir});assert.match(r.sources.find(s=>s.entryId===44).component,/944\.txt$/);assert.deepEqual(next.nodes.find(n=>n.id==='beni-street').worldbookAnchor.facts,data.nodes.find(n=>n.id==='beni-street').worldbookAnchor.facts);});
});
check('非引用段在两次调用之间改变可接受，只更新来源哈希',()=>{
  const files=seed(),body=stemById(44)+'.txt';fixture(files,()=>{const next=clone(original),first=applyWorldbookAnchors(next,{worldbookDir:fixtureDir}),facts=next.nodes.find(n=>n.id==='beni-street').worldbookAnchor.facts;files.set(body,Buffer.concat([files.get(body),Buffer.from('\n旁支维护备注：与地图摘录无关。\n')]));const second=applyWorldbookAnchors(next,{worldbookDir:fixtureDir});assert.notEqual(first.sources.find(s=>s.entryId===44).sha256,second.sources.find(s=>s.entryId===44).sha256);assert.deepEqual(next.nodes.find(n=>n.id==='beni-street').worldbookAnchor.facts,facts);});
});
check('同次读取内正文或metadata漂移会停下，绝不部分写入或覆盖来源',()=>{
  for(const ext of ['.txt','.json']){const files=seed(),target=stemById(44)+ext;rejectWithoutMutation(files,/Worldbook changed while reading/,{onRead:(name,count,current)=>{if(name===target&&count===2)current.set(name,Buffer.concat([current.get(name),Buffer.from('\n ')]));}});}
});
console.log(JSON.stringify({ok:true,groups:groups.length,checks:groups,receipt,evidence:'只读正式世界书与地图复制件，内存故障样本验证；未重建地图、未改正式世界书或M10证据。'},null,2));
