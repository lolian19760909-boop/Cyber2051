'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {chromium}=require('../../独立制卡器/workbench/node_modules/playwright'),{extract}=require('../../工具/lib/script-modules.cjs');
const root=path.resolve(__dirname,'../..'),file=process.env.CXX_TEST_CARD||path.join(root,'.cache/build/赛博小祥2051-V2.3.0.json'),bytes=fs.readFileSync(file),card=JSON.parse(bytes),scripts=card.data.extensions.tavern_helper.scripts;
const bootstrap=scripts.find(s=>s.id==='cxx-runtime-bootstrap').content,all=scripts.map(s=>s.content).join('\n;\n'),modules=extract(all,['CxxPopover','CxxOperations','CxxUILayers']);
const ui=['CxxPopover','CxxOperations','CxxUILayers'].map(name=>{const found=modules.find(m=>m.name===name);assert(found,name);return found.source;}).join('\n;\n');
const sha=value=>createHash('sha256').update(value).digest('hex'),report={cardSHA256:sha(bytes),scope:'Packaged runtime in Edge with controlled missing capabilities; no live ST/TT',cases:[],errors:[]};
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const limited of [false,true]){
  const context=await browser.newContext();if(limited)await context.addInitScript(()=>{
   Object.defineProperty(window,'structuredClone',{value:undefined,configurable:true});Object.defineProperty(crypto,'subtle',{value:undefined,configurable:true});Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});
   Object.defineProperty(HTMLElement.prototype,'showPopover',{value:undefined,configurable:true});Object.defineProperty(HTMLElement.prototype,'hidePopover',{value:undefined,configurable:true});
   const matches=Element.prototype.matches;Element.prototype.matches=function(selector){if(selector.includes(':popover-open'))throw new DOMException('Unsupported selector','SyntaxError');return matches.call(this,selector);};
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.route('http://localhost/compatibility',route=>route.fulfill({body:'<!doctype html><meta charset="utf-8"><main></main>',contentType:'text/html'}));await page.route('https://**',route=>route.abort());await page.goto('http://localhost/compatibility');
  const start=Date.now();await page.addScriptTag({content:bootstrap});const bootstrapMs=Date.now()-start;await page.addScriptTag({content:ui});
  const result=await page.evaluate(async({expected,limited,payload})=>{
   const service=CxxOperations.create({report(){}}),destroy=CxxOperations.mount(window,service);await service.run('save','测试保存',async()=>true);const box=document.querySelector('.cxx-operation-feedback');if(box.hidden||getComputedStyle(box).display==='none')throw Error('Save feedback is hidden');destroy();service.destroy();
   const panel=document.createElement('div');panel.dataset.cxxUpdatePanel='';document.body.append(panel);const layers=CxxUILayers.forWindow(window),release=layers.suspend();if(!panel.inert||panel.style.visibility!=='hidden')throw Error('Layer was not suspended');release();if(panel.inert||panel.style.visibility==='hidden')throw Error('Layer was not restored');panel.remove();
   const frame=document.createElement('iframe');document.body.append(frame);const foreign=new frame.contentWindow.Uint8Array([1,2,3]).buffer;if(foreign instanceof ArrayBuffer)throw Error('Expected another realm');
   const digest=Array.from(new Uint8Array(await CxxCrypto.digest(foreign)),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==expected)throw Error('Foreign buffer hash differs');
   const manifest={id:'compat-test',version:'test',entries:[{id:expected,file:'model.bin',bytes:3,mime:'application/octet-stream'}]},BlobType=frame.contentWindow.Blob;
   CxxResourceRuntime.zipEntries=async function*(){yield {name:'manifest.json',blob:new BlobType([JSON.stringify({id:manifest.id})])};yield {name:'model.bin',blob:new BlobType([foreign])};};
   const live=CxxLive2DRuntime.install(window,manifest,'');await live.importPack({});const state=live.read();if(!state.installed||state.completed!==1||state.error)throw Error('Live2D import failed: '+state.error);live.destroy();frame.remove();
   const timings=[];for(let i=0;i<50;i++){const begin=performance.now();const copy=CxxDataClone.clone(payload);if(copy===payload)throw Error('Clone aliases state');timings.push(performance.now()-begin);}timings.sort((a,b)=>a-b);
   return {limited,nativeClone:typeof window.structuredClone==='function',nativeDigest:CxxCrypto.create().capabilities().nativeDigest,feedbackVisible:true,layersRestored:true,foreignHash:digest,live2dImported:true,cloneMs:{median:timings[25],p95:timings[47]}};
  },{expected:sha(Buffer.from([1,2,3])),limited,payload:scripts.find(s=>s.data?.__cxx_update_seed).data.__cxx_update_seed.initialContent});
  assert.equal(result.nativeClone,!limited);assert.equal(result.nativeDigest,!limited);report.cases.push({...result,bootstrapMs});await context.close();
 }}finally{await browser.close();}
 assert.deepEqual(report.errors,[]);report.pass=true;
}
main().catch(e=>{report.failure=e.stack;process.exitCode=1;}).finally(()=>{const out=process.env.CXX_EVIDENCE?path.join(process.env.CXX_EVIDENCE,'report.json'):path.join(root,'.cache/mirror220/runtime-compat-browser.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));});
