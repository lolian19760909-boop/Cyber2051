'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Clone=require('../../卡片源码/共享/data-clone.js'),Popover=require('../../卡片源码/共享/popover.js'),{extract}=require('../../工具/lib/script-modules.cjs');
test('data clone fallback preserves optional fields, unknown keys, references and sparse arrays',()=>{
 const clone=Clone.create(undefined),value=JSON.parse('{"__proto__":{"kept":true},"zero":0,"no":false,"nil":null}');value.optional=undefined;value.rows=new Array(3);value.rows[2]=value;value.same=value.rows;
 const result=clone(value);assert.deepEqual(result,value);assert.notEqual(result,value);assert.equal(result.rows[2],result);assert.equal(result.same,result.rows);assert(!Object.hasOwn(result.rows,0));assert(Object.hasOwn(result,'__proto__'));assert(Object.hasOwn(result,'optional'));
 result.__proto__.kept=false;assert.equal(value.__proto__.kept,true);
 assert.throws(()=>clone(new Map()),/plain records/);assert.throws(()=>clone({fn(){}}),/functions/);
 let calls=0;const native=Clone.create(v=>{calls++;return v;});assert.equal(native(value),value);assert.equal(calls,1);
});
test('popover fallback handles missing methods and a rejected selector without hiding the panel',()=>{
 const node={attrs:new Map([['popover','manual']]),setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);},matches(){throw new SyntaxError('unsupported selector');}};
 assert.equal(Popover.isOpen(node),false);assert.equal(Popover.show(node),false);assert(!node.attrs.has('popover'));Popover.hide(node);
 node.showPopover=()=>{throw Error('must not show after an unsupported selector');};node.hidePopover=()=>{throw Error('must not hide a closed panel');};
 assert.equal(Popover.isOpen(node),false);assert.equal(Popover.show(node),false);assert(!node.attrs.has('popover'));Popover.hide(node);
});
test('actual card realms bind their local clone before a tactical module loads without structuredClone',()=>{
 const card=JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD||path.join(__dirname,'../../.cache/build/赛博小祥2051-V2.3.0.json')));
 let tested=0;
 for(const script of card.data.extensions.tavern_helper.scripts){
  const modules=extract(script.content,['CxxDataClone','CxxTacticalEngine']),adapter=modules.find(m=>m.name==='CxxDataClone');
  if(!adapter)continue;
  const context=vm.createContext({});vm.runInContext(adapter.source,context);assert.equal(context.structuredClone,undefined);
  const tactical=modules.find(m=>m.name==='CxxTacticalEngine');if(tactical){vm.runInContext(tactical.source,context);const game={tactical:{enabled:true,initialized:true,revision:4,encounter:{actors:[{id:'player',visible:true,intel:2}],nodes:[],zones:[],edges:[],order:['player'],randomState:9,draws:1,source:{private:true}}}};const view=context.CxxTacticalEngine.view(game);assert.equal(view.encounter.actors[0].id,'player');assert.equal(view.encounter.randomState,undefined);assert.equal(game.tactical.encounter.randomState,9);tested++;}
 }
 assert.equal(tested,1,'Exercise the tactical engine from the actual candidate');
});
