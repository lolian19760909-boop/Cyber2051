'use strict';
const {engine:E,growth:G}=require("../../卡片源码/数值引擎/index.cjs");
const attributes=value=>Object.fromEntries(G.attributes.map(key=>[key,value]));
function state(value=15){return {schema:1,extension:{keep:42},growth:G.initialize({schema:1,level:1,xp:0,attributes:attributes(value),attributePoints:100,perkPoints:300,unrestricted:true},'custom')};}
function stat(value=15){return {other:{keep:true},terminal:{wallet:{yen:100,earned:100,spent:0},gameplay:state(value)}};}
const RULES={id:E.rules.id,version:E.rules.version};
function battle(value=15,extra={}){const base=state(value),max=E.maximums(base.growth.perks,E.rules,[],base.growth);
  const vitals={hp:max.hp,stamina:max.stamina,ram:max.ram};
  return {...base,numeric:{schema:1,rulesRef:{...RULES},vitals:{...vitals},receipts:{},combat:{manual:true,active:true,paused:false,round:1,playerTags:[],
    player:{level:base.growth.level,attributes:{...base.growth.attributes},perks:{...base.growth.perks},vitals:{...vitals},equipment:[],tags:[]},
    enemies:[{id:'enemy_one',profileId:'weaker',vitals:{hp:100,stamina:100,ram:10}}],allies:[],...extra}}};}
const profiles={equal:{attributes:attributes(15)},weaker:{attributes:attributes(10)},stronger:{attributes:attributes(20)}};
const encounter=(extra={})=>({id:'enc_start',kind:'encounter',encounterId:'fight_one',active:true,playerTags:[],enemies:[{id:'enemy_one',profileId:'weaker'}],...extra});
function applyPatches(before,patches){const next=structuredClone(before);for(const p of patches){const parts=p.path.slice(1).split('/').map(k=>k.replace(/~1/g,'/').replace(/~0/g,'~'));let parent=next;for(const k of parts.slice(0,-1)){if(!parent[k]||typeof parent[k]!=='object')throw Error('Parent missing');parent=parent[k];}const key=parts.at(-1);if(p.op==='replace'&&!Object.hasOwn(parent,key))throw Error('Replace missing');if(!['add','replace'].includes(p.op))throw Error('Unexpected operation');parent[key]=structuredClone(p.value);}return next;}
module.exports={E,G,RULES,attributes,state,stat,profiles,encounter,battle,applyPatches};
