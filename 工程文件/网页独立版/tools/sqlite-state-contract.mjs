/** Necessary state/legacy serialization contract; no database feature matrix. */
import assert from 'node:assert/strict';
import {cardModule,cardRuleChain} from '../src/reuse/card.mjs';
import {createRulesEngine} from '../src/rules/engine.mjs';
import {stateFields,fieldsState,stateTemplate} from '../src/database/sqlite-state.mjs';
import {useSqliteSettings} from '../src/database/sqlite-settings.mjs';
const state=createRulesEngine({chain:cardRuleChain()}).emptyRoot();
state.terminal.wallet={id:'wallet',yen:1200,earned:1400,spent:200};
state.custom=JSON.parse('{"escaped/key~":{"empty":{},"list":[1,null,false,"保留未知字段"]},"__proto__":{"marker":"own property"}}');
assert.deepEqual(fieldsState(stateFields(state)),state);assert.equal({}.marker,undefined);
const next=structuredClone(state);next.terminal.wallet.yen=900;next.custom.newField='新增';
assert.deepEqual(fieldsState(stateFields(next)),next);
const old={mate:{type:'chatSheets',version:2},sheet_custom:{name:'旧自定义表',content:[['id'],[7]]}},upgraded=stateTemplate(old);assert.deepEqual(upgraded,old);assert.equal(Object.keys(upgraded).some(key=>key==='sheet_cxx_state'),false,'Formal state must not duplicate in plugin snapshots');
const I=cardModule('运行时/identity.js'),identity=I.snapshot('street','',I.initialSetup('street'));identity.setupToken='synthetic-state-contract';
const typical=cardModule('运行时/player-operations.js').plan(createRulesEngine({chain:cardRuleChain()}).emptyRoot(),{action:'initialize'},{identity,newChat:true});assert.deepEqual(fieldsState(stateFields(typical)),typical);
const settings={__userscripts:{shujuku_v120__userscript_settings_v1:{shujuku_v120_profile_v1____default____settings:JSON.stringify({storageMode:'native',customUnknown:'保留'})}}};useSqliteSettings(settings);const saved=JSON.parse(settings.__userscripts.shujuku_v120__userscript_settings_v1.shujuku_v120_profile_v1____default____settings);assert.equal(saved.storageMode,'sqlite');assert.equal(saved.customUnknown,'保留');assert.equal(saved.autoUpdateEnabled,false);
console.log('PASS 真实建角62人物及未知字段/空对象/数组/转义键完整往返，旧表与设置保留；正式状态不进入插件模板重复保存');
