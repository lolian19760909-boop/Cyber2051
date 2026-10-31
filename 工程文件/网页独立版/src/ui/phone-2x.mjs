import {appUrl} from '../platform/paths.mjs';
let prepared;
export function phone2xStyle(){return prepared??=(async()=>{
 const response=await fetch(appUrl('web/phone-2x.css'));
 if(!response.ok)throw Error('通讯界面样式读取失败');
 return (await response.text()).replaceAll('cxx-phone-asset:',appUrl('web/assets/terminal-2x/'));
})().catch(error=>{prepared=null;throw error;});}
export function nativeFontStyle(doc){
 const style=doc.createElement('style'),base=appUrl('web/assets/terminal-2x/');
 style.textContent=[['Book',400],['Bold',700]].map(([name,weight])=>'@font-face{font-family:CxxCP2;src:url("'+base+'BlenderPro-'+name+'.woff2") format("woff2");font-weight:'+weight+';font-style:normal;font-display:swap}').join('\n');
 doc.head.append(style);return style;
}
