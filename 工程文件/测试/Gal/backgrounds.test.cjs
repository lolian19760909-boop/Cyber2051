'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const gal=path.resolve(__dirname,'../../卡片源码/Gal'),root=path.resolve(gal,'../../..');
const {select}=require(path.join(gal,'backgrounds.js')),sprites=require(path.join(gal,'sprites.js')),parser=require(path.join(gal,'parser.js'));
const assets=require(path.join(gal,'media-inventory.json')).files,standing=require(path.join(gal,'standing-media.json')).files;
const standingSource=require('../lib/standing-source.cjs');
const pick=(location,time='清晨',extra={})=>select({location,time,...extra},{assets});
const files=result=>[result,...(result?.fallbacks||[])].filter(Boolean).map(x=>x.filename);
test('具体住宅、房间及不含时间的场景图优先匹配',()=>{
 for(const [location,time,filename]of[
  ['京滨方舟 · 睦居住地 · 卧室','清晨','ark_Mutsumihouse_bedroom_morning'],
  ['若叶睦的家 · 庭院','09:00','ark_Mutsumihouse_yard_morning'],
  ['皇核 · 素世家 · 卧室','晚上','core_soyohouse_bedroom_midnight'],
  ['Mujica 据点 · 军械库','上午','core_mujica hideout_armory'],
  ['皇核 · 户川 · 走廊','午夜','core_Togawa Aisle'],
  ['暗池 · 喵梦家 · 餐厅','下午','darkpool_nyamuhouse_diningroom'],
  ['京滨方舟 · 餐厅','清晨','ark_restaurant_morning'],
  ['祥子的家 · 浴室','清晨','lowtown_sakihouse_bathroom_morning'],
  ['暗池 · 立希家 · 门外','深夜','darkpool_takihouse_out_midnight'],
 ])assert.equal(pick(location,time).filename,'2051CG_'+filename+'.png',location);
});
test('缺具体图降到区域，缺同一时段图降到通用图',()=>{
 assert.equal(pick('皇核 · 未绘制咖啡店').filename,'2051CG_core_morning.png');
 assert.match(pick('睦家 · 卧室','23:00').filename,/^2051CG_T[89]_midnight/);
 assert.equal(pick('皇核 · 素世家 · 卧室','上午').filename,'2051CG_core_morning.png');
 assert.match(pick('暗池 · 没有画过的仓库','18:00').filename,/^2051CG_darkpool_midnight\d*\.png$/);
 assert.match(pick('荒川下城 · RING-Live!','深夜').filename,/^2051CG_RING_midnight/);
 assert.match(pick('山手霓环 · 红花街').filename,/^2051CG_redflower_morning/);
});
test('滨水、未知、空地点及歧义地点使用稳定 T 系列，缺时间不中断',()=>{
 for(const location of ['滨水区','未知地点','','皇核→暗池']){
  const day=pick(location),night=pick(location,'22:00');
  assert.match(day.filename,/^2051CG_T[1-7]_morning/);assert.match(night.filename,/^2051CG_T[89]_midnight/);assert.deepEqual(pick(location),day);
 }
 assert.match(select(null,{assets}).filename,/^2051CG_T[1-9]_/);
 for(const time of ['','时间不详','24:00','09:60'])assert.match(pick('皇核',time).filename,/^2051CG_core_/);
 for(const time of ['清晨 06:00','17:59'])assert.equal(pick('皇核',time).filename,'2051CG_core_morning.png');
 assert.equal(pick('皇核','18:00').filename,'2051CG_core_midnight.png');
});
test('62 张根目录背景均有匹配入口，废案不进入清单',()=>{
 const local=fs.readdirSync(path.join(root,'图片/2051_backgroundCG')).filter(f=>f.endsWith('.png')).sort();
 assert.deepEqual(assets.map(x=>x.file).sort(),local);assert.equal(local.length,62);
 for(const asset of assets){
  const stem=asset.file.slice(7,-4),period=stem.match(/_(morning|midnight)\d*$/)?.[1]||'';
  const location=/^T[1-9]_/.test(stem)?'滨水区':stem.replace(/_(morning|midnight)\d*$/,'');
  assert.ok(files(pick(location,period)).includes(asset.file),asset.file);
  const bytes=fs.readFileSync(path.join(root,'图片/2051_backgroundCG',asset.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.file);
 }
});
test('人物不影响背景，空资源或错误 URL 只返回空',()=>{
 assert.deepEqual(pick('皇核','清晨',{characters:[{name:'若叶睦'}]}),pick('皇核','清晨',{characters:[]}));
 assert.equal(select({location:'皇核'},{assets,baseUrl:'not a url'}),null);
 assert.equal(select({location:'皇核'},{assets:[]}),null);assert.equal(select({location:'皇核'},{assets:null}),null);
 assert.ok(pick('Mujica 据点 军械库').url.includes('mujica%20hideout'));
});
test('549 张立绘逐图匹配清单，缺场景及换背景不改变人物选择',()=>{
 const local=standingSource.listFiles();
 assert.equal(local.length,549);assert.deepEqual(standing.map(x=>x.file).sort(),local);
 for(const asset of standing){
  const bytes=standingSource.read(asset.file);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.file);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  if(!sprites.expressions.includes(asset.expressionId))continue;
  const url=sprites.sprite(asset.characterId,'https://cyber2051.top',asset.expressionId,require(path.join(gal,'standing-media.json')));
  assert.equal(decodeURIComponent(new URL(url).pathname.split('/').at(-1)),asset.file);assert.ok(url.includes('/standing/'+asset.sha256.slice(0,16)+'/'));
 }
 const parsed=parser.parseMessage('祥子：你来了。'),resolve=(id,e)=>sprites.sprite(id,'https://cyber2051.top',e,standing);
 const expected=sprites.select(parsed,0,resolve);assert.equal(expected[0].id,'Saki');
 for(const location of ['京滨方舟 · 睦家 · 卧室','皇核','滨水区','']){
  parsed.scene={location,time:'清晨'};assert.deepEqual(sprites.select(parsed,0,resolve),expected);
 }
});
// Exercise the actual UI function bodies with image events; no browser or host needed.
function mediaUI(){
 const source=fs.readFileSync(path.join(gal,'ui.js'),'utf8'),ast=require('D:/SillyTavern/node_modules/acorn').parse(source,{ecmaVersion:'latest'}),functions={};
 function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&['renderBackground','renderSprites','removeSprite'].includes(node.id.name))functions[node.id.name]=source.slice(node.start,node.end);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}walk(ast);
 class Node{constructor(){this.attributes={};this.children=[];this.hidden=false;this.style={setProperty(){}};}setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}removeAttribute(k){delete this.attributes[k];}append(node){this.children.push(node);node.parent=this;}prepend(node){this.children.unshift(node);node.parent=this;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}set src(v){this.attributes.src=v;}get src(){return this.attributes.src;}}
 const stage=new Node(),cast=new Node(),mediaLoading=new Node(),emptyStage=new Node();
 const context={stage,cast,mediaLoading,emptyStage,root:new Node(),doc:{defaultView:{matchMedia:()=>({matches:true})}},element:()=>new Node(),safeSpriteUrl:v=>v||'',clearTimeout,setTimeout};
 vm.createContext(context);vm.runInContext('let destroyed=false,backgroundImage=null,backgroundUrl="",desiredSprites=[],speakingId="Saki";const spriteNodes=new Map(),spriteExits=new Map();'+Object.values(functions).join('\n')+';globalThis.setSprites=items=>{desiredSprites=items;renderSprites();};',context);
 return context;
}


