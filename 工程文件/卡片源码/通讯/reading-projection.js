/* Source paragraph identity is authoritative. Unmappable translations never borrow a speaker. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxReadingProjection=api;})(globalThis,function(){
 'use strict';
 const safeStates=new Set(['ready','partial']),escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 function project(snapshot,parser,mode='original'){
  const raw=snapshot.sourceMessage,parsed=parser.parseMessage(raw,{cache:false});let cursor=parsed.ranges.find(r=>r.kind==='cxx-story'&&r.valid&&r.complete)?.bodyStart||0,unmapped=0,available=0;
  const segments=safeStates.has(snapshot.state)?snapshot.segments.filter(s=>s.reading?.text):[];
  const paragraphs=parsed.paragraphs.map(p=>{
   const original=p.text,plain=p.dialogueText||original,variants=[plain,escape(plain)];let at=-1,needle=plain;for(const v of variants){at=raw.indexOf(v,cursor);if(at>=0){needle=v;break;}}const end=at<0?-1:at+needle.length;if(at>=0)cursor=end;
   const matches=at<0?[]:segments.filter(s=>s.source.start>=at&&s.source.end<=end),overlap=at<0?[]:segments.filter(s=>s.source.start<end&&s.source.end>at);let translated=plain,offset=plain.length;
   // An escaped source needs decoding before substitution; do not reinterpret its offsets.
   if(needle!==plain&&matches.length){unmapped+=matches.length;matches.length=0;}
   for(const s of matches.slice().reverse()){const start=s.source.start-at,finish=s.source.end-at;if(finish>offset||plain.slice(start,finish)!==s.source.text){unmapped++;continue;}translated=translated.slice(0,start)+s.reading.text+translated.slice(finish);offset=start;}
   unmapped+=overlap.filter(s=>!matches.includes(s)).length;const hasReading=matches.length>0;if(hasReading)available++;
   const readingText=hasReading?(p.dialogueText&&original!==plain?original.replace(plain,translated):translated):null,voiceEligible=at>=0&&parsed.ranges.some(r=>r.kind==='cxx-story'&&r.valid&&r.complete&&at>=r.bodyStart&&end<=r.closeStart);
   return {...p,text:mode==='reading'&&readingText?readingText:mode==='compare'&&readingText?original+'\n\n【译文】\n'+readingText:original,sourceText:original,readingText,voiceEligible,voiceSource:voiceEligible?plain:null,voiceReading:voiceEligible&&hasReading?translated:null,segmentIds:matches.map(s=>s.id),readingLanguage:matches[0]?.reading?.language||'',sourceStart:at};
  });
  return {...parsed,paragraphs,reading:{mode,state:snapshot.state,sourceRevision:snapshot.sourceRevision,revision:snapshot.readingRevision,available,unmapped,translated:safeStates.has(snapshot.state)}};
 }
 function displayRaw(snapshot,mode='original',ids){
  let text=snapshot.sourceMessage;if(mode==='original'||!safeStates.has(snapshot.state))return text;
  for(const s of snapshot.segments.slice().reverse())if(s.reading?.text&&(!ids||ids.has(s.id))){const replacement=escape(s.reading.text);text=text.slice(0,s.source.start)+(mode==='compare'?s.source.text+'\n\n【译文】\n'+replacement:replacement)+text.slice(s.source.end);}
  return text;
 }
 return {project,displayRaw,safeStates};
});
