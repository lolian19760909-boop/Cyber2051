/* Resolve only selected-branch facts at or before the viewed floor. No writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxGalScene=api;})(globalThis,function(){
  'use strict';
  function create(parser){
    let scope=null,cache=new WeakMap();
    function parsed(message){let entry=cache.get(message);if(!entry||entry.raw!==message.mes||entry.swipe!==message.swipe_id){const value=parser.parseMessage(message.mes||'');entry={raw:message.mes,swipe:message.swipe_id,scene:value.scene,battle:[]};for(const p of value.paragraphs)if(p.characterId&&typeof p.battle==='boolean')entry.battle.push([p.characterId,p.battle]);if(value.scene?.charactersValid)for(const p of value.scene.characters){const id=parser.characterAliases[p.name]?.id;if(id&&typeof p.battle==='boolean')entry.battle.push([id,p.battle]);}cache.set(message,entry);}return entry;}
    function battleBefore({key,messages,floor}){
      if(scope!==key){scope=key;cache=new WeakMap();}
      const state={};
      if(!Array.isArray(messages)||!Number.isInteger(floor)||floor<0||floor>=messages.length)return state;
      for(let i=0;i<floor;i++){const message=messages[i];if(!message||message.is_user||message.is_system)continue;for(const [id,value]of parsed(message).battle)state[id]=value;}
      return state;
    }
    function saved(message,locate){const vars=Array.isArray(message?.variables)?message.variables[message.swipe_id||0]:message?.variables,at=vars?.stat_data?.terminal?.gameplay?.location;if(!at?.mapId||!at?.placeId)return null;const place=locate?.(at.mapId,at.placeId);if(!place?.name)return null;return {key:at.mapId+':'+at.placeId,name:place.name,location:[place.district,place.name].filter(Boolean).join(' · ')};}
    function resolve({key,messages,floor,scene,locate}){
      if(scope!==key){scope=key;cache=new WeakMap();}
      if(!Array.isArray(messages)||!Number.isInteger(floor)||floor<0||floor>=messages.length)return scene||null;
      function ownScene(index,direct){
        const current=messages[index];if(current.is_user||current.is_system)return null;
        const at=saved(current,locate);let previous=null;for(let i=index-1;i>=0&&!previous;i--)previous=saved(messages[i],locate);
        // Only a newly saved transition may override an otherwise valid ztl.
        // An inherited/stale location must never override a fresh scene.
        if(at&&previous&&at.key!==previous.key&&(!direct?.location||!direct.location.includes(at.name)))return {...direct,location:at.location,time:direct?.time||'',date:direct?.date||'',characters:direct?.characters||[],source:'saved-transition'};
        if(direct?.location)return {...direct,source:'scene'};
        if(at)return {location:at.location,time:'',date:'',characters:[],source:'saved-location'};
        return null;
      }
      const direct=ownScene(floor,scene);if(direct)return direct;
      for(let i=floor-1;i>=0;i--){const m=messages[i];if(m.is_user||m.is_system)continue;const prior=ownScene(i,parsed(m).scene);if(prior)return {...prior,characters:[],source:'previous-scene'};}
      return null;
    }
    return {resolve,battleBefore};
  }
  return {create};
});
