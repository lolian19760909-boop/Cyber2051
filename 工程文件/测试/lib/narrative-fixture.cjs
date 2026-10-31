'use strict';
const path=require('node:path'),F=require('./tactical-fixtures.cjs'),{executor}=require('../MVU/mvu-fixture.cjs');
const fs=require('node:fs'),zPath=[path.join(process.env.TEMP,'cxx236-zod-4.4.3/package/index.cjs'),path.join(require('node:os').homedir(),'AppData/Local/Temp/cxx236-zod-4.4.3/package/index.cjs')].find(p=>fs.existsSync(p));
const z=require(zPath),Schema=require('../../卡片源码/MVU/schema.js'),Guard=require('../../卡片源码/MVU/variables.js'),T=require('../../卡片源码/运行时/talents.js');
const copy=structuredClone;
function fixture(game,story,pending,tacticalBase=null){
 const listeners=new Map(),stat={terminal:{gameplay:copy(game),wallet:{yen:500,earned:500,spent:0}},keep:{value:20}},context={chat:[{mes:'前文',variables:[{stat_data:copy(stat)}]},{is_user:true,mes:'执行本轮行动'},{is_user:false,mes:story,swipe_id:0}],eventTypes:{CHAT_CHANGED:'chat_changed'}};
 const api={SillyTavern:{getContext:()=>context},eventOn(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},eventRemoveListener:(n,f)=>listeners.get(n)?.delete(f)},emit=async(n,...args)=>{for(const f of listeners.get(n)||[])await f(...args);};
 const mvu=executor(emit);api.Mvu={parseMessage:mvu.run,events:{COMMAND_PARSED:Guard.events.parsed,VARIABLE_UPDATE_ENDED:Guard.events.ended}};
 const data={stat_data:stat,metadata:{keep:true},schema:copy(mvu.schema(stat))};function extensible(n){if(n?.type!=='object')return;n.extensible=true;n.recursiveExtensible=true;for(const c of Object.values(n.properties||{}))extensible(c);}extensible(data.schema.properties.terminal);data.schema.strictSet=true;data.schema.strictTemplate=false;
 const win={__cxx_battle__:{pendingFor:()=>pending},__cxx_tactical__:{narrativeBase:()=>tacticalBase}},service=Guard.create({api,win,runtime:{key:()=> 'narrative-test'},schema:Schema.build(z,{talents:T}),greetings:[],policy:()=>({})});
 return {data,service,context,async run(events,ordinary=[]){const next=copy(data),patches=[...ordinary,...(events===null?[]:[{op:'add',path:'/terminal/gameplay/numericInput',value:events}])];await mvu.run('<UpdateVariable><JSONPatch>'+JSON.stringify(patches)+'</JSONPatch></UpdateVariable>',next);return copy(next);},destroy:()=>service.destroy()};
}
module.exports={...F,fixture};
