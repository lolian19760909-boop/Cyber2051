/** Real view action → session → state port, including committed-save retry and stale tabs. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';
const require=createRequire(import.meta.url),P=require('../../卡片源码/运行时/story-profile.js');
globalThis.CxxStoryProfile=P;globalThis.CxxItemArt=require('../../卡片源码/运行时/item-art.js');
const text=fs.readFileSync(new URL('../src/ui/gameplay.mjs',import.meta.url),'utf8'),tree=require('acorn').parse(text,{ecmaVersion:'latest',sourceType:'module'}),mount=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='mountGameplay').declaration,commit=mount.body.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='commit');
const card={data:{name:'Fixture',character_version:'3.0.0',extensions:{},character_book:{entries:[]}}},preset={prompts:[{identifier:'main',role:'system',content:'Fixture'},{identifier:'chatHistory',marker:true}],prompt_order:[{character_id:100001,order:[{identifier:'main',enabled:true},{identifier:'chatHistory',enabled:true}]}]};
function actualCommit(session,update=async()=>{}){const facade=new Proxy(session,{get(target,key){return key==='content'?{definitions:()=>[]}:Reflect.get(target,key);}});return new Function('session','busy','source','itemArt','combat','update','snapshot','window','CustomEvent',`return (${text.slice(commit.start,commit.end)});`)(facade,()=>false,()=>({floor:0}),{schema:1,assets:{}},null,update,()=>({storyProfile:session.profile}),new EventTarget(),CustomEvent);}
async function fixture(id){const port=createMemoryStatePort({accountId:id}),profile={schema:1,id:'profile_'+id,name:'Fixture'},options={mode:'local',accountId:id,runId:'run_'+id,ports:{state:port,model:{chat(){throw Error('Unexpected model call');}}},chain:{...cardRuleChain(),parser:cardParser()},card,preset,profile},session=createWebSession(options);await port.commit({...session.identity,nodeId:'opening',operationId:'seed',parentNodeId:null,expectedRevision:0,stateAfter:session.rules.emptyRoot(),message:{kind:'opening',raw:'<cxx-story>Fixture.</cxx-story>'},profile});await session.restore();return {session,port,options};}
const request=(session,id,role='player')=>({action:'gal-portraits',id,characterId:role,character:{name:role,aliases:[],default:{schema:1,kind:'gallery',id:role==='player'?'Anon':role},expressions:{}},expectedVisual:P.visualStamp(session.profile),storyContext:session.captureContext(),artAssets:[]});
const checks=[];
{
 const {session,port}=await fixture('retry');let updates=0;const save=actualCommit(session,async()=>{if(++updates===1)throw Error('fixture: refresh failed after commit');}),r=request(session,'visual_retry');
 await assert.rejects(save(r),/refresh failed/);const before=await port.readHead(session.identity.runId),saved=(await port.readRun(session.identity.runId)).profile;
 await save(r);assert.deepEqual(await port.readHead(session.identity.runId),before);assert.deepEqual((await port.readRun(session.identity.runId)).profile,saved);checks.push('durable save survives refresh failure and retries without a second commit');
 await assert.rejects(save({...r,storyContext:{...r.storyContext,scope:{...r.storyContext.scope,runId:'another-story'}}}),/来源已变化/);
 await assert.rejects(save({...r,id:'visual_changed'}),/来源已变化/);
 await assert.rejects(save({...r,character:{...r.character,default:{schema:1,kind:'gallery',id:'Tomorin'}}}),/同一/);assert.deepEqual((await port.readRun(session.identity.runId)).profile,saved);checks.push('confirmation retry retains story ownership and immutable request data');session.dispose();
}
{
 const {session:a,port,options}=await fixture('two'),b=createWebSession(options);await b.restore();const ra=request(a,'visual_a','Tomorin'),rb=request(b,'visual_b','Anon');
 await actualCommit(a)(ra);const saved=(await port.readRun(a.identity.runId)).profile;await assert.rejects(actualCommit(b)(rb),/另一页面已更新/);assert.deepEqual((await port.readRun(a.identity.runId)).profile,saved);assert.equal(await port.readReceipt(a.identity.runId,'visual_b'),null);checks.push('stale second session preserves the first character save');
 await b.restore();await actualCommit(b)(request(b,'visual_fresh','Anon'));const combined=(await port.readRun(a.identity.runId)).profile;assert.equal(combined.galPortraits.Tomorin.default.id,'Tomorin');assert.equal(combined.galPortraits.Anon.default.id,'Anon');checks.push('after reload another character merges into the current story profile');a.dispose();b.dispose();
}
console.log(JSON.stringify({ok:true,checks}));
