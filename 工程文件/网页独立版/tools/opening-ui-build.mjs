/** Build the approved component into the existing application's generated assets. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT,WEB} from './workspace-paths.mjs';
import {adaptCreationVisuals} from './opening-visuals-adapt.mjs';

export const OPENING_SOURCE=path.resolve(ROOT,'../资料/设计/UI升级-设计师旧卡-20261026/fusion');
export const OPENING_OUTPUT=path.join(WEB,'generated/opening-ui');
export function adaptOpeningFlow(code){
 const header="  const directOrigins={'origin-street':'street','origin-corpo':'corpo','origin-student':'student','custom-opening':null};\n  const isDirect=id=>Object.hasOwn(directOrigins,id),validScenario=id=>Number.isInteger(id)&&id>=2&&id<=11||isDirect(id);";
 code=code.replace(/\r\n/g,'\n');if(!code.includes(header))throw Error('开局场景适配接点变化');
 return code.replace(header,"  const directOrigin=id=>globalThis.CxxOpeningGroups.beginnings.find(row=>row.id===id)?.origin;\n  const isDirect=id=>id==='custom-opening'||globalThis.CxxOpeningGroups.beginnings.some(row=>row.id===id);\n  const validScenario=id=>isDirect(id)||globalThis.CxxOpeningCatalog.some(row=>row.id===id&&row.action);").replaceAll('directOrigins[id]','directOrigin(id)');
}
export function buildOpeningUI(){
 const integration=path.join(OPENING_SOURCE,'integration'),built=path.join(OPENING_SOURCE,'build');
 for(const [name,flag] of [['build','--web-only'],['prepare-creation','--components-only']])execFileSync(process.execPath,[path.join(integration,name+'.cjs'),flag],{stdio:['ignore','pipe','pipe']});
 const manifest=JSON.parse(fs.readFileSync(path.join(built,'assets.json'),'utf8'));
 const files=['feedback.mjs','index.mjs','visual-runtime.mjs','audio.mjs','audio-site.css','web-shell.mjs','adapters.mjs','settings.mjs','settings-motion.mjs','settings-art.mjs','lettering.mjs','base.css','theme-runtime.js','opening-flow.js','assets.json','ASCII-Magic-LICENSE','ASCII-Magic-NOTICE'];
 const assets=[...Object.values(manifest.controls),manifest.map,manifest.logo,manifest.city,manifest.loading,...manifest.music.map(row=>row.file),...Object.values(manifest.sfx)];
 const rows=[];
 for(const name of [...files,...assets.map(name=>'assets/'+name),'reading-shell.mjs','reading.css']){
  const override=path.join(WEB,'web/opening-ui',name),source=fs.existsSync(override)?override:path.join(name.startsWith('reading')?integration:built,name),target=path.join(OPENING_OUTPUT,name),raw=fs.readFileSync(name==='opening-flow.js'?path.join(ROOT,'卡片源码/运行时/opening-flow.js'):source),bytes=name==='opening-flow.js'?Buffer.from(adaptOpeningFlow(raw.toString('utf8'))):name==='visual-runtime.mjs'?Buffer.from(adaptCreationVisuals(raw.toString('utf8'))):raw;
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
  rows.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 const report={at:new Date().toISOString(),source:OPENING_SOURCE,out:OPENING_OUTPUT,files:rows,bytes:rows.reduce((n,row)=>n+row.bytes,0),scope:'approved web UI only; excludes Tavern embedded helper, samples and tracing assets'};
 fs.writeFileSync(path.join(WEB,'reports/opening-ui.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
