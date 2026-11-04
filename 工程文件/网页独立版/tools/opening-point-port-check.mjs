import assert from 'node:assert/strict';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {createTavernStatePort} from '../src/store/tavern.mjs';
const identity={accountId:'point-owner',runId:'point-story',branchId:'point-route'};
async function verify(port){
 const one={terminal:{wallet:{yen:30,earned:0,spent:0}}},two={terminal:{wallet:{yen:77,earned:47,spent:0}}};
 await port.commit({...identity,operationId:'first',nodeId:'n1',expectedRevision:0,parentNodeId:null,beforeState:{},stateAfter:one,message:{role:'assistant',kind:'opening',raw:'<cxx-story>开局正文。</cxx-story>'}});
 const points=await Promise.all(Array.from({length:3},()=>port.createCheckpoint(identity.runId,'开局存档',{nodeId:'n1',checkpointId:'opening_n1'})));assert(points.every(row=>row.checkpointId==='opening_n1'));assert.equal((await port.listCheckpoints(identity.runId)).length,1);
 await port.commit({...identity,operationId:'next',nodeId:'n2',expectedRevision:1,parentNodeId:'n1',beforeState:one,stateAfter:two,message:{role:'assistant',raw:'<cxx-story>后续正文。</cxx-story>'}});
 assert.deepEqual(await port.createCheckpoint(identity.runId,'重试',{nodeId:'n1',checkpointId:'opening_n1'}),points[0]);await assert.rejects(port.createCheckpoint(identity.runId,'冲突',{nodeId:'n2',checkpointId:'opening_n1'}),/另一处进度/);assert.equal((await port.listCheckpoints(identity.runId)).length,1);await port.restoreCheckpoint(identity.runId,'opening_n1');const head=await port.readHead(identity.runId);assert.equal(head.headNodeId,'n1');assert.deepEqual(await port.readNodeState(identity.runId,'n1'),one);assert.deepEqual(await port.readNodeState(identity.runId,'n2'),two);await port.close();
}
await verify(createMemoryStatePort({accountId:identity.accountId}));
let disk={rows:[],metadata:{}};const host={assertScope(){},async read(){return structuredClone(disk);},async write({rows,document}){disk={rows:structuredClone(rows),metadata:{cxx2051_web:structuredClone(document)}};}};
await verify(await createTavernStatePort({host,...identity,deferReconcile:true,parse:raw=>({supported:true,raw,display:{paragraphs:[{text:'正文'}],choices:[]},protocol:{patches:[],issues:[]}})}));
console.log('PASS memory/native bridge checkpoint identity, concurrent retries, conflict and original-route restoration');
