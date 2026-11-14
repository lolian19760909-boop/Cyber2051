'use strict';
const path=require('node:path');
module.exports=async(context,file)=>{
 const pack=require('../../工具/lib/offline-resources.cjs')(path.resolve(__dirname,'../..'),{file}),stats={manifest:pack.manifest.id,requests:0,bytes:0,scope:'local bytes from the candidate resource pack; public delivery checked separately'};
 await context.route(pack.manifest.baseUrl+'**',async route=>{const name=decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)),body=pack.entries.get(name);if(!body)return route.fulfill({status:404,body:'missing candidate resource'});stats.requests++;stats.bytes+=body.length;return route.fulfill({body,contentType:pack.manifest.entries.find(e=>e.file===name)?.mime||'application/json',headers:{'access-control-allow-origin':'*'}});});
 return stats;
};
