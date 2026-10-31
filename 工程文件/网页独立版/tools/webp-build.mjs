/** Build the optional WebP variant of every PNG. The encoder is Python/Pillow; the receipt is the build input. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,WEB} from './workspace-paths.mjs';
const GENERATED=path.join(WEB,'generated');
const OUT=path.join(GENERATED,'assets-webp');
const RECEIPT=path.join(GENERATED,'assets-webp.json');
const QUALITY=92;
function readReceipt(){try{const value=JSON.parse(fs.readFileSync(RECEIPT,'utf8'));return value?.quality===QUALITY?value:null;}catch{return null;}}
function python(){for(const candidate of [process.env.CXX_PYTHON,path.join(process.env.USERPROFILE||'','.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe'),'python3','python'])if(candidate&&fs.existsSync(candidate))return candidate;return process.env.CXX_PYTHON||'python';}
function recordUrl(record){const raw=String(record?.url||'').replace(/\\/g,'/').replace(/^\.?\//,'');if(!raw)return null;return raw.startsWith('assets-webp/')?raw:'assets-webp/'+raw;}
function valid(row,record){if(!record?.id||record.skipped||record.error)return false;const url=recordUrl(record);if(!url)return false;const file=path.join(GENERATED,url);try{return fs.existsSync(file)&&fs.statSync(file).size===record.bytes;}catch{return false;}}
// A skipped PNG (animated or not smaller) is a settled decision; otherwise every build would spawn the encoder again.
function resolved(row,record){if(!record)return false;if(record.skipped)return true;return valid(row,record);}
/** Convert only missing files; an existing receipt makes ordinary rebuilds offline and fast. */
export async function buildWebpAssets(manifest,{force=false}={}){
  fs.mkdirSync(OUT,{recursive:true});
  const rows=(manifest.resources?.files||[]).filter(row=>row.mime==='image/png');
  let receipt=force?null:readReceipt();
  const missing=rows.filter(row=>!resolved(row,receipt?.files?.[row.id]));
  if(missing.length){
    const job={manifest:path.join(GENERATED,'manifest.json'),sourceRoot:GENERATED,out:OUT,receipt:RECEIPT,quality:QUALITY,workers:Math.max(1,Math.min(4,Number(process.env.CXX_WEBP_WORKERS||4)))};
    fs.writeFileSync(path.join(ROOT,'工程文件/.cache/webp-job.json'),JSON.stringify(job));
    const result=spawnSync(python(),[path.join(WEB,'tools/webp-encode.py'),'--manifest',job.manifest,'--source-root',job.sourceRoot,'--out',job.out,'--receipt',job.receipt,'--quality',String(QUALITY),'--workers',String(job.workers)],{stdio:'inherit'});
    if(result.error)throw new Error('WebP 转码器无法启动：'+result.error.message+'（可用 CXX_PYTHON 指定 Python）');
    if(result.status!==0)throw new Error('WebP 转码未完成，见上方输出');
    receipt=readReceipt();
  }
  const files=receipt?.files||{},variants={};
  for(const row of rows){const record=files[row.id];if(valid(row,record))variants[row.id]={id:record.id,url:recordUrl(record),sha256:record.id,bytes:record.bytes,mime:'image/webp'};}
  return {schema:1,quality:QUALITY,generated:Object.keys(variants).length,available:rows.length,variants,receipt:RECEIPT};
}
/** Attach variants to manifest resource rows; the original PNG stays the source of record. */
export function applyWebpVariants(manifest,variants){for(const row of manifest.resources?.files||[]){const variant=variants?.[row.id];if(variant)row.variants={...(row.variants||{}),webp:variant};}return manifest;}
