const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const worker=process.argv[2]||path.join(__dirname,'../src/assets/cache-worker.mjs'),out=process.argv[3]||path.join(__dirname,'../../.cache/play-loading-20261027/checks/cache-cancel.json'),source=fs.readFileSync(worker,'utf8'),handlers=new Map(),timers=new Set();
let releaseOld,opens=0,downloads=0;
const gate=new Promise(r=>releaseOld=r),cache={match:async()=>undefined,keys:async()=>[],put:async()=>{},delete:async()=>true};
const self={location:{href:'http://127.0.0.1/resource-worker.js'},addEventListener:(n,f)=>handlers.set(n,f),skipWaiting:async()=>{},clients:{claim:async()=>{}}};
const schedule=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);timers.add(t);return t;};
vm.runInNewContext(source,{self,URL,Response,Request,Headers,TextEncoder,TextDecoder,Uint8Array,DataView,AbortController,crypto:crypto.webcrypto,performance,setTimeout:schedule,clearTimeout,console,caches:{open:async()=>{if(++opens===1)await gate;return cache;}},navigator:{storage:{persist:async()=>true,estimate:async()=>({quota:1e9,usage:0})}},fetch:async()=>{downloads++;throw Error('unexpected download after latest cancel');}},{filename:worker});
const config={id:'a'.repeat(64),baseUrl:'http://127.0.0.1/',version:'synthetic',bytes:1,download:'/synthetic.zip',entries:[{id:'b'.repeat(64),file:'synthetic',bytes:1}]};
function prepare(){const messages=[];let settled;handlers.get('message')({data:{type:'prepare',config},ports:[{postMessage:x=>messages.push(x)}],waitUntil:p=>settled=p});return{messages,get settled(){return settled;}};}
const cancel=()=>handlers.get('message')({data:{type:'cancel-prepare',id:config.id},ports:[]});
(async()=>{const first=prepare();cancel();const second=prepare();cancel();releaseOld();let timeout,timedOut=false;
try{await Promise.race([Promise.all([first.settled,second.settled]),new Promise(r=>timeout=setTimeout(()=>{timedOut=true;r();},500))]);}finally{clearTimeout(timeout);for(const t of timers)clearTimeout(t);}
const last=second.messages.at(-1),result={ok:!timedOut&&downloads===0&&last?.stage==='error'&&last?.name==='AbortError',timedOut,downloads,opens,workerSha256:crypto.createHash('sha256').update(source).digest('hex'),sequence:'prepareA/cancelA/prepareB/cancelB/releaseA delayed cache open',first:first.messages,second:second.messages,scope:'Exact Worker message handlers in NodeVM; synthetic delayed cleanup/cache; real browser lifecycle not covered'};fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=result.ok?0:1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
