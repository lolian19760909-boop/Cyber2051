/** Read-only source audit plus isolated in-memory size probes. No player writes/model/network. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {prepareCommit,diffState,stateAt} from '../src/store/records.mjs';
import {reconcileNative} from '../src/store/native-source.mjs';
import {nativeStateKey} from '../src/store/native-receipt.mjs';
import {nativeFingerprint,projectTavernRows} from '../src/store/tavern.mjs';

const WEB=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),ROOT=path.resolve(WEB,'..');
const size=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const clone=value=>structuredClone(value),initial={terminal:{wallet:{yen:0,earned:0,spent:0},auditPayload:'x'.repeat(8192)}};
const accountId='audit-volume',runId='audit-volume',scope='["WEB_HOST_TEST_VOLUME.png","web-controlled-volume"]';
const text=n=>'<cxx-story>合成存储样本'+n+'，无真实剧情或模型请求。'+('a'.repeat(512))+'</cxx-story>';
const parse=raw=>({supported:true,display:{paragraphs:[{text:raw}]},protocol:{patches:[]}});
const checks=[],samples=[];
for(const turns of [40,100]){
  const port=createMemoryStatePort({accountId});let before={},parentNodeId=null,latest;
  for(let n=0;n<=turns;n++){
    const after=n?{...clone(initial),terminal:{...clone(initial.terminal),wallet:{yen:n,earned:n,spent:0}}}:clone(initial);
    latest=await port.commit({accountId,runId,mode:'local',branchId:'main',operationId:'op'+n,nodeId:'n'+n,parentNodeId,expectedRevision:n,beforeState:before,stateAfter:after,message:{kind:n?'generated':'opening',raw:text(n),input:n?{text:'继续'+n}:null}});
    assert.equal(latest.status,'committed');before=after;parentNodeId='n'+n;
  }
  const independent=await port.exportRun(runId),point=await port.createCheckpoint(runId,'体积检查点'),withPoint=await port.exportRun(runId),restored=await port.restoreCheckpoint(runId,point.checkpointId),withBranch=await port.exportRun(runId);
  assert.equal(withBranch.tables.nodes.length,independent.tables.nodes.length);
  const opening=prepareCommit({accountId,runId,mode:'tavern',branchId:'main',operationId:'native-opening',nodeId:'opening',parentNodeId:null,beforeState:{},stateAfter:initial,message:{kind:'opening',raw:text(0)}},null,{data:{}},null);
  const openingRow={mes:text(0),is_user:false,is_system:false,swipe_id:0,extra:{cxx2051_node:'opening'},variables:[{stat_data:clone(initial),__cxx_web_commit:{schema:1,owner:'web',nodeId:'opening',stateNodeId:'opening',fingerprint:nativeFingerprint(text(0))}}]};
  const document={schema:1,baseRows:[],run:opening.run,nodes:[opening.node],receipts:[opening.receipt],branches:[opening.branch],checkpoints:[],records:{}};
  const actual=[clone(openingRow)];let previous=clone(initial);
  for(let n=1;n<=turns;n++){
    actual.push({is_user:true,is_system:false,mes:'继续'+n,variables:[{stat_data:clone(previous)}]});
    const floor=actual.length,after={...clone(initial),terminal:{...clone(initial.terminal),wallet:{yen:n,earned:n,spent:0}}},raw=text(n),id='native-receipt-'+n;
    actual.push({is_user:false,is_system:false,mes:raw,swipe_id:0,extra:{cxx2051_native_receipt:id},variables:[{stat_data:after,__cxx_native_commit:{schema:1,scope,floor,swipe:0,receipt:id,fingerprint:nativeFingerprint(raw),beforeFingerprint:nativeStateKey(previous,nativeFingerprint),stateFingerprint:nativeStateKey(after,nativeFingerprint),patches:diffState(previous,after)}}]});previous=after;
  }
  const reconciled=await reconcileNative({document,actual,projected:[openingRow],projectRows:projectTavernRows,parse,fingerprint:nativeFingerprint,nativeScope:scope,accountId,runId});
  assert.equal(reconciled.nodes.length,turns+1);assert.equal(stateAt(reconciled.nodes,reconciled.run.headNodeId).terminal.wallet.yen,turns);
  const anchors=reconciled.nodes.filter(n=>n.hostRows),deltas=reconciled.nodes.filter(n=>n.hostRowsDelta),hostRowsBytes=anchors.reduce((sum,n)=>sum+size(n.hostRows),0),uniqueRows=projectTavernRows(reconciled),storedRows=anchors.reduce((sum,n)=>sum+n.hostRows.length,0)+deltas.reduce((sum,n)=>sum+n.hostRowsDelta.rows.length,0);
  assert.equal(uniqueRows.length,actual.length);assert.deepEqual(uniqueRows.map(row=>row.mes),actual.map(row=>row.mes));assert.equal(anchors.length,0);assert.equal(deltas.length,turns);assert(storedRows<=actual.length+1);assert.equal(reconciled.nodes.filter(n=>n.snapshot!==undefined).length,Math.floor((turns+1)/32)+1);
  samples.push({turns,payload:'controlled 8 KiB stable field + one wallet increment; 512-byte body; not actual story forecast',independent:{saveBytes:size(independent),nodes:independent.tables.nodes.length,nodeSnapshots:independent.tables.nodes.filter(n=>n.snapshot!==undefined).length,lastNodeBytes:size(independent.tables.nodes.at(-1)),lastCommitResultBytes:size(latest),checkpointAddedBytes:size(withPoint)-size(independent),restoredBranchAddedBytes:size(withBranch)-size(withPoint),nodesAddedOnRestore:withBranch.tables.nodes.length-independent.tables.nodes.length,branchId:restored.branchId},nativeAdoption:{documentBytes:size(reconciled),hostRowsAnchorCount:anchors.length,hostRowsDeltaCount:deltas.length,hostRowsStoredRows:storedRows,latestActualRows:uniqueRows.length,allHostRowsBytes:hostRowsBytes,deltaBytes:deltas.reduce((sum,n)=>sum+size(n.hostRowsDelta),0),latestHostRowsBytes:size(uniqueRows),nodeSnapshots:reconciled.nodes.filter(n=>n.snapshot!==undefined).length,explicitNodeSnapshotBytes:reconciled.nodes.filter(n=>n.snapshot!==undefined).reduce((sum,n)=>sum+size(n.snapshot),0)}});
  checks.push('真实历史函数'+turns+'轮：独立增量/每32点快照/检查点与恢复不复制nodes；原生行增量和每32点快照准确重建末态，无历史行前缀重复');
}
const fixture=JSON.parse(fs.readFileSync(path.join(WEB,'tools/fixtures/performance-host.json'),'utf8'));
assert(/^WEB_HOST_TEST_.*\.png$/.test(fixture.avatar)&&/^web-controlled-/.test(fixture.chatId));
const file=path.join(ROOT,'.cache/web-host-20261025/data-clean/default-user/chats',fixture.avatar.replace(/\.png$/,''),fixture.chatId+'.jsonl');
const bytes=fs.readFileSync(file),rows=bytes.toString('utf8').split(/\r?\n/).filter(Boolean).map(row=>JSON.parse(row)),doc=rows[0].chat_metadata.cxx2051_web;
const realFixture={fixture,fileBytes:bytes.length,rows:rows.length-1,nodes:doc.nodes.length,metadataBytes:size(rows[0].chat_metadata),currentStateBytes:size(stateAt(doc.nodes,doc.run.headNodeId)),hostRowsAnchors:doc.nodes.filter(n=>n.hostRows).length,scope:'read existing owned isolated test fixture only; no daily chat/model credentials read'};
const sources=['src/store/records.mjs','src/store/idb.mjs','src/store/tavern.mjs','src/store/native-source.mjs','src/store/native-receipt.mjs','src/store/backup.mjs','src/app/turn.mjs','tavern-extension/index.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(path.join(WEB,file))).digest('hex')}));
const report={at:new Date().toISOString(),scope:'source review + actual storage/reconciliation functions with in-memory synthetic data, byte counts are serialized UTF-8 JSON; not disk/network latency or screenshot MB reproduction',library:{route:'code-quality-workflow',snapshot:'2026-08-18',loaded:['ST-A0'],candidates:[]},initialStateBytes:size(initial),sources,realFixture,samples,checks,errors:[]};
fs.writeFileSync(path.join(WEB,'reports/save-volume-audit-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({initialStateBytes:report.initialStateBytes,realFixture,samples,checks},null,2));
