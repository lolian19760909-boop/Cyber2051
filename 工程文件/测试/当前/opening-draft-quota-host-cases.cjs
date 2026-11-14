'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports={
 async pressure({page,report}){
  report.draftQuota=await page.evaluate(()=>{localStorage.setItem('cxx-test-foreign-sentinel','retain-unrelated-setting');window.__quotaFixture={keys:[]};let filled=0;try{for(let i=0;i<200;i++){const key='cxx-test-draft-quota-'+i;localStorage.setItem(key,'q'.repeat(65536));__quotaFixture.keys.push(key);filled+=65536;}}catch{}const last=__quotaFixture.keys.pop();if(last){localStorage.removeItem(last);filled-=65536;}return {fixtureCharacters:filled,headroomCharacters:65536};});
 },
 async profile({page,report,out}){
  const opening=page.locator('.cxx-opening-flow:visible');await opening.getByLabel('姓名',{exact:true}).fill('草稿容量实测');
  await opening.getByLabel('上传人物立绘',{exact:true}).setInputFiles(path.resolve(__dirname,'../../../图片/2051_character_tachi_2/Mew Type/Arale_tachi_normal.png'));
  await page.waitForFunction(()=>!!Cxx236OpeningHost.state()?.draft.profile?.portraitUpload);
  const saved=await page.evaluate(async()=>{const d=Cxx236OpeningHost.state().draft,store=await CxxOpeningDraftStorage.open(window);await store.close();return {name:d.profile.name,portraitBytes:d.profile.portraitUpload.src.length,draftBytes:JSON.stringify(d).length};});
  assert.equal(saved.name,'草稿容量实测');assert(saved.portraitBytes>report.draftQuota.headroomCharacters);report.draftQuota.profile=saved;
  await page.screenshot({path:path.join(out,'quota-profile-saved.png')});
 },
 async completed({page,report,out}){
  const saved=await page.evaluate(()=>{const c=SillyTavern.getContext(),profile=c.chatMetadata.__cxx_story_profile;const foreignPreserved=localStorage.getItem('cxx-test-foreign-sentinel')==='retain-unrelated-setting';localStorage.removeItem('cxx-test-foreign-sentinel');for(const key of __quotaFixture.keys)localStorage.removeItem(key);delete window.__quotaFixture;return {name:profile?.name,portrait:profile?.portrait,hasImage:!!c.chatMetadata.__cxx_item_art?.assets?.[profile?.portrait?.id]?.src,foreignPreserved};});
  assert.equal(saved.name,'草稿容量实测');assert(saved.hasImage);assert(saved.foreignPreserved);report.draftQuota.completed=saved;report.checks.push('real native full localStorage: portrait draft and final story save succeed; unrelated site data preserved');await page.screenshot({path:path.join(out,'quota-created-and-saved.png')});
 }
};
