import {displayProjection,normalizeThinkingTags} from '../app/parse.mjs';

/** Both reading views share one display parse and receive response metadata from their caller. */
export function createReadingParser({parser,session,depthFor=()=>0,responseFor=()=>undefined}){
 return {...parser,parseMessage(raw,options){
  const text=session.transformMessage(raw,{depth:options?.depth??depthFor(raw)});
  const original=parser.parseMessage(normalizeThinkingTags(text),{...options,...session.readingOptions});
  const projected=session.projectParsed({...displayProjection(original),response:responseFor(raw,options)});
  return {...original,auxiliary:projected.display.auxiliary||[]};
 }};
}
