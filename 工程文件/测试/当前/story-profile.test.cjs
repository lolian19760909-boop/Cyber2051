'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Profile=require('../../卡片源码/运行时/story-profile.js'),Guide=require('../../卡片源码/通讯/mirror-guide.js'),Flow=require('../../卡片源码/运行时/opening-flow.js'),I=require('../../卡片源码/运行时/identity.js');
const cp=structuredClone,asset={schema:1,id:'art_fixture',src:'data:image/webp;base64,AA==',mime:'image/webp',width:1,height:1};
test('default persona stays out of supplementary text; explicit import preserves the draft and is repeatable',()=>{
 const text='默认人物'.repeat(1200),win={crypto:globalThis.crypto,SillyTavern:{getContext:()=>({name1:'夜',powerUserSettings:{persona_description:text}})}};
 const draft=Profile.seed(win);assert.equal(draft.name,'夜');assert.equal(draft.additional,'');assert.equal(Profile.hostPersona(win),text);assert(!Profile.description(draft).includes('默认人物'));
 draft.additional='本故事的手写设定';const imported=Profile.importPersona(draft,text);assert.equal(imported.additional,draft.additional+'\n\n'+text);assert.deepEqual(Profile.importPersona(imported,text),imported);assert.equal(draft.additional,'本故事的手写设定');
});
function fixture(){let chatId='A',fail=false;const books={original:[]},disk={original:[]},counts={create:0,write:0,bind:0},chats={A:{__cxx_story_v1:{routeId:'a'},variables:{unknown:8}},B:{__cxx_story_v1:{routeId:'b'},variables:{unknown:9}}};
 const settings={personas:{original:'旧人物'},persona_descriptions:{original:{description:'旧设定'}}};
 const c=()=>({getCurrentChatId:()=>chatId,chatMetadata:chats[chatId],name1:'旧人物',powerUserSettings:settings,getRequestHeaders:()=>({}),saveWorldInfo:async(n,raw)=>{counts.write++;books[n]=Object.values(cp(raw.entries));if(!fail)disk[n]=cp(books[n]);},saveMetadata:async()=>{}});
 const win={crypto:globalThis.crypto,SillyTavern:{getContext:c},fetch:async(url,opts)=>{assert.equal(url,'/api/worldinfo/get');return Response.json({entries:Object.fromEntries((disk[JSON.parse(opts.body).name]||[]).map(e=>[e.uid,e]))});}};
 const api={getCharWorldbookNames:()=>({primary:'original'}),getWorldbookNames:()=>Object.keys(books),getChatWorldbookName:()=>chats[chatId].world_info||null,getWorldbook:async n=>cp(books[n]),createWorldbook:async(n,e)=>{counts.create++;books[n]=cp(e);if(!fail)disk[n]=cp(e);},replaceWorldbook:async(n,e)=>{counts.write++;books[n]=cp(e);if(!fail)disk[n]=cp(e);},rebindChatWorldbook:async(_,n)=>{counts.bind++;chats[chatId].world_info=n;}};
 const p={schema:1,id:'profile_fixture',name:'悠',appearance:'黑发',additional:'玩家的补充',future:{keep:true},avatar:{kind:'asset',id:asset.id},avatarUpload:asset};return {p,win,api,books,disk,settings,chats,counts,options:{api},setFail:x=>fail=x,switch:x=>chatId=x};}
