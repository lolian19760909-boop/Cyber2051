/** Match native metadata by source identity; repeated prose is not an identity. */
const clone=value=>value===undefined?undefined:structuredClone(value);
const role=row=>!!row.is_user+':'+!!row.is_system;
const id=row=>row?.extra?.cxx2051_node||row?.swipe_info?.[row.swipe_id||0]?.extra?.cxx2051_node;
const mergeExtra=(old={},fresh={})=>({...clone(old),...clone(fresh),...(old.cxx_context||fresh.cxx_context?{cxx_context:{...clone(old.cxx_context||{}),...clone(fresh.cxx_context||{})}}:{})});
export function preserveRowMetadata(rows,currentRows,{original=row=>row.mes}={}){
 const used=new Set();
 return rows.map((row,floor)=>{
  const own=id(row);let match=own?currentRows.find(old=>id(old)===own):null;
  if(!match&&own)match=currentRows.find(old=>old.swipe_info?.some(info=>info.extra?.cxx2051_node===own));
  if(!match&&!own&&currentRows[floor]&&role(currentRows[floor])===role(row)&&currentRows[floor].mes===row.mes&&!used.has(currentRows[floor]))match=currentRows[floor];
  if(!match&&!own){const candidates=currentRows.filter(old=>!used.has(old)&&role(old)===role(row)&&old.mes===row.mes);if(candidates.length===1)match=candidates[0];}
  if(match){used.add(match);row={...clone(match),...row,extra:mergeExtra(match.extra,row.extra)};}
  if(row.swipes?.length){
   row.swipe_info=row.swipes.map((raw,index)=>{const fresh=row.swipe_info?.[index]||{},sid=fresh.extra?.cxx2051_node;let at=sid?match?.swipe_info?.findIndex(info=>info.extra?.cxx2051_node===sid):-1;
    if(at<0&&match?.swipes?.[index]===raw)at=index;
    if(at<0&&match?.swipes?.filter(value=>value===raw).length===1)at=match.swipes.indexOf(raw);
    const old=at>=0?match?.swipe_info?.[at]:null;if(old&&original({...match,mes:match.swipes[at],swipe_id:at,extra:mergeExtra(match.extra,old.extra)})===raw)row.swipes[index]=match.swipes[at];return {...clone(old||{}),...fresh,extra:mergeExtra(old?.extra,fresh.extra)};});
   row.mes=row.swipes[row.swipe_id||0];
   const selected=row.swipe_info[row.swipe_id||0]?.extra?.cxx_context;if(selected)row.extra=mergeExtra(row.extra,{cxx_context:selected});
  }else if(match&&original(match)===row.mes)row.mes=match.mes;return row;
 });
}
