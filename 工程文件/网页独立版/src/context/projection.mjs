/** Port of maintained 运行时/context-controller.js story/visibleStory; no host APIs. */
import {normalizeThinkingTags} from '../app/parse.mjs';
export function visibleStory(raw,{parser,name}={}){
 if(!parser?.inspect||!parser?.readingText||!parser?.prepareDialogue)return {text:String(raw||''),pending:false,hiddenThoughts:0};
 const prepared=parser.prepareDialogue(parser.readingText(normalizeThinkingTags(raw))),inspected=parser.inspect(prepared),cuts=inspected.ranges.filter(r=>r.aux||['UpdateVariable','ztl','xuan','CityPublicContext','m18-terminal'].includes(r.kind)),merged=[];
 for(const r of cuts.sort((a,b)=>a.start-b.start)){const prior=merged.at(-1);if(prior&&r.start<=prior.end)prior.end=Math.max(prior.end,r.end);else merged.push({start:r.start,end:r.end});}
 let text=prepared;for(const r of merged.reverse())text=text.slice(0,r.start)+'\n'+text.slice(r.end);text=text.replace(/<StatusPlaceHolderImpl\s*\/>/g,'').trim();
 const canonical=value=>parser.characterAliases?.[value]?.name||value,thoughts=parser.inspect(text).ranges.filter(r=>{if(r.kind!=='cxx-say')return false;const opening=text.slice(r.start,r.bodyStart),kind=/\bkind\s*=\s*(["'])(.*?)\1/i.exec(opening)?.[2];if(kind!=='thought')return false;const speaker=/\bspeaker\s*=\s*(["'])(.*?)\1/i.exec(opening)?.[2];return !speaker||!(['{{user}}','user','玩家'].includes(speaker)||name&&canonical(speaker)===canonical(name));});
 for(const r of thoughts.sort((a,b)=>b.start-a.start))text=text.slice(0,r.start)+'\n'+text.slice(r.end);
 return {text:text.trim(),hiddenThoughts:thoughts.length,pending:cuts.some(r=>!r.complete)};
}
