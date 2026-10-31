/** Use the existing website CXXUser lifecycle and credential keys. No second OAuth client. */
export class LoginError extends Error{constructor(code,message){super(message||code);this.name='LoginError';this.code=code;}}
export function createSiteLogin({client=globalThis.CXXUser}={}){
  return {async login({onWaiting}={}){
    if(!client?.login||!client?.check)throw new LoginError('login_client_missing','站点登录组件尚未就绪');
    await client.login({onState:state=>{if(state.state==='waiting')onWaiting?.();}});
    const account=await client.check();
    if(!account?.publisherId)throw new LoginError('account_unavailable','尚未取得有效站点身份');
    const headers=client.headers(),authorization=headers.Authorization||headers.authorization||'';
    return {...account,token:authorization.replace(/^Bearer\s+/i,'')};
  }};
}
export function createSessionTokenStore(storage,client=globalThis.CXXUser){
  return {
    get(){try{return storage?.getItem('cxx-oauth-token')||'';}catch{return '';}},
    set(token,extra={}){try{if(token)storage?.setItem('cxx-oauth-token',String(token));if(extra.displayName)storage?.setItem('cxx-oauth-name',extra.displayName);}catch{}return String(token||'');},
    publisherId(){return client?.current?.()?.publisherId||'';},
    displayName(){try{return client?.current?.()?.displayName||storage?.getItem('cxx-oauth-name')||'';}catch{return '';}},
    clear(){if(client?.logout)client.logout();else try{for(const key of ['cxx-oauth-token','cxx-oauth-name','cxx-oauth-avatar'])storage?.removeItem(key);}catch{}return '';},
  };
}

// Existing Tavern integrations retain their import name; the shared client offers both methods.
export const createDiscordLogin=createSiteLogin;
