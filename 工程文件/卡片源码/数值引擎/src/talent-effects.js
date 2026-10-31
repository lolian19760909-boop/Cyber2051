(function(root,factory){const local=typeof module==='object'&&module.exports;const value=factory(local?require('./talent-rules.js'):root.CxxTalentRules);if(local)module.exports=value;else root.CxxTalentEffects=value;})(globalThis,function(rules){
  'use strict';
  return Object.fromEntries(Object.entries(rules.definitions).map(([id,ranks])=>[id,ranks.map(effects=>effects.map(rules.describe).join(''))]));
});
