const {test}=require('node:test'),assert=require('node:assert/strict');
const Bridge=require('../../卡片源码/通讯/jingyi-bridge.js'),Reader=require('../../卡片源码/通讯/reading-service.js'),Prefs=require('../../卡片源码/MVU/preferences.js');
test('story off blocks every paid bridge operation and handshake; enabling retains plugin configuration',async()=>{
 let enabled=false,calls=0;const config={secret:'private-fixture',automatic:true},original=JSON.stringify(config),top={__JINGYI__:{features:['llm.stream','tts.stream','call.connect','stt'],tts:{status:()=>({enabled:true,readReady:true,streamReady:true}),voices:()=>[],speak:()=>calls++,stream:()=>calls++},llm:{stream:()=>calls++},call:{connect:()=>{calls++;return{};}},stt:{status:()=>({available:true}),start:()=>calls++}}};
 const b=Bridge.create(top,{enabled:()=>enabled});assert.equal((await b.refresh()).read,false);for(const method of ['llm','stream','speak','renderSpeech','mic'])assert.throws(()=>b[method]({}),/关闭/);assert.equal(calls,0);enabled=true;assert.equal((await b.refresh()).read,true);assert.equal(calls,1);enabled=false;assert.throws(()=>b.speak({}),/关闭/);assert.equal(JSON.stringify(config),original);b.destroy();
});
test('old stories preserve enabled behavior; explicit false remains story-local',()=>{
 assert.equal(Prefs.read({}).mirror,true);assert.equal(Prefs.read({__cxx_ui_preferences:{mirror:false}}).mirror,false);assert.equal(Prefs.read({__cxx_ui_preferences:{mirror:true}}).mirror,true);
});
test('off uses canonical original projection while refusing reading and paid voice',async()=>{
 const snapshot={state:'ready',sourceMessage:'<cxx-story><cxx-say speaker="千早爱音">明天见。</cxx-say></cxx-story>',segments:[]},parser=require('../../卡片源码/Gal/parser.js');let enabled=false,calls=0;const reader=Reader.create({top:{},api:{SillyTavern:{getContext:()=>({chat:[]})}},runtime:{key:()=> 'story'},parser,core:{},bridge:{refresh:()=>calls++},settings:()=>({readingMode:'compare'}),enabled:()=>enabled});
 assert.equal(reader.mode(),'original');assert.equal(reader.displayRaw(snapshot),snapshot.sourceMessage);assert.equal(reader.read().enabled,false);await assert.rejects(reader.setMode('reading'),/开启/);await assert.rejects(reader.play({floor:0}),/关闭/);await assert.rejects(reader.readText({text:'test'}),/关闭/);assert.equal(calls,0);enabled=true;assert.equal(reader.mode(),'compare');reader.destroy();
});
