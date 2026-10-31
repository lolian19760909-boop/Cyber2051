import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {publicNewsSources} from '../src/ui/experience.mjs';
const require=createRequire(import.meta.url),News=require('../../卡片源码/运行时/news.js');
const privateText='PRIVATE_PHONE_4729_SECRET',thought='INNER_THOUGHT_8153_SECRET';
const block=value=>'<CityPublicContext>'+JSON.stringify(value)+'</CityPublicContext>';
const publicEvent={date:'2051-04-10',location:'池袋广场',events:['广场公开演出已经开始。']};
const nodes=[
 {nodeId:'private',message:{raw:'<cxx-story>私聊 '+privateText+'。<cxx-thought>'+thought+'</cxx-thought></cxx-story>'}},
 {nodeId:'public',message:{raw:'<cxx-story>玩家的私人余额为12345。'+privateText+'</cxx-story>'+block(publicEvent)}},
 {nodeId:'quoted',message:{raw:'```html\n'+block({date:null,location:null,events:[thought]})+'\n```'}},
 {nodeId:'empty',message:{raw:block({date:null,location:null,events:[]})}},
 {nodeId:'duplicate',message:{raw:block(publicEvent)+block(publicEvent)}}
];
const rows=[{id:'journal',from:0,to:4,text:privateText+thought,sourceNodeIds:nodes.map(n=>n.nodeId)}];
const output=publicNewsSources(rows,nodes,News.summary),checks=[];
assert.equal(output.length,1);assert.deepEqual(output[0].publicEvents,[{nodeId:'public',...publicEvent}]);checks.push('所选完整纪要范围仅采用原卡协议确认的公共事件');
assert.ok(!JSON.stringify(output).includes(privateText));assert.ok(!JSON.stringify(output).includes(thought));assert.ok(!JSON.stringify(output).includes('12345'));checks.push('私人纪要、私聊、心声和个人余额均不进入新闻输入');
assert.equal(output[0].publicEvents.some(r=>['quoted','empty','duplicate'].includes(r.nodeId)),false);checks.push('引用示例、空公共事件及重复协议不产生新闻事实');
assert.deepEqual(publicNewsSources([{id:'only-private',sourceNodeIds:['private']}],nodes,News.summary),[]);checks.push('没有明确公共事件时不给新闻模型发送输入');
assert.deepEqual(publicNewsSources([{id:'old-branch',sourceNodeIds:['not-current']}],nodes,News.summary),[]);checks.push('当前路线之外的来源不能借旧纪要进入新闻输入');
assert.deepEqual(publicNewsSources([{id:'dedup',sourceNodeIds:['public','public']}],nodes,News.summary)[0].publicEvents.length,1);checks.push('同一原文来源去重且保留纪要和节点引用');
const report={at:new Date().toISOString(),pass:true,checks,scope:'维护源 CxxCityNews.summary 与网页新闻输入投影；未请求真实模型'};
await writeFile(new URL('../reports/p3a-news-privacy-check.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
