/** The local port remains authoritative; successful saves update one temporary backup. */
import {createBackupEncoder} from './backup-encoder.mjs';
export function createTemporaryBackup({token,exportSnapshot,closeSnapshot=()=>{},fetcher=globalThis.fetch,base='/api/play/temporary-save',changed=()=>{}}){
  const encoder=createBackupEncoder();
  let latest=null,flight=null,paused=0,disposed=false,controller=null;let state={phase:'idle',save:null,error:'',runId:null};
  const emit=patch=>{state={...state,...patch};changed(read());},read=()=>({...state});
  const headers=extra=>({...extra,Authorization:'Bearer '+(typeof token==='function'?token():token)});
  async function responseData(response){const value=await response.json();if(!response.ok)throw Object.assign(Error(value.message||'临时存档请求未完成'),{code:value.error});return value;}
  function request(runId){if(disposed||paused||!runId)return;latest=runId;emit({phase:'pending',error:''});if(!flight)flight=drain().finally(()=>{flight=null;});}
  async function drain(){while(latest&&!disposed){const runId=latest;latest=null;controller=new AbortController();try{emit({phase:'packing',runId});const snapshot=await exportSnapshot(runId);if(disposed)return;if(!snapshot){emit({phase:'idle'});continue;}const blob=await encoder.encode(snapshot);if(disposed)return;emit({phase:'uploading'});const result=await responseData(await fetcher(base,{method:'POST',headers:headers({'Content-Type':'application/octet-stream'}),body:blob,signal:controller.signal,credentials:'omit',cache:'no-store'}));if(!disposed)emit({phase:latest?'pending':'ready',save:result.save,error:'',runId});}catch(error){if(!disposed)emit({phase:'failed',error:error.message,runId});}finally{controller=null;}}}
  function observe(port){for(const name of ['commit','commitProfile','selectBranch','restoreCheckpoint','createCheckpoint','importRun','putRecords','writeStorySettings']){const original=port[name];port[name]=async(...args)=>{const result=await original(...args);if(result?.status!=='conflict'&&result?.status!=='failed'){const runId=name==='commit'||name==='commitProfile'?args[0].runId:name==='importRun'?result.runId:name==='putRecords'?args[1]:args[0];if(name!=='putRecords'||['memories','summaries','indices','media'].includes(args[0]))request(runId);}return result;};}return port;}
  return {observe,request,read,
    async metadata(){const result=await responseData(await fetcher(base+'?meta=1',{headers:headers(),cache:'no-store',credentials:'omit'}));emit({save:result.save});return result.save;},
    async download(){const response=await fetcher(base,{headers:headers(),cache:'no-store',credentials:'omit'});if(!response.ok)await responseData(response);return encoder.decode(await response.blob());},
    async withoutUpload(fn){paused++;try{return await fn();}finally{paused--;}},
    async flush(){if(flight)await flight;},
    destroy(){disposed=true;latest=null;controller?.abort();encoder.destroy();void closeSnapshot();},
  };
}
