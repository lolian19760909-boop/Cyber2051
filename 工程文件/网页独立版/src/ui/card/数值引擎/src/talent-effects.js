/* Derived from 卡片源码/数值引擎/src/talent-effects.js; source SHA256 1ff47f4dc2aecea05cad2ada529b785e3a84c431b593ccc3bb49d2e7bf55bf76. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const value=factory(local?require('./talent-rules.js'):root.CxxTalentRules);if(local)module.exports=value;else root.CxxTalentEffects=value;})(globalThis,function(rules){
  'use strict';
  return Object.fromEntries(Object.entries(rules.definitions).map(([id,ranks])=>[id,ranks.map(effects=>effects.map(rules.describe).join(''))]));
});
