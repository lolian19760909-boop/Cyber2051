import fs from 'node:fs';
import path from 'node:path';
export async function checkCreatorMobile({page,context=page.context(),out,report}){
 const shot=async name=>page.screenshot({path:path.join(out,name+'.png')});
 await page.evaluate(()=>{
   window.__inputTrace=[];window.__snapshotInput=el=>({label:el.getAttribute('aria-label'),value:el.value,start:el.selectionStart,end:el.selectionEnd,active:document.activeElement===el,connected:el.isConnected});
   for(const name of ['compositionstart','compositionupdate','compositionend','beforeinput','input','select','focusin','focusout'])document.addEventListener(name,event=>{if(!event.target.matches?.('input,textarea'))return;__inputTrace.push({event:name,data:event.data,inputType:event.inputType,isComposing:event.isComposing,...__snapshotInput(event.target)});if(name==='input')queueMicrotask(()=>__inputTrace.push({event:'after-input',...__snapshotInput(event.target)}));},true);
   for(const type of [HTMLInputElement,HTMLTextAreaElement]){const d=Object.getOwnPropertyDescriptor(type.prototype,'value');Object.defineProperty(type.prototype,'value',{...d,set(value){if(document.activeElement===this)__inputTrace.push({event:'active-value-set',next:value,...__snapshotInput(this),stack:new Error().stack});return d.set.call(this,value);}});}
 });
 const cdp=await context.newCDPSession(page);
 async function probe(label,scenario='initial'){const input=page.getByRole('textbox',{name:label,exact:true});await input.fill('');await input.focus();await input.scrollIntoViewIfNeeded();await page.waitForTimeout(100);const geometry=await input.evaluate(el=>({box:el.getBoundingClientRect().toJSON(),clientWidth:el.clientWidth,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,scrollLeft:el.scrollLeft,style:{font:getComputedStyle(el).font,textAlign:getComputedStyle(el).textAlign,direction:getComputedStyle(el).direction,padding:getComputedStyle(el).padding},ancestors:[...function*(n){while(n){yield n;n=n.parentElement;}}(el)].slice(0,10).map(n=>({tag:n.tagName,cls:n.className,box:n.getBoundingClientRect().toJSON(),overflow:getComputedStyle(n).overflow,transform:getComputedStyle(n).transform}))}));await page.evaluate(()=>{__inputTrace=[];});
   const center={x:geometry.box.x+geometry.box.width/2,y:geometry.box.y+geometry.box.height/2},hit=await input.evaluate((el,center)=>{const target=document.elementFromPoint(center.x,center.y);return {matchesInput:target===el,tag:target?.tagName,className:target?.className,label:target?.getAttribute('aria-label'),text:target?.textContent?.slice(0,60)};},center);
   await input.evaluate(el=>el.blur());await page.touchscreen.tap(center.x,center.y);const touch=await input.evaluate(el=>({focusedInput:document.activeElement===el,activeTag:document.activeElement?.tagName,activeLabel:document.activeElement?.getAttribute('aria-label')}));await input.focus();await page.waitForTimeout(50);await page.evaluate(()=>{__inputTrace=[];});
   await cdp.send('Input.imeSetComposition',{text:'ni',selectionStart:2,selectionEnd:2});await cdp.send('Input.imeSetComposition',{text:'nihao',selectionStart:5,selectionEnd:5});await cdp.send('Input.insertText',{text:'你好'});
   const first=await input.evaluate(el=>__snapshotInput(el));await page.keyboard.type('AB');await input.evaluate(el=>el.setSelectionRange(1,1));await page.keyboard.insertText('中');const final=await input.evaluate(el=>__snapshotInput(el));await input.evaluate(el=>el.setSelectionRange(1,3));await page.keyboard.insertText('替');await page.keyboard.press('Backspace');const edited=await input.evaluate(el=>__snapshotInput(el));
   report.checks.push({case:label,scenario,geometry,center,hit,touch,composition:first,afterMiddleInsert:final,afterReplaceDelete:edited,events:await page.evaluate(()=>__inputTrace),ok:first.value==='你好'&&first.start===2&&final.value==='你中好AB'&&final.start===2&&edited.value==='你AB'&&edited.start===1});
 }
 await probe('姓名');await shot('02-ime-name');
 await page.getByRole('button',{name:'背景补充',exact:true}).click();await probe('外貌自由补充');await shot('03-ime-description');
 await page.getByRole('button',{name:'基本资料',exact:true}).click();
 report.orientations=[];
 for(const [width,height,type,angle] of [[390,844,'portraitPrimary',0],[844,390,'landscapePrimary',90]]){
   await page.setViewportSize({width,height});await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height,screenOrientation:{type,angle}});await page.waitForTimeout(150);
   for(const requested of ['portrait','landscape']){

     const toggle=page.locator('.cxx-orientation-toggle:visible');const text=await toggle.innerText();if((requested==='portrait'&&text.includes('竖屏'))||(requested==='landscape'&&text.includes('横屏')))await toggle.tap();
     await page.waitForTimeout(150);const button=page.getByRole('button',{name:'面部与发型',exact:true});await button.scrollIntoViewIfNeeded();const box=await button.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
     const before=await page.evaluate(({x,y})=>({screen:{width:screen.width,height:screen.height,type:screen.orientation?.type},inner:{width:innerWidth,height:innerHeight},visual:{width:visualViewport.width,height:visualViewport.height,offsetLeft:visualViewport.offsetLeft,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale},local:{width:document.querySelector('.cxx-opening-flow').clientWidth,height:document.querySelector('.cxx-opening-flow').clientHeight},stored:localStorage.getItem('cxx-gal-mobile-orientation-v1'),root:document.querySelector('.cxx-opening-flow').getBoundingClientRect().toJSON(),transform:getComputedStyle(document.querySelector('.cxx-opening-flow')).transform,hit:document.elementFromPoint(x,y)?.textContent?.slice(0,50)}),{x,y});
     await page.touchscreen.tap(x,y);const clicked=await button.getAttribute('aria-pressed');await shot('orientation-'+type+'-'+requested);
     report.orientations.push({requested,box,before,clicked});fs.writeFileSync(path.join(out,'creator-progress.json'),JSON.stringify(report,null,2));await page.getByRole('button',{name:'基本资料',exact:true}).tap();for(let trial=0;trial<3;trial++)await probe('姓名',type+'-'+requested+'-'+trial);await shot('typed-'+type+'-'+requested);
     await page.getByRole('button',{name:'背景补充',exact:true}).tap();await probe('外貌自由补充',type+'-'+requested);await probe('经历',type+'-'+requested);
     await page.getByRole('button',{name:'面部与发型',exact:true}).tap();await probe('发型',type+'-'+requested);
     const trait=page.locator('.creator-trait').filter({has:page.getByLabel('发型',{exact:true})});if(!await trait.locator('details').evaluate(el=>el.open))await trait.locator('summary').tap();await probe('自定义发型',type+'-'+requested);
     await page.getByRole('button',{name:'基本资料',exact:true}).tap();


   }
 }
 report.viewport=await page.evaluate(()=>({screen:{width:screen.width,height:screen.height,type:screen.orientation?.type},inner:{width:innerWidth,height:innerHeight},visual:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},root:document.querySelector('.cxx-opening-flow').getBoundingClientRect().toJSON()}));return report.checks.every(row=>row.ok&&row.hit.matchesInput&&row.touch.focusedInput)&&report.orientations.every(row=>row.clicked==='true'&&(row.before.stored||(row.before.screen.type.startsWith('portrait')?'portrait':'landscape'))===row.requested&&(row.requested==='portrait'?row.before.local.width<row.before.local.height:row.before.local.width>row.before.local.height))&&report.errors.length===0;
}
