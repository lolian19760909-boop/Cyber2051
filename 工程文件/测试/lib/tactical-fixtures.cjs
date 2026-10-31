'use strict';
const L=require('../../卡片源码/运行时/loadout.js'),E=require('../../卡片源码/数值引擎/src/engine.js'),B=require('../../卡片源码/运行时/battle.js'),O=require('../../卡片源码/运行时/player-operations.js');
const attrs=n=>Object.fromEntries(E.growth.attributes.map(k=>[k,n]));
function game(){const g={...L.base(),growth:E.growth.initialize({schema:1,unrestricted:true,level:10,xp:0,attributes:attrs(15),attributePoints:20,perkPoints:200},'custom')};g.numeric=E.initialNumeric(g,undefined,L.effects(g));return g;}
let sequence=0;
function op(g,request){return O.plan({terminal:{gameplay:g,keep:17}},request).terminal.gameplay;}
function own(g,template,tier=1){g=structuredClone(g);const d=L.definition({template,tier});g.itemDefinitions[d.id]=d;g.inventory[d.id]={quantity:1,definitionRef:d.definitionRef};return {g,id:d.id};}
function equip(g,template,tier=1,slot){const x=own(g,template,tier),operations=[{action:'equip',id:x.id,slot}];if(L.isWeapon(L.get(x.g,x.id)))operations.push({action:'active-weapon',slot:slot||'weapon_1'});return op(x.g,{action:'loadout-save',id:'save_'+(++sequence),expected:L.stamp(x.g),operations});}
function allocate(g,id,rank){const perks={...g.growth.perks};function add(id,n){const node=E.growth.node(id);for(const p of node.requires)add(p,E.growth.node(p).ranks);perks[id]=Math.max(perks[id]||0,n);}add(id,rank);return op(g,{action:'talent-allocate',build:{attributes:g.growth.attributes,perks}});}
function npc(id,name,n=6,extra={}){return B.actor({id,name,template:'civilian',level:5,attributes:attrs(n),...extra});}
function start(g,allies=[],enemies=[npc('enemy','对手')]){return op(g,{action:'battle-start',mode:'cheat',id:'fight_'+(++sequence),draft:{player:B.player(g),allies,enemies}});}
function round(g,roll=0){return B.prepare(g,{id:'round_'+(++sequence),roll});}
function campaign(g){const rounds=[];for(let i=0;i<40&&g.numeric.combat.active;i++){const p=round(g);rounds.push(p.result);g=op(g,{action:'battle-resolve',pending:p});}return {g,rounds};}
function cases(){const weak=()=>[npc('e1','敌人一',3,{vitals:{hp:20}}),npc('e2','敌人二',3,{vitals:{hp:20}}),npc('e3','敌人三',3,{vitals:{hp:20}})];return [
 {name:'单人对阵多个敌人',g:start(game(),[],weak())},
 {name:'多人对阵多个敌人',g:start(game(),[npc('ally1','队友一'),npc('ally2','队友二')],weak())},
 {name:'单人对阵爱音（测试参数）',g:start(game(),[],[npc('Anon','千早爱音（测试参数）',10,{level:10})])},
 {name:'多人对阵祥子（测试参数）',g:start(game(),[npc('ally1','队友一'),npc('ally2','队友二')],[npc('Saki','丰川祥子（测试参数）',18,{level:20})])}
 ];}
module.exports={L,E,B,O,attrs,game,op,own,equip,allocate,npc,start,round,campaign,cases};
