'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {extract}=require('../../工具/lib/script-modules.cjs'),{workerNode}=require('../../工具/lib/card-ast.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.cache/component-e2-actions');
const oldFile=path.join(root,'交付/组件/2.3.0-E2-正文同源-20261016/东京都2051-V2.3.0-E2-正文同源候选.json'),newFile=process.env.CXX_TEST_CARD||path.join(root,'交付/组件/2.3.0-E2-业务边界-20261016/东京都2051-V2.3.0-E2-业务边界候选.json');
const identity=file=>({file:path.relative(root,file),bytes:fs.statSync(file).size}),old=JSON.parse(fs.readFileSync(oldFile)),next=JSON.parse(fs.readFileSync(newFile)),scripts=card=>card.data.extensions.tavern_helper.scripts,seed=card=>scripts(card).find(s=>s.data?.__cxx_update_seed).data.__cxx_update_seed;
const allowed=['cxx-runtime-bootstrap','cf33c692-7a41-444d-b8b7-6a70163e0104','cxx-business-core-241','cxx-native-ui-231'],changedScripts=[];
for(const before of scripts(old)){const after=scripts(next).find(s=>s.id===before.id);assert(after);if(before.content!==after.content){assert(allowed.includes(before.id),before.id);changedScripts.push(before.id);}}
function stable(card){const value=structuredClone(card);for(const s of scripts(value))delete s.content;const meta=seed(value);delete meta.baseline;delete meta.migration.buildId;delete meta.migration.accepts;return value;}
assert.deepEqual(stable(next),stable(old),'Only approved script payloads, build identity and continuation registration may change');
const core=card=>scripts(card).find(s=>s.id==='cxx-business-core-241').content,modules=['CxxQuests','CxxPlayerOperations','Cxx236Schema','CxxChapter','Cxx238Dialogue','CxxGalParser','CxxStorySummaries','Cxx249HistoryRuntime'];
for(const name of modules){const a=extract(core(old),[name]),b=extract(core(next),[name]);assert(a.length&&b.length,name);assert.equal(a[0].source,b[0].source,name);}
assert.equal(workerNode(core(old)).value,workerNode(core(next)).value);assert.equal(seed(next).migration.saveSchema,1);assert(seed(next).migration.accepts.some(s=>s.buildId===seed(old).migration.buildId&&s.saveSchema===1));
const report={baseline:identity(oldFile),candidate:identity(newFile),changedScripts,checks:{worldbookRegexGreetingsAndOtherFieldsIdentical:true,gameplayAndParserModulesIdentical:modules,historyWorkerIdentical:true,saveSchema:1,previousE2Accepted:true},scope:'Direct field/source equality; no real host, formal delivery or player records accessed'};
fs.writeFileSync(path.join(out,'baseline-diff.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
