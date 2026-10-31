'use strict';
const http=require('http'),path=require('path'),assert=require('assert/strict');

function tone(){
 const rate=24000,samples=rate*3,b=Buffer.alloc(44+samples*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++)b.writeInt16LE(Math.sin(i/rate*440*Math.PI*2)*10000,44+i*2);return b;
}

module.exports=async({page,root,out,report})=>{
 const requests=[],wav=tone(),server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','content-type');res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS');
  if(req.method==='OPTIONS'){res.end();return;}
  let body='';for await(const chunk of req)body+=chunk;
  requests.push({path:req.url,body:body?JSON.parse(body):null});await new Promise(r=>setTimeout(r,600));res.writeHead(200,{'Content-Type':'audio/wav'});res.end(wav);
 });
 await new Promise(r=>server.listen(6973,'127.0.0.1',r));
 try{
  report.step='Mirror voice configuration';
  await page.evaluate(()=>document.querySelector('.jingyi-open-button').click());
  await page.locator('[data-jy-tts-gsv="baseUrl"]').waitFor({state:'attached'});
  await page.locator('[data-jy-tts-gsv="baseUrl"]').evaluate(input=>{
   const root=input.getRootNode();
   for(const el of root.querySelectorAll('[data-jy-tts-field="provider"]'))el.value='gsv';
   for(const [name,value]of Object.entries({baseUrl:'http://127.0.0.1:6973',refAudioPath:'fixture.wav',promptText:'你好',promptLang:'zh'}))root.querySelector('[data-jy-tts-gsv="'+name+'"]').value=value;
   root.querySelector('[data-jy-tts-gsv="viaProxy"]').checked=false;
   for(const enabled of root.querySelectorAll('[data-jy-tts-field="enabled"]'))enabled.checked=true;
   root.querySelector('[data-jy-tts-field="enabled"]').dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>__JINGYI__.tts.status().provider==='gsv'&&__JINGYI__.tts.status().readReady);
  await page.keyboard.press('Escape');
  await page.locator('.jy-close').waitFor({state:'detached'});
  report.step='Gal model import';
  await page.evaluate(()=>{const pane=document.createElement('section');pane.id='model-test-import';document.body.append(pane);window.removeModelImport=CxxLive2D.panel(pane);});
  await page.locator('#model-test-import input[type=file]').setInputFiles(path.join(root,'资源/爱音Live2D-v1.zip'));
  await page.waitForFunction(()=>CxxLive2D.read().installed,null,{timeout:60000});
  await page.evaluate(()=>{removeModelImport();document.querySelector('#model-test-import').remove();CxxLive2D.setEnabled(true);__cxx_gal_g1__.open();});
  await page.waitForFunction(()=>document.querySelector('.cxx-gal-sprite-slot[data-character="Anon"] iframe')?.contentDocument?.documentElement?.dataset.modelReady==='1',null,{timeout:40000});
  await page.evaluate(()=>Cxx236Preferences.whenIdle());
  report.step='Gal actual voice playback';
  const speaking=()=>page.evaluate(()=>document.querySelector('.cxx-gal-sprite-slot[data-character="Anon"] iframe')?.contentDocument?.documentElement?.dataset.speaking);
  assert.equal(await speaking(),'0');
  await page.locator('.cxx-gal-voice').click();
  await page.waitForFunction(()=>CxxReading.read().status.includes('生成语音'));
  assert.equal(await speaking(),'0');
  await page.waitForFunction(()=>CxxVoice.read().stage==='playing'&&CxxVoice.read().amplitude>.2,null,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('.cxx-gal-sprite-slot[data-character="Anon"] iframe')?.contentDocument?.documentElement?.dataset.speaking==='1');
  report.checks.push({galVoice:await page.evaluate(()=>CxxVoice.read()),provider:'MirrorTranslate public tts.speak -> local GPT-SoVITS-shaped WAV response -> card AudioContext'});
  await page.locator('.cxx-gal-next').click();
  await page.waitForFunction(()=>CxxVoice.read().amplitude===0);
  assert.equal(await speaking(),'0');
  await page.locator('summary[aria-controls=cxx-gal-audio-panel]').click();
  await page.getByRole('button',{name:'连续朗读',exact:true}).click();
  await page.waitForFunction(()=>CxxVoice.read().stage==='playing');
  assert.equal(await speaking(),'0');
  assert.equal(await page.evaluate(()=>CxxVoice.read().characterId),null);
  await page.evaluate(()=>CxxReading.stop());
  await page.locator('summary[aria-controls=cxx-gal-audio-panel]').click();
  await page.locator('.cxx-gal-next').click();
  await page.screenshot({path:path.join(out,'gal-live2d-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(out,'gal-live2d-phone.png')});
  report.checks.push('Waiting for audio keeps mouth closed; active Anon audio opens it; next paragraph stops sound; narration leaves mouth closed');
  const baseVoice=await page.evaluate(()=>({...CxxVoice.read(),index:2,characterId:'Anon',kind:'dialogue'}));
  for(const mismatch of [{characterId:'Taki'},{kind:'thought'},{swipe:1},{scope:'another-story'}]){
   await page.evaluate(async identity=>{const blob=await(await fetch('http://127.0.0.1:6973/identity-check')).blob();window.identityVoice=await CxxVoice.play(blob,identity);},{...baseVoice,...mismatch});
   await page.waitForFunction(()=>CxxVoice.read().stage==='playing'&&CxxVoice.read().amplitude>.2);
   assert.equal(await speaking(),'0');await page.evaluate(()=>identityVoice.stop());
  }
  report.checks.push('Other-character, thought, other-branch and other-story audio leave Anon mouth closed');
  report.step='Gal model lifecycle';
  for(let n=0;n<3;n++){
   await page.getByRole('button',{name:'返回原生',exact:true}).click();await page.evaluate(()=>Cxx236Preferences.whenIdle());
   await page.waitForFunction(()=>CxxLive2D.read().players===0&&CxxLive2D.read().objectURLs===0&&CxxLive2D.read().bindings===0);
   await page.evaluate(()=>__cxx_gal_g1__.open());
   await page.waitForFunction(()=>document.querySelector('.cxx-gal-sprite-slot[data-character="Anon"] iframe')?.contentDocument?.documentElement?.dataset.modelReady==='1');
   assert.equal(await page.locator('.cxx-gal-sprite-slot iframe').count(),1);await page.evaluate(()=>Cxx236Preferences.whenIdle());
  }
  await page.evaluate(()=>CxxLive2D.setEnabled(false));
  assert.equal(await page.locator('.cxx-gal-sprite-slot iframe').count(),0);
  await page.getByRole('button',{name:'返回原生',exact:true}).click();await page.evaluate(()=>Cxx236Preferences.whenIdle());
  report.checks.push({galLifecycle:await page.evaluate(()=>CxxLive2D.read()),voiceRequests:requests});assert(requests.length>=2);
 }catch(e){report.mediaFailure={requests,state:await page.evaluate(()=>({model:CxxLive2D.read(),voice:CxxVoice.read(),reading:CxxReading.read(),source:CxxReading.paragraphs(SillyTavern.getContext().chat.length-1),frames:[...document.querySelectorAll('.cxx-gal-sprite-slot iframe')].map(f=>({ready:f.contentDocument?.documentElement?.dataset.modelReady,speaking:f.contentDocument?.documentElement?.dataset.speaking,html:f.contentDocument?.body?.innerText?.slice(0,200)}))})).catch(()=>null)};throw e;
 }finally{await new Promise(r=>server.close(r));}
};
