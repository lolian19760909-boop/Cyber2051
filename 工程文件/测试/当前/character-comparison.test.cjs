'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Comparison=require('../../卡片源码/运行时/character-comparison.js'),Probe=require('../../卡片源码/运行时/character-cache-check.js');
test('diagnostics use the shared character comparison and preserve the original data',()=>{
 const card={name:'测试',extensions:{tavern_helper:{scripts:[{content:'a\r\nb'}],variables:{note:'c\r\nd',zero:0,no:false}}},character_book:{entries:[{id:1,use_regex:false,content:'原文'}]}};
 const before=JSON.stringify(card),helper=card.extensions.tavern_helper,other=structuredClone(card);
 other.extensions.tavern_helper=Object.entries(Comparison.normalize(helper));other.character_book.entries[0].use_regex=true;
 assert.equal(Probe.comparable,Comparison.character);
 assert.deepEqual(Comparison.character(card),Comparison.character({json_data:JSON.stringify({data:other})}));
 assert.equal(JSON.stringify(card),before);
 for(const change of [value=>value.extensions.tavern_helper.variables.extra=1,value=>value.extensions.tavern_helper.scripts[0].content='different',value=>value.character_book.entries[0].use_regex='unknown']){
  const changed=structuredClone(card);change(changed);assert.notDeepEqual(Comparison.character(card),Comparison.character(changed));
 }
 assert.notEqual(Comparison.normalize('a\rb'),Comparison.normalize('a\nb'));
});

test('TT version and creator projections are accepted only when identical to data',()=>{const data={character_version:'2.3.5',creator:'作者',creator_notes:'说明',tags:['Tokyo']};for(const key of Object.keys(data))assert.equal(Comparison.mirroredOuterField({data,...data},key),true);assert.equal(Comparison.mirroredOuterField({data,character_version:'9.0'},'character_version'),false);assert.equal(Comparison.mirroredOuterField({data,future:'x'},'future'),false);});
