import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\\/g,'/').replace(/\/$/,'');
const web=root+'/工程文件/网页独立版';
const importFile=p=>import(pathToFileURL(p).href);
const {createMemoryStatePort}=await importFile(web+'/src/store/memory.mjs');
const adapterPath=root+'/资料/设计/UI升级-设计师旧卡-20261026/fusion/integration/adapters.mjs';
const {createWebAdapter}=await importFile(adapterPath);
const statePort=createMemoryStatePort({accountId:'audit'});
for(const [runId,at] of [['run-a','2026-10-28T00:00:00.000Z'],['run-b','2026-10-30T00:00:00.000Z']]) await statePort.commit({accountId:'audit',runId,branchId:'main',mode:'local',expectedRevision:0,operationId:runId+'-open',nodeId:runId+'-node',parentNodeId:null,stateAfter:{value:runId},beforeState:{},profile:{name:runId},message:{role:'assistant',kind:'opening',raw:'<cxx-story>'+runId+'</cxx-story>'},createdAt:at});
const adapter=createWebAdapter({getState:()=>({mode:'local',accountId:'audit',statePort}),startSession:()=>{}});
const listed=await adapter.listStories();
assert.equal(listed[0].id,'run-b');
const sortResult={source:adapterPath,sourceSha:createHash('sha256').update(fs.readFileSync(adapterPath)).digest('hex'),storageRows:await statePort.listRuns('audit'),actualStoryOrder:listed.map(x=>x.id),expectedStoryOrder:['run-b','run-a'],actualContinueTarget:listed.find(x=>x.playable).id,expectedContinueTarget:'run-b',nanComparator:Number.isNaN('2026-10-30T00:00:00.000Z'-'2026-10-28T00:00:00.000Z')};


await statePort.commit({accountId:'audit',runId:'run-a',branchId:'main',mode:'local',expectedRevision:1,operationId:'a-next',nodeId:'a-next-node',parentNodeId:'run-a-node',stateAfter:{},beforeState:{},message:{raw:'<cxx-story>updated</cxx-story>'},createdAt:'2026-10-31T00:00:00.000Z'});assert.equal((await adapter.listStories())[0].id,'run-a');console.log(JSON.stringify({passed:2,total:2,scope:'Actual MemoryState and maintained menu adapter; synthetic stories only'}));
