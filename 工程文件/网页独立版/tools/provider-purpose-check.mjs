/** Actual session and model adapters with synthetic in-memory HTTP responses. */
import assert from 'node:assert/strict';
import {createWebSession} from '../src/app/session.mjs';
import {createMemoryStatePort} from '../src/store/memory.mjs';
import {cardRuleChain,cardParser} from '../src/reuse/card.mjs';
import {createDirectModelPort} from '../src/models/port.mjs';
const main={adapter:'openai-chat',family:'openai-chat',model:'primary-model',baseUrl:'https://primary.invalid/v1',credential:'fixture-main',apiKey:'fixture-legacy-alias',provider:{bodyOverrides:{route:'primary-route'},bodyOmissions:['top_k']}};
const cases=[
 ['inherit all',{},'openai-chat','primary-model','https://primary.invalid/v1','primary-route'],
 ['model-only override',{model:'memory-model',baseUrl:'',provider:{},credential:null},'openai-chat','memory-model','https://primary.invalid/v1','primary-route'],
 ['provider override',{model:'memory-model',provider:{bodyOverrides:{route:'memory-route'}}},'openai-chat','memory-model','https://primary.invalid/v1','memory-route'],
 ['explicit DeepSeek',{adapter:'chat:deepseek',family:'chat:deepseek',model:'memory-deepseek',baseUrl:'https://memory.invalid/v1',provider:{bodyOverrides:{route:'memory-route'}},credential:'fixture-memory'},'chat:deepseek','memory-deepseek','https://memory.invalid/v1','memory-route'],
 ['explicit Gemini',{adapter:'google-gemini',family:'google-gemini',model:'memory-gemini',baseUrl:'https://memory.invalid/v1beta',credential:'fixture-memory'},'google-gemini','memory-gemini','https://memory.invalid/v1beta',undefined],
 ['legacy family-only Gemini',{family:'google-gemini',model:'memory-gemini',baseUrl:'https://memory.invalid/v1beta',credential:'fixture-memory'},'google-gemini','memory-gemini','https://memory.invalid/v1beta',undefined],
 ['explicit adapter takes priority',{adapter:'google-gemini',family:'openai-chat',model:'memory-gemini',baseUrl:'https://memory.invalid/v1beta',credential:'fixture-memory'},'google-gemini','memory-gemini','https://memory.invalid/v1beta',undefined],
 ['independent protocol keeps its own connection',{family:'google-gemini',model:'memory-gemini',baseUrl:'https://memory.invalid/v1beta'},'google-gemini','memory-gemini','https://memory.invalid/v1beta',undefined]
];
const checks=[];
for(const [name,memory,adapter,model,baseUrl,route]of cases){
 const sent=[],http=[],direct=createDirectModelPort({fetchImpl:async(url,options)=>{http.push({url,body:JSON.parse(options.body)});return Response.json({choices:[{message:{content:'fixture response'},finish_reason:'stop'}],candidates:[{content:{parts:[{text:'fixture response'}]},finishReason:'STOP'}]});}});
 const port={...direct,chat(payload,options){sent.push(structuredClone(payload));return direct.chat(payload,options);}},session=createWebSession({mode:'local',accountId:'purpose-fixture',runId:'purpose-fixture',card:{data:{name:'fixture',character_book:{entries:[]}}},preset:{prompts:[],prompt_order:[]},chain:{...cardRuleChain(),parser:cardParser()},ports:{state:createMemoryStatePort({accountId:'purpose-fixture'}),model:port},model:main,promptOptions:{selection:{retryDelays:[]},purposes:{memory}}});
 try{for(const purpose of ['body','memory','archive'])await session.requestPurpose(purpose,[{role:'user',content:'fixture'}],{maxTokens:64});assert.equal(sent[0].adapter,main.adapter);assert.equal(sent[0].body.model,main.model);assert.equal(http[0].body.route,'primary-route');assert.deepEqual(sent[1],sent[2]);assert.deepEqual(http[1],http[2]);assert.equal(sent[1].adapter,adapter,name);assert.equal(sent[1].body.model,model);assert.equal(sent[1].baseUrl,baseUrl);assert.equal(sent[1].credential,memory.adapter||memory.family?memory.credential||memory.apiKey||null:memory.credential||memory.apiKey||main.credential);assert.equal(http[1].body.route,route);if(adapter==='google-gemini'){assert(http[1].url.startsWith(baseUrl+'/models/memory-gemini:'));assert(Array.isArray(http[1].body.contents));assert.equal(http[1].body.messages,undefined);}else assert(http[1].url.endsWith('/chat/completions'));checks.push(name);}finally{session.dispose();}
}
console.log(JSON.stringify({ok:true,checks:checks.length,names:checks,networkRequests:0,paid:0}));
