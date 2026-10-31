/** Select the maintained MirrorTranslate pure TTS closure; never load its host entry. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const WEB=fileURLToPath(new URL('../',import.meta.url));
export const MIRROR_SOURCE=path.resolve(WEB,'../../资料/参考/镜译接口/隔离验证-0.50.1-20261011/upstream');
export const MIRROR_FILES=['core.js','prompts.js','jailbreak-default.js','palette.js','tts-sanitizer.js','tts.js','tts-stream.js','tts-cloud.js','pcm-player.js'];
export function snapshotMirror({out=path.join(WEB,'shared/mirror')}={}){
  fs.mkdirSync(out,{recursive:true});
  const files=MIRROR_FILES.map(name=>{const bytes=fs.readFileSync(path.join(MIRROR_SOURCE,name));fs.writeFileSync(path.join(out,name),bytes);return {path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
  const manifest={schema:1,upstream:'https://github.com/iabil-604/MirrorTranslate',version:'0.50.1',author:'iabil',source:'资料/参考/镜译接口/隔离验证-0.50.1-20261011/upstream',files,scope:'Unmodified pure TTS payload, normalization, stream splitting, response parsing and PCM playback modules. Host index.js is not loaded.'};
  fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({private:true,type:'module'})+'\n');
  fs.writeFileSync(path.join(out,'source.json'),JSON.stringify(manifest,null,2)+'\n');return {out,...manifest};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=snapshotMirror();console.log(JSON.stringify({out:result.out,version:result.version,files:result.files.length,bytes:result.files.reduce((n,f)=>n+f.bytes,0)}));}
