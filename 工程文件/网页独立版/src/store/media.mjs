/** JSON wire form only for native chat files and portable backups. IDB keeps Blobs. */
const marker='cxx2051/blob/v1';
function base64(bytes){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
function bytes(text){const binary=atob(text),out=new Uint8Array(binary.length);for(let i=0;i<out.length;i++)out[i]=binary.charCodeAt(i);return out;}
export async function packMedia(value){
 if(value instanceof Blob){const parts=[];for(let at=0;at<value.size;at+=1024*1024)parts.push(base64(new Uint8Array(await value.slice(at,at+1024*1024).arrayBuffer())));return {__cxxWire:marker,mime:value.type,bytes:value.size,parts,...(typeof File!=='undefined'&&value instanceof File?{name:value.name,lastModified:value.lastModified}:{})};}
 if(Array.isArray(value))return Promise.all(value.map(packMedia));if(value&&typeof value==='object'){const pairs=await Promise.all(Object.entries(value).map(async([key,row])=>[key,await packMedia(row)]));return Object.fromEntries(pairs);}return value;
}
export async function unpackMedia(value){
 if(value?.__cxxWire===marker){if(!Array.isArray(value.parts)||!Number.isSafeInteger(value.bytes)||value.bytes<0)throw new Error('媒体记录格式损坏');const data=value.parts.map(bytes),size=data.reduce((n,p)=>n+p.length,0);if(size!==value.bytes)throw new Error('媒体记录字节数不符');return value.name&&typeof File!=='undefined'?new File(data,value.name,{type:value.mime,lastModified:value.lastModified}):new Blob(data,{type:value.mime});}
 if(Array.isArray(value))return Promise.all(value.map(unpackMedia));if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,row])=>[key,await unpackMedia(row)])));return value;
}
