/** Existing radio, signed announcement inbox and Live2D views; media loads on demand. */
import {sourceScript,sourceText,sourceJson} from './source.mjs';
export async function createMedia({session,assets,card}){
  await sourceScript('共享/radio-service.js');const radioData=await sourceJson('终端/content/radio.json');globalThis.CxxRadioStyle=(globalThis.CxxThemeCSS||'')+await sourceText('共享/radio.css');const channels=radioData.channels.map(channel=>({...channel,tracks:channel.tracks.map(track=>({...track,url:assets.resolve(track.url)}))})),radio=globalThis.CxxRadioFactory.create({window,runtime:{key:()=>session.identity.accountId+':'+session.identity.runId+':'+session.identity.branchId},channels});globalThis.CxxRadio=radio;
  for(const file of ['运行时/core.js','运行时/controller.js','运行时/mailbox.js'])await sourceScript(file);globalThis.CxxMailboxStyle=(globalThis.CxxThemeCSS||'')+await sourceText('运行时/mailbox.css');const seed=card.runtimePolicy;if(!seed?.trustedKeys)throw Error('官方公告签名维护源缺失');
  const mailbox=globalThis.CxxMailboxFactory.create({win:window,fetcher:fetch.bind(window),verify:document=>globalThis.CxxUpdateController.verifyDocument(document,seed.trustedKeys,globalThis.CxxUpdateCore,crypto),storage:localStorage});globalThis.CxxMailbox=mailbox;
  await sourceScript('运行时/resources.js',{adapted:true});await sourceScript('Live2D/runtime.js',{adapted:true});const live=globalThis.CxxWebUIData.live2d;if(!live?.manifest||!live.html)throw Error('Live2D播放器维护源尚未构建');const live2d=globalThis.CxxLive2DRuntime.install(window,live.manifest,live.html,live.css);
  return {radio,mailbox,live2d,destroy(){radio.destroy();mailbox.destroy();live2d.destroy();for(const key of ['CxxRadio','CxxMailbox','CxxLive2D'])delete globalThis[key];}};
}
