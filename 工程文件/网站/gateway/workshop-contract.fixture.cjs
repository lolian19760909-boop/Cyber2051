'use strict';
// 仅本机合成账户/临时库/测试钥。不会读取 .env、生产库或实际 Discord 身份。
const http=require('node:http'),net=require('node:net'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{DatabaseSync}=require('node:sqlite');
const F=require('./official-release-fixtures.cjs'),C=require('./workshop-contract.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){for(let n=0;n<32;n++){const s=net.createServer(),p=crypto.randomInt(20000,60000);try{await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(p,'127.0.0.1',resolve);});await new Promise(r=>s.close(r));return p;}catch(e){if(e.code!=='EADDRINUSE')throw e;}}throw Error('no available fixture port');}
async function startFixture(port=0,{evidenceDirectory}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cxx-p3-contract-fixture-')),pair=F.keys(),keyFile=path.join(root,'TEST-ONLY-private.pem');
 fs.writeFileSync(keyFile,pair.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});
 const gatewayPort=await freePort(),dbFile=path.join(root,'workshop.db'),adminToken=crypto.randomBytes(32).toString('hex'),secret=crypto.randomBytes(32).toString('hex');
 const child=spawn(process.execPath,[path.join(__dirname, "server.js")],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{}),
  CXX_GATEWAY_PORT:String(gatewayPort),CXX_DB_PATH:dbFile,CXX_STORAGE:path.join(root,'workshop-storage'),CXX_ADMIN_TOKEN:adminToken,CXX_IPSALT:'TEST-ONLY-ip-salt',SESSION_SECRET:secret,
  CXX_FORMAT3_PACKAGES_MODULE:path.resolve(__dirname,"../../工具/发布/packages.cjs"),CXX_OFFICIAL_RELEASE_DIR:path.join(root,'releases/v3'),CXX_OFFICIAL_SIGNING_KEY_FILE:keyFile,CXX_OFFICIAL_KEY_ID:'test.key'}});
 child.stdout.resume();child.stderr.resume();let server,closed=false;
 const ids={authorized:'1111111111111111',ordinary:'2222222222222222',other:'3333333333333333'};
 function session(role){if(role==='admin')return {token:adminToken,fixture:true};if(!ids[role])return null;const payload=Buffer.from(JSON.stringify({v:2,pid:ids[role],n:'本地合成 '+role,exp:Date.now()+3600000})).toString('base64url');return {token:payload+'.'+crypto.createHmac('sha256',secret).update(payload).digest('base64url'),publisherId:ids[role],displayName:'本地合成 '+role,fixture:true};}
 function publicFixture(){
  const responses={},modern=path.join(root,'releases/v3/component-manifest.json'),legacy=path.join(root,'releases/v3/manifest.json'),manifest=fs.existsSync(modern)?modern:legacy;let catalogText=null;
  if(fs.existsSync(manifest)){catalogText=fs.readFileSync(manifest,'utf8');responses['https://cyber2051.top/updates/v3/'+(fs.existsSync(modern)?'component-manifest.json':'manifest.json')]=catalogText;if(fs.existsSync(legacy))responses['https://cyber2051.top/updates/v3/manifest.json']=fs.readFileSync(legacy,'utf8');
   for(const p of JSON.parse(catalogText).packages)responses[p.url]=fs.readFileSync(path.join(root,'releases/v3/packages',p.id,p.version+'.json'),'utf8');}
  const result={fixture:true,trusted:{'test.key':crypto.createPublicKey(pair.pem).export({type:'spki',format:'der'}).toString('base64')},catalogText,responses};
  if(evidenceDirectory){fs.mkdirSync(evidenceDirectory,{recursive:true});const temp=path.join(evidenceDirectory,'public-fixture.json.tmp');fs.writeFileSync(temp,JSON.stringify(result,null,2)+'\n');fs.renameSync(temp,path.join(evidenceDirectory,'public-fixture.json'));fs.writeFileSync(path.join(evidenceDirectory,'TEST-ONLY-public-key.pem'),pair.pem);}
  return result;
 }
 async function close(){if(closed)return;closed=true;if(server?.listening)await new Promise(r=>server.close(r));if(child.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}
  if(evidenceDirectory){publicFixture();if(fs.existsSync(dbFile))fs.copyFileSync(dbFile,path.join(evidenceDirectory,'fixture-final.TEST-ONLY.sqlite'));}
  if(!root.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(root).startsWith('cxx-p3-contract-fixture-'))throw Error('unsafe fixture cleanup');fs.rmSync(root,{recursive:true,force:true});}
 try{
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('fixture child stopped');try{if((await fetch('http://127.0.0.1:'+gatewayPort+'/api/workshop/health')).ok){ready=true;break;}}catch{}await delay(30);}if(!ready)throw Error('fixture startup timeout');
  const db=new DatabaseSync(dbFile);for(const [role,id]of Object.entries(ids))db.prepare('INSERT INTO publishers(publisher_id,discord_id_hash,created_at,last_login_at,display_name_last,status,can_publish_official)VALUES(?,?,?,?,?,?,?)').run(id,crypto.createHash('sha256').update('TEST-ONLY-'+role).digest('hex'),new Date().toISOString(),new Date().toISOString(),'本地合成 '+role,'active',role==='authorized'?1:0);db.close();
  const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1');
   if(url.pathname==='/__fixture__/session'){const value=session(url.searchParams.get('role'));return json(res,value?200:404,value||{ok:false});}
   if(url.pathname==='/__fixture__/public-fixture.json')return json(res,200,publicFixture());
   if(url.pathname==='/__fixture__/file'){
    const requested=url.searchParams.get('url'),text=publicFixture().responses[requested];
    res.writeHead(text?200:404,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});res.end(text||JSON.stringify({ok:false,error:'fixture_file_missing'}));return;
   }
   if(url.pathname==='/__fixture__/card.json'){const card=F.card(pair.pem);card.data.extensions.tavern_helper.scripts[0].data.__cxx_update_seed.mapIndex=Object.fromEntries(C.schema().maps.map(m=>[m.id,m.places.map(p=>p.id)]));return json(res,200,card);}
   if(url.pathname==='/__fixture__/workflow.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(path.join(__dirname, "workshop-contract-fixture.html")).pipe(res);return;}
   if(url.pathname==='/__fixture__/stop'&&req.method==='POST'){json(res,200,{ok:true});setImmediate(()=>close());return;}
   if(url.pathname.startsWith('/api/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const headers={};for(const key of ['authorization','content-type','x-edit-key','x-filename'])if(req.headers[key])headers[key]=req.headers[key];
    const response=await fetch('http://127.0.0.1:'+gatewayPort+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store',...(response.headers.has('content-disposition')?{'Content-Disposition':response.headers.get('content-disposition')}:{})});res.end(Buffer.from(await response.arrayBuffer()));return;}
   const pathname=url.pathname.startsWith('/workshop/')?url.pathname.slice('/workshop'.length):url.pathname;
   const publicRoot=path.join(__dirname, "public"),file=path.resolve(publicRoot,'.'+(pathname==='/'?'/submit.html':decodeURIComponent(pathname)));
   if(!file.startsWith(publicRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{ok:false,error:'not_found'});
   res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
  }catch{json(res,500,{ok:false,error:'fixture_error'});}});
  const publicPort=port||await freePort();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(publicPort,'127.0.0.1',resolve);});
  const baseUrl='http://127.0.0.1:'+server.address().port;publicFixture();
  if(evidenceDirectory){const files=['server.js','official-release.cjs','workshop-contract.cjs','workshop-bridge.cjs','contract-places.json','public/submit.html','public/contract-form.js','workshop-contract.fixture.cjs','workshop-contract-fixture.html'];fs.writeFileSync(path.join(evidenceDirectory,'source-ledger.json'),JSON.stringify(files.map(file=>{const b=fs.readFileSync(path.join(__dirname,file));return {file,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};}),null,2)+'\n');}
  return {baseUrl,gatewayBaseUrl:'http://127.0.0.1:'+gatewayPort,root,session,publicFixture,close};
 }catch(e){await close();throw e;}
}
if(require.main===module){const evidence=path.resolve(__dirname,'../../.cache/workshop-fixture-'+Date.now());startFixture(Number(process.argv[2]||6920),{evidenceDirectory:evidence}).then(f=>{console.log(JSON.stringify({fixture:true,url:f.baseUrl+'/__fixture__/workflow.html',publicFixture:f.baseUrl+'/__fixture__/public-fixture.json',evidence}));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>f.close());}).catch(()=>{console.error('本地合成夹具启动失败；未连接生产。');process.exitCode=1;});}
module.exports={startFixture};
