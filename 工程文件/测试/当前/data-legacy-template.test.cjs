'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const Store=require('../../卡片源码/数据/store.js'),Sync=require('../../卡片源码/数据/sync.js'),Rows=require('../../卡片源码/数据/rows.js'),template=require('../../卡片源码/数据/schema.js');
// Extracted from the shipped 2.3.33 card, SHA256 13af00e03c782884bb5c2588668ac029509b0cfb279875f83af9a8e526a0eca7.
const oldCheck="CHECK(slot IN ('主手', '副手', '头部', '躯干', '腿部', '义体'))";
function fixture({legacy=true,balanceLegacy=false}={}){
 let data=structuredClone(template),db,imports=0,lastError='';
 if(balanceLegacy){for(const name of ['cxx_actor_stat','cxx_wallet']){const sheet=data['sheet_'+name];sheet.sourceData.ddl=sheet.sourceData.ddl.replace(/yen INTEGER NOT NULL DEFAULT 0(?: CHECK\(yen >= 0\))?/, 'yen INTEGER NOT NULL DEFAULT 0 CHECK(yen >= 0)');sheet.sourceData.playerNote='保留余额说明';}data.sheet_cxx_wallet.content.push([8,'chat',123,140,17,6]);data.sheet_cxx_actor_stat.content.push([8,'legacy_player',80,100,0,123,null,6]);}
 const equipment=data.sheet_cxx_equipment;delete data.sheet_cxx_equipment;data.sheet_zhuang_bei_biao=equipment;equipment.uid='sheet_zhuang_bei_biao';equipment.playerField={zero:0};equipment.sourceData.playerOption=false;
 if(legacy){equipment.sourceData.ddl=equipment.sourceData.ddl.replace('CHECK(length(slot) > 0)',oldCheck);for(const key of ['cxx_actor_flag','cxx_wallet','cxx_roster','cxx_scene','cxx_effect','cxx_pref','cxx_battle','cxx_tactical','cxx_quest','cxx_quest_meta'])delete data['sheet_'+key].uid;}
 equipment.content.push([41,'player','主手','old_pistol',1,3]);
 data.sheet_private={uid:'sheet_private',name:'玩家自用表',sourceData:{ddl:'CREATE TABLE player_notes(row_id INTEGER PRIMARY KEY,note TEXT);'},content:[['行号','备注'],[9,'保留玩家笔记']]};
 function install(next){const candidate=new DatabaseSync(':memory:');try{
  for(const sheet of Object.values(next).filter(row=>row?.sourceData?.ddl)){
   candidate.exec(sheet.sourceData.ddl);const table=/CREATE TABLE\s+(\w+)/i.exec(sheet.sourceData.ddl)[1];
   for(const cells of sheet.content.slice(1))candidate.prepare('INSERT INTO '+table+' VALUES ('+cells.map(()=>'?').join(',')+')').run(...cells);
  }
 }catch(error){candidate.close();throw error;}db?.close();db=candidate;data=structuredClone(next);}
 install(data);
 const api={exportTableAsJson:()=>structuredClone(data),getTableTemplate(){const result=structuredClone(data);for(const sheet of Object.values(result))if(sheet?.content)sheet.content=sheet.content.slice(0,1);return result;},
  async importTemplateFromData(target,options){assert.equal(options.scope,'chat');assert.equal(options.dataMode,'seed');imports++;for(const [key,sheet]of Object.entries(target))if(key.startsWith('sheet_')&&!sheet.uid)return {success:false,error:key+' 缺少 uid'};const merged=structuredClone(target);for(const [key,sheet]of Object.entries(merged))if(data[key]?.content)sheet.content=structuredClone(data[key].content);install(merged);return {success:true};},
  async importTableAsJson(json){try{install(JSON.parse(json));return true;}catch(error){lastError=error.message;return false;}}
 };
 const store=Store.create({scope:{AutoCardUpdaterAPI:api},template,wait:1,step:1});
 return {store,api,get data(){return data},get db(){return db},get imports(){return imports},get lastError(){return lastError},close(){db.close()}};
}
test('2.3.33 equipment schema upgrades once while retaining rows, pinyin keys and player metadata',async()=>{
 const f=fixture();try{const before=structuredClone(f.data);const ready=await f.store.ensureSchema();assert.equal(ready.ok,true,ready.reason);assert.equal(f.imports,1);
  assert.equal(f.data.sheet_zhuang_bei_biao.sourceData.ddl,before.sheet_zhuang_bei_biao.sourceData.ddl.replace(oldCheck,'CHECK(length(slot) > 0)'));assert.deepEqual(f.data.sheet_zhuang_bei_biao.content,before.sheet_zhuang_bei_biao.content);assert.deepEqual(f.data.sheet_private,before.sheet_private);assert.deepEqual(f.data.sheet_zhuang_bei_biao.playerField,{zero:0});assert.equal(f.data.sheet_zhuang_bei_biao.sourceData.playerOption,false);assert.equal(f.data.sheet_zhuang_bei_biao.uid,'sheet_zhuang_bei_biao');assert.equal(f.data.sheet_cxx_equipment,undefined);for(const [key,sheet]of Object.entries(f.data))if(key.startsWith('sheet_'))assert.equal(sheet.uid,key);
  assert.equal((await f.store.ensureSchema()).ok,true);assert.equal(f.imports,1);assert.equal(f.db.prepare('SELECT slot FROM cxx_equipment').get().slot,'主手');
 }finally{f.close();}
});
test('current equipment rows mirror into an actual old SQL schema after normal ensureSchema',async()=>{
 const f=fixture();try{const terminal={wallet:{yen:100,earned:100,spent:0},ensemble:{actors:{player:{actorId:'player',name:'兼容验证',controllable:true,gameplay:{equipment:{weapon:{itemId:'old_pistol'},cyber_nervous_1:{itemId:'implant_a'},cyber_nervous_2:{itemId:'implant_b'}}}}}}};
  const result=await Sync.create({store:f.store,rows:Rows}).pushAll(terminal,4);assert.equal(result.ok,true,result.reason+' SQL='+f.lastError);assert.deepEqual(f.db.prepare('SELECT slot FROM cxx_equipment ORDER BY slot').all().map(row=>row.slot),['cyber_nervous_1','cyber_nervous_2','weapon']);assert.equal(f.db.prepare('SELECT note FROM player_notes').get().note,'保留玩家笔记');
 }finally{f.close();}
});
test('current complete schemas use the existing read-only readiness path',async()=>{const f=fixture({legacy:false});try{assert.equal((await f.store.ensureSchema()).ok,true);assert.equal(f.imports,0);}finally{f.close();}});
test('template ACK is followed by a readback of the upgraded constraint',async()=>{const f=fixture();try{f.api.importTemplateFromData=async()=>({success:true});const result=await Store.ensureSchema(f.api,template,{wait:1,step:1});assert.equal(result.ok,false);assert.match(result.reason,/旧槽位约束/);}finally{f.close();}});

