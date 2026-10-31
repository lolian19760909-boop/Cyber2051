/* Owned by the shared runtime: removed on card reload or character change. */
(function(api){
 const win=api.parent||api,runtime=win.Cxx233Runtime,view=api.CxxCombatView;
 runtime.register('CxxCombatView',view);
 const service=view.native({api,win,runtime});
 runtime.register('CxxCombatCards',service,()=>service.destroy(),['CxxCombatView']);
})(globalThis);
