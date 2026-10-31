const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {digest}=require('../../卡片源码/地图/resource-client.js');
for(const length of [0,3,55,56,64,65,65536,262177])test('HTTP fallback SHA-256 matches Node, bytes='+length,async()=>{const input=Uint8Array.from({length},(_,i)=>(i*37+11)&255);assert.equal(await digest(input.buffer,null),crypto.createHash('sha256').update(input).digest('hex'));});
