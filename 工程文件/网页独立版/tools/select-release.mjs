/** Verify an existing immutable build before selecting it. No save migration or network access. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
export function selectRelease({root,release,previous=false,apply=false}={}){
 root=path.resolve(root);const pointer=path.join(root,'current.json'),current=JSON.parse(fs.readFileSync(pointer,'utf8')),target=previous?current.previous:release;
 if(!/^[a-f0-9]{20}$/.test(target||''))throw Error('请选择已保留的20位release，或使用有previous记录的入口');
 const directory=path.join(root,'releases',target),manifest=JSON.parse(fs.readFileSync(path.join(directory,'release-manifest.json'),'utf8'));
 if(manifest.buildId!==target||manifest.schema!==1||!Array.isArray(manifest.files))throw Error('版本清单与目标不符');
 for(const row of manifest.files){const file=path.resolve(directory,row.path),relative=path.relative(directory,file);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('版本文件路径不符');const bytes=fs.readFileSync(file);if(bytes.length!==row.bytes||createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('版本文件校验失败：'+row.path);}
 const next={schema:1,release:target,previous:current.release===target?current.previous:current.release,contentVersion:manifest.contentVersion};
 if(apply){const temporary=pointer+'.next';fs.writeFileSync(temporary,JSON.stringify(next)+'\n');fs.renameSync(temporary,pointer);}
 return {release:target,previous:next.previous,files:manifest.files.length,bytes:manifest.bytes,applied:apply,saveDataChanged:false,restartLocalLauncher:true,restartGatewayAfterAdapterUpdate:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const option=name=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];};const root=option('--root');if(!root)throw Error('用法：node select-release.mjs --root <play目录> (--release <id> | --previous) [--apply]');
 console.log(JSON.stringify(selectRelease({root,release:option('--release'),previous:process.argv.includes('--previous'),apply:process.argv.includes('--apply')}),null,2));
}
