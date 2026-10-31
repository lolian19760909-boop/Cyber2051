/** Session-level branch checks; isolated memory store, no player data or model service. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {createWebSession} from '../src/app/session.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';

const chain={...cardRuleChain(),parser:cardParser()},state=createMemoryStatePort({accountId:'floor-check'}),calls=[],checks=[];
const preset={prompts:[{identifier:'chatHistory',marker:true}],prompt_order:[{order:[{identifier:'chatHistory',enabled:true}]}]};
let databaseHead=null,hold=null;
const model={async chat(payload){calls.push(payload);if(hold)await hold;return {text:'<cxx-story>正文版本 '+calls.length+'。</cxx-story>'};}};
const define=()=>createWebSession({mode:'local',accountId:'floor-check',runId:'floor-fixture',ports:{state,model,database:{prompt:async messages=>messages,restore:async({nodes,state})=>{databaseHead=nodes.at(-1)?.nodeId;return state;}}},chain,preset});
let app=define();
const ok=name=>checks.push({name,ok:true});
const head=()=>state.readHead(app.identity.runId);
assert.equal((await app.runTurn('共同输入')).status,'committed');const a=await head(),aState=structuredClone(app.currentState);
await app.runTurn('A 的旧后续');const aLater=await head();
await app.regenerate({nodeId:a.headNodeId});const b=await head();
await app.runTurn('B 的旧后续');const bLater=await head();
const before=await state.exportRun(app.identity.runId),beforeNodes=before.tables.nodes;
let versions=await app.listFloorVersions();
assert.deepEqual(versions[b.headNodeId],[a.headNodeId,b.headNodeId]);
assert.deepEqual(versions[bLater.headNodeId],[bLater.headNodeId]);
ok('同父正文列为版本，不把后续层混入');

await app.selectFloorVersion(b.headNodeId,a.headNodeId);
const selected=await head();assert.equal(selected.headNodeId,a.headNodeId);assert.notEqual(selected.branchId,a.branchId);
assert.deepEqual(app.nodes.map(n=>n.nodeId),[a.headNodeId]);assert.deepEqual(app.currentState,aState);assert.equal(databaseHead,a.headNodeId);
const after=await state.exportRun(app.identity.runId);
assert.deepEqual(after.tables.nodes,beforeNodes);
for(const branch of before.tables.branches)assert.deepEqual(after.tables.branches.find(row=>row.branchId===branch.branchId),branch);
ok('选旧层停在该版本；状态和数据库跟随，原两条路线及后续逐项保持');

app.dispose();app=define();await app.restore();assert.equal(app.narrativeNode.nodeId,a.headNodeId);assert.deepEqual(app.currentState,aState);
ok('重新建立会话仍停在所选版本');
const unchanged=await head();await assert.rejects(app.selectFloorVersion(a.headNodeId,bLater.headNodeId),error=>error.code==='floor_version_missing');assert.deepEqual(await head(),unchanged);
await app.selectFloorVersion(a.headNodeId,a.headNodeId);assert.deepEqual(await head(),unchanged);
ok('拒绝跨层选择；重复选择当前版不写入');

await app.runTurn('从所选版本继续');const continued=await head(),newNode=await state.readNode(app.identity.runId,continued.headNodeId);
assert.equal(newNode.parentId,a.headNodeId);const prompt=JSON.stringify(calls.at(-1).body.messages);
assert.ok(!prompt.includes('A 的旧后续')&&!prompt.includes('B 的旧后续')&&!prompt.includes('正文版本 3。'));
assert.equal((await state.listBranches(app.identity.runId)).find(row=>row.branchId===a.branchId).headNodeId,aLater.headNodeId);
assert.equal((await state.listBranches(app.identity.runId)).find(row=>row.branchId===b.branchId).headNodeId,bLater.headNodeId);
ok('新回合接在所选节点，提示词没有带入旧路线后续');

await app.selectBranch(b.branchId);await app.selectFloorVersion(b.headNodeId,a.headNodeId);
const branchCount=(await state.listBranches(app.identity.runId)).length,pointCount=(await state.listCheckpoints(app.identity.runId)).length;
await app.selectFloorVersion(a.headNodeId,b.headNodeId);await app.selectFloorVersion(b.headNodeId,a.headNodeId);
assert.equal((await state.listBranches(app.identity.runId)).length,branchCount+1);
assert.equal((await state.listCheckpoints(app.identity.runId)).length,pointCount+1);
const stableCount=(await state.listBranches(app.identity.runId)).length;
await app.selectFloorVersion(a.headNodeId,b.headNodeId);await app.selectFloorVersion(b.headNodeId,a.headNodeId);
assert.equal((await state.listBranches(app.identity.runId)).length,stableCount);
ok('已有精确停点复用路线，来回切换不会持续生成分支');

const current=await head();await state.commit({accountId:'floor-check',runId:app.identity.runId,branchId:'program-branch',nodeId:'program-only',operationId:'program-only',parentNodeId:null,fork:true,expectedRevision:current.revision,beforeState:{},stateAfter:aState,message:{kind:'program',raw:'程序记录'}});
await app.selectBranch(current.branchId);versions=await app.listFloorVersions();assert.ok(!versions[a.headNodeId].includes('program-only'));
await assert.rejects(app.selectFloorVersion(a.headNodeId,'program-only'),error=>error.code==='floor_version_missing');
ok('程序记录不作为正文版本，也不能被选中');

let release;hold=new Promise(resolve=>{release=resolve;});const pending=app.runTurn('生成中');
await assert.rejects(app.selectFloorVersion(a.headNodeId,b.headNodeId),error=>error.code==='turn_busy');release();await pending;hold=null;
ok('生成期间阻止切换');
for(const name of ['A','B']){const current=await head();await state.commit({accountId:'floor-check',runId:app.identity.runId,branchId:'state-'+name,nodeId:'state-'+name,operationId:'state-'+name,parentNodeId:null,fork:true,expectedRevision:current.revision,beforeState:{},stateAfter:{...aState,__floorFixture:name},message:{raw:'状态 '+name}});}
await app.restore();assert.equal(app.currentState.__floorFixture,'B');await app.selectFloorVersion('state-B','state-A');assert.equal(app.currentState.__floorFixture,'A');assert.equal(databaseHead,'state-A');
ok('切换使用目标节点的完整状态，不沿用另一版变量');app.dispose();
const report={at:new Date().toISOString(),ok:true,checks,scope:'session and existing storage ports; no player data, paid model, visual or device acceptance'};
const out=fileURLToPath(new URL('../../.cache/play-loading-20261027/checks/play-floor-version.json',import.meta.url));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
