const test=require('node:test'),assert=require('node:assert/strict'),Parser=require('../../卡片源码/Gal/parser.js'),Engine=require('../../卡片源码/数值引擎/src/engine.js');
const status=flag=>'<ztl>'+JSON.stringify({time:'14:32',location:'RiNG酒吧',characters:[],...(flag===undefined?{}:{combat:{pending:flag}})})+'</ztl>';
test('only a validated live scene with boolean pending requests the battle panel',()=>{
 assert.equal(Parser.parseMessage('枪声响起，战斗开始。'+status()).scene.combatPending,undefined);
 assert.equal(Parser.parseMessage('对手拔出了武器。'+status(true)).scene.combatPending,true);
 for(const flag of [false,1,'true',null])assert.equal(Parser.parseMessage(status(flag)).scene.combatPending,undefined);
});
test('thinking and quoted protocol examples never request the panel',()=>{
 for(const raw of ['<think>'+status(true)+'</think>街道很安静。','```json\n'+status(true)+'\n```','<konatan_planning~>示例'+status(true)+'</konatan_planning~>\n<cxx-story>街道很安静。</cxx-story>'])assert.notEqual(Parser.parseMessage(raw).scene?.combatPending,true);
});
test('narrative combat marker is UI only; confirmed combat still uses scripted round results',()=>{
 assert.equal(Engine.context({}),'');const idle=Engine.context({terminal:{gameplay:{tactical:{enabled:true}}}});assert.match(idle,/"combat":\{"pending":true\}/);assert.match(idle,/不能自行开启/);assert.match(idle,/同一冲突后续层不重复/);
 const active=Engine.context({terminal:{gameplay:{numeric:{combat:{manual:true,active:true}}}}});assert.ok(!active.includes('pending'));assert.match(active,/程序注入/);
});
