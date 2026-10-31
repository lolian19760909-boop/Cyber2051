/** Compile text bans and bias entries once, before either direct or relay transport. */
export async function prepareSamplingTokens(payload,source,family,getCounter){
 const p={...(payload.presetSettings||{}),...payload},text=['text-generic','kobold-lite'].includes(family),settings={...(p.textSettings||{}),...p};
 if(['pollinations','huggingface'].includes(source)&&!(p.seed>=0))payload={...payload,seed:Math.floor(Math.random()*(source==='pollinations'?99999999:2**32))};
 if(p.nativeTextEncoded)return payload;
 const entries=text?(Array.isArray(settings.logit_bias)?settings.logit_bias:[]):['openai','azure_openai','openrouter','electronhub','chutes','custom','openai-chat'].includes(source)?p.bias_presets?.[p.bias_preset_selected]||[]:[],bans=text&&settings.send_banned_tokens!==false?[settings.banned_tokens||'',settings.global_banned_tokens||''].filter(Boolean).join('\n'):'';
 if(!entries.length&&!bans)return payload;
 const counter=await getCounter(),encode=async value=>Array.from(await (counter.encodeAsync?counter.encodeAsync(value):counter.encode?counter.encode(value):[])),bias={};
 const rawIds=value=>{try{const ids=JSON.parse(value);return Array.isArray(ids)&&ids.every(Number.isInteger)?ids:null;}catch{return null;}};
 for(const entry of entries){if(!entry?.text)continue;let value=String(entry.text),ids;if(text){value=value.trim();if(!value)continue;if(value.startsWith('{')&&value.endsWith('}'))ids=await encode(value.slice(1,-1));else if(value.startsWith('[')&&value.endsWith(']'))ids=rawIds(value)||[];else ids=await encode(' '+value);}else ids=rawIds(value)||await encode(value);for(const id of ids)bias[id]=entry.value;}
 if(!text)return {...payload,logit_bias:bias};
 const bannedIds=[],bannedStrings=[];for(const line of [...new Set(bans.split('\n').filter(Boolean))]){if(line.startsWith('[')&&line.endsWith(']'))bannedIds.push(...(rawIds(line)||[]));else if(line.startsWith('"')&&line.endsWith('"'))bannedStrings.push(line.slice(1,-1));else bannedIds.push(...await encode(line));}
 return {...payload,nativeTextEncoded:{banned_tokens:[...new Set(bannedIds)].join(','),banned_strings:bannedStrings,logit_bias:bias}};
}