test('three stories keep separate entries in the original book and only the selected entry enters a request',async()=>{
 const f=fixture();f.books.original=f.disk.original=[{uid:7,comment:'其他资料',content:'保留',future:{keep:1}}];
 const a=await Profile.bind(f.win,f.p,f.options);f.switch('B');const b=await Profile.bind(f.win,{...f.p,name:'遥'},f.options);
 f.chats.C={__cxx_story_v1:{routeId:'c'}};f.switch('C');const c=await Profile.bind(f.win,{...f.p,name:'丰川祥子',additional:'{{user}}扮演丰川祥子'},f.options);
 assert.equal(a.binding.worldbook,'original');assert.equal(b.binding.worldbook,'original');assert.equal(c.binding.worldbook,'original');assert.equal(new Set([a,b,c].map(p=>p.binding.entryUid)).size,3);assert.equal(f.counts.create,0);
 for(const [id,p]of [['A',a],['B',b],['C',c]]){f.switch(id);const selected=await Profile.selected(f.win,f.options),payload={characterLore:cp(f.books.original),chatLore:cp(f.books.original),globalLore:[],personaLore:[]};Profile.filterEntries(payload,p.binding,selected,p.binding.routeId);const profiles=Object.values(payload).flat().filter(e=>e.extra?.__cxx_story_profile);assert.equal(profiles.length,1);assert.equal(profiles[0].uid,p.binding.entryUid);assert.equal(profiles[0].disable,false);}
 assert.equal(f.settings.personas.original,'旧人物');assert.equal(f.chats.A.variables.unknown,8);assert.deepEqual(f.books.original[0].future,{keep:1});assert.equal(f.counts.write,3);
});
test('failed disk readback leaves metadata intact and retry reuses the route entry',async()=>{const f=fixture();f.setFail(true);await assert.rejects(Profile.bind(f.win,f.p,f.options),/保存/);assert.equal(f.chats.A.__cxx_story_profile,undefined);f.setFail(false);await Profile.bind(f.win,f.p,f.options);assert.equal(f.counts.create,0);assert.equal(f.counts.write,2);assert.equal(f.books.original.length,1);});
test('twelve routes share one original book with stable IDs, including simultaneous windows and reordered TT JSON',async()=>{
 const f=fixture(),windows=[];const fetch=f.win.fetch;f.win.fetch=async(...args)=>{const value=await(await fetch(...args)).json();for(const [id,e]of Object.entries(value.entries))value.entries[id]=Object.fromEntries(Object.entries(e).reverse());return Response.json(value);};
 for(let i=0;i<12;i++){const id='route-'+i;f.chats[id]={__cxx_story_v1:{routeId:id}};f.switch(id);const context=f.win.SillyTavern.getContext();windows.push({...f.win,SillyTavern:{getContext:()=>({...context,getCurrentChatId:()=>id})}});}
 const options={api:{...f.api,getChatWorldbookName:()=>null}},saved=await Promise.all(windows.map((w,i)=>Profile.bind(w,{...f.p,name:'身份'+i},options)));
 assert.equal(f.disk.original.length,12);assert.equal(new Set(saved.map(p=>p.binding.entryUid)).size,12);assert.equal(f.counts.create,0);
 for(let i=11;i>=0;i--){const p=await Profile.bind(windows[i],saved[i],options);assert.equal(p.binding.entryUid,saved[i].binding.entryUid);const row=await Profile.selected(windows[i],options),payload={characterLore:cp(f.disk.original)};Profile.filterEntries(payload,p.binding,row,p.binding.routeId);assert.equal(payload.characterLore.length,1);assert.match(payload.characterLore[0].content,new RegExp('身份'+i+'。'));}
 assert.equal(f.counts.write,12);
});
test('legacy profile migration preserves manual text; a branch receives its own entry exactly once',async()=>{
 const f=fixture(),old='cxx-content-legacy';f.books[old]=f.disk[old]=[{uid:9,comment:'人物',content:'作者手改的资料',extra:{__cxx_story_profile:{schema:1,routeId:'a'}}}];f.chats.A.world_info=old;
 const a=await Profile.bind(f.win,f.p,f.options);assert.equal(a.binding.worldbook,'original');assert.equal(f.chats.A.world_info,null);assert.equal(f.disk.original[0].content,'作者手改的资料');
 f.switch('B');const b=await Profile.bind(f.win,a,f.options);assert.notEqual(b.binding.entryUid,a.binding.entryUid);assert.equal(b.worldbookContent,'作者手改的资料');await Profile.bind(f.win,b,f.options);assert.equal(f.disk.original.length,2);assert.equal(f.counts.create,0);
 f.disk.original[1].content='再次手改';await Profile.bind(f.win,b,f.options);assert.equal(f.chats.B.__cxx_story_profile.worldbookContent,'再次手改');assert.equal(f.disk.original[0].content,'作者手改的资料');
});

