import{createGameSetup,DEFAULT_GAME_VERSION}from'./game-setup.mjs';
/** Installed compatibility contracts belong to the maintained rule/schema modules, not release hashes. */
export function installedGameSetup(chain){
 const contract={rulesId:chain.applier.VERSION,stateSchemaId:chain.schema.SCHEMA_ID};
 return createGameSetup({versions:[{id:DEFAULT_GAME_VERSION,label:DEFAULT_GAME_VERSION},{id:'1.3.0',label:'1.3.0（既有故事）',create:false}],expansions:[],features:[],combinations:[DEFAULT_GAME_VERSION,'1.3.0'].map(baseVersion=>({baseVersion,expansions:[],featureIds:[],contract}))});
}
