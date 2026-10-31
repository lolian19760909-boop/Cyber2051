import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),web=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url),parser=require(root+'卡片源码/Gal/parser.js'),knowledge=require(root+'卡片源码/长期记忆/knowledge.js');
const {loadContract}=await import(pathToFileURL(web+'src/memory/contract.mjs').href),contract=await loadContract();
const {prepareArchive}=await import(pathToFileURL(web+'src/memory/archive.mjs').href),{buildMemorySources,narrativeSegments}=await import(pathToFileURL(web+'src/memory/source.mjs').href);
const identity={accountId:'regression-synthetic',runId:'chunk-synthetic'},actors=[{actorId:'player',name:'玩家'},{actorId:'wb_4',name:'高松灯'}];
const privateQuote='只有高松灯知道密码藏在旧车站的第三根柱子。',publicQuote='玩家与高松灯在诊所共同交付了红线纸袋。';
const raw='<cxx-story><cxx-say speaker="高松灯" kind="thought">'+privateQuote+'</cxx-say>'+publicQuote+'</cxx-story>';
const node={nodeId:'synthetic-node',parentId:null,branchId:'main',operationId:'op',message:{raw,attemptId:'a',binding:{viewpointActorId:'player'}}},sourceRows=await buildMemorySources({nodes:[node],identity,parser}),sourceRow=sourceRows[0],task={taskId:'synthetic-task',source:{...sourceRow.source,quote:sourceRow.plain.slice(0,160)}};
const all=narrativeSegments(raw,parser,actors),publicSegments=all.filter(s=>s.kind!=='thought'),ownThought=all.filter(s=>s.kind==='thought');
function proposal(kind,actor,quote){return {records:[{table:'事件记录',quote,cells:{事件编号:'EV_one',类别:kind,内容:'按引用原句归档',参与人物:[actor],关联纪要:''}},{table:'人物认知',quote,cells:{认知编号:'KN_one',人物编号:actor,事件编号:'EV_one',认知类型:'知道',所知内容:'按引用原句获知',获知途径:kind==='心声'?'本人心声':'亲眼见到',告知者:'',取代认知:''}}]};}
function run(value,segments){return prepareArchive({raw:value,task,chunkIndex:1,sourceRow,segments,actors,existing:[],contract,knowledge,sourceRows,now:()=>new Date(0).toISOString()});}
let failures=0;
const check=(name,fn)=>{try{fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+': '+error.message);}};
check('Cross-chunk private quote cannot create public event and player cognition',()=>assert.throws(()=>run(proposal('已发生','player',privateQuote),publicSegments),{code:'memory_archive_invalid'}));
check('Current chunk public quote can create public event and participant cognition',()=>assert.equal(run(proposal('已发生','player',publicQuote),publicSegments).length,2));
check('Current chunk own thought can remain private and belong to its speaker',()=>assert.equal(run(proposal('心声','wb_4',privateQuote),ownThought).length,2));
check('Current chunk thought cannot become public fact',()=>assert.throws(()=>run(proposal('已发生','wb_4',privateQuote),ownThought),{code:'memory_archive_invalid'}));
check('Current chunk thought cannot become another actor cognition',()=>assert.throws(()=>run(proposal('心声','player',privateQuote),ownThought),{code:'memory_archive_invalid'}));
console.log(JSON.stringify({scope:'Actual pure modules, synthetic input only',checks:5,failures}));if(failures)process.exitCode=1;
