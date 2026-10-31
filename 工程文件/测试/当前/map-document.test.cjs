'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const UI=require('../../卡片源码/地图/document-style.js'),eng=path.resolve(__dirname,'../..'),resource=JSON.parse(fs.readFileSync(path.join(eng,'卡片源码/地图/resources.json'))),sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function read(ref){const data=fs.readFileSync(path.join(eng,'网站/atlas',ref.path));assert.equal(data.length,ref.bytes);assert.equal(sha(data),ref.sha256);return ref.path.endsWith('.gz')?zlib.gunzipSync(data).toString():data.toString();}
const index=JSON.parse(read(resource.manifest)),shared=read(index.shared),styles=['atlas.css','detail.css','map-labels.css'].map(file=>fs.readFileSync(path.join(eng,'卡片源码/地图',file),'utf8'));
styles[0]=fs.readFileSync(path.join(eng,'卡片源码/主题/tokens.css'),'utf8')+'\n'+styles[0];
const withoutStyles=html=>html.replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi,'$1$2');
for(const [id,record]of Object.entries(index.documents))test(id+' replaces the three maintained sheets and the approved clinic text without changing map IDs or coordinates',()=>{
 const input=read(record.page).replace('/*CXX_ATLAS_SHARED_RUNTIME*/',()=>shared),output=UI.prepare(input,styles);
 const normalized=text=>withoutStyles(text)
  .replaceAll('红花街内的义体诊所','<clinic-headline>').replaceAll('夕暮老街的义体与神经内科诊所','<clinic-headline>')
  .replaceAll('街里有一家便宜实惠、技术过硬的义体诊所——『阿杨』义体诊所，老板是在日长大的华人，对中国了解并不深，海铃经常光顾。','<clinic-street>')
  .replaceAll('海铃也常去夕暮老街找宇田川巴处理伤口与维护义体，巴的诊所与羽泽咖啡店比邻。','<clinic-street>')
  .replaceAll('红花街里一家便宜实惠、技术过硬的义体诊所，老板是在日长大的华人，对中国了解并不深。海铃经常光顾这家义体诊所','<clinic-description>')
  .replaceAll('夕暮老街的独立义体与神经内科诊所，由宇田川巴主理，与羽泽咖啡店比邻。海铃经常来这里接受外伤处理与义体维护','<clinic-description>')
  .replaceAll('红花街里一家便宜实惠、技术过硬的义体诊所，老板是在日长大的华人，对中国了解并不深。','<clinic-summary>')
  .replaceAll('夕暮老街的独立义体与神经内科诊所，由宇田川巴主理，与羽泽咖啡店比邻。','<clinic-summary>')
  .replaceAll('卡内定案『红花街里』（随红花街锚点）','<clinic-position>')
  .replaceAll('夕暮老街的巴诊所；地图点位沿用原诊所坐标','<clinic-position>')
  .replaceAll('阿杨义体诊所','<clinic-name>').replaceAll('宇田川巴的老街诊所','<clinic-name>');
 assert.equal(normalized(output),normalized(input));assert.equal((output.match(/<style\b/g)||[]).length,3);
 assert(!output.includes('阿杨'));
 if(id==='tokyo-central'){assert(output.includes('宇田川巴的老街诊所'));assert(output.includes('a-yang-clinic'));}
 assert.deepEqual([...output.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]),styles);
});
test('a different document recipe fails before an iframe receives partially styled markup',()=>{
 for(const html of ['<head></head>','<style>a{}</style>','<style>a{}</style>'.repeat(4)])assert.throws(()=>UI.prepare(html,styles),/配方/);
});

test('industrial parks replace the obsolete bay overlay, survive scene packets and keep old facility IDs and coordinates',()=>{
 const vm=require('node:vm'),source=f=>fs.readFileSync(path.join(eng,'卡片源码',f),'utf8'),industrial=JSON.parse(source('地图/industrial-parks.json')),places=require('../../卡片源码/地图/place-build.cjs').load(source).places;
 const input=read(index.documents['tokyo-central'].page).replace('/*CXX_ATLAS_SHARED_RUNTIME*/',()=>shared),output=UI.prepare(input,styles,places,{},industrial);
 function unpack(html){const box={window:{}};vm.runInNewContext([...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)][0][1],box);return JSON.parse(JSON.stringify(box.window));}
 const before=unpack(input),after=unpack(output),a=after.TOKYO_ATLAS,b=before.TOKYO_ATLAS;assert.equal(a.regions.length,b.regions.length);assert.deepEqual(a.regions.filter(r=>r.id!=='minato'),b.regions.filter(r=>r.id!=='minato'));assert.equal(a.regions[7].id,'minato');assert.equal(a.regions[7].name,'联合工业区');assert.equal(a.regions[7].kind,'alias');assert(a.sectorDefinitions.find(s=>s.id==='central-core').members.includes('minato'));
 for(const p of b.services){const next=a.services.find(x=>x.id===p.id);assert(next);assert.deepEqual(next.at,p.at);if(industrial.facilities[p.id]?.group)assert.equal(next.group,industrial.facilities[p.id].group);}
 for(const key of ['overview','central-core']){const packet={districtExpansion:{...a.districtExpansion,...JSON.parse(after.TOKYO_ATLAS_PACKETS[key]).districtExpansion}};for(const d of industrial.districts){assert(packet.districtExpansion.districts.some(x=>x.id===d.id));assert(packet.districtExpansion.places.some(x=>x.id===d.id+'-gate'));}}
 for(const d of industrial.districts){assert.equal(a.districtExpansion.districts.filter(x=>x.id===d.id).length,1);const p=places.find(x=>x.industrialDistrict===d.id);assert(p.desc.length>40);assert.equal(p.kind,'private');assert.equal(require('../../卡片源码/运行时/police.js').rules.districts[p.group].name,'联合工业区');}
 assert(!output.includes('环湾港区'));assert.deepEqual(a.buildings,b.buildings);assert.deepEqual(a.footprints,b.footprints);
});
