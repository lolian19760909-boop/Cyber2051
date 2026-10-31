(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxGrowthRules=value;})(globalThis,function(){
  'use strict';
  // Public vanilla-curve reconstruction, pinned below. It is not an official data dump;
  // its author reports possible 1-XP rounding differences. Never silently repin old saves.
  const source={
    url:'https://github.com/Dunc4nNT/cyberpunk-2077-modding/blob/554800b6fc21ee2d3dca5a263fa4b270f12d289d/src/mods/MoreLevels/redscript/MoreLevels.reds',
    record:'player_primary_level_to_xp',gameVersion:'2.21 / 2.3',precision:'公开原版曲线拟合；单级取整可能相差1经验',
    inspected:'2026-10-07'
  };
  const levels=[{level:1,xp:0,attributePoints:0,perkPoints:0}];
  for(let level=2;level<=60;level++){
    const step=Math.round(2.90699e9/(1+Math.exp(-(0.0399177*level-14.96278))));
    levels.push({level,xp:levels.at(-1).xp+step,attributePoints:1,perkPoints:1});
  }
  const rules={schema:1,id:'cp2077_character_xp',version:'2.3-public-fit-1',levels};
  return {rules,source};
});
