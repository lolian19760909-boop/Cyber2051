/* Pinned ACU 1.3 compatibility fixes shared by browser and native builds. */
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function patchDatabasePlugin(source,{stack=true,programCheckpoints=false}={}){
 const changes=[
  ['I={...C?.backend??(i?o:{}),getLorebooks:u.entries?', 'I={...(i?o:C?.backend??{}),getLorebooks:u.entries?'],
  ['m={...C?.capabilities,getLorebooks:', "m={...C?.capabilities,...(i?{setLorebookEntries:'native',createLorebookEntries:'native',deleteLorebookEntries:'native'}:{}),getLorebooks:"]
 ];
 if(stack)changes.push(['var s=null,l=null,g=null;try{g=l=fa(n);var u=xe(4);','var s=null,l=null,g=null,cxxStack=Ne();try{g=l=fa(n);var u=xe(4);'],['finally{l&&ve(l)}},e.prototype.Mb=','finally{l&&ve(l),Re(cxxStack)}},e.prototype.Mb=']);
 if(programCheckpoints)changes.push(
  ['async function ensureV2BoundaryCheckpointForRetainedBufferCore_ACU(t,n,o={},i="compaction"){','async function ensureV2BoundaryCheckpointForRetainedBufferCore_ACU(t,n,o={},i="compaction"){const cxxProgramBoundary=o.cxxProgramBoundary===true;'],
  ['if(I&&!u){logDebug_ACU(`[V2 Compaction] AI 保留边界楼层','if(I&&!u&&!cxxProgramBoundary){logDebug_ACU(`[V2 Compaction] AI 保留边界楼层'],
  ['if(I&&u){const o=await loadTableStateFromFramesV2Detailed_ACU(t,g,','if(I&&u&&!cxxProgramBoundary){const o=await loadTableStateFromFramesV2Detailed_ACU(t,g,'],
  ['if(n>0){const i=resolveRetainedCheckpointBoundary_ACU(o,n);','if(t.cxxProgramBoundary===true){const cxxTarget=findTargetAiMessage_ACU(o);if(!cxxTarget)return{success:false,changed:false,error:"程序状态缺少数据库承载楼层"};return ensureV2BoundaryCheckpointForRetainedBufferCore_ACU(o,{shouldRotateCheckpoint:true,indicesToPurge:[cxxTarget.index],anchorIndex:cxxTarget.index},t,"compaction");}if(n>0){const i=resolveRetainedCheckpointBoundary_ACU(o,n);'],
  ['await refreshMergedDataAndNotifyWithUI_ACU();const t=Object.keys(i.tableData||{}).find','await refreshMergedDataAndNotifyWithUI_ACU();if(n?.cxxProgramBoundary===true){const cxxCheckpoint=await ensureV2BoundaryCheckpointForRetainedBuffer_ACU({cxxProgramBoundary:true,save:false});if(!cxxCheckpoint.success)throw Error(cxxCheckpoint.error||"程序数据库检查点保存失败");await refreshMergedDataAndNotifyWithUI_ACU();}const t=Object.keys(i.tableData||{}).find']
 );
 let code=source;for(const [from,to]of changes){if(code.split(from).length!==2)throw Error('数据库兼容补丁锚点变化：'+from);code=code.replace(from,to);}
 const B=require('./card-ast.cjs'),tree=B.acorn.parse(code,{ecmaVersion:'latest'}),edits=[],methods=new Set(['setLorebookEntries','createLorebookEntries','deleteLorebookEntries']);let backend;
 B.walk(tree,n=>{if(n.type==='FunctionDeclaration'&&n.id?.name==='createNativeStBackend_ACU'){backend=n;return false;}});
 if(!backend)throw Error('数据库原生后端缺失');
 B.walk(backend,n=>{if(n.type==='Property'&&methods.has(n.key?.name)&&n.value?.async){const f=n.value,name=code.slice(f.params[0].start,f.params[0].end);edits.push({start:f.body.start+1,end:f.body.end-1,text:'return withCxxBookLock('+name+',async()=>{'+code.slice(f.body.start+1,f.body.end-1)+'});'});return false;}});
 if(edits.length!==3)throw Error('数据库世界书写器接点变化');
 edits.push({start:backend.body.start+1,end:backend.body.start+1,text:"const cxxBookFlights=new Map();function withCxxBookLock(name,work){const locks=globalThis.navigator?.locks;if(locks?.request)return locks.request('cxx-worldbook:'+name,work);const prior=cxxBookFlights.get(name)||Promise.resolve(),next=prior.catch(()=>{}).then(work);cxxBookFlights.set(name,next);return next.finally(()=>{if(cxxBookFlights.get(name)===next)cxxBookFlights.delete(name);});}"});
 for(const edit of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,edit.start)+edit.text+code.slice(edit.end);
 B.acorn.parse(code,{ecmaVersion:'latest'});return {code,changes:[...changes,['native worldbook read/modify/save','cxx-worldbook lock across each writer']]};
}
function pinnedDatabaseSource(){const dir=path.resolve(__dirname,'../../网页独立版/vendor/database'),receipt=JSON.parse(fs.readFileSync(path.join(dir,'sources.json'))),record=receipt.files.find(r=>r.file==='shujuku-1.3.js'),source=fs.readFileSync(path.join(dir,record.file),'utf8');if(createHash('sha256').update(source).digest('hex')!==record.sha256)throw Error('数据库原件指纹变化');return {source,sha256:record.sha256};}
module.exports={patchDatabasePlugin,pinnedDatabaseSource};
