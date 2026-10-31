/** Deterministic local BM25. Chinese unigrams/bigrams preserve names without remote tokenization. */
export function terms(value){const text=String(value||'').normalize('NFKC').toLowerCase(),result=text.match(/[a-z0-9_]+/g)||[];for(const run of text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu)||[]){const chars=[...run];result.push(...chars);for(let i=0;i+1<chars.length;i++)result.push(chars[i]+chars[i+1]);}return result;}
export function createBM25(documents,{k1=1.2,b=0.75}={}){
  const rows=documents.map(document=>{const tokens=terms(document.text),counts=new Map();for(const term of tokens)counts.set(term,(counts.get(term)||0)+1);return {...document,length:tokens.length,counts};}),average=rows.reduce((n,r)=>n+r.length,0)/Math.max(1,rows.length),frequency=new Map();
  for(const row of rows)for(const term of row.counts.keys())frequency.set(term,(frequency.get(term)||0)+1);
  return {size:rows.length,query(value,{limit=12}={}){const query=[...new Set(terms(value))].slice(0,1024);return rows.map(row=>{let score=0;for(const term of query){const count=row.counts.get(term)||0;if(!count)continue;const df=frequency.get(term),idf=Math.log(1+(rows.length-df+0.5)/(df+0.5));score+=idf*count*(k1+1)/(count+k1*(1-b+b*row.length/(average||1)));}return {id:row.id,score};}).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,limit);}};
}
