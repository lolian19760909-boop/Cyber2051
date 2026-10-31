/** Exit 1 on the audited defect, exit 0 after the independently gated fix. All endpoints are synthetic. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const mod=rel=>import(pathToFileURL(path.join(root,rel)));
const {createWebSession}=await mod('src/app/session.mjs');
const {createMemoryStatePort}=await mod('src/store/memory.mjs');
const {cardRuleChain,cardParser}=await mod('src/reuse/card.mjs');
const {buildKnowledgeIndex}=await mod('src/context/knowledge.mjs');
const chain={...cardRuleChain(),parser:cardParser()},checks=[];
const preset={prompts:['worldInfoBefore','chatHistory'].map(identifier=>({identifier,marker:true})),prompt_order:[{order:['worldInfoBefore','chatHistory'].map(identifier=>({identifier,enabled:true}))}]};
const row=(body,keys=['never'])=>({id:'1',keys,content:body,enabled:true,constant:false,extensions:{position:0}});
async function scenario({name,books,selectionFor,catalog=null,input='no-hit',test}){
 const sent=[],card={data:{name:'Synthetic',character_book:{entries:[row('CARD_BODY',['hit'])]}}};
 const app=createWebSession({mode:'tavern',accountId:'audit-host-id',runId:'audit-host-id',chain,card,catalog,preset,selectionFor,ports:{state:createMemoryStatePort(),worldbook:{canWrite:true,async apply(){}},worldbookBooks:async()=>structuredClone(books),model:{async chat(payload){const messages=payload.body.messages;if(messages[0]?.content?.includes('世界书目录挑选助手'))return {text:'{"uids":[],"reason":"本轮不需要该条目"}'};sent.push(messages);return {text:'<cxx-story>离线合成正文。</cxx-story>'};}}}});
 try{await app.restore();const turn=await app.runTurn(input);assert.equal(turn.status,'committed');const text=JSON.stringify(sent);test(text);checks.push({name,pass:true});}
 catch(error){checks.push({name,pass:false,error:error.message,body:sent});}
 finally{app.dispose();}
}
await scenario({name:'真实主书名映射到card目录；空选择不得注入被拒条目',books:[{bookId:'RealPrimaryBookName',entries:[row('HOST_REJECTED_BODY',['hit'])]}],catalog:buildKnowledgeIndex({bookId:'card',entries:[row('CARD_BODY',['hit'])]}),input:'hit',test:text=>assert.equal(text.includes('HOST_REJECTED_BODY'),false,'模型返回空选择后仍注入HOST_REJECTED_BODY')});
const two=[{bookId:'A',entries:[row('HOST_A_BODY')]},{bookId:'B',entries:[row('HOST_B_BODY')]}];
await scenario({name:'两书同UID只选B，A不得跟着进入提示',books:two,selectionFor:()=>({managedIds:['A:1','B:1'],selectedIds:['B:1']}),test:text=>{assert.equal(text.includes('HOST_A_BODY'),false,'选B同时注入A');assert.equal(text.includes('HOST_B_BODY'),true,'未注入选中的B');}});
await scenario({name:'移除A不应移除同UID且仍选中的B',books:two,selectionFor:()=>({managedIds:['A:1','B:1'],selectedIds:['B:1'],removedIds:['A:1']}),test:text=>{assert.equal(text.includes('HOST_A_BODY'),false);assert.equal(text.includes('HOST_B_BODY'),true,'移除A同时移除B');}});
const out={at:new Date().toISOString(),scope:'Actual session and rules/parser with MemoryState and synthetic host/model only; no browser/network/player data/D writes.',checks,passed:checks.filter(x=>x.pass).length,total:checks.length};
console.log(JSON.stringify(out,null,2));process.exitCode=out.passed===out.total?0:1;
