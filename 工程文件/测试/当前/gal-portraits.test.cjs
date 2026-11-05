'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../../卡片源码/运行时/story-profile.js'),Parser=require('../../卡片源码/Gal/parser.js'),Sprites=require('../../卡片源码/Gal/sprites.js');
const profile=()=>({schema:1,id:'profile_example',name:'雾岛'}),asset=id=>({schema:1,kind:'asset',id:'art_'+id.repeat(64)});
const stat={terminal:{ensemble:{actors:{player:{actorId:'player',name:'雾岛'},wb_4:{actorId:'wb_4',name:'高松灯',worldbookUid:4},npc_new:{actorId:'npc_new',name:'诊所医生'}}}}};
const edit=(previous,id,character)=>P.withGalPortraits(previous,{id,expectedVisual:P.visualStamp(previous),characterId:'player',character});
test('player, built-in and story NPC identities resolve without changing the shared cast',()=>{
 const characters=P.characters(profile(),stat),before=JSON.stringify(Sprites.characters);
 assert.equal(characters.find(p=>p.id==='Tomorin').actorId,'wb_4');assert.equal(characters.find(p=>p.id==='npc_new').name,'诊所医生');
 const raw='<cxx-story><cxx-say speaker="User" expression="smile">你好。</cxx-say><cxx-say speaker="诊所医生" expression="serious">先坐。</cxx-say></cxx-story>';
 const parsed=Parser.parseMessage(raw,{characters});assert.deepEqual(parsed.paragraphs.map(p=>p.characterId),['player','npc_new']);
 const selected=Sprites.select(parsed,1,(id,face)=>id+'/'+face,{},characters);assert.deepEqual(selected.map(p=>p.id).sort(),['npc_new','player']);assert.equal(selected.find(p=>p.id==='npc_new').expression,'serious');assert.equal(JSON.stringify(Sprites.characters),before);
});
test('parser cache and explicit scene cast follow the current story identity',()=>{
 const raw='<cxx-story><cxx-say speaker="User" expression="smile">你好。</cxx-say></cxx-story><ztl>{"location":"诊所","time":"夜","characters":[{"name":"User","outfit":"外套","thought":""}]}</ztl>';
 for(const name of ['雾岛','林夏']){const characters=P.characters({...profile(),name},stat),parsed=Parser.parseMessage(raw,{key:'same-reply',characters});assert.equal(parsed.paragraphs[0].speaker,name);assert.equal(parsed.scene.charactersValid,true);assert.equal(parsed.scene.characters[0].name,name);}
 assert.equal(Parser.parseMessage(raw).paragraphs[0].characterId,null);
});
test('User follows the actor controlled on the selected message while character IDs stay stable',()=>{
 const raw='<cxx-story><cxx-say speaker="User" expression="smile">你好。</cxx-say></cxx-story>',historical=structuredClone(stat),current=structuredClone(stat);historical.terminal.ensemble.control={actorId:'player'};current.terminal.ensemble.control={actorId:'wb_4'};
 assert.equal(Parser.parseMessage(raw,{key:'same-floor',characters:P.characters(profile(),historical)}).paragraphs[0].characterId,'player');
 assert.equal(Parser.parseMessage(raw,{key:'same-floor',characters:P.characters(profile(),current)}).paragraphs[0].characterId,'Tomorin');
 assert.equal(P.characters(profile(),current).find(p=>p.id==='Tomorin').controlled,true);
 assert.equal(Parser.parseMessage(raw,{key:'same-floor',characters:P.characters(profile(),historical)}).paragraphs[0].characterId,'player');
});
test('portrait expressions save in one story and use its default image for missing expressions',()=>{
 const a=edit(profile(),'visual_a',{name:'雾岛',aliases:[],default:asset('a'),expressions:{smile:asset('b')}}),b=profile(),table={assets:{[asset('a').id]:{src:'default-a'},[asset('b').id]:{src:'smile-b'}}};
 assert.equal(P.galImage(a,'player','smile',table),'smile-b');assert.equal(P.galImage(a,'player','sadness',table),'default-a');assert.equal(P.galImage(b,'player','smile',table),null);
 assert.deepEqual(JSON.parse(JSON.stringify(a)),a);assert.equal(a.name,'雾岛');assert.equal(b.galPortraits,undefined);
});
test('visual save retries keep the same request and reject changed or stale drafts',()=>{
 const p=profile(),request={id:'visual_retry',expectedVisual:P.visualStamp(p),characterId:'player',character:{name:'雾岛',aliases:['小雾'],default:asset('a'),expressions:{}}},saved=P.withGalPortraits(p,request);
 assert.deepEqual(P.withGalPortraits(saved,request),saved);assert.throws(()=>P.withGalPortraits(saved,{...request,character:{...request.character,default:asset('b')}}),/同一/);assert.throws(()=>P.withGalPortraits(saved,{...request,id:'visual_stale'}),/已变化/);
 assert.deepEqual(P.artReferences(saved),[asset('a').id]);
});
test('new named characters and aliases remain stable across save round trips',()=>{
 const p=profile(),saved=P.withGalPortraits(p,{id:'visual_new',expectedVisual:P.visualStamp(p),characterId:'custom_clerk',character:{name:'夜班店员',aliases:['店员'],default:asset('c'),expressions:{}}}),restored=JSON.parse(JSON.stringify(saved)),characters=P.characters(restored,stat);
 const parsed=Parser.parseMessage('<cxx-story><cxx-say speaker="店员">请拿好。</cxx-say></cxx-story>',{characters});assert.equal(parsed.paragraphs[0].characterId,'custom_clerk');assert.equal(P.galImage(restored,'custom_clerk','normal',{assets:{[asset('c').id]:{src:'clerk'}}}),'clerk');
});
test('legacy player portrait is the initial Gal default and removing a custom slot preserves it',()=>{
 const p={...profile(),portrait:asset('a')},saved=edit(p,'visual_set',{name:'雾岛',aliases:[],default:asset('b'),expressions:{}}),cleared=P.withGalPortraits(saved,{id:'visual_clear',expectedVisual:P.visualStamp(saved),characterId:'player',character:null});
 assert.deepEqual(cleared.portrait,p.portrait);assert.equal(P.galImage(cleared,'player','smile',{assets:{[asset('a').id]:{src:'legacy'}}}),'legacy');assert.deepEqual(P.artReferences(cleared),[asset('a').id]);
});
test('Gal image entry accepts stored WebP while preserving the existing URL boundary',()=>{
 const text=require('node:fs').readFileSync(require.resolve('../../卡片源码/Gal/ui.js'),'utf8'),start=text.indexOf('    function safeSpriteUrl(value)'),end=text.indexOf('    function removeSprite(',start),resolve=new Function('doc',text.slice(start,end)+';return safeSpriteUrl;')({baseURI:'https://example.test/play/'}),webp='data:image/webp;base64,UklGRg==';
 assert.equal(resolve(webp),webp);assert.equal(resolve('https://cyber2051.top/img/p.png'),'https://cyber2051.top/img/p.png');assert.equal(resolve('data:image/svg+xml,<svg onload="alert(1)"/>'),'');assert.equal(resolve('javascript:alert(1)'),'');assert.equal(resolve('https://other.invalid/image.png'),'');
});
