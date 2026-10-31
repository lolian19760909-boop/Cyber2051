// 本机回归用：没有真实模型、密钥或付费请求。
import http from 'node:http';
const news = { outlet: '都营新闻', column: '科技', title: '本机测试新闻', lead: '这是一条本机测试导语。', body: '<img src=x onerror=alert(1)> 测试正文保持为文字。' };
const thread = { board: '杂谈', title: '本机测试帖子', author: '测试员', posts: [{ author: '测试员', text: '本机回归楼层。' }] };
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.end(); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const model = JSON.parse(raw || '{}').model;
  if (model === 'error') { res.writeHead(500); res.end('fixture failure'); return; }
  const value = model === 'empty' ? { news: [], threads: [] } : model === 'malformed' ? { news: [news], threads: [{ ...thread, posts: [{}] }] } : { news: [news, { ...news, title: '本机测试新闻二' }], threads: [thread, { ...thread, title: '本机测试帖子二' }] };
  if (model === 'delay') await new Promise(resolve => setTimeout(resolve, 5000));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }));
}).listen(6905, '127.0.0.1', () => console.log('仅本机测试接口：http://127.0.0.1:6905/v1'));
