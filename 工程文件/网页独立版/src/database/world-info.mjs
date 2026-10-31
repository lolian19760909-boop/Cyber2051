export let world_names=[];
export const world_info={charLore:[]};
export function updateNames(names){world_names.splice(0,world_names.length,...names);}
export const loadWorldInfo=name=>window.CxxDatabaseHost.context.loadWorldInfo(name);
export const saveWorldInfo=(name,data)=>window.CxxDatabaseHost.context.saveWorldInfo(name,data);
