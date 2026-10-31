/** A native settlement receipt belongs to one selected row, not to variables cloned by a preset. */
import {applyChanges} from './records.mjs';
import {stableJSON} from '../context/sources.mjs';
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function nativeStateKey(value,fingerprint){return fingerprint(stableJSON(value));}
export function nativeSettlement(row,{scope,floor,raw,fingerprint,before}){
  const swipe=row.swipe_id||0,value=Array.isArray(row.variables)?row.variables[swipe]:row.variables,receipt=value?.__cxx_native_commit,own=row.swipe_info?.[swipe]?.extra?.cxx2051_native_receipt??row.extra?.cxx2051_native_receipt;
  if(!receipt||receipt.schema!==1||!scope||receipt.scope!==scope||receipt.floor!==floor||receipt.swipe!==swipe||!receipt.receipt||own!==receipt.receipt||receipt.fingerprint!==fingerprint(raw)||!Array.isArray(receipt.patches))throw fail('host_state_pending','此原生回复尚无属于本楼的完整结算凭据；旧楼变量副本不会被采用，请在原生界面完成结算并保存');
  if(receipt.beforeFingerprint!==nativeStateKey(before,fingerprint))throw fail('host_state_mismatch','此原生回复的结算父状态与已保存路线不一致，原聊天保留');
  const control=before?.terminal?.ensemble?.control;if(receipt.actorBinding&&(!control||receipt.actorBinding.actorId!==control.actorId||receipt.actorBinding.viewpointActorId!==control.viewpointActorId||receipt.actorBinding.controlRevision!==control.revision))throw fail('host_state_mismatch','原生结算的人物来源与父状态不一致，原聊天保留');
  let state;try{state=applyChanges(before,receipt.patches);}catch{throw fail('host_state_mismatch','此原生回复的完整结算增量无法重建，原聊天保留');}
  if(receipt.stateFingerprint!==nativeStateKey(state,fingerprint))throw fail('host_state_mismatch','原生结算增量与完整状态指纹不一致，原聊天保留');
  if(!value?.stat_data||typeof value.stat_data!=='object')throw fail('host_state_pending','此原生回复的当前完整状态尚未保存');
  return {state,current:value.stat_data,receipt,programChanged:nativeStateKey(value.stat_data,fingerprint)!==receipt.stateFingerprint};
}
