// 全站共享登录；保留原 handoff、认证端点和凭据键。
'use strict';
(function () {
  const TOKEN='cxx-oauth-token', NAME='cxx-oauth-name', AVATAR='cxx-oauth-avatar';
  let account=null,pending=null,checking=null,lastState=null,stateObserver=null;
  const strings=new Map();
  const text=(zh,en,ja)=>{const lang=window.CXXI18N?.current()||'zh';const value=lang==='en'?en:lang==='ja'?ja:zh;strings.set(value,[zh,en,ja]);return value;};
  const headers=extra=>{const token=localStorage.getItem(TOKEN);return {...(extra||{}),...(token?{Authorization:'Bearer '+token}:{})};};
  function notify(value){account=value;document.dispatchEvent(new CustomEvent('cxx-user-changed',{detail:{account}}));chip();}
  function clear(){for(const key of [TOKEN,NAME,AVATAR])localStorage.removeItem(key);}
  function check(){
    if(checking)return checking;
    checking=checkAccount().finally(()=>{checking=null;});return checking;
  }
  async function checkAccount(){
    if(!localStorage.getItem(TOKEN)){notify(null);return null;}
    const requestedToken=localStorage.getItem(TOKEN);
    const r=await fetch('/api/workshop/me',{headers:headers(),cache:'no-store'});
    if(localStorage.getItem(TOKEN)!==requestedToken)return account;
    if(r.status===401||r.status===403){clear();notify(null);return null;}
    const j=await r.json();
    if(localStorage.getItem(TOKEN)!==requestedToken)return account;
    if(!r.ok)throw Error(text('登录状态读取失败，请重试。','Could not check your login. Retry.','ログイン状態を確認できません。再試行してください。'));
    notify(j);return j;
  }
  function cancelLogin(){if(pending)pending.cancel();}
  function logout(){cancelLogin();clear();notify(null);}
  function loginDiscord({onState}={}){
    if(pending)return pending.promise;
    const popup=window.open('about:blank','cxx-login','width=520,height=720');
    stateObserver=onState;
    const report=(state,message)=>{lastState={state,message};onState?.(lastState);};
    if(!popup){
      const error=Error(text('登录窗口被拦截，请允许弹窗后重试。','Allow popups, then retry login.','ポップアップを許可してから再試行してください。'));
      report('error',error.message);return Promise.reject(error);
    }
    const operation={cancelled:false,timer:null,controller:new AbortController(),cancel(){this.cancelled=true;this.controller.abort();clearTimeout(this.timer);this.wake?.();try{popup.close();}catch{}}};
    const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    operation.promise=(async()=>{
      try{
        report('starting',text('正在建立登录会话……','Starting login…','ログインを開始しています…'));
        const handoffId=b64(crypto.getRandomValues(new Uint8Array(24))),secret=b64(crypto.getRandomValues(new Uint8Array(32)));
        const challenge=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)))].map(b=>b.toString(16).padStart(2,'0')).join('');
        const r=await fetch('/api/workshop/login-handoff/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handoffId,challenge}),signal:operation.controller.signal}),j=await r.json();
        if(!r.ok||!j.ok)throw Error(text('暂时无法发起 Discord 登录，请稍后重试。','Discord login is unavailable. Retry later.','Discord ログインを開始できません。後で再試行してください。'));
        if(operation.cancelled)throw Error(text('已取消登录。','Login cancelled.','ログインを中止しました。'));
        popup.location.href=j.loginUrl;
        report('waiting',text('请在 Discord 窗口完成登录；本页会自动继续。','Complete login in Discord. This page will continue automatically.','Discord でログインしてください。このページは自動的に続行します。'));
        const deadline=Date.now()+(j.expiresInMs||600000);
        while(!operation.cancelled&&Date.now()<deadline){
          await new Promise(resolve=>{operation.wake=resolve;operation.timer=setTimeout(resolve,2500);});
          if(operation.cancelled)break;
          let pr,pj;
          try{pr=await fetch('/api/workshop/login-handoff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handoffId,secret}),cache:'no-store',signal:operation.controller.signal});pj=await pr.json();}
          catch{if(operation.cancelled)break;report('waiting',text('连接暂时中断，正在重试；你的填写内容还在。','Connection interrupted. Retrying; your draft is safe.','接続が途切れました。入力を保持して再試行しています。'));continue;}
          if(operation.cancelled)break;
          if(pr.status===410||pr.status===403)throw Error(text('登录会话已失效，请重试。','Login session expired. Retry.','ログインの有効期限が切れました。再試行してください。'));
          if(pj.status==='ready'&&pj.token){
            localStorage.setItem(TOKEN,pj.token);localStorage.setItem(NAME,pj.displayName||'');localStorage.removeItem(AVATAR);
            const value={displayName:pj.displayName||text('已登录','Signed in','ログイン済み')};
            notify(value);report('ready',text('登录成功，可以继续。','Signed in. You can continue.','ログインしました。続行できます。'));
            try{popup.close();}catch{}return value;
          }
        }
        throw Error(operation.cancelled?text('已取消登录。','Login cancelled.','ログインを中止しました。'):text('登录超时，请重试。','Login timed out. Retry.','ログインがタイムアウトしました。再試行してください。'));
      }catch(error){if(operation.cancelled)error=Error(text('已取消登录。','Login cancelled.','ログインを中止しました。'));report('error',error.message);try{popup.close();}catch{}throw error;}
      finally{clearTimeout(operation.timer);if(pending===operation)pending=null;}
    })();
    pending=operation;return operation.promise;
  }
  let accountUI,accountDialog;
  function loadAccountUI(){return window.CXXAccount?Promise.resolve():accountUI||(accountUI=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/workshop/account.js?v=account-ui-20261031';script.onload=resolve;script.onerror=()=>{accountUI=null;reject(Error('账号界面读取失败，请重试。'));};document.head.append(script);}));}
  function acceptAccount(value){localStorage.setItem(TOKEN,value.token);localStorage.setItem(NAME,value.displayName||'');localStorage.removeItem(AVATAR);notify({publisherId:value.publisherId,displayName:value.displayName});}
  async function accountWindow(view,options={}){if(accountDialog)return accountDialog;await loadAccountUI();accountDialog=CXXAccount.open({view,headers,accept:acceptAccount,loginDiscord,onState:options.onState}).finally(()=>{accountDialog=null;});return accountDialog;}
  function login(options={}){return accountWindow('login',options);}
  function accountSettings(){return accountWindow('password');}
  function chip(){
    const nav=document.querySelector('.site-header .nav');if(!nav)return;
    let c=nav.querySelector('.user-chip');
    if(!c){c=document.createElement('a');c.className='user-chip';c.href='/my.html';nav.appendChild(c);}
    c.textContent=account?account.displayName||text('我的投稿','My posts','マイ投稿'):text('登录','Sign in','ログイン');
    c.title=text('登录 / 我的投稿','Login / my posts','ログイン / マイ投稿');c.classList.toggle('signed-in',Boolean(account));
    let settings=nav.querySelector('.account-settings');if(account&&!settings){settings=document.createElement('button');settings.type='button';settings.className='account-settings';settings.textContent='账号';settings.onclick=()=>accountSettings().catch(()=>{});nav.append(settings);}else if(!account)settings?.remove();
  }
  window.CXXUser={accountVersion:'site-accounts/1',login,check,logout,cancelLogin,headers,accountSettings,current:()=>account};
  document.addEventListener('cxx-lang-changed',()=>{chip();if(pending&&lastState&&stateObserver&&strings.has(lastState.message)){lastState={state:lastState.state,message:text(...strings.get(lastState.message))};stateObserver(lastState);}});
  const boot=()=>{chip();check().catch(()=>chip());};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
