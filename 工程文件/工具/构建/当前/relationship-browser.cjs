'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const B=require('../../lib/card-ast.cjs'),root=path.resolve(__dirname,'../../..'),out=path.join(root,'.cache/affinity227');
const file=path.resolve(process.argv[2]),card=JSON.parse(fs.readFileSync(file)),log=fs.readFileSync(process.argv[3],'utf8');
const packet=JSON.parse(log.split('\n').find(l=>l.startsWith('{"task"'))),templates={};
const native=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-native-ui-231').content;
B.walk(B.acorn.parse(native,{ecmaVersion:'latest'}),n=>{if(n.type==='CallExpression'&&n.callee.object?.name==='Cxx233Components')for(const p of n.arguments[0].properties.find(p=>p.key.name==='templates').value.properties){const id=p.key.name||p.key.value;if(/^status[012]$/.test(id))templates[id]=p.value.value;}});
async function main(){
 const report={file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),checks:[],frames:[],errors:[]};
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:6948');await page.waitForFunction(()=>window.EjsTemplate?.evalTemplate&&window.TavernHelper);
  report.ejs=await page.evaluate(async({packet,book})=>{
   let oldError;try{await EjsTemplate.evalTemplate(JSON.stringify(packet),{},{logging:false});}catch(e){oldError=e.message;}
   const next=structuredClone(packet);next.references.worldbook=book.entries.map(e=>e.content).join('\n\n');const input=JSON.stringify(next),output=await EjsTemplate.evalTemplate(input,{}, {logging:false});
   return {oldError,revisedInputUnchanged:output===input,newWorldbookHasEjs:next.references.worldbook.includes('<%')};
  },{packet,book:card.data.character_book});
  assert.match(report.ejs.oldError,/Invalid or unexpected token/);assert.equal(report.ejs.revisedInputUnchanged,true);assert.equal(report.ejs.newWorldbookHasEjs,false);report.checks.push('Original pasted MirrorTranslate request fails in loaded Prompt Template 1.17.9; revised 99 worldbook references pass unchanged.');
  await page.close();
  // These frames exercise packaged native templates and their real click handlers.
  // External image responses are unnecessary for this interaction check.
  for(const [id,html]of Object.entries(templates)){
   const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>report.errors.push({id,message:e.message}));
   await p.route('**/*',route=>route.abort());
   const scene={date:'2051年10月13日',time:'18:30',location:'RiNG',characters:[{name:'高松灯',outfit:'黑色外套',thought:'记得把写下的句子带回去。'},{name:'千早爱音',outfit:'日常服装',thought:'先把眼前的事情做好。'}]};
   const bridge='<script>window.watchVisibleInterval=(fn,ms)=>{const id=setInterval(()=>{if(!document.hidden)fn()},ms);return()=>clearInterval(id)};<'+ '/script>';
   await p.setContent(html.replace('<head>','<head>'+bridge).replace('`$1`','`'+JSON.stringify(scene)+'`'),{waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>window.CxxStatusViewState&&window.Cxx236ComponentUpdate);
   await p.evaluate(()=>window.CxxNativeStatus?.setExpanded(true));
   await p.locator('#backBtn').click();await p.locator('.char-card').first().waitFor();
   const before=await p.locator('.char-card').allTextContents();assert.equal(before.length,10);assert(!before.some(s=>/好感|戒备|陌生|恋慕|不渝|1000/.test(s)));
   await p.evaluate(scene=>Cxx236ComponentUpdate(JSON.stringify(scene),{stat_data:{高松灯:{好感度:-100},千早爱音:{好感度:1000}}}),scene);
   assert.deepEqual(await p.locator('.char-card').allTextContents(),before);
   for(let i=0;i<10;i++){await p.locator('.char-card').nth(i).click();await p.locator('#backBtn').waitFor();assert(await p.locator('.hero-name').count());await p.locator('#backBtn').click();}
   await p.screenshot({path:path.join(out,id+'-390.png')});
   await p.setViewportSize({width:1280,height:900});await p.locator('.char-card').first().click();await p.screenshot({path:path.join(out,id+'-1280.png')});
   report.frames.push({id,characters:before.map(s=>s.trim()),clicks:10,legacyValuesDoNotReorder:true});await p.close();
  }
  assert.deepEqual(report.errors,[]);report.checks.push('Three packaged native views open all ten profiles and return; old affinity does not change ordering or labels.');
 }catch(e){report.failure=e.stack;throw e;}finally{await browser.close();fs.writeFileSync(path.join(out,'relationship-browser.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
