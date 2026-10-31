const test=require('node:test'),assert=require('node:assert/strict');
const Identity=require("../../卡片源码/运行时/identity.js");

test('preset origins have distinct anchors and the same remaining allocation budget',()=>{
  const starts=['street','corpo','student'].map(id=>Identity.initialSetup(id));
  assert.equal(starts.every(s=>s.attributePoints===4),true);
  assert.equal(starts.every(s=>Object.values(s.attributes).reduce((a,b)=>a+b,0)+s.attributePoints===22),true);
  assert.equal(new Set(starts.map(s=>JSON.stringify(s.attributes))).size,3);
  const draft=starts[0];draft.attributes.body+=2;draft.attributePoints-=2;
  const value=Identity.snapshot('street','',draft);
  assert.equal(value.growthSetup.attributes.body,6);assert.equal(value.growthSetup.attributePoints,2);
  assert.equal(Identity.initialSetup('street').attributes.body,4);
});

test('preset allocation cannot create points or erase the origin anchor',()=>{
  const d=Identity.initialSetup('corpo');d.attributes.body+=1;
  assert.throws(()=>Identity.normalizeSetup('corpo',d),/自由配点/);
  const low=Identity.initialSetup('student');low.attributes.intelligence-=1;low.attributePoints+=1;
  assert.throws(()=>Identity.normalizeSetup('student',low),/自由配点/);
});

test('custom backgrounds preserve arbitrary safe integer starts including cheats',()=>{
  const d=Identity.initialSetup('custom');Object.assign(d,{level:'999',xp:'456',attributePoints:'10000000000',perkPoints:'9999'});d.attributes.body='999';
  const value=Identity.snapshot('custom','  自己填写的角色来历。  ',d);
  assert.equal(value.background,'自己填写的角色来历。');assert.equal(value.growthSetup.unrestricted,true);
  assert.equal(value.growthSetup.level,999);assert.equal(value.growthSetup.attributes.body,999);
  assert.equal(value.growthSetup.attributePoints,10000000000);assert.equal(Identity.valid(value),true);
});

test('blank or invalid inputs remain errors rather than becoming zero or truncated integers',()=>{
  for(const v of ['',-1,1.2,Infinity,Number.MAX_SAFE_INTEGER+1]){
    const d=Identity.initialSetup('custom');d.perkPoints=v;
    assert.throws(()=>Identity.snapshot('custom','有效背景',d));
  }
  assert.equal(Identity.snapshot('custom','',Identity.initialSetup('custom')).background,'');
});

test('old identity snapshots stay valid and new prompts retain initial-point meaning',()=>{
  const old=Identity.snapshot('student');assert.equal('growthSetup' in old,false);assert.equal(Identity.valid(old),true);
  const custom=Identity.initialSetup('custom');custom.attributes.cool=90;
  const value=Identity.snapshot('custom','背景',custom),prompt=Identity.promptContext(value);
  assert.match(prompt,/仅在首次建立成长记录时使用/);assert.match(prompt,/不得擅自削弱/);assert.match(prompt,/"cool":90/);
  assert.match(Identity.promptContext(old),/不赠送初始资产/);
});
