(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxReleaseSafety=api;})(globalThis,function(){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x)),has=(x,k)=>Object.prototype.hasOwnProperty.call(x||{},k);
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const retained=new Set(['enabled','disabled','data','button','buttons','export_with','extra']);
  const types=['worldbook','regex','scripts'];
  const fail=message=>{throw Object.assign(Error(message),{code:'invalid-release-groups'});};
  const flat=nodes=>nodes.flatMap(n=>[n,...(n.type==='folder'?flat(n.scripts):[])]);
  const list=(c,t)=>t==='worldbook'?c.worldbook.entries:t==='regex'?c.regex.scripts:flat(c.scripts.trees);
  const key=(t,id)=>t+':'+String(id),idOf=(t,x)=>t==='worldbook'?x.uid:x.id;
  function seedMap(baseline,type){
    const out=new Map();function walk(s){for(const [k,v]of Object.entries(s?.records||{})){out.set(k,v);if(v.children)walk(v.children);}}
    walk(type==='worldbook'?baseline?.worldbook?.entries:type==='regex'?baseline?.regex?.scripts:baseline?.scripts?.trees);return out;
  }
  function groupsFor(groups,previous,incoming){
    const universe=new Set(types.flatMap(t=>[...(previous[t]||[]),...list(incoming,t).map(x=>idOf(t,x))].map(id=>key(t,id))));
    const all=groups===undefined?[{id:'all',members:Object.fromEntries(types.map(t=>[t,[...new Set([...(previous[t]||[]),...list(incoming,t).map(x=>idOf(t,x))])]])),requires:[]}]:copy(groups);
    if(!Array.isArray(all)||!all.length)fail('更新分组为空');const ids=new Set(),owners=new Map();
    for(const g of all){if(!/^[a-zA-Z0-9._-]{1,96}$/.test(g.id||'')||ids.has(g.id)||!object(g.members)||!Array.isArray(g.requires))fail('更新分组编号或依赖无效');ids.add(g.id);
      for(const t of types){if(!Array.isArray(g.members[t]||[]))fail('更新分组成员无效');for(const id of g.members[t]||[]){const k=key(t,id);if(!universe.has(k)||owners.has(k))fail('更新分组包含重复或未知组件：'+k);owners.set(k,g.id);}}
    }
    // Newly introduced groups cannot know every historical deletion. Such IDs
    // remain coupled to the program group (or the first group) by default.
    for(const k of universe)if(!owners.has(k))owners.set(k,ids.has('program')?'program':all[0].id);
    const visit=(id,stack=new Set())=>{if(!ids.has(id)||stack.has(id))fail('更新分组依赖缺失或成环');const next=new Set(stack);next.add(id);for(const dep of all.find(g=>g.id===id).requires)visit(dep,next);};
    all.forEach(g=>visit(g.id));
    for(const tree of incoming.scripts.trees)if(tree.type==='folder'&&flat(tree.scripts).some(n=>owners.get(key('scripts',n.id))!==owners.get(key('scripts',tree.id))))fail('一个脚本文件夹必须属于同一更新分组');
    return {all,owners};
  }
  // 基线摘要改为前 16 位后，比较必须走前缀比较，才能同时兼容旧卡里 64 位的基线。
  const digestEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length>0&&b.length>0&&(a===b||a.startsWith(b)||b.startsWith(a));
  const samePrint=(a,b)=>{if(!object(a)||!object(b))return false;const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>has(b,k)&&digestEqual(a[k],b[k]));};
  async function prepare({previous,before,incoming,baseline,groups,worldbookTransportBaselines=[],Core,updaterId}){
    const eq=(a,b)=>Core.canonical(a)===Core.canonical(b),hash=x=>Core.sha256(Core.canonical(x)),conflicts=[],counts={added:0,updated:0,deleted:0,kept:0};
    const {all,owners}=groupsFor(groups,previous,incoming),blocked=new Set(),merged=new Map(),nextSeeds=new Map();
    const issue=(t,id,path,reason)=>{conflicts.push({component:t,id,path,reason});blocked.add(owners.get(key(t,id)));};
    async function fields(seed,local,remote,t,id,path=''){
      const result=copy(local);
      for(const k of new Set([...Object.keys(remote),...Object.keys(seed?.fields||{})])){
        if(k==='scripts'&&remote.type==='folder')continue;
        if(k==='data'){result.data={...(remote.data||{}),...(local.data||{})};continue;}
        if(retained.has(k)){if(!has(local,k)&&has(remote,k))result[k]=copy(remote[k]);continue;}
        const old=seed?.fields?.[k],p=path?path+'.'+k:k;
        if(!has(remote,k)){
          if(has(local,k)&&old){if(digestEqual(await hash(local[k]),old.hash))delete result[k];else issue(t,id,p,'deleted-upstream-local-dirty');}continue;
        }
        if(!has(local,k)){if(!old)result[k]=copy(remote[k]);else if(!digestEqual(await hash(remote[k]),old.hash))issue(t,id,p,'local-field-deleted');continue;}
        if(eq(local[k],remote[k]))continue;
        if(old&&object(local[k])&&object(remote[k])&&old.fields){result[k]=await fields(old,local[k],remote[k],t,id,p);continue;}
        if(old&&digestEqual(await hash(local[k]),old.hash))result[k]=copy(remote[k]);
        else if(!old||!digestEqual(await hash(remote[k]),old.hash))issue(t,id,p,old?'both-changed':'local-field-collision');
      }
      return result;
    }
    const targetPrint=await Core.fingerprints(incoming);
    for(const t of types){const seeds=seedMap(baseline,t),targetSeeds=seedMap(targetPrint,t),owned=new Set(previous[t]),current=new Map(list(before,t).map(x=>[idOf(t,x),x])),remote=new Map(list(incoming,t).map(x=>[idOf(t,x),x]));
      for(const id of new Set([...owned,...remote.keys()])){
        if(id===updaterId)continue;const l=current.get(id),r=remote.get(id),s=seeds.get(typeof id+':'+id),k=key(t,id);
        if(!owned.has(id)&&l){issue(t,id,'','unowned-id-collision');merged.set(k,copy(l));continue;}
        if(!l&&r){if(owned.has(id)&&s){issue(t,id,'','local-item-deleted');}else merged.set(k,copy(r));}
        else if(l&&r){if(l.type!==r.type&&(l.type==='folder'||r.type==='folder')){issue(t,id,'','node-type-changed');merged.set(k,copy(l));}
          else if(!s){issue(t,id,'','baseline-missing');merged.set(k,copy(l));}
          else merged.set(k,await fields(s,l,r,t,id));}
        else if(l&&!r){const one={worldbook:{internalName:before.worldbook.internalName,entries:[]},regex:{scripts:[]},scripts:{trees:[]}};if(t==='worldbook')one.worldbook.entries=[l];if(t==='regex')one.regex.scripts=[l];if(t==='scripts')one.scripts.trees=[l];const actual=seedMap(await Core.fingerprints(one),t).get(typeof id+':'+id);
          const retainedMatch=samePrint(actual.retained||{},s?.retained||{});
          // Old card baselines include a conversion marker that ST does not
          // persist. Only exact publisher-certified hashes may omit that marker.
          const withoutTransport={...(s?.retained||{})};delete withoutTransport.extra;
          const missingTransport=t==='worldbook'&&!has(l,'extra')&&worldbookTransportBaselines.some(r=>r.uid===id&&digestEqual(r.hash,s?.hash)&&digestEqual(r.extraHash,s?.retained?.extra))&&samePrint(actual.retained||{},withoutTransport);
          if(!s||!digestEqual(actual.hash,s.hash)||Object.keys(l.data||{}).length||!retainedMatch&&!missingTransport){issue(t,id,'','deleted-upstream-local-dirty');merged.set(k,copy(l));}}
        if(targetSeeds.has(typeof id+':'+id))nextSeeds.set(k,targetSeeds.get(typeof id+':'+id));
      }
    }
    let changed=true;while(changed){changed=false;for(const g of all)if(!blocked.has(g.id)&&g.requires.some(d=>blocked.has(d))){blocked.add(g.id);changed=true;conflicts.push({component:'group',id:g.id,path:'',reason:'dependency-blocked'});}}
    const chosen=new Map(),actualOwned={};
    for(const t of types){const current=new Map(list(before,t).map(x=>[idOf(t,x),x])),old=new Set(previous[t]),target=new Set(list(incoming,t).map(x=>idOf(t,x)));actualOwned[t]=[];
      for(const id of new Set([...current.keys(),...target,...old])){const k=key(t,id),isBlocked=blocked.has(owners.get(k));const value=id===updaterId||!old.has(id)&&!target.has(id)||isBlocked?current.get(id):merged.get(k);
        if(value)chosen.set(k,copy(value));if((isBlocked?old.has(id):target.has(id))&&id!==updaterId)actualOwned[t].push(id);
        if(eq(current.get(id)??null,value??null))counts.kept++;else if(!current.has(id))counts.added++;else if(!value)counts.deleted++;else counts.updated++;
      }
    }
    function simple(t){const order=[...list(incoming,t),...list(before,t)],seen=new Set();return order.flatMap(x=>{const k=key(t,idOf(t,x));if(seen.has(k))return [];seen.add(k);return chosen.has(k)?[chosen.get(k)]:[];});}
    const used=new Set();function trees(nodes){return nodes.flatMap(n=>{const k=key('scripts',n.id),v=chosen.get(k);if(!v||used.has(n.id))return [];used.add(n.id);const result=copy(v);if(result.type==='folder'){const layout=blocked.has(owners.get(k))?list(before,'scripts').find(s=>s.id===n.id):n;result.scripts=trees(layout?.scripts||[]);}return [result];});}
    const scripts=trees(incoming.scripts.trees);scripts.push(...trees(before.scripts.trees));for(const n of list(before,'scripts'))scripts.push(...trees([n]));
    const at=scripts.findIndex(s=>s.id===updaterId),oldAt=before.scripts.trees.findIndex(s=>s.id===updaterId);if(at>=0&&oldAt>=0)scripts.splice(Math.min(oldAt,scripts.length-1),0,...scripts.splice(at,1));
    const after={worldbook:{...copy(before.worldbook),entries:simple('worldbook')},regex:{...copy(before.regex),scripts:simple('regex')},scripts:{...copy(before.scripts),trees:scripts}};
    // Fingerprints describe official baselines, never bless a player's edit.
    const prints=copy(targetPrint);for(const t of types){const oldSeeds=seedMap(baseline,t);const dest=t==='worldbook'?prints.worldbook.entries:t==='regex'?prints.regex.scripts:prints.scripts.trees;
      function repair(set){for(const [k,s]of Object.entries(set.records||{})){const id=k.startsWith('number:')?Number(k.slice(7)):k.slice(7);if(blocked.has(owners.get(key(t,id)))){const old=oldSeeds.get(k);if(old)set.records[k]=copy(old);else delete set.records[k];}else if(s.children)repair(s.children);}}
      repair(dest);for(const id of previous[t]){const k=typeof id+':'+id;if(blocked.has(owners.get(key(t,id)))&&!dest.records[k]&&oldSeeds.has(k))dest.records[k]=copy(oldSeeds.get(k));}
    }
    return {after,baseline:prints,owned:actualOwned,conflicts,counts,blocked:[...blocked],completed:all.filter(g=>!blocked.has(g.id)).map(g=>g.id),groups:all};
  }
  // Compare against what this transaction actually wrote. Player additions and
  // edits made afterwards stay in the current snapshot, including unknown data.
  function reverseValue(original,written,current,Core,path='',conflicts=[]){
    const equal=(a,b)=>Core.canonical(a??null)===Core.canonical(b??null);
    if(equal(original,written)||path.endsWith('.data')||path==='data')return current===undefined?undefined:copy(current);
    if(equal(current,written))return original===undefined?undefined:copy(original);
    if(object(original)&&object(written)&&object(current)){const out=copy(current);for(const k of new Set([...Object.keys(original),...Object.keys(written)])){const value=reverseValue(original[k],written[k],current[k],Core,path?path+'.'+k:k,conflicts);if(value===undefined)delete out[k];else out[k]=value;}return out;}
    conflicts.push({path,reason:'changed-after-install'});return current===undefined?undefined:copy(current);
  }
  function rollback({before,journal,Core,updaterId}){
    const conflicts=[],after=copy(before);for(const t of types){const originals=new Map(list(journal.before,t).map(x=>[idOf(t,x),x])),written=new Map(list(journal.after,t).map(x=>[idOf(t,x),x]));
      // Folders are kept as atomic trees on rollback; do not flatten/reparent
      // user descendants while undoing a historical installation.
      const get=c=>t==='scripts'?c.scripts.trees:list(c,t),a=get(journal.before),b=get(journal.after),c=get(before),keyOf=x=>idOf(t,x),am=new Map(a.map(x=>[keyOf(x),x])),bm=new Map(b.map(x=>[keyOf(x),x])),cm=new Map(c.map(x=>[keyOf(x),x])),result=[];
      for(const id of new Set([...c.map(keyOf),...a.map(keyOf)])){const v=id===updaterId?cm.get(id):reverseValue(am.get(id),bm.get(id),cm.get(id),Core,t+'.'+id,conflicts);if(v!==undefined)result.push(v);}
      if(t==='worldbook')after.worldbook.entries=result;else if(t==='regex')after.regex.scripts=result;else after.scripts.trees=result;
    }
    after.registry=reverseValue(journal.before.registry,journal.after.registry,before.registry,Core,'registry',conflicts);
    // A changed program dependency cannot safely be combined with an older
    // program. Keep the entire code set in that case, retaining the receipt.
    if(conflicts.length)return {after:copy(before),conflicts,blocked:true};
    return {after,conflicts,blocked:false};
  }
  return {groupsFor,prepare,rollback,reverseValue};
});
