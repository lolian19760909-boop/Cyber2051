/** Full local backups are packed and read outside the UI thread. */
import {encodeSave,decodeSave} from './backup.mjs';
export function createBackupEncoder({WorkerClass=globalThis.Worker}={}){
 let worker=null,sequence=0;const jobs=new Map();
 function fail(error){worker?.terminate();worker=null;for(const job of jobs.values())job.reject(error);jobs.clear();}
 function request(kind,value){
  if(!WorkerClass)return kind==='encode'?encodeSave(value):decodeSave(value);
  if(!worker){worker=new WorkerClass(new URL('./backup-worker.mjs',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const job=jobs.get(data.id);jobs.delete(data.id);if(data.error)job.reject(Object.assign(Error(data.error.message),{code:data.error.code}));else job.resolve(data.result);};worker.onerror=event=>fail(Error(event.message||'存档处理未完成'));}
  return new Promise((resolve,reject)=>{const id=++sequence;jobs.set(id,{resolve,reject});worker.postMessage({id,kind,value});});
 }
 return {encode:snapshot=>request('encode',snapshot),decode:file=>request('decode',file),destroy(){fail(new DOMException('已停止存档处理','AbortError'));}};
}
