/** Connection fields follow the installed SillyTavern 1.19.0 providers. */
export const SERVICE_DEFAULTS={openai:'https://api.openai.com/v1',claude:'https://api.anthropic.com/v1',openrouter:'https://openrouter.ai/api/v1',ai21:'https://api.ai21.com/studio/v1',makersuite:'https://generativelanguage.googleapis.com/v1beta',mistralai:'https://api.mistral.ai/v1',cohere:'https://api.cohere.com',perplexity:'https://api.perplexity.ai',groq:'https://api.groq.com/openai/v1',electronhub:'https://api.electronhub.ai/v1',chutes:'https://llm.chutes.ai/v1',nanogpt:'https://nano-gpt.com/api/v1',deepseek:'https://api.deepseek.com/beta',aimlapi:'https://api.aimlapi.com/v1',xai:'https://api.x.ai/v1',moonshot:'https://api.moonshot.ai/v1',fireworks:'https://api.fireworks.ai/inference/v1',cometapi:'https://api.cometapi.com/v1',mancer:'https://neuro.mancer.tech/oai/v1',togetherai:'https://api.together.xyz/v1',infermaticai:'https://api.totalgpt.ai/v1',dreamgen:'https://dreamgen.com/api/openai/v1',featherless:'https://api.featherless.ai/v1',novelai:'https://text.novelai.net',aihorde:'https://aihorde.net/api/v2'};
export const ENDPOINT_CHOICES={
 zai:[['common','通用','https://api.z.ai/api/paas/v4'],['coding','Coding','https://api.z.ai/api/coding/paas/v4']],
 siliconflow:[['global','国际','https://api.siliconflow.com/v1'],['cn','中国','https://api.siliconflow.cn/v1']],
 minimax:[['global','国际','https://api.minimax.io/v1'],['cn','中国','https://api.minimaxi.com/v1']],
 pollinations:[['authenticated','API Key','https://gen.pollinations.ai/v1'],['anonymous','匿名','https://text.pollinations.ai/v1']],
};
export const PROVIDER_FIELDS=['authMode','region','projectId','deployment','apiVersion','accountId','endpoint'];
export const sourceId=adapter=>String(adapter||'openai-chat').replace(/^(chat|text|extra):/,'');
export function connectionDefaults(adapter,provider={}){
 const id=sourceId(adapter),choices=ENDPOINT_CHOICES[id];
 if(choices)return (choices.find(row=>row[0]===provider.endpoint)||choices[0])[2];
 if(id==='workers_ai'||id==='workersai')return provider.accountId?'https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(provider.accountId)+'/ai':'';
 if(adapter==='text:openrouter')return 'https://openrouter.ai/api/v1';
 return SERVICE_DEFAULTS[id]||({'claude-messages':SERVICE_DEFAULTS.claude,'google-gemini':SERVICE_DEFAULTS.makersuite,'vertex-ai':'','azure-openai':''}[id])||'';
}
export function connectionCredential(settings){
 if(['vertexai','vertex-ai'].includes(sourceId(settings.adapter))&&settings.provider?.authMode==='full'){
  if(!settings.serviceAccount?.trim())return null;
  let serviceAccount;try{serviceAccount=JSON.parse(settings.serviceAccount||'');}catch{throw Error('请导入有效的 Google 服务账号 JSON。');}
  return {serviceAccount};
 }
 return settings.apiKey||null;
}
export function modelListAvailable(adapter){return !['vertexai','vertex-ai','azure_openai','azure-openai','novelai','cometapi'].includes(sourceId(adapter));}
