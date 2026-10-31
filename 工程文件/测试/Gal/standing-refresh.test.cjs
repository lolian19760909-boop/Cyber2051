'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Parser=require('../../卡片源码/Gal/parser.js'),Sprites=require('../../卡片源码/Gal/sprites.js');
const Dialogue=require('../../卡片源码/正文/dialogue.js'),Scene=require('../../卡片源码/Gal/scene.js');
const media=require('../../卡片源码/Gal/standing-media.json'),origin='https://cyber2051.top';
const say=(name,face='normal',battle)=>`<cxx-say speaker="${name}" expression="${face}"${battle===undefined?'':` battle="${battle}"`}>「测试台词」</cxx-say>`;
const story=(body,people)=>'<cxx-story>'+body+'</cxx-story>'+(people?'<ztl>'+JSON.stringify({date:'2051-10-03',time:'22:00',location:'暗池',characters:people})+'</ztl>':'');
const resolve=(id,face,options)=>Sprites.sprite(id,origin,face,media,options);
const filename=url=>decodeURIComponent(new URL(url).pathname.split('/').at(-1));
function selected(raw,index=0,initial){return Sprites.select(Parser.parseMessage(raw),index,resolve,initial);}

test('61 distinct worldbook identities accept names and official file prefixes without changing saved IDs',()=>{
 const mapping=[...require('../../资源/立绘/20261020/character-map.json').characters,...require('../../资源/立绘/20261020-oc/character-map.json').characters];
 assert.equal(new Set(Sprites.characters.map(p=>p.id)).size,61);
 for(const p of mapping)for(const name of [p.characterName,p.filePrefix,p.filePrefix.toLowerCase()]){
  const raw=story(say(name,'regret')),snapshot=raw,value=Parser.parseMessage(raw);
  assert.equal(value.paragraphs[0].characterId,p.characterId,name);
  assert.equal(selected(raw)[0].id,p.characterId);
  assert.equal(raw,snapshot);
 }
 for(const [name,id]of [['LAYER','Rei'],['LOCK','Rokka'],['CHU²','Chiyu'],['Kanade','Kanata'],['Hooka','Houka'],['柚枼','Morikawa'],['常夜灯','LinXingye'],['I:P','Vesper'],['Masquerena','Vesper']])assert.equal(selected(story(say(name)))[0].id,id);
 for(const name of ['榴弹喵','EM:P 榴弹喵','灯闪万事屋'])assert.deepEqual(selected(story(say(name))),[]);
});
test('no evident emotion uses normal; a later plain sentence does not inherit the speaker previous anger',()=>{
 const raw=story(say('千早爱音','serious')+say('千早爱音'));
 assert.equal(selected(raw,0)[0].expression,'serious');
 assert.equal(selected(raw,1)[0].expression,'normal');
 assert.equal(selected(story(say('千早爱音','unknown')))[0].expression,'normal');
});
test('shame never becomes constricted pupils; breakdown and old ambiguous tags never become cyberpsychosis',()=>{
 for(const value of ['羞耻','害羞','embarrassed'])assert.equal(Dialogue.expression(value),'blush');
 for(const value of ['精神冲击','震撼','失神落魄','暴怒','精神崩溃','失神','恍惚','yandere_trance','yandere trance'])assert.equal(Dialogue.expression(value),'constricted_pupils',value);
 for(const value of ['Cyberpsychosis','cyberpsychosis','赛博精神病发作'])assert.equal(Dialogue.expression(value),'cyberpsychosis');
 for(const value of ['遗憾','无奈','叹气','允悲','轻微悲伤'])assert.equal(Dialogue.expression(value),'regret');
 assert.equal(Dialogue.expression('愤怒'),'serious');
});
test('author-approved missing images fall back within the same character',()=>{
 for(const [id,face,file]of [
  ['Kokoro','normal','Kokoro_tachi_smile.png'],['Kasumi','cyberpsychosis','Kasumi_tachi_constricted pupils.png'],
  ['Viola','cyberpsychosis','Viola_tachi_constricted pupils.png'],['Viola','serious','Viola_tachi_normal.png'],
  ['Saki','normal','Sakiko_tachi_normal.png'],['Moka','normal','Moca_tachi_normal.png'],['Touko','normal','Toko_tachi_normal.png']
 ])assert.equal(filename(resolve(id,face)),file);
});
test('ordinary cast keeps emotional portraits during combat, and the two configured cast keep battle form',()=>{
 const ordinary=selected(story(say('千早爱音','sadness',true)))[0];
 assert.equal(filename(ordinary.url),'Anon_tachi_sadness.png');
 const raw=story(say('奥泽美咲','serious',true)+say('奥泽美咲','sadness')+say('奥泽美咲','cyberpsychosis')+say('奥泽美咲','normal',false));
 const expected=['battle_serious','battle_serious','battle_Cyberpsychosis','normal'];
 expected.forEach((face,i)=>assert.equal(filename(selected(raw,i)[0].url),'Misaki_tachi_'+face+'.png'));
 for(const face of Dialogue.expressions){
  const item=selected(story(say('户山香澄',face,true)))[0];
  assert.equal(filename(item.url),'Kasumi_tachi_fighting_normal.png');
  assert.equal(filename(item.fallbackUrl),'Kasumi_tachi_fighting_normal.png');
 }
});
test('a battle image failure can fall back only to its battle default, never normal clothes',()=>{
 const item=selected(story(say('奥泽美咲','cyberpsychosis',true)))[0];
 assert.equal(filename(item.url),'Misaki_tachi_battle_Cyberpsychosis.png');
 assert.equal(filename(item.fallbackUrl),'Misaki_tachi_battle_serious.png');
});
test('battle state persists across replies and is recomputed on edits, swipes, historical views and chat switches',()=>{
 const resolver=Scene.create(Parser),chat=[
  {mes:story(say('奥泽美咲','serious',true)),swipe_id:0},
  {is_user:true,mes:story(say('奥泽美咲','normal',false))},
  {mes:story(say('奥泽美咲','sadness')),swipe_id:0},
  {mes:story(say('奥泽美咲','normal',false)),swipe_id:0},
  {mes:story(say('奥泽美咲')),swipe_id:0}
 ];
 const at=i=>selected(chat[i].mes,0,resolver.battleBefore({key:'one',messages:chat,floor:i}))[0];
 assert.equal(filename(at(2).url),'Misaki_tachi_battle_serious.png');
 assert.equal(filename(at(0).url),'Misaki_tachi_battle_serious.png','future end cannot rewrite history');
 assert.equal(filename(at(4).url),'Misaki_tachi_normal.png');
 chat[0].mes=story(say('奥泽美咲'));chat[0].swipe_id=1;
 assert.equal(filename(at(2).url),'Misaki_tachi_sadness.png');
 assert.deepEqual(resolver.battleBefore({key:'two',messages:[chat[2]],floor:0}),{});
});
test('end-of-reply silent battle changes apply only at the last paragraph',()=>{
 const raw=story(say('奥泽美咲','serious',true)+'\n\n战斗结束，她放下武器。',[{name:'奥泽美咲',outfit:'重装',thought:'结束了',battle:false}]);
 assert.equal(filename(selected(raw,0)[0].url),'Misaki_tachi_battle_serious.png');
 assert.equal(filename(selected(raw,1)[0].url),'Misaki_tachi_serious.png');
 const resolver=Scene.create(Parser),messages=[{mes:raw},{mes:story(say('奥泽美咲'))}];
 assert.equal(resolver.battleBefore({key:'one',messages,floor:1}).Misaki,false);
});
test('thought and normalized outbound history preserve valid battle marks without mutating source',()=>{
 const raw=story(say('户山香澄','normal',true).replace('expression="normal"','expression="normal" kind="thought"'));
 const normalized=Parser.prepareDialogue(raw),p=Parser.parseMessage(normalized).paragraphs[0];
 assert.equal(p.kind,'thought');assert.equal(p.battle,true);
 assert.match(Parser.historyDialogue(raw),/battle="true"/);
 assert.equal(Dialogue.scan(story(say('户山香澄','normal','nonsense'))).segments[0].battle,undefined);
 const pending='<cxx-story><cxx-say speaker="户山香澄" expression="normal" battle="true">尚未闭合';
 assert.equal(Parser.parseMessage(pending).paragraphs[0].battle,undefined);
});
test('quoted and planning examples cannot start battles',()=>{
 for(const prefix of ['<think>'+say('户山香澄','normal',true)+'</think>','```\n'+say('户山香澄','normal',true)+'\n```']){
  const parsed=Parser.parseMessage(prefix+story(say('户山香澄')));
  assert.equal(Sprites.battleState(parsed,parsed.paragraphs.length-1).Kasumi,undefined);
 }
});
test('future cast battle groups are added through media configuration without new character conditionals',()=>{
 const configured=structuredClone(media);
 configured.characters.Anon={battle:{defaultAsset:'serious',expressions:{smile:'smile'}}};
 const url=face=>Sprites.sprite('Anon',origin,face,configured,{battle:true});
 assert.equal(filename(url('sadness')),'Anon_tachi_serious.png');
 assert.equal(filename(url('smile')),'Anon_tachi_smile.png');
 assert.equal(filename(resolve('Anon','sadness',{battle:true})),'Anon_tachi_sadness.png');
});
test('unknown NPCs and excluded test images never acquire another character portrait',()=>{
 assert.equal(Parser.parseMessage(story(say('陌生店员'))).paragraphs[0].characterId,null);
 assert.deepEqual(selected(story(say('陌生店员'))),[]);
 assert.ok(!media.files.some(a=>/夜小妹|测试3|黑白test/.test(a.file)));
});
test('diagnostics accept all canonical emotions with explicit battle booleans and reject invalid marks',()=>{
 const diagnostics=require('../../卡片源码/运行时/diagnostics.js');
 const suffix='<xuan>1. 观察\n2. 交谈\n3. 调查\n4. 离开\n5. 等待</xuan>';
 for(const face of Sprites.expressions)for(const battle of [true,false]){
  const raw=story(say('Vesper',face,battle),[])+suffix;
  assert.deepEqual(diagnostics.inspect(raw),[],face+':'+battle);
  assert.ok(diagnostics.inspect(raw.replace('battle="'+battle+'"','battle="maybe"')).some(s=>s.includes('属性')));
 }
});
