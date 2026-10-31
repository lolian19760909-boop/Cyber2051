(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxVisualProjects=api;})(globalThis,function(root){
  'use strict';
  const projects=new Map();
  function mount({id,parent,inputs={},onEvent=()=>{},onFallback=()=>{}}){
    const visual=root.TavernVisual??root.parent?.TavernVisual;
    let session=null,closed=false,closing=null,failed=false;
    const layer=parent.ownerDocument.createElement('div');layer.className='cxx-visual-project';layer.style.cssText='position:absolute;inset:0;pointer-events:none;visibility:hidden';layer.setAttribute('aria-hidden','true');parent.append(layer);
    function fallback(error){if(!failed&&!closed){failed=true;onFallback(error);}if(!session)layer.remove();}
    async function dispose(){closed=true;layer.hidden=true;if(session&&!closing)closing=session.dispose().catch(error=>{failed=true;onFallback(error);});await closing;layer.remove();}
    const ready=(async()=>{
      if(visual?.api!==1){fallback();return false;}
      try{
        if(!projects.has(id))projects.set(id,(async()=>{const existing=await visual.getProject(id);if(existing)return existing;const files=root.CxxVisualProjectFiles[id];return visual.importFiles(files.map(file=>new parent.ownerDocument.defaultView.File([file.text],file.name,{type:file.name.endsWith('.json')?'application/json':'text/javascript'})));})());
        const project=await projects.get(id);if(closed)return false;
        session=visual.mount(project,layer,{onEvent:event=>{if(!closed)onEvent(event);},onError:error=>{fallback(error);void dispose();}});
        await session.ready;if(closed)return false;
        for(const [name,value]of Object.entries(inputs)){if(closed)return false;await session.setInput(name,value);}
        if(!closed&&!failed)layer.style.visibility='';return !closed&&!failed;
      }catch(error){fallback(error);await dispose();return false;}
    })();
    return {ready,dispose};
  }
  return {mount};
});
