'use strict';
module.exports.setup=async()=>{
 const cp=structuredClone,K=CxxStoryLibrary.KEY,sha=CxxUpdateCore.sha256;
 menu.destroy();openings.destroy();chosen='A';
 Object.assign(db.A[0].chat_metadata,{future:{zero:0,enabled:false,nested:{keep:'unknown'}}});
 db.A[0].chat_metadata[K].future={zero:0,enabled:false};
 Object.assign(db.A[1],{swipes:[db.A[1].mes,'保留的另一条回复'],swipe_info:[{extra:{zero:0}},{extra:{enabled:false}}],variables:[{stat_data:{hp:0,future:false}},{stat_data:{hp:99,unknown:{keep:true}}}],extra:{custom:'keep'}});
 for(let i=3;i<=9;i++){db['s'+i]=cp(db.B);Object.assign(db['s'+i][0].chat_metadata[K],{storyId:'story'+i,routeId:'route'+i,name:'保留故事 '+i,slot:i});}
 window.originalRows=cp(db.A);window.otherRows=cp(db.B);window.originalDb=cp(db);window.archiveStats={writes:[],reads:[],flushes:0,imports:[],downloads:[],closes:0};
 window.holdPoint=false;window.failPoint=false;
 adapter.exists=async id=>!!db[id];
 adapter.read=async id=>{archiveStats.reads.push(id);if(!db[id])throw Error('记录不存在');return cp(db[id]);};
 adapter.write=async(id,rows)=>{archiveStats.writes.push(id);if(holdPoint)await new Promise(r=>window.finishPoint=r);if(failPoint)throw Error('受控存档写入失败');db[id]=cp(rows);};
 adapter.removePoint=async(id,expected)=>{if(db[id]?.[0]?.chat_metadata[K]?.rowsHash!==expected)throw Error('指纹不符');delete db[id];};
 adapter.flush=async()=>{archiveStats.flushes++;};
 adapter.capture=async()=>{const d={format:1,type:'cyber2051.migration',source:{workId:'cyber2051'},sourceContext:{chatId:chosen},payload:{header:cp(db[chosen][0]),messages:cp(db[chosen].slice(1))},archive:{unknown:{zero:0,enabled:false}}};d.sha256=await sha(d);return d;};
 adapter.validateExport=async d=>{const value=cp(d),expected=value.sha256;delete value.sha256;if(!expected||await sha(value)!==expected)throw Error('存档指纹不符');return cp(d);};
 adapter.importDocument=async d=>{await adapter.validateExport(d);const chatId='import'+(archiveStats.imports.length+1);db[chatId]=[cp(d.payload.header),...cp(d.payload.messages)];archiveStats.imports.push(chatId);return {chatId};};
 window.focusAnchor=document.createElement('button');focusAnchor.textContent='返回焦点';document.body.append(focusAnchor);focusAnchor.focus();
 window.mountArchive=async initial=>{const all=await store.list(),current=all.find(i=>i.chatId===chosen);window.archive=CxxStoryUI.mount({document,scope:window.current(),initial,current,store,covers:CxxStoryAssets,upload:async()=>{throw Error('受控图片上传失败');},download:async d=>archiveStats.downloads.push(cp(d)),prepareImport:async raw=>{const d=await adapter.validateExport(JSON.parse(raw));return {document:d,meta:CxxStoryLibrary.metadata([d.payload.header]),preview:CxxStoryLibrary.describe([d.payload.header,...d.payload.messages])};},onClose:()=>{archiveStats.closes++;archive.destroy();},onContinue:()=>{archiveStats.closes++;archive.destroy();}});await archive.refresh();};
 await mountArchive();
};
