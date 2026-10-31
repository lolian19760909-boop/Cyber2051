/** Settings bridge for the pinned shujuku 1.3 profile contract. */
export function useSqliteSettings(settings){
 const profiles=settings.__userscripts||={},own=profiles.shujuku_v120__userscript_settings_v1||={};
 const meta=JSON.parse(own.shujuku_v120_globalMeta_v1||'{}'),slot=meta.activeIsolationCode?encodeURIComponent(meta.activeIsolationCode):'__default__';
 const key='shujuku_v120_profile_v1__'+slot+'__settings',template='shujuku_v120_profile_v1__'+slot+'__template';
 const prior=JSON.parse(own[key]||own.shujuku_v120_allSettings_v2||'{}');
 own[key]=JSON.stringify({...prior,storageMode:'sqlite',autoUpdateEnabled:false,autoMergeEnabled:false,desktopPetEnabled:false});
 own.shujuku_v120_globalMeta_v1=JSON.stringify({...meta,version:1,activeIsolationCode:meta.activeIsolationCode||'',isolationCodeList:meta.isolationCodeList||[],plotEnabledGlobal:false});
 // Explicit absent keys keep the plugin's shared config cache out of this story.
 for(const name of ['shujuku_v120_allSettings_v2','shujuku_v120_customTemplate',template])if(!(name in own))own[name]=null;
 return settings;
}
