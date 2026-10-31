'use strict';
const test=require('node:test');
const assert=require('node:assert');
const path=require('path');
const fs=require('fs');
const vm=require('vm');

const engineDir=path.resolve(__dirname,'..','..','卡片源码','数值引擎');
const numeric=require(path.join(engineDir,'index.cjs'));

test('protocol carries the condition vocabulary of the learned perks',()=>{
  const state={growth:{perks:{Body_Right_Perk_2_2:1}}};
  const text=numeric.mvu.protocol(state,{});
  assert.ok(text.includes('recent_block'),'learned perk condition label must reach the protocol');
  assert.ok(text.includes('blunt'),'blunt token must reach the protocol');
  assert.ok(text.includes('本局相关条件标签'),'protocol must announce the vocabulary section');
});

test('protocol only lists labels the card actually knows',()=>{
  const text=numeric.mvu.protocol({growth:{perks:{}}},{});
  assert.ok(!text.includes('air_dash')||text.includes('air_dash='),'unknown labels must not be invented');
  assert.ok(text.includes('numericInput'));
  assert.ok(text.includes('不得自行计算'));
});

test('browser copies load without a card host providing CxxDataClone',()=>{
  const files=['src/engine.js','adapters/mvu.js'];
  for(const rel of files){
    const source=fs.readFileSync(path.join(engineDir,rel),'utf8');
    const sandbox={console,Array,Object,JSON,Math,Number,String,Boolean,Set,Map,Error,TypeError,encodeURIComponent,decodeURIComponent};
    sandbox.globalThis=sandbox;
    vm.runInNewContext(source,sandbox,{filename:rel});
  }
});