test('legacy official text and a pre-profile identity migrate once with the original book',async()=>{
 const f=fixture(),legacy='Cyber2051-Story-old';f.books[legacy]=f.disk[legacy]=[{uid:40,content:'手改任务进展',future:'keep',extra:{__cxx_official_content:{instanceId:'instance',owner:'pack',id:'quest.1',baseline:{fields:{}}}}}];f.chats.A.world_info=legacy;f.chats.A.variables.__cxx_identity={setupToken:'confirmed',id:'street',name:'街头小子',background:'已经确认的背景'};
 const row=await Profile.selected(f.win,f.options);assert.match(row.content,/旧人物/);assert.match(row.content,/已经确认的背景/);assert.equal(f.chats.A.world_info,null);assert.equal(f.disk.original.find(e=>e.content==='手改任务进展').future,'keep');
 await Profile.selected(f.win,f.options);assert.equal(f.disk.original.length,2);assert.equal(f.counts.create,0);
 f.switch('B');await Profile.bind(f.win,f.chats.A[Profile.KEY],f.options);const copied=f.disk.original.filter(e=>e.content==='手改任务进展');assert.equal(copied.length,2);assert.notEqual(copied[0].uid,copied[1].uid);assert.equal(copied[1].extra.__cxx_official_content.routeId,'b');
});
test('import on another installation restores exported manual profile text without the old book',async()=>{const f=fixture();const p={...f.p,binding:{schema:4,worldbook:'missing',entryUid:90,routeId:'other'},worldbookContent:'异机导入的手改资料'};const a=await Profile.bind(f.win,p,f.options);assert.equal(a.worldbookContent,p.worldbookContent);assert.equal(f.counts.create,0);});
test('profile is not serialized into model text with image or unknown state; names validated',()=>{const f=fixture(),text=Profile.description(f.p);assert.match(text,/姓名：悠/);assert(!/avatar|base64|future/.test(text));assert.throws(()=>Profile.normalize({...f.p,name:' '}));});

test('creator traits and portrait bind to one story and survive a JSON save round trip without changing global persona',async()=>{
 const f=fixture(),Art=require('../../卡片源码/运行时/item-art.js'),crypto=require('crypto'),src=require('../../卡片源码/运行时/player-assets.js').cyberdeck,bytes=Buffer.from(src.split(',')[1],'base64');
 const upload={schema:1,id:'art_'+crypto.createHash('sha256').update(bytes).digest('hex'),src,mime:'image/webp',...Art.dimensions(bytes),purpose:'portrait'};
 f.chats.A[Art.key]=await Art.merge(null,[{...upload,purpose:undefined,foreign:{keep:1}}]);
 f.p.appearanceTraits={schema:1,values:{hair:'长卷发',skinTone:'小麦色',future:'unknown'},future:{keep:4}};f.p.portrait={schema:1,kind:'asset',id:upload.id};f.p.portraitUpload=upload;
 const saved=await Profile.bind(f.win,f.p,{...f.options,art:Art});assert.equal(saved.portraitUpload,undefined);assert.equal(saved.portrait.id,upload.id);assert.deepEqual(f.chats.A[Art.key].assets[upload.id].foreign,{keep:1});
 assert.match(f.books[saved.binding.worldbook].at(-1).content,/发型：长卷发/);assert(!/base64|future|unknown/.test(f.books[saved.binding.worldbook].at(-1).content));
 const transport=JSON.parse(JSON.stringify(f.chats.A));f.chats.A=transport;await Profile.bind(f.win,transport[Profile.KEY],{...f.options,art:Art});assert.equal(f.counts.create,0);assert.deepEqual(f.chats.A[Profile.KEY].appearanceTraits.future,{keep:4});assert.equal(f.chats.A[Art.key].assets[upload.id].src,src);assert.equal(f.settings.personas.original,'旧人物');
 f.switch('B');await assert.rejects(Profile.bind(f.win,saved,{...f.options,art:Art}),/立绘资源缺失/);assert.equal(f.chats.B[Profile.KEY],undefined);
});
test('current avatar comes from the persona module and survives special filename characters',async()=>{assert.equal(await Profile.currentAvatar({}, {load:async()=>({personas:{user_avatar:'玩家 #1.png'},host:{default_user_avatar:'/default.png'}})}),'/User Avatars/'+encodeURIComponent('玩家 #1.png'));});
test('story switch while reading a book stops further mutation',async()=>{const f=fixture();f.books.shared=[];f.chats.A.world_info='shared';const fetch=f.win.fetch;f.win.fetch=async(...args)=>{const r=await fetch(...args);f.switch('B');return r;};await assert.rejects(Profile.bind(f.win,f.p,f.options),/切换/);assert.equal(f.counts.create,0);assert.equal(f.chats.B.__cxx_story_profile,undefined);});
test('only the approved 10 stable opening IDs remain reachable in expandable band catalog',()=>{const groups=require('../../卡片源码/开场/groups.json'),catalog=require('../../卡片源码/开场/catalog.json'),ids=new Set(groups.bands.flatMap(b=>[...b.characters.flatMap(c=>c.openings),...b.special]));assert.deepEqual([...ids].sort((a,b)=>a-b),catalog.filter(r=>r.id!==1).map(r=>r.id));assert.equal(ids.size,10);});
test('persona draft and review retain content without writes until final confirmation',async()=>{const storage=new Map();let count=0,got;const opts={key:'draft',identity:I,storage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},readIdentity:()=>null,readPreferences:()=>({level:'medium',device:'desktop',gal:false}),readProfile:()=>({schema:1,id:'profile_draft',name:'旧名'}),prepare:async()=>{},submit:async o=>{got=o;count++;},verify:async()=>{},send:async()=>{}};const a=Flow.create(opts);a.next();a.patch({profile:{name:'新名',appearance:'银发'}});a.next();a.next();a.next();a.selectScenario(11);a.review();assert.equal(count,0);a.destroy();const b=Flow.create(opts);assert.equal(b.state().draft.step,'review');assert.equal(b.state().draft.profile.name,'新名');await b.commit();assert.equal(count,1);assert.equal(got.profile.appearance,'银发');});
test('Fish links resolve only valid voice IDs; errors give specific recovery',()=>{const id='abcdef0123456789abcdef0123456789';assert.equal(Guide.voiceId('https://fish.audio/m/'+id+'/'),id);assert.equal(Guide.voiceId(id),id);assert.equal(Guide.voiceId(''),'');assert.throws(()=>Guide.voiceId('https://evil.test/'+id));assert.throws(()=>Guide.voiceId('https://fish.audio/discovery/'));assert.match(Guide.explain(Error('HTTP 402 credit')),/用量|额度/);assert.match(Guide.explain(Error('HTTP 401')),/密钥/);assert.match(Guide.explain(Error('Failed to fetch')),/连接/);});