const balanceState=yen=>({wallet:{yen,earned:Math.max(100,yen+100),spent:Math.max(100,yen+100)-yen},ensemble:{actors:{player:{actorId:'player',name:'余额验证',controllable:true,wallet:{yen}},npc_debt:{actorId:'npc_debt',name:'欠款人物',wallet:{yen:-37}}}}});
test('signed player and NPC balances mirror and read back through the actual SQL constraints',async()=>{
 const f=fixture({legacy:false});try{const sync=Sync.create({store:f.store,rows:Rows});for(const yen of [-100,0,250]){const result=await sync.pushAll(balanceState(yen),7);assert.equal(result.ok,true,result.reason+' SQL='+f.lastError);assert.equal(f.db.prepare('SELECT yen FROM cxx_wallet').get().yen,yen);assert.equal(f.db.prepare("SELECT yen FROM cxx_actor_stat WHERE actor_key='player'").get().yen,yen);assert.equal(f.db.prepare("SELECT yen FROM cxx_actor_stat WHERE actor_key='npc_debt'").get().yen,-37);}}finally{f.close();}
});
test('old nonnegative balance schemas upgrade once and preserve existing rows and player metadata',async()=>{
 const f=fixture({legacy:false,balanceLegacy:true});try{const before=structuredClone(f.data),ready=await f.store.ensureSchema();assert.equal(ready.ok,true,ready.reason);assert.equal(f.imports,1);for(const name of ['cxx_actor_stat','cxx_wallet']){assert.deepEqual(f.data['sheet_'+name].content,before['sheet_'+name].content);assert.equal(f.data['sheet_'+name].sourceData.playerNote,'保留余额说明');}assert.deepEqual(f.data.sheet_private,before.sheet_private);const result=await Sync.create({store:f.store,rows:Rows}).pushAll(balanceState(-100),8);assert.equal(result.ok,true,result.reason+' SQL='+f.lastError);assert.equal(f.db.prepare('SELECT yen FROM cxx_wallet').get().yen,-100);assert.equal(f.imports,1);}finally{f.close();}
});
