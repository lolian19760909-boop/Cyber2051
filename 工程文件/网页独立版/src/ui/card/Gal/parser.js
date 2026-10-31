/* Derived from 卡片源码/Gal/parser.js; source SHA256 caf0d079975103aa5ceacc4a8d3ac827176ad4e7518227e3802d1ef7437b01c3. Rebuild with tools/p3a-adapt-views.mjs. */
/* Read-only adapter: maintained card protocols and the project's Izumi preset.
 * Auxiliary preset output is excluded from Gal narration only.
 * No game variables or source message text are written.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CxxGalParser = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const dialogueCodec=typeof module==='object'&&module.exports?require("../正文/dialogue.js"):globalThis.Cxx238Dialogue;
  const aliases=Object.create(null);
  dialogueCodec.portraits.forEach(p=>{
    for(const name of [p.name,...p.aliases]){aliases[name]={id:p.id,name:p.name};aliases[name.toLowerCase()]=aliases[name];}
  });
  const expressions=new Set(dialogueCodec.expressions);

  function mark(mask, start, end) { mask.fill(1, start, end); }

  function protectedText(text) {
    var blocks = new Uint8Array(text.length);
    var all = new Uint8Array(text.length);
    var lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
    var match, fence = null, quoted = false;
    while ((match = lines.exec(text)) && match[0]) {
      var line = match[0].replace(/[\r\n]+$/, '');
      var marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (!line.trim()) quoted = false;
      if (/^ {0,3}>/.test(line)) quoted = true;
      if (fence) {
        mark(blocks, match.index, lines.lastIndex);
        if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      } else if (quoted) {
        // Keep Markdown's unmarked continuation lines inside a blockquote.
        mark(blocks, match.index, lines.lastIndex);
      } else if (marker) {
        fence = marker[1];
        mark(blocks, match.index, lines.lastIndex);
      }
    }
    var htmlQuotes = /<(blockquote|pre|code)(?:\s[^>]*)?>[\s\S]*?(?:<\/\1>|$)|<!--[\s\S]*?(?:-->|$)/gi;
    while ((match = htmlQuotes.exec(text))) mark(blocks, match.index, htmlQuotes.lastIndex);
    all.set(blocks);
    var inline = /(`+)[\s\S]*?\1|“[^”]*”|‘[^’]*’|「[^」]*」|『[^』]*』|"[^"\r\n]*"|'[^'\r\n]*'/g;
    while ((match = inline.exec(text))) mark(all, match.index, inline.lastIndex);
    return { blocks: blocks, all: all };
  }

  function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
  // st-memory-enhancement reads the original message. Only reading copies pass here.
  function readingText(source) {
    let text=String(source);
    // Keep examples in code/quotes; comments themselves are not visible story text.
    const literal=protectedText(text.replace(/<!--|-->/g,m=>' '.repeat(m.length))).all;
    const cuts=[];
    for(const m of text.matchAll(/\\?<tableEdit\b[^>]*>[\s\S]*?(?:\\?<\/tableEdit\s*>|$)|<!--[\s\S]*?(?:-->|$)/gi)) {
      if(literal[m.index]||indentedTag(text,m.index))continue;
      if(!m[0].startsWith('<!--')||/\b(?:updateRow|insertRow|deleteRow)\s*\(/.test(m[0]))cuts.push([m.index,m.index+m[0].length]);
    }
    // Also tolerate a model omitting tableEdit, but only whole command lines.
    for(const m of text.matchAll(/^ {0,3}(?:updateRow|insertRow|deleteRow)\s*\(/gm)) {
      if(literal[m.index]||cuts.some(([a,b])=>m.index>=a&&m.index<b))continue;
      let at=m.index,valid=true,count=0;
      while(true){
        const head=/^\s*(updateRow|insertRow|deleteRow)\s*\(\s*\d+\s*,/.exec(text.slice(at));
        if(!head)break;
        let i=at+head[0].indexOf('(')+1,depth=1,quote='',escape=false;
        for(;i<text.length&&depth;i++){
          const ch=text[i];
          if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';}
          else if(ch==='"'||ch==="'")quote=ch;else if(ch==='(')depth++;else if(ch===')')depth--;
        }
        if(depth||quote){valid=false;break;}
        at=i;count++;while(/[ \t;]/.test(text[at]||'')&&at<text.length)at++;
        if(!/^(?:updateRow|insertRow|deleteRow)\s*\(/.test(text.slice(at)))break;
      }
      if(valid&&count&&(at===text.length||/[\r\n]/.test(text[at])))cuts.push([m.index,at]);
    }
    const merged=[];for(const [a,b]of cuts.sort((a,b)=>a[0]-b[0])){const prev=merged.at(-1);if(prev&&a<=prev[1])prev[1]=Math.max(prev[1],b);else merged.push([a,b]);}
    for(const [a,b]of merged.reverse())text=text.slice(0,a)+'\n'+text.slice(b);
    return text;
  }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function indentedTag(text, index) { var start = Math.max(text.lastIndexOf('\n', index - 1), text.lastIndexOf('\r', index - 1)) + 1; return /^(?: {4}|\t)/.test(text.slice(start, index)); }

  // Izumi can prefill the opener outside the saved reply. Identify that prefix
  // before scanning examples inside it as live status, choices or dialogue.
  function planningPrefix(raw, protection=protectedText(raw).all) {
    for(const close of raw.matchAll(/<\/(konatan_planning~|think|thinking)>/gi)) {
      if(protection[close.index]||indentedTag(raw,close.index))continue;
      const end=close.index+close[0].length,head=raw.slice(0,close.index);
      if(!head.trim()||!/^\s*(?:<tucao>|<cxx-story>)/.test(raw.slice(end)))return null;
      if([...head.matchAll(/<cxx-story>/g)].some(m=>!protection[m.index]&&!indentedTag(raw,m.index)))return null;
      const opener=/^\s*<(?:konatan_planning~|think|thinking)>/i.exec(head);
      return {kind:close[1].toLowerCase(),start:0,bodyStart:opener?.[0].length||0,closeStart:close.index,end,valid:true,complete:true,parent:null,aux:true};
    }
    const open=/^\s*<(think|thinking|konatan_planning~)>/i.exec(raw);
    if(open){const body=raw.indexOf('<cxx-story>',open[0].length);if(body>=0&&!protection[body]&&!indentedTag(raw,body)&&!new RegExp('</'+open[1]+'>','i').test(raw.slice(open[0].length,body)))return {kind:open[1].toLowerCase(),start:0,bodyStart:open[0].length,closeStart:body,end:body,valid:true,complete:true,parent:null,aux:true};}
    return null;
  }
  function dialogueProtection(text){const p=protectedText(text),prefix=planningPrefix(text,p.all);if(prefix)mark(p.all,prefix.start,prefix.end);return p;}

  function izumiNarrative(text, warnings) {
    const prefix=planningPrefix(text);if(prefix)text=text.slice(prefix.end);
    var protection = protectedText(text).all;
    var literal = /<(pre|code)(?:\s[^>]*)?>[\s\S]*?(?:<\/\1>|$)/gi, block;
    while ((block = literal.exec(text))) mark(protection, block.index, literal.lastIndex);
    // background 由预设正则折叠成「背景剧情」，卡自绘界面不走宿主正则，这里自行隐藏。
    var tags = /<(\/?)(konatan_planning~|think|thinking|tucao|konatan_chat|current_event|progress|summary_format|advice|disclaimer|guifan|danmu|options|htmlcontent|details|content|background)>/g;
    var visible = [], cursor = 0, match;
    while ((match = tags.exec(text))) {
      if (protection[match.index]) continue;
      var name = match[2];
      if (name === 'content') {
        visible.push(text.slice(cursor, match.index), '\n');
        cursor = tags.lastIndex;
        continue;
      }
      if (match[1]) {
        // Izumi prefills only the planning closer; the generated prefix has no opener.
        if (name === 'konatan_planning~') {
          visible.length = 0;
          cursor = tags.lastIndex;
        }
        continue;
      }
      if (name === 'details' && !/^\s*<summary>\s*(?:摘要|平行事件详情)\s*(?:<\/summary>|$)/.test(text.slice(tags.lastIndex))) continue;
      var pair = new RegExp('<(\\/?)' + name + '>', 'g'), depth = 1, closing;
      pair.lastIndex = tags.lastIndex;
      while ((closing = pair.exec(text))) {
        if (protection[closing.index]) continue;
        depth += closing[1] ? -1 : 1;
        if (!depth) break;
      }
      if (!closing) {
        warnings.push('辅助标签未闭合，无法确定正文边界，已保留后续文字');
        visible.push(text.slice(cursor));
        return visible.join('');
      }
      var end = pair.lastIndex;
      visible.push(text.slice(cursor, match.index), '\n\n');
      cursor = tags.lastIndex = end;
    }
    visible.push(text.slice(cursor));
    return visible.join('');
  }

  function dialogueMarkup(text, warnings, utterances) {
    return dialogueCodec.transform(text,item=>{
      if(!item.text)return '';
      const who=aliases[item.speaker];
      const index=utterances.push({text:item.text,speaker:who?.name||item.speaker,characterId:who?.id||null,expression:item.expression,dialogueText:item.text,...(typeof item.battle==='boolean'?{battle:item.battle}:{}),...(item.kind==='thought'?{kind:'thought'}:{})})-1;
      return '\n\n\uE110CXXD'+index+'\uE111\n\n';
    },protectedText);
  }

  function storyParts(raw, warnings) {
    var protection = protectedText(raw).all, pieces = [], ranges = [], match;
    var completedAux = /<(think|thinking|konatan_planning~|tucao|current_event|progress|summary_format)>([\s\S]*?)<\/\1>/gi;
    while ((match = completedAux.exec(raw))) mark(protection, match.index, completedAux.lastIndex);
    var tags = /<cxx-story\s*>/gi;
    while ((match = tags.exec(raw))) {
      if (protection[match.index] || indentedTag(raw, match.index)) continue;
      var closer = /<\/cxx-story\s*>/gi, closing;
      closer.lastIndex = tags.lastIndex;
      while ((closing = closer.exec(raw)) && protection[closing.index]) {}
      var end = closing ? closing.index : raw.length;
      if (!closing) {
        var boundary = /<(?:ztl|xuan|UpdateVariable|current_event|progress|CityPublicContext)\b/g;
        boundary.lastIndex = tags.lastIndex;
        var next;
        while ((next = boundary.exec(raw))) if (!protection[next.index]) { end = next.index; break; }
        warnings.push('正文标签未闭合，已读取至辅助内容边界');
      }
      pieces.push(raw.slice(tags.lastIndex, end));
      ranges.push([match.index, closing ? closer.lastIndex : end]);
      tags.lastIndex = closing ? closer.lastIndex : end;
    }
    if (!pieces.length) return null;
    // A complete auxiliary block is never a source of scene data. An unfinished
    // planning prefix must not swallow the independently delimited real story.
    var masked = new Uint8Array(protection);
    ranges.forEach(function (range) { mark(masked, range[0], range[1]); });
    var auxiliary = /<(think|thinking|konatan_planning~|tucao|current_event|progress|summary_format|details|pre|code|blockquote)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
    while ((match = auxiliary.exec(raw))) {
      if (!ranges.some(function (range) { return match.index < range[1] && auxiliary.lastIndex > range[0]; })) mark(masked, match.index, auxiliary.lastIndex);
    }
    var protocols = [], openings = /<(ztl|xuan|UpdateVariable|m18-terminal|CityPublicContext)>|<StatusPlaceHolderImpl\/>/g;
    while ((match = openings.exec(raw))) {
      if (masked[match.index]) continue;
      if (!match[1]) { protocols.push(match[0]); continue; }
      var close = raw.indexOf('</' + match[1] + '>', openings.lastIndex);
      var finish = close < 0 ? raw.length : close + match[1].length + 3;
      protocols.push(raw.slice(match.index, finish)); openings.lastIndex = finish;
    }
    return { body: pieces.join('\n\n'), protocols: protocols.join('\n\n') };
  }

  function readScene(body, warnings) {
    var scene = JSON.parse(body);
    if (!object(scene) || !nonempty(scene.location)) throw new Error('地点不完整');
    if (!nonempty(scene.time)) warnings.push('时间未记录，已保留地点');
    var charactersValid = Array.isArray(scene.characters) && scene.characters.every(function (item) { return object(item) && nonempty(item.name) && !!aliases[item.name]; });
    var people = charactersValid ? scene.characters.map(function (item) {
      if (typeof item.outfit !== 'string' || typeof item.thought !== 'string') warnings.push('人物详情不完整，已保留场景与人物名单');
      return { name: aliases[item.name].name, outfit: typeof item.outfit === 'string' ? item.outfit : '', thought: typeof item.thought === 'string' ? item.thought : '', ...(typeof item.battle==='boolean'?{battle:item.battle}:{}) };
    }) : [];
    if (!charactersValid) warnings.push('人物名单无效，立绘仅使用本回复明确的说话人');
    return { date: typeof scene.date === 'string' ? scene.date : '', time: nonempty(scene.time) ? scene.time : '', location: scene.location, characters: people, charactersValid: charactersValid, ...(scene.combat?.pending === true ? { combatPending: true } : {}) };
  }

  function readChoices(body) {
    var lines = body.trim().split(/\r\n|\r|\n/).filter(function (line) { return line.trim(); });
    if (lines.length !== 5) throw new Error('当前卡要求五个编号行动选项');
    return lines.map(function (line, index) {
      var match = /^\s*([1-5])\.\s*(\S[\s\S]*)$/.exec(line);
      if (!match || Number(match[1]) !== index + 1) throw new Error('选项编号或正文不完整');
      return match[2].trim();
    });
  }

  // Shared syntax decoder. Field authority and facts remain schema.prepare's job.
  function readUpdate(body) {
    let value=String(body).trim();
    const analysis=/^<(Analysis|Analyze)>[\s\S]*?<\/\1>\s*/i.exec(value);
    if(analysis)value=value.slice(analysis[0].length).trim();
    const tagged=/^<(json_?patch)>\s*([\s\S]*?)\s*<\/\1>$/i.exec(value);
    if(tagged)value=tagged[2].trim();
    const fence=/^(`{3,}|~{3,})(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/i.exec(value);
    if(fence)value=fence[2].trim();
    let patches;try{patches=JSON.parse(value);}catch{throw Error('变量更新需要完整的 JSON 数组；请检查括号、引号和标签边界。');}
    if(!Array.isArray(patches))throw Error('变量更新必须是 JSON 数组。');
    patches.forEach((entry,index)=>{
      if(!object(entry)||!['add','replace'].includes(entry.op)||!Object.hasOwn(entry,'value')||Object.keys(entry).some(k=>!['op','path','value'].includes(k)))throw Error('第 '+(index+1)+' 项需要 op、path、value，op 只接受 add 或 replace。');
      if(typeof entry.path!=='string'||!entry.path.startsWith('/')||entry.path==='/'||/~(?![01])/.test(entry.path)||entry.path.slice(1).split('/').some(k=>!k||['__proto__','constructor','prototype','$meta','$internal'].includes(k.replace(/~1/g,'/').replace(/~0/g,'~'))))throw Error('第 '+(index+1)+' 项变量路径格式不正确。');
    });
    return patches;
  }
  function standaloneUpdates(raw,protection,ranges){
    const found=[];
    for(const m of raw.matchAll(/<(json_?patch)>/gi)){
      if(protection.all[m.index]||indentedTag(raw,m.index)||ranges.concat(found).some(r=>m.index>=r.start&&m.index<r.end))continue;
      const ender=new RegExp('</'+m[1]+'>','ig');ender.lastIndex=m.index+m[0].length;const close=ender.exec(raw),end=close?ender.lastIndex:raw.length;
      found.push({kind:'UpdateVariable',start:m.index,bodyStart:m.index,closeStart:end,end,parent:null,valid:!!close,complete:!!close,standalone:true});
    }
    if(!ranges.length&&!found.length&&/^\s*(?:<(?:Analysis|Analyze)>[\s\S]*?<\/(?:Analysis|Analyze)>\s*)?\[/.test(raw))found.push({kind:'UpdateVariable',start:0,bodyStart:0,closeStart:raw.length,end:raw.length,parent:null,valid:true,complete:true,standalone:true});
    return found;
  }
  function variableUpdates(raw){
    raw=String(raw||'');const checked=inspect(raw),blocks=checked.ranges.filter(r=>r.kind==='UpdateVariable'&&!checked.ranges.some(a=>a.aux&&r.start>a.start&&r.end<=a.end));
    const issues=blocks.filter(r=>r.parent!==null||!r.valid||!r.complete).map(r=>r.reason||'变量块边界不完整或交叉嵌套。');
    for(const d of checked.diagnostics)if(/<\/?(?:UpdateVariable|json_?patch)>/i.test(raw.slice(d.start,d.end))&&!blocks.some(r=>d.start>=r.start&&d.end<=r.end))issues.push('存在无对应开始标签的变量结束标签。');
    const patches=[];
    if(!issues.length)for(const r of blocks)try{patches.push(...readUpdate(raw.slice(r.bodyStart,r.closeStart)));}catch(e){issues.push(e.message);}
    // These paths are transient event queues, never persisted arrays. Only their
    // append spelling is normalized; ordinary JSON Pointer paths stay untouched.
    const normalized=[];
    for(const patch of patches){
      const append=/^\/terminal\/(?:rosterInput|gameplay\/numericInput|ensemble\/actors\/[^/]+\/gameplay\/numericInput)\/-$/.test(patch.path);
      const item=append&&patch.op==='add'&&object(patch.value)?{...patch,path:patch.path.slice(0,-2),value:[patch.value]}:patch;
      const queue=/^\/terminal\/(?:rosterInput|gameplay\/numericInput|ensemble\/actors\/[^/]+\/gameplay\/numericInput)$/.test(item.path);
      if(queue&&item.op==='add'&&Array.isArray(item.value)){
        const previous=normalized.at(-1);if(previous?.op==='add'&&previous.path===item.path&&Array.isArray(previous.value))previous.value.push(...item.value);else normalized.push({...item,value:item.value.slice()});
      }else normalized.push(item);
    }
    return {found:blocks.length>0,patches:normalized,issues,ranges:blocks.map(({start,end})=>({start,end}))};
  }
  function readDialogue(line) {
    var label = /^([ \t]*)([^：:\r\n]+)[：:][ \t]*(\S[\s\S]*)$/.exec(line);
    if (!label) return null;
    var who = aliases[label[2]];
    var expression = 'normal', display = line;
    var expressionLabel = /^([^【】]+)【([^【】]*)】$/.exec(label[2]);
    if (expressionLabel && aliases[expressionLabel[1]]) {
      who = aliases[expressionLabel[1]];
      if (expressions.has(expressionLabel[2]) || expressionLabel[2] === 'yandere_trance') {
        expression = dialogueCodec.expression(expressionLabel[2]);
        display = label[1] + expressionLabel[1] + line.slice(label[1].length + label[2].length);
      }
    }
    // Current worldbook examples do not enforce a dialogue-output grammar.
    // Accept only a small explicit attribution set, never names mentioned in prose.
    var attribution = !who && /^(.*?)(轻声说|低声说|说道|问道|答道|说)$/.exec(label[2]);
    if (attribution) who = aliases[attribution[1]];
    if (!who) return null;
    var dialogue = label[3];
    var quoteEnd = { '“': '”', '‘': '’', '「': '」', '『': '』', '"': '"', "'": "'" }[dialogue[0]];
    if (quoteEnd) {
      var end = dialogue.indexOf(quoteEnd, 1);
      if (end < 0) return null;
      dialogue = dialogue.slice(1, end);
    } else if (attribution) return null;
    if (!dialogue.trim()) return null;
    return { who: who, text: dialogue, display: display, expression: expression, start: label[1].length };
  }

  function paragraphsFrom(text, utterances = []) {
    var protection = protectedText(text).all;
    // Only malformed/unclosed protocols remain at this stage. Keep their content
    // visible, but do not mistake lines in diagnostic payloads for spoken dialogue.
    var protocol = /<(ztl|xuan|UpdateVariable|m18-terminal|CityPublicContext)(?=[\s/>]|$)[^<>]*(?:>|(?=<)|$)/gi;
    var tag;
    while ((tag = protocol.exec(text))) {
      if (protection[tag.index]) continue;
      var close = text.indexOf('</' + tag[1] + '>', protocol.lastIndex);
      var end = close < 0 ? text.length : close + tag[1].length + 3;
      mark(protection, tag.index, end);
      protocol.lastIndex = end;
    }
    var paragraphs = [], pending = '';
    function flush() {
      if (pending.trim()) paragraphs.push({ text: pending.replace(/[\r\n]+$/, ''), speaker: null, characterId: null, expression: 'normal' });
      pending = '';
    }
    var lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
    var match;
    while ((match = lines.exec(text)) && match[0]) {
      var line = match[0].replace(/[\r\n]+$/, '');
      if (!line.trim()) { flush(); continue; }
      const utterance=/^\uE110CXXD(\d+)\uE111$/.exec(line.trim());
      if(utterance&&utterances[Number(utterance[1])]){flush();paragraphs.push(utterances[Number(utterance[1])]);continue;}
      var dialogue = readDialogue(line);
      if (dialogue && !/^(?: {4}|\t)/.test(line) && !protection[match.index + dialogue.start]) {
        flush();
        paragraphs.push({ text: dialogue.display, speaker: dialogue.who.name, characterId: dialogue.who.id,
          dialogueText: dialogue.text, expression: dialogue.expression });
      } else {
        pending += match[0];
      }
    }
    flush();
    return paragraphs;
  }

  function rankDialogue(paragraphs) {
    var byCharacter = new Map();
    paragraphs.forEach(function (paragraph, index) {
      if (!paragraph.characterId || !paragraph.dialogueText) return;
      // Count Unicode code points, not UTF-16 units; punctuation and whitespace
      // contribute no dialogue weight. The original text is never changed.
      var count = Array.from(paragraph.dialogueText.replace(/[\s\p{P}]/gu, '')).length;
      var entry = byCharacter.get(paragraph.characterId);
      if (!entry) {
        entry = { id: paragraph.characterId, name: paragraph.speaker, characters: 0, turns: 0,
          firstParagraph: index, lastParagraph: index };
        byCharacter.set(paragraph.characterId, entry);
      }
      entry.characters += count;
      entry.turns += 1;
      entry.lastParagraph = index;
    });
    return Array.from(byCharacter.values()).sort(function (a, b) {
      return b.characters - a.characters || b.turns - a.turns || a.firstParagraph - b.firstParagraph;
    });
  }

  const parsedCache = new Map();
  let cacheBytes=0,cacheEnabled=true;
  const clearCache=()=>{parsedCache.clear();cacheBytes=0;};
  function cacheRead(key,raw){const entry=parsedCache.get(key);if(!entry||entry.value.raw!==raw)return null;parsedCache.delete(key);parsedCache.set(key,entry);return entry.value;}
  function cacheWrite(key,value){const old=parsedCache.get(key);if(old){cacheBytes-=old.bytes;parsedCache.delete(key);}const bytes=JSON.stringify(value).length*2+(typeof key==='string'?key.length*2:64);if(bytes>16*1024*1024)return;parsedCache.set(key,{value,bytes});cacheBytes+=bytes;while(parsedCache.size>64||cacheBytes>16*1024*1024){const first=parsedCache.keys().next().value;cacheBytes-=parsedCache.get(first).bytes;parsedCache.delete(first);}}
  // Source ranges are shared by the display guard, Gal and summary extraction.
  function inspect(raw, { scenePayload = false } = {}) {
    const protection=protectedText(raw),ranges=[],stack=[],diagnostics=[];
    const planning=planningPrefix(raw,protection.all);if(planning)ranges.push(planning);
    const auxiliary=new Set(['think','thinking','konatan_planning~','tucao','advice','current_event','progress','summary_format','konatan_chat','disclaimer','guifan','danmu','options','htmlcontent','details']);
    const tokens=/<(\/?)(cxx-story|cxx-say|ztl|xuan|UpdateVariable|m18-terminal|CityPublicContext|think|thinking|konatan_planning~|tucao|advice|current_event|progress|summary_format|konatan_chat|disclaimer|guifan|danmu|options|htmlcontent|details)(?=[\s/>]|$)([^<>]*)(?:>|(?=<)|$)/gi;
    for(const m of raw.matchAll(tokens)) {
      if(m.index<(planning?.end||0)||protection.all[m.index]||indentedTag(raw,m.index))continue;
      const name=({updatevariable:'UpdateVariable',citypubliccontext:'CityPublicContext'})[m[2].toLowerCase()]||m[2].toLowerCase(),parent=stack.at(-1);
      const standard=(m[2]===name||name==='UpdateVariable'||scenePayload&&name==='ztl')&&m[0].endsWith('>');
      if(!m[1]) {
        if(name==='details'&&!/^\s*<summary>\s*(?:摘要|平行事件详情)/.test(raw.slice(m.index+m[0].length)))continue;
        const item={kind:name,start:m.index,bodyStart:m.index+m[0].length,end:raw.length,closeStart:raw.length,valid:standard,parent:parent?.start??null,aux:auxiliary.has(name)};
        if(parent&&!parent.aux&&!(parent.kind==='cxx-story'&&name==='cxx-say')){parent.valid=false;item.valid=false;}
        if(name!=='cxx-say'&&m[3].trim())item.valid=false;
        stack.push(item);ranges.push(item);
      } else {
        const at=stack.findLastIndex(x=>x.kind===name);
        if(at<0){diagnostics.push({start:m.index,end:m.index+m[0].length,message:'孤立结束标签，已保留原文'});continue;}
        const closing=stack.splice(at);
        for(const item of closing){item.closeStart=m.index;item.end=m.index+m[0].length;item.complete=item.kind===name;if(closing.length>1||!standard||m[3].trim())item.valid=false;}
      }
    }
    for(const item of stack){
      const wasValid=item.valid;item.valid=false;
      // A complete payload at the reply end may only lack its outer closer.
      if(item.kind==='UpdateVariable'&&item.parent===null&&wasValid)try{readUpdate(raw.slice(item.bodyStart));item.valid=true;item.complete=true;item.normalizedCloser=true;}catch{}
    }
    ranges.push(...standaloneUpdates(raw,protection,ranges));ranges.sort((a,b)=>a.start-b.start);
    const roots=ranges.filter(x=>x.parent===null);
    for(const name of ['cxx-story','ztl','xuan','m18-terminal','CityPublicContext']){
      const items=roots.filter(x=>x.kind===name);if(items.length>1)items.forEach(x=>x.valid=false);
    }
    for(const item of roots) {
      if(item===planning)continue;
      if(item.valid&&item.complete)try{
        if(item.kind!=='UpdateVariable'&&protection.blocks.subarray(item.start,item.end).some(Boolean))throw Error('协议跨入引用');
        const body=raw.slice(item.bodyStart,item.closeStart);
        if(item.kind==='ztl'&&!scenePayload)readScene(body,[]);
        if(item.kind==='xuan')readChoices(body);
        if(item.kind==='UpdateVariable')readUpdate(body);
        if(item.kind==='m18-terminal'&&body!=='')throw Error('终端标记必须为空');
      }catch(error){item.valid=false;item.reason=error.message;}
      if(!item.valid||!item.complete)diagnostics.push({start:item.start,end:item.end,message:item.kind+' 标签残缺、重复或内容无效，已保留原文'+(item.reason?'：'+item.reason:'')});
    }
    return {ranges,roots,diagnostics,protection,planning};
  }
  // Settlement uses the reader's structural boundaries, while accepting legacy
  // scene payloads that only list characters. Planning examples are never facts.
  function settlementParts(raw) {
    raw=String(raw||'');const checked=inspect(raw,{scenePayload:true}),scenes=checked.roots.filter(r=>r.kind==='ztl');
    let scene=null;
    if(scenes.length){
      const r=scenes[0];
      try{if(scenes.length!==1||!r.valid||!r.complete)throw Error();scene=JSON.parse(raw.slice(r.bodyStart,r.closeStart));if(!scene||typeof scene!=='object'||Array.isArray(scene)||scene.characters!==undefined&&!Array.isArray(scene.characters))throw Error();}
      catch{throw Error('在场人物需要完整的ztl JSON。');}
    }
    const stories=checked.roots.filter(r=>r.kind==='cxx-story');
    if(stories.length&&!(stories.length===1&&stories[0].valid&&stories[0].complete))throw Error('NPC事实需要完整的正文。');
    let body=stories.length?raw.slice(stories[0].bodyStart,stories[0].closeStart):raw;
    if(!stories.length){for(const r of [...checked.roots].sort((a,b)=>b.start-a.start))body=body.slice(0,r.start)+body.slice(r.end);}
    return {scene,body};
  }
  function auxiliaryBlocks(raw) {
    if (typeof raw !== 'string') return [];
    const labels = {think:'查看思考',thinking:'查看思考','konatan_planning~':'查看思考',tucao:'查看吐槽',advice:'查看建议',UpdateVariable:'查看变量说明',summary_format:'查看摘要',current_event:'查看事件摘要',progress:'查看事件进度'};
    const protection = protectedText(raw).all, stack = [], result = [];
    const planning=planningPrefix(raw,protection);if(planning)result.push({text:raw.slice(0,planning.end),label:labels['konatan_planning~']});
    let malformed = false;
    for (const match of raw.matchAll(/<(\/?)(think|thinking|konatan_planning~|tucao|advice|UpdateVariable|summary_format|current_event|progress)>/g)) {
      if (match.index<(planning?.end||0) || protection[match.index] || indentedTag(raw,match.index)) continue;
      if (!match[1]) { if (!stack.length) malformed=false; stack.push({name:match[2],start:match.index,bodyStart:match.index+match[0].length}); continue; }
      if (!stack.length) continue;
      if (stack.at(-1).name!==match[2]) { malformed=true; continue; }
      const block=stack.pop();
      if (!stack.length && !malformed) {
        const body=raw.slice(block.bodyStart,match.index).trim();
        const text=raw.slice(block.start,match.index+match[0].length);
        if(body && (raw.indexOf(body)===raw.lastIndexOf(body) || block.name==='advice'&&raw.indexOf(text)===raw.lastIndexOf(text)))result.push({text,label:labels[block.name]});
      }
    }
    return result;
  }
  function parseMessage(raw,options={}) {
    if (typeof raw !== 'string') throw new TypeError('parseMessage expects a string');
    const cache=cacheEnabled&&options.cache!==false,cacheKey=options.key??raw,hit=cache&&cacheRead(cacheKey,raw);
    if(hit)return hit;
    var result = { paragraphs: [], choices: [], scene: null, terminal: null, warnings: [], raw: raw, dialogueRanking: [] };
    raw=dialogueCodec.normalize(readingText(raw),dialogueProtection);
    result.auxiliary = auxiliaryBlocks(raw);
    const inspected=inspect(raw);
    // Reuse ranges only while this parse's text is identical. Auxiliary removal
    // and story unwrapping can change offsets and must trigger a fresh scan.
    let checkedText=raw,checked=inspected;
    const inspectCurrent=()=>{if(raw!==checkedText){checked=inspect(raw);checkedText=raw;}return checked;};
    result.validation=componentValidation(result.raw,raw===result.raw?inspected:undefined);
    result.ranges=inspected.ranges;result.diagnostics=inspected.diagnostics;
    result.warnings.push(...inspected.diagnostics.map(x=>x.message));
    const saved=[];
    // Keep invalid blocks intact while the legacy auxiliary decoder runs.
    const invalid=inspected.roots.filter(x=>!x.valid||!x.complete);
    for(const r of invalid.sort((a,b)=>b.start-a.start)){const token='\uE100CXX'+saved.length+'\uE101';saved.push(raw.slice(r.start,r.end));raw=raw.slice(0,r.start)+token+raw.slice(r.end);}
    raw=izumiNarrative(raw,result.warnings);
    raw=raw.replace(/\uE100CXX(\d+)\uE101/g,(_,i)=>saved[Number(i)]);
    const safeStory=inspectCurrent().roots.filter(x=>x.kind==='cxx-story'&&x.valid&&x.complete);
    for(const r of safeStory.sort((a,b)=>b.start-a.start))raw=raw.slice(0,r.start)+'\n\n'+raw.slice(r.bodyStart,r.closeStart)+'\n\n'+raw.slice(r.end);
    const current=inspectCurrent(),rejected=current.roots.filter(x=>!x.valid||!x.complete);
    var protection = current.protection;
    // M18 examples can also occur in HTML literal blocks or multiline attributes.
    // Keep this extra protection local to the new marker contract.
    var m18Protection = new Uint8Array(raw.length), htmlStack = [], htmlStart = 0, html;
    var htmlTags = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][\w:-]*)(?:\s+(?:[^<>"']+|"[^"]*"|'[^']*')*)?\s*\/?>/gi;
    while ((html = htmlTags.exec(raw))) {
      if (html[0].startsWith('<!--') || /["']/.test(html[0])) mark(m18Protection, html.index, htmlTags.lastIndex);
      var htmlName = html[1]?.toLowerCase();
      if (['pre', 'code', 'blockquote'].indexOf(htmlName) < 0) continue;
      if (html[0].startsWith('</')) {
        if (htmlStack[htmlStack.length - 1] !== htmlName) continue;
        htmlStack.pop();
        if (!htmlStack.length) mark(m18Protection, htmlStart, htmlTags.lastIndex);
      } else {
        if (!htmlStack.length) htmlStart = html.index;
        htmlStack.push(htmlName);
      }
    }
    if (htmlStack.length) mark(m18Protection, htmlStart, raw.length);
    var tags = /<StatusPlaceHolderImpl\/>|<(\/?)(ztl|xuan|UpdateVariable|m18-terminal|CityPublicContext)(?=[\s/>]|$)[^<>]*(?:>|(?=<)|$)/gi;
    var visible = [], cursor = 0, match;
    while ((match = tags.exec(raw))) {
      if(rejected.some(r=>match.index>=r.start&&match.index<r.end))continue;
      if (protection.all[match.index] || indentedTag(raw, match.index)) continue;
      if (match[2]?.toLowerCase() === 'm18-terminal') {
        var m18LineStart = Math.max(raw.lastIndexOf('\n', match.index - 1), raw.lastIndexOf('\r', match.index - 1)) + 1;
        if (m18Protection[match.index] || /^(?: {4}| {0,3}\t)/.test(raw.slice(m18LineStart, match.index))) continue;
      }
      if (match[0] === '<StatusPlaceHolderImpl/>') {
        // MVU appends this exact standalone marker to assistant text before saving.
        // Keep indented code and markup containing the token as literal content.
        var lineStart = Math.max(raw.lastIndexOf('\n', match.index - 1), raw.lastIndexOf('\r', match.index - 1)) + 1;
        var lineEnd = raw.slice(tags.lastIndex).search(/[\r\n]/);
        var suffix = raw.slice(tags.lastIndex, lineEnd < 0 ? raw.length : tags.lastIndex + lineEnd);
        var prefix = raw.slice(lineStart, match.index);
        if (!/^ {0,3}$/.test(prefix) || !/^[ \t]*$/.test(suffix)) continue;
        visible.push(raw.slice(cursor, match.index), '\n\n');
        cursor = tags.lastIndex;
        continue;
      }
      if (!match[2]) continue; // Case variants are ordinary text, not the verified MVU marker.
      var tag = match[2], opening = '<' + tag + '>', closing = '</' + tag + '>';
      if (match[1]) { result.warnings.push(closing + ' 缺少对应起始标签，已保留原文'); continue; }
      if (['ztl', 'xuan', 'UpdateVariable', 'm18-terminal', 'CityPublicContext'].indexOf(tag) < 0 || match[0] !== opening) {
        result.warnings.push(match[0] + ' 不是当前卡的标准标签，已保留原文');
        var unsupportedClose = raw.indexOf(closing, tags.lastIndex);
        if (unsupportedClose < 0) break;
        tags.lastIndex = unsupportedClose + closing.length;
        continue;
      }
      var close = raw.indexOf(closing, tags.lastIndex);
      if (close < 0) {
        result.warnings.push(opening + ' 尚未闭合，已保留后续原文');
        continue;
      }
      var end = close + closing.length;
      var body = raw.slice(tags.lastIndex, close);
      tags.lastIndex = end;
      try {
        if (protection.blocks.subarray(match.index, end).some(function (value) { return value; })) {
          throw new Error('协议跨入代码围栏或引文');
        }
        if (body.indexOf(opening) >= 0 || /<\/?(?:ztl|xuan|UpdateVariable|m18-terminal|CityPublicContext)>/.test(body)) {
          throw new Error('协议嵌套或交叉');
        }
        if (tag === 'ztl') result.scene = readScene(body, result.warnings);
        else if (tag === 'xuan') result.choices = result.choices.concat(readChoices(body));
        else if (tag === 'm18-terminal') {
          if (body !== '') throw new Error('终端标记必须为空');
          result.terminal = 'm18';
        }
        else if(tag !== 'CityPublicContext') readUpdate(body);
        visible.push(raw.slice(cursor, match.index), '\n\n');
        cursor = end;
      } catch (error) {
        result.warnings.push(opening + ' 无法安全解析：' + error.message + '；已保留原文');
      }
    }
    visible.push(raw.slice(cursor));
    const utterances=[];
    const narration=visible.join('').replace(/^<OpeningPage id="(?:17|18|19)"\/>[ \t]*(?:\r?\n|$)/,'');
    result.paragraphs = paragraphsFrom(dialogueMarkup(narration, result.warnings, utterances), utterances);
    if(result.diagnostics.length)result.paragraphs.push({text:'（标签异常，相关原文已保留；不生成对应操作按钮。）',speaker:null,characterId:null,expression:'normal'});
    result.dialogueRanking = rankDialogue(result.paragraphs);
    if(cache)cacheWrite(cacheKey,result);
    return result;
  }

  // Share story/auxiliary boundaries with the reader; format only a bounded body for history.
  function firstLine(raw) {
    const text=readingText(String(raw||'')),story=storyParts(text,[]);
    const body=(story?story.body:izumiNarrative(text,[])).slice(0,1600).replace(/<(think|thinking|konatan_planning~|tucao|ztl|xuan|UpdateVariable)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi,' ');
    let line=body.replace(/^\s*<cxx-story\s*>/i,'').split(/<cxx-say\b/i)[0].replace(/<[^>]*>/g,' ').split('\n').map(s=>s.trim()).find(Boolean)||'';
    if(!line){const say=/<cxx-say\b[^>]*?speaker="([^"]*)"[^>]*>([\s\S]*?)(?:<\/cxx-say>|$)/i.exec(body);if(say)line=(say[1]?say[1]+'：':'')+say[2].replace(/<[^>]*>/g,' ');}
    line=line.replace(/\s+/g,' ').trim();
    return line.length>60?line.slice(0,59)+'…':line;
  }
  function componentValidation(raw,checked=inspect(raw)){return {roots:checked.roots.map(r=>({kind:r.kind,valid:r.valid,complete:r.complete})),statusPlaceholder:[...raw.matchAll(/^ {0,3}<StatusPlaceHolderImpl\/>[ \t]*$/gm)].some(m=>m.index>=(checked.planning?.end||0)&&!checked.protection.all[m.index])};}
  return Object.freeze({ characterAliases:Object.freeze(Object.fromEntries(Object.entries(aliases).map(([name,value])=>[name,Object.freeze({...value})]))), parseMessage: parseMessage, auxiliaryBlocks: auxiliaryBlocks, inspect, settlementParts, variableUpdates, readUpdate, readingText, componentValidation, firstLine, clearCache,
    setCacheEnabled:value=>{cacheEnabled=Boolean(value);if(!cacheEnabled)clearCache();},cacheStats:()=>({entries:parsedCache.size,bytes:cacheBytes}),
    prepareDialogue:text=>dialogueCodec.normalize(text,dialogueProtection),
    nativeDialogue:(text,save)=>dialogueCodec.native(text,save,dialogueProtection),
    historyDialogue:text=>dialogueCodec.history(text,dialogueProtection) });
});
