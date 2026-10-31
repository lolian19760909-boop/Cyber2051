'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {stage,root,extract}=require('./fixtures/tag-stage.cjs'),fixture=require('./fixtures/update-variable.cjs');
const cache=process.env.CXX_EVIDENCE?path.resolve(process.env.CXX_EVIDENCE):path.join(root,'.cache/tag-overflow'),css=fs.readFileSync(path.join(root,'卡片源码/原生/prose.css'),'utf8');
async function main(){
  const staged=stage(),all=staged.card.data.extensions.tavern_helper.scripts.map(s=>s.content||'').join('\n'),globals=all.includes('globalThis.CxxDisplayGuardStyle=')?require('../../工具/lib/card-global.cjs')(all,['CxxDisplayGuardStyle']):staged.receipt.inMemoryOnly?'globalThis.CxxDisplayGuardStyle='+JSON.stringify(require('../../工具/lib/ui-theme.cjs').scopedSheet(f=>fs.readFileSync(path.join(root,'卡片源码',f),'utf8'),'正文/display-guard.css','#chat .mes_text :is(.cxx-dialogue-mode,.custom-cxx-dialogue-mode,.cxx-update-diagnostic)'))+';':'',widths=(process.env.CXX_WIDTHS||'390,844,1280').split(',').map(Number),zoom=Number(process.env.CXX_ZOOM)||1,report={...staged.receipt,checks:[],errors:[],scope:'Isolated browser: real local Markdown/sanitizer, current card regex, controlled ST hooks and TT legacy formatter; no real ST/TT or player data.'};
  fs.mkdirSync(cache,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try{
    for(const mode of ['hooks','legacy']){
      const page=await browser.newPage({viewport:{width:Math.round(390/zoom),height:Math.round(844/zoom)},deviceScaleFactor:zoom});page.on('pageerror',e=>report.errors.push(e.message));await page.route('**/*',r=>r.abort());
      await page.setContent('<style>html{color:#e2e5ee;background:#11151b;font:16px/1.6 sans-serif;--cxx-text:#e2e5ee;--cxx-muted:#aeb8c6;--cxx-line:#42515d;--cxx-red:#eb5576;--cxx-cyan:#9ed6d9;--cxx-ink:#10131a}body{margin:8px}#chat{max-width:840px;margin:auto}summary{cursor:pointer}</style><div id="chat"><div class="mes" mesid="0"><div class="mes_text"></div></div></div>');
      await page.addScriptTag({path:'D:/SillyTavern/node_modules/showdown/dist/showdown.js'});await page.addScriptTag({path:'D:/SillyTavern/node_modules/dompurify/dist/purify.js'});
      await page.addScriptTag({content:extract(staged.core,['Cxx238Dialogue'])[0].source});
      await page.addScriptTag({path:path.join(root,'卡片源码/运行时/character-comparison.js')});
      if(globals)await page.addScriptTag({content:globals});
      for(const code of Object.values(staged.code))await page.addScriptTag({content:code});
      await page.evaluate(({mode,fixture,rules,css})=>{
        window.fixture=fixture;window.listeners=new Set();window.scope='fixture-chat';window.hooks={};window.formatCalls=0;window.formatMode='regex';
        const md=new showdown.Converter(),escape=t=>t.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
        window.c={characterId:0,characters:[{avatar:'test-card.png',name:'测试卡'}],chat:[],getCurrentChatId:()=>scope,eventTypes:{}};
        const format=(raw,name,a,user)=>{
          formatCalls++;let text=raw;
          if(formatMode==='escaped')return '<p>'+escape(text)+'</p>';
          if(formatMode==='regex')for(const rule of rules){
            if(rule.disabled||!rule.placement?.includes(user?1:2)||rule.promptOnly||rule.minDepth>0)continue;
            const m=/^\/(.*)\/([dgimsuvy]*)$/.exec(rule.findRegex);text=text.replace(m?new RegExp(m[1],m[2]):new RegExp(rule.findRegex),rule.replaceString);
          }
          if(mode==='hooks')text=hooks.afterRegex?.(text)??text;
          return DOMPurify.sanitize(md.makeHtml(text));
        };
        if(mode==='hooks')c.messageFormatter={addHook(fn,o){hooks[o.stage]=fn;},format};else c.messageFormatting=format;
        window.runtime={alive:true,key:()=>scope,watchMessages(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
        window.api={SillyTavern:{getContext:()=>c}};
        window.stopGuard=CxxDisplayGuard235.install({top:window,api,runtime,parser:CxxGalParser});
        window.native=CxxNativeHost.mount({window,context:()=>c,subscribe:()=>()=>{},prose:CxxNativeProse,terminalFactory:{create:()=>({close(){},destroy(){}})},css,notify:()=>{},messageFeed:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}});
        window.render=(raw,{user=false,swipe=0}={})=>{
          c.chat[0]={mes:raw,is_user:user,swipe_id:swipe};const target=document.querySelector('.mes_text');
          // Host rendering precedes message subscribers. Guards touch only this display copy.
          target.innerHTML=mode==='hooks'?format(hooks.beforeRegex(raw,{isUser:user}),'',false,user):format(raw,'',false,user);
          for(const fn of listeners)fn({full:true});
        };
        render('<cxx-story>交易结束，玩家走向街口。</cxx-story>\n'+fixture.reported);
      },{mode,fixture:{reported:fixture.reported,valid:fixture.valid},rules:staged.card.data.extensions.regex_scripts,css});
      const detail=page.locator('.cxx-update-diagnostic'),body=detail.locator('.cxx-native-aux-body');
      await detail.waitFor();assert.equal(await body.isVisible(),false);assert.equal(await page.evaluate(()=>c.chat[0].mes),'<cxx-story>交易结束，玩家走向街口。</cxx-story>\n'+fixture.reported);
      await detail.locator('summary').click();await page.waitForFunction(()=>!document.querySelector('.cxx-update-diagnostic .cxx-native-aux-body').hidden);
      assert.equal(await body.isVisible(),true);assert.equal(await detail.locator('pre').textContent(),fixture.reported);assert.equal(await detail.locator('pre img,pre script').count(),0);
      for(const width of widths){
        const height=width===844?390:width===1280?720:width===390?844:width===360?800:900;
        await page.setViewportSize({width:Math.round(width/zoom),height:Math.round(height/zoom)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        const metric=await detail.evaluate(n=>({font:parseFloat(getComputedStyle(n).fontSize),summaryFont:parseFloat(getComputedStyle(n.querySelector('summary')).fontSize),summaryHeight:n.querySelector('summary').getBoundingClientRect().height}));
        (report.layout||=[]).push({mode,width,...metric});if(!process.env.CXX_BASELINE){assert(metric.font>=16);assert(metric.summaryFont>=16);assert(metric.summaryHeight>=44);}await page.screenshot({path:path.join(cache,mode+'-expanded-'+width+'.png')});
        await page.keyboard.press('Control+End');await page.waitForFunction(()=>{const n=document.querySelector('.cxx-update-diagnostic pre'),b=n.getBoundingClientRect();return b.bottom<=innerHeight+1&&b.bottom>=0;},null,{timeout:3000});const end=await detail.locator('pre').evaluate(n=>({bottom:n.getBoundingClientRect().bottom,height:innerHeight}));assert(end.bottom<=end.height+1&&end.bottom>=0,'diagnostic raw end reachable '+JSON.stringify(end));await page.screenshot({path:path.join(cache,mode+'-end-'+width+'.png')});
      }
      await detail.locator('summary').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.cxx-update-diagnostic .cxx-native-aux-body').hidden);assert.equal(await body.isVisible(),false);
      report.checks.push(mode+': invalid update is collapsed, expands by mouse, closes by keyboard; 390/844/1280 no horizontal overflow and raw preserved');
      await page.evaluate(()=>render('<cxx-story><cxx-say speaker="千早爱音" kind="thought">希望雨快点停。</cxx-say></cxx-story>'));
      const badge=page.locator('.cxx-dialogue-mode,.custom-cxx-dialogue-mode');assert.equal(await badge.count(),1);const badgeFont=await badge.evaluate(n=>parseFloat(getComputedStyle(n).fontSize));(report.badges||=[]).push({mode,font:badgeFont});if(!process.env.CXX_BASELINE)assert(badgeFont>=13);assert((await page.locator('.mes_text').innerText()).includes('希望雨快点停'));
      await page.evaluate(()=>render(fixture.valid,{swipe:1}));assert.equal(await page.locator('.cxx-update-diagnostic').count(),0);assert.equal(await page.locator('[data-cxx-slot="mvu"]').count(),1);
      assert.doesNotMatch(await page.locator('.mes_text').innerText(),/JSONPatch|numericInput/);report.checks.push(mode+': valid numericInput produces the normal MVU slot; branch change removes old diagnostic');
      await page.evaluate(()=>{formatMode='noRules';render(fixture.valid,{swipe:2});});
      const fallback=page.locator('.mes_text details.cxx-native-aux');assert.equal(await fallback.count(),1);assert.equal(await fallback.locator('summary').textContent(),'查看变量说明');assert.equal(await fallback.locator('.cxx-native-aux-body').isVisible(),false);
      assert.ok(await page.evaluate(()=>formatCalls>0));await fallback.locator('summary').click();await page.waitForFunction(()=>!document.querySelector('.mes_text details .cxx-native-aux-body').hidden);assert.equal(await fallback.locator('.cxx-native-aux-body').isVisible(),true);
      await page.evaluate(()=>{for(const fn of listeners)fn({full:true});});assert.equal(await fallback.getAttribute('open'),'');report.checks.push(mode+': fallback matching uses host-formatted text, closes by default, and preserves user-opened state on refresh');
      await page.addStyleTag({content:'details{display:contents!important}details>div{display:block!important}[hidden]{display:block!important}'});
      await fallback.locator('summary').click();await page.waitForFunction(()=>document.querySelector('.mes_text details .cxx-native-aux-body').hidden);assert.equal(await fallback.locator('.cxx-native-aux-body').isVisible(),false);
      report.checks.push(mode+': explicit content wrapper stays hidden under simulated conflicting theme styles');
      await page.evaluate(()=>{stopGuard();native.destroy();scope='other-chat';});assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cxx-cyan').trim()),'#9ed6d9','host theme unchanged');assert.equal(await page.locator('.mes_text details.cxx-native-aux').count(),0);assert.equal(await page.evaluate(()=>listeners.size),0);assert.equal(await page.locator('#cxx-native-reading-style').count(),0);
      report.checks.push(mode+': teardown restores fallback text and releases both subscriptions');await page.close();
    }
    assert.deepEqual(report.errors,[]);
  }finally{await browser.close();}
  fs.writeFileSync(path.join(cache,'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks:report.checks,errors:report.errors,receipt:path.join(cache,'browser.json')},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
