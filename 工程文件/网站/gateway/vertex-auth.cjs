'use strict';
const crypto=require('node:crypto');
const endpoint='https://oauth2.googleapis.com/token';
async function serviceAccountToken(account,{signal,fetchImpl=globalThis.fetch,now=()=>Date.now()}={}){
 const key=crypto.createPrivateKey(account.private_key);if(key.asymmetricKeyType!=='rsa')throw Error('服务账号需要RSA私钥');
 const issued=Math.floor(now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:endpoint,iat:issued,exp:issued+3600});
 const assertion=unsigned+'.'+crypto.sign('RSA-SHA256',Buffer.from(unsigned),key).toString('base64url');
 const response=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString(),signal,redirect:'error'});
 if(!response.ok)throw Error('Google服务账号鉴权失败，请检查账号权限及JSON。');
 const data=await response.json();if(typeof data.access_token!=='string'||!data.access_token||/[\r\n]/.test(data.access_token))throw Error('Google未返回有效访问令牌。');
 return data.access_token;
}
module.exports={serviceAccountToken};
