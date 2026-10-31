/** Prepare a disposable real ST host with source code reused and an isolated data root. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT,WEB } from './content-build.mjs';
import {buildExtension} from './build.mjs';
const host=path.join(ROOT,'.cache/debug223/host/app'),cache=path.join(ROOT,'.cache/web-host-20261025');
const require=createRequire(path.join(host,'package.json')),YAML=require('yaml');
fs.mkdirSync(cache,{recursive:true});
const requestedData=process.argv.find(a=>a.startsWith('--data='))?.slice(7)||'data';if(!/^[a-z0-9-]+$/i.test(requestedData))throw Error('测试数据目录名不符');
const configFile=path.join(cache,'config.yaml'),data=path.join(cache,requestedData);
const config=YAML.parse(fs.readFileSync(fs.existsSync(configFile)?configFile:path.join(host,'default/config.yaml'),'utf8'));
Object.assign(config,{dataRoot:data,listen:false,port:22351,enableUserAccounts:false,basicAuthMode:false,whitelistMode:true,enableServerPlugins:false,enableServerPluginsAutoUpdate:false,enableDownloadableTokenizers:false});
config.protocol={ipv4:true,ipv6:false};config.browserLaunch={...config.browserLaunch,enabled:false};config.extensions={...config.extensions,enabled:true,autoUpdate:false,models:{...config.extensions?.models,autoDownload:false}};
fs.writeFileSync(configFile,YAML.stringify(config));
const extensionRoot=path.join(data,'default-user/extensions');fs.mkdirSync(extensionRoot,{recursive:true});
const extension=process.argv.includes('--reuse-app')?{extension:path.join(WEB,'artifacts/st-extension')}:await buildExtension();
fs.cpSync(extension.extension,path.join(extensionRoot,'Cyber2051-Web'),{recursive:true});
fs.copyFileSync(path.join(WEB,'tavern-extension/index.mjs'),path.join(extensionRoot,'Cyber2051-Web/index.mjs'));
const versions=[];
for(const name of ['JS-Slash-Runner','shujuku','MirrorTranslate','ST-Prompt-Template','SillyTavern-Runtime-Suite']){
 const from=name==='SillyTavern-Runtime-Suite'?path.join(ROOT,'配套扩展/tavern-runtime-suite'):path.join(ROOT,'.cache/debug223/host/data/default-user/extensions',name);
 const to=path.join(extensionRoot,name);
 if(!path.resolve(to).startsWith(path.resolve(cache)+path.sep)||fs.existsSync(to)&&fs.lstatSync(to).isSymbolicLink())throw new Error('测试插件目录越界');
 fs.cpSync(from,to,{recursive:true,filter:file=>!path.relative(from,file).split(path.sep).some(part=>['.git','node_modules','.cache'].includes(part))});
 const manifest=JSON.parse(fs.readFileSync(path.join(to,'manifest.json'),'utf8'));versions.push({name,version:manifest.version,source:from});
}
const candidate=(await createRequire(import.meta.url)('../../工具/构建/当前/build.cjs').build({write:false})).card;
fs.writeFileSync(path.join(cache,'test-card.json'),JSON.stringify(candidate));
const snapshot={at:new Date().toISOString(),server:path.join(host,'server.js'),st:JSON.parse(fs.readFileSync(path.join(host,'package.json'),'utf8')).version,dataRoot:data,config:configFile,port:22351,plugins:versions,scope:'isolated test data; no daily ST settings/chats/keys copied'};
fs.writeFileSync(path.join(WEB,'reports/st-environment.json'),JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify(snapshot,null,2));
