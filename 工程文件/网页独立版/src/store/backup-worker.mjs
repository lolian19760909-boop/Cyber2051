import '../../card/共享/vendor/js-sha256/sha256.js';
import {encodeSave,decodeSave} from './backup.mjs';
globalThis.CxxSha256=globalThis.sha256;
const cryptoReady=import('../../card/运行时/crypto-compat.js');
self.onmessage=async({data:{id,kind,value}})=>{try{await cryptoReady;const result=await(kind==='encode'?encodeSave(value):decodeSave(value));self.postMessage({id,result});}catch(error){self.postMessage({id,error:{message:error.message,code:error.code||'save_processing'}});}};
