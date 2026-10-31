/** MirrorTranslate 0.50.1 public APIs. Never read its connection settings or credentials. */
export function createStMedia({context,assertScope,getApi=()=>globalThis.__JINGYI__,setup}={}){
 let closed=false;const controllers=new Set(),handles=new Set(),unsubscribers=new Set();
 const check=()=>{if(closed)throw Error('此酒馆媒体会话已关闭');assertScope();};
 async function api(){check();const value=getApi();if(!value)throw Error('镜译尚未启用，请返回酒馆检查扩展');await value.ready;check();return value;}
 function coordinates(nodeId){check();const c=context(),doc=c.chatMetadata?.cxx2051_web,node=doc?.nodes?.find(n=>n.nodeId===nodeId);if(!node)throw Error('正文来源节点已变化');for(let floor=0;floor<c.chat.length;floor++){const row=c.chat[floor];for(let swipe=0;swipe<(row.variables?.length||0);swipe++){const m=row.variables[swipe]?.__cxx_web_commit;if(m?.nodeId===nodeId||m?.stateNodeId===nodeId)return {messageId:floor,swipeId:swipe};}}if(node.native&&Number.isInteger(node.nativeFloor))return {messageId:node.nativeFloor,swipeId:c.chat[node.nativeFloor]?.swipe_id||0};throw Error('此正文不在当前酒馆路线');}
 async function voice(options,play){const value=await api(),controller=new AbortController(),external=options.signal,abort=()=>controller.abort();if(external?.aborted)abort();else external?.addEventListener('abort',abort,{once:true});controllers.add(controller);let handle;
  const release=()=>{external?.removeEventListener('abort',abort);controllers.delete(controller);if(handle)handles.delete(handle);};
  try{handle=await value.tts.speak({...options,signal:controller.signal,analyze:false,play});check();if(controller.signal.aborted){handle.stop?.();throw new DOMException('已停止','AbortError');}handles.add(handle);Promise.resolve(handle.done).then(release,release);return handle;}catch(error){release();throw error;}}
 const port={async capabilities(){const value=await api(),tts=value.tts?.status?.()||{},mic=value.stt?.status?.()||{};return {version:value.version,tts:!!tts.readReady,read:!!tts.readReady,call:!!tts.streamReady,mic:!!mic.available,reading:typeof value.reading?.get==='function',voices:value.tts?.voices?.()||[],reason:tts.readReason||tts.reason||'',micReason:mic.reason||'',provider:'MirrorTranslate'};},
  original(row){check();return String(getApi()?.floor?.original?.(row)??row?.mes??'');},
  async snapshot(nodeId){const value=await api(),at=coordinates(nodeId),result=await value.reading.get(at);check();const now=coordinates(nodeId);if(now.messageId!==at.messageId||now.swipeId!==at.swipeId)throw Error('读取译文时正文路线已变化');return result;},
  speak:options=>voice(options,true),renderSpeech:options=>voice(options,false),
  async microphone(options={}){const value=await api();return value.stt.start(options);},
  async stream(options={}){const value=await api();return value.tts.stream(options);},
  async connect(names=[]){const value=await api();return value.call.connect({app:'东京都2051网页通讯器',characters:names,needs:['tts.stream','stt','llm.stream']});},
  async callModel(options){const value=await api();return value.llm.stream(options);},
  async subscribe(fn){const value=await api(),off=value.reading.onChange(event=>{if(!closed){try{check();fn(event);}catch{}}});unsubscribers.add(off);return()=>{unsubscribers.delete(off);off();};},
  configure(){check();setup?.();},stop(){for(const controller of controllers)controller.abort();for(const handle of handles)handle.stop?.();handles.clear();},
  dispose(){port.stop();for(const off of unsubscribers)off();unsubscribers.clear();closed=true;},coordinates};return port;
}