test('story portrait retries are idempotent and cannot mutate persona or unknown fields',()=>{
 const original={schema:1,id:'profile_art',name:'悠',avatar:{kind:'asset',id:'avatar-keep'},binding:{avatar:'host-keep'},future:{keep:1}},before=cp(original);
 const request={id:'visual_first',expectedVisual:Profile.visualStamp(original),portrait:{schema:1,kind:'gallery',id:'Anon'}};
 const saved=Profile.withPortrait(original,request);assert.deepEqual(original,before);assert.equal(saved.visualRevision,1);
 assert.deepEqual(Profile.withPortrait(saved,request),saved);assert.deepEqual(saved.avatar,before.avatar);assert.deepEqual(saved.binding,before.binding);assert.deepEqual(saved.future,before.future);
 assert.equal(Profile.description(saved),Profile.description(original));
 assert.throws(()=>Profile.withPortrait(saved,{...request,portrait:{schema:1,kind:'gallery',id:'Tomorin'}}),/同一/);
 assert.throws(()=>Profile.withPortrait(saved,{...request,id:'visual_stale'}),/已变化/);
});
test('independent story portraits restore defaults without deleting shared image resources',()=>{
 const a={schema:1,id:'profile_a',name:'A'},b={schema:1,id:'profile_b',name:'B'},assetRef={schema:1,kind:'asset',id:'art_'+'a'.repeat(64)};
 const changed=Profile.withPortrait(a,{id:'visual_upload',expectedVisual:Profile.visualStamp(a),portrait:assetRef});assert.equal(b.portrait,undefined);
 const restored=Profile.withPortrait(changed,{id:'visual_restore',expectedVisual:Profile.visualStamp(changed),portrait:null});assert.equal(restored.portrait,undefined);assert.equal(changed.portrait.id,assetRef.id);assert.equal(restored.visualRevision,2);
 for(const portrait of [{schema:2,kind:'gallery',id:'Anon'},{schema:1,kind:'gallery',id:'invented'},{schema:1,kind:'asset',id:'https://bad.test/image'}])assert.throws(()=>Profile.portrait(portrait),/无效/);
});
