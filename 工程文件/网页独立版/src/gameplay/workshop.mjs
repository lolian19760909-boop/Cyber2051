/** Signed content installation is account-local; each story owns its enabled versions. */
import {sourceScript} from '../ui/source.mjs';
export const COMPONENT_CATALOG='https://cyber2051.top/updates/v3/component-manifest.json';
const copy=structuredClone;
async function loadModules(){if(typeof process==='object'&&process.versions?.node){const {createRequire}=await import('node:module'),require=createRequire(import.meta.url);return {Core:require('../../../卡片源码/运行时/core.js'),Content:require('../../../卡片源码/运行时/content.js'),Discovery:require('../../../卡片源码/运行时/discovery.js')};}for(const f of ['crypto-compat','core','content','discovery'])await sourceScript('运行时/'+f+'.js');return {Core:globalThis.CxxUpdateCore,Content:globalThis.CxxContent,Discovery:globalThis.CxxUpdateDiscovery};}
export async function createWorkshop({runtimePolicy={},statePort,runId,readStory=()=>statePort.readStorySettings(runId),writeStory=next=>statePort.writeStorySettings(runId,next),commit=fn=>fn(),capture=()=>runId,isCurrent=()=>true,fetch:fetcher=globalThis.fetch?.bind(globalThis),account,modules}={}){
 const {Core,Content,Discovery}=modules||await loadModules();let library={},story={},catalog=null,revision=0,effective=null,accountLoaded=false,accountRows=[],subscriptionIntent=0,syncSequence=0;
 const initial={format:1,packages:runtimePolicy.registry?.packages||{}};
 function rebuild(){const raw={registry:{format:1,packages:{...initial.packages,...library.registry?.packages}},subscriptions:{...library.subscriptions}};return effective={...Content.withMigration(raw,{__cxx_content_pins:story.pins||{},__cxx_migration:{format:1,archive:{packages:story.archive?.packages||{}},preferences:{subscriptions:story.subscriptions||{}}}}),pins:copy(story.pins||{}),revision:++revision};}
 function state(){return effective||rebuild();}
 async function restore(){const [local,saved]=await Promise.all([statePort.readWorkshopLibrary(),readStory()]);library=local||{};story=saved?.workshop||{};return rebuild();}
 function assert(expected){if(!isCurrent()||JSON.stringify(capture())!==expected)throw Object.assign(Error('故事已变化，请在当前存档重新选择工坊内容'),{code:'workshop_context_changed'});}
 async function syncAccount(expected){
  const intent=subscriptionIntent,sequence=++syncSequence,current=()=>intent===subscriptionIntent&&sequence===syncSequence;
  const rows=await account.read();assert(expected);if(!current())return;const subscribed=new Set(rows.map(row=>row.packageId));
  const updated=await statePort.updateWorkshopLibrary(old=>{assert(expected);if(!current())return old;const next=copy(old||{}),known=new Set([...Object.keys(next.subscriptions||{}),...Object.keys(story.subscriptions||{}),...subscribed]);next.subscriptions={...next.subscriptions};for(const id of known)if(id.startsWith('community.'))next.subscriptions[id]=subscribed.has(id);return next;});assert(expected);if(!current())return;library=updated;accountRows=rows;accountLoaded=true;rebuild();
 }
 async function read({refresh=false}={}){const expected=JSON.stringify(capture());let notice='';if(refresh){const next=await Discovery.readCatalog({Core,trustedKeys:runtimePolicy.trustedKeys,url:COMPONENT_CATALOG,fetch:fetcher});assert(expected);catalog=next;}await restore();assert(expected);
  if(account&&(!accountLoaded||refresh))try{await syncAccount(expected);}catch(error){assert(expected);if(error.code==='workshop_account_changed')throw error;notice='账号订阅同步失败：'+error.message;}
  const current=state(),installed=Object.entries(current.registry.packages).filter(([,p])=>p.optional).map(([id,p])=>({id,installed:!!library.registry?.packages?.[id],display:p.content.worldbook?.[0]?.extra?.__cxx_workshop_display,title:p.content.worldbook?.[0]?.name||id,version:p.version,versions:[p.version,...Object.keys(p.history||{})],enabledVersion:current.pins[id]||null,scope:library.registry?.packages?.[id]?'account':'story'}));
  for(const row of accountRows)if(!current.registry.packages[row.packageId])installed.push({id:row.packageId,title:row.title,display:{title:row.title},installed:false,remote:true,version:null,versions:[],scope:'account'});
  return {loaded:catalog!==null,notice,items:copy((catalog?.packages||[]).filter(p=>p.kind==='content'&&p.optional)),subscriptions:current.subscriptions,directSubscriptions:current.directSubscriptions,requiredBy:current.requiredBy,pins:current.pins,pinIntent:copy(story.pinIntent||story.pins||{}),installed};
 }

 async function command(value){
  if(!['subscribe','enable'].includes(value?.command)||typeof value.enabled!=='boolean')throw Error('请选择订阅或本存档启用操作');const expected=JSON.stringify(capture());let intent=value.command==='subscribe'?++subscriptionIntent:null,prepared=null;const selected=()=>{assert(expected);if(intent!==null&&intent!==subscriptionIntent)throw Object.assign(Error('订阅选择已更新，请查看当前选择'),{code:'workshop_subscription_changed'});};
  await restore();selected();const current=state(),record=current.registry.packages[value.id];
  if(value.command==='subscribe'&&value.enabled&&(!record||value.version&&library.registry?.packages?.[value.id]?.version!==value.version||Content.collectionMembers(record).some(m=>!current.registry.packages[m.packageId]||Core.compareVersions(current.registry.packages[m.packageId].version,m.minVersion)<0))){await read({refresh:true});selected();const entry=catalog.packages.find(p=>p.id===value.id&&p.kind==='content'&&p.optional);if(entry){if(value.version&&entry.version!==value.version)throw Error('目录已改变，请刷新后选择版本');prepared=await Discovery.prepareContent(entry,{Content,catalog,Core,mapIndex:runtimePolicy.mapIndex,characterIds:runtimePolicy.characterIds,trustedKeys:runtimePolicy.trustedKeys,fetch:fetcher});selected();}else{if(!record||value.version&&record.version!==value.version)throw Error('所选内容暂不可下载');for(const m of Content.collectionMembers(record))if(!current.registry.packages[m.packageId]||Core.compareVersions(current.registry.packages[m.packageId].version,m.minVersion)<0)throw Error('合集成员暂不可下载：'+m.packageId);}}
  if(account&&value.command==='subscribe'){const p=prepared?.find(item=>item.pack.id===value.id)?.pack||record,submissionId=p?.content?.worldbook?.[0]?.extra?.__cxx_workshop_source?.submissionId||accountRows.find(row=>row.packageId===value.id)?.submissionId;await account.set({submissionId,subscribed:value.enabled});selected();}
  if(value.command==='subscribe'){selected();intent=++subscriptionIntent;}
  return commit(async()=>{
   selected();await restore();selected();
   if(value.command==='subscribe'){
    const p=prepared?.find(item=>item.pack.id===value.id)?.pack||state().registry.packages[value.id];if(!p?.optional&&!accountRows.some(row=>row.packageId===value.id))throw Error('请选择可选内容');
    library=await statePort.updateWorkshopLibrary(old=>{selected();const next=copy(old||{});next.subscriptions={...next.subscriptions,[value.id]:value.enabled};if(prepared){let registry={format:1,packages:{...initial.packages,...next.registry?.packages}};for(const item of prepared)registry=Core.mergeRegistry(registry,item.pack,{mapIndex:runtimePolicy.mapIndex,characterIds:runtimePolicy.characterIds,subscriptions:[...Object.keys(next.subscriptions).filter(id=>next.subscriptions[id]),...prepared.map(item=>item.pack.id)]}).registry;next.registry={format:1,packages:Object.fromEntries(Object.entries(registry.packages).filter(([id])=>!Object.hasOwn(initial.packages,id)))};}return next;});
   }else{
    const p=state().registry.packages[value.id],version=value.version||p?.version;if(!p?.optional||value.enabled&&(!state().subscriptions[value.id]||!Content.packageContent(p,version)))throw Error('请先订阅并下载所选内容版本');
    const saved=copy(await readStory()||{}),selection=Content.planPins(state().registry,saved.workshop||{}, {...value,version}),next={...saved.workshop,...selection,subscriptions:{...saved.workshop?.subscriptions,...state().directSubscriptions},archive:{format:1,packages:{...saved.workshop?.archive?.packages}}};
    for(const id of Object.keys(next.pins))if(state().registry.packages[id])next.archive.packages[id]=copy(state().registry.packages[id]);saved.workshop=next;await writeStory(saved);story=next;
   }
   return rebuild();
  });
 }
 await restore();if(account)await read();return {read,command,restore,state};
}
