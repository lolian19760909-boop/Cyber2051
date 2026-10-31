'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const G=require("../../卡片源码/运行时/gameplay.js"),T=require("../../卡片源码/运行时/talents.js"),I=require("../../卡片源码/运行时/identity.js"),Actions=require("../../卡片源码/运行时/gameplay-actions.js"),Core=require("../../卡片源码/运行时/core.js");
function fixture(){
  const f={sent:0,writes:[],mounts:[],timers:new Set(),metadata:{variables:{}},messages:[]};
  const starting=T.initialize({...I.initialSetup('street'),level:2,xp:1000,perkPoints:2},'street');
  f.messages=[{is_user:false,mes:'现有存档',variables:[{stat_data:{terminal:{wallet:{yen:100,earned:100,spent:0},gameplay:{schema:1,...Object.fromEntries(G.TABLES.map(k=>[k,{}])),growth:starting}}}}]}];
  f.rows=()=>structuredClone([{chat_metadata:f.metadata},...f.messages]);f.disk=f.rows();
  const doc={activeElement:null,createElement(tag){return {tag,children:[],style:{},textContent:'',listeners:{},isConnected:true,append(n){n.parent=this;this.children.push(n);},replaceChildren(){this.children=[];},setAttribute(){},addEventListener(n,fn){this.listeners[n]=fn;},focus(){doc.activeElement=this;},remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);},querySelector(s){return this.children.find(n=>n.tag===s)||this.children.map(n=>n.querySelector(s)).find(Boolean);}};},defaultView:{getComputedStyle:()=>({display:'block',visibility:'visible'}),Event:class{}},querySelector(s){return s==='#send_textarea'?input:send;}};
  const input={value:'',dispatchEvent(){}},send={disabled:false,isConnected:true,getClientRects:()=>[{}],click(){f.sent++;f.messages.push({is_user:true,mes:input.value});input.value='';f.disk=f.rows();}};doc.body=doc.createElement('body');
  const context={characterKey:'fixture.png',chatId:'fixture'};
  const root={module:{exports:{}},document:doc,fetch(){throw Error('Network is not used in this fixture');},crypto:crypto.webcrypto,
    setTimeout:fn=>{f.timers.add(fn);return fn;},clearTimeout:fn=>f.timers.delete(fn),
    CxxUpdateBackup:{nativeAdapters:()=>({readCurrent:async()=>({jsonl:f.disk.map(JSON.stringify).join('\n')})})}};
  vm.runInNewContext(fs.readFileSync(require.resolve("../../卡片源码/运行时/gameplay-host.js"),'utf8'),root);
  const api={SillyTavern:{getContext:()=>({saveMetadata:async()=>{f.disk=f.rows();}})},Mvu:{isDuringExtraAnalysis:()=>false},getCharData:()=>({first_mes:'opening'}),getVariables:()=>structuredClone(f.metadata.variables),
    async updateVariablesWith(fn,scope){f.writes.push(scope.type);assert.equal(scope.type,'chat');f.metadata.variables=fn(structuredClone(f.metadata.variables));}};
  f.client=root.module.exports.create({api,host:{getContext:()=>context,assertContext(){},readState:()=>({registry:{packages:{}}}),withLock:async fn=>fn(),assertNoPendingInstall:async()=>{}},
    backup:{captureFull:async()=>({payload:{diskJSONL:f.disk.map(JSON.stringify).join('\n'),messages:structuredClone(f.messages),header:{chat_metadata:structuredClone(f.metadata)}}})},getSeed:()=>({mapIndex:{}}),
    core:Core,content:{withMigration:s=>s,storyChoices:()=>({starts:[],npcs:[]})},gameplay:G,actions:Actions,talents:T,talentUI:{mount(options){f.mounts.push(options);return {destroy(){},shadow:{querySelectorAll:()=>[]}};}}});
  const walk=n=>[n,...n.children.flatMap(walk)];f.text=()=>walk(doc.body).map(n=>n.textContent).join('\n');
  f.current=()=>f.mounts.at(-1);f.saved=()=>f.messages.findLast(m=>m.variables).variables[0].stat_data;
  f.reply=valid=>{const record=Object.values(f.metadata.variables.__cxx_gameplay_actions.records).at(-1),ticket=record.ticket,after=structuredClone(f.saved());for(const c of ticket.plan.changes){let p=after;for(const k of c.path.slice(0,-1))p=p[k];p[c.path.at(-1)]=structuredClone(c.after);}if(valid)after.terminal.gameplay.results[ticket.id]={requestHash:ticket.requestHash,status:'success'};f.messages.push({is_user:false,mes:'成长保存夹具',variables:[{stat_data:after}]});f.disk=f.rows();};
  return f;
}


