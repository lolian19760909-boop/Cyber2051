/**
 * 卡内 UMD 模块的浏览器装载顺序（数据，不含逻辑）。
 *
 * 来源：对 `卡片源码` 内 `数据/validator.js`、`MVU/schema.js`、`数据/applier.js`、`Gal/parser.js`
 * 做 require 闭包遍历得到的装载序（当前数组 36 项，parser 重复，实际装载 35 份脚本）。
 * 顺序含义：被依赖者先于依赖者；`schema.js` 在工厂执行时就会读 `CxxNumericHost` / `CxxDataClone`
 * / `CxxQuests` / `CxxCivic` / `CxxEnsembleState`，所以这些必须在它之前完成装载。
 *
 * 维护：卡内模块增删依赖后重新生成，不要手写猜测顺序。生成方式见
 * `tools/p1-inventory.mjs` 同目录的 `card-load-order` 检查项。
 */
export const CARD_LOAD_ORDER = [
  '数据/validator.js',
  '数值引擎/src/numeric-rules.js',
  '数值引擎/src/talent-rules.js',
  '数值引擎/src/growth-base.js',
  '数值引擎/src/talent-data.js',
  '数值引擎/src/talent-effects.js',
  '数值引擎/src/growth-rules.js',
  '数值引擎/src/growth.js',
  '共享/data-clone.js',
  '运行时/item-definitions.js',
  '运行时/item-model.js',
  '运行时/item-catalog-data.js',
  '运行时/loadout.js',
  '数值引擎/src/engine.js',
  '数值引擎/adapters/mvu.js',
  '运行时/numeric-content.js',
  '运行时/battle.js',
  '运行时/ensemble-content.js',
  '运行时/ensemble-state.js',
  '运行时/ensemble-mvu.js',
  '正文/dialogue.js',
  'Gal/parser.js',
  '运行时/roster.js',
  '运行时/numeric-host.js',
  '运行时/chapter.js',
  '剧情/line-model.js',
  '运行时/quests.js',
  '运行时/police.js',
  '运行时/city.js',
  '运行时/civic.js',
  '运行时/tactical-rules.js',
  '运行时/tactical-engine.js',
  '运行时/player-operations.js',
  'MVU/schema.js',
  '数据/applier.js',
  'Gal/parser.js',
];

/** UMD 全局名 → 链上角色的映射（装载完成后按此取对象）。 */
export const CARD_GLOBALS = {
  z: ['Cxx236Zod'],
  schema: ['Cxx236Schema'],
  applier: ['Cxx236Applier'],
  parser: ['CxxGalParser', 'CxxParser', 'Cxx236Parser'],
};

/**
 * 卡内 JSON 数据模块：UMD 里 `local ? require('x.json') : root.<全局>`，
 * 浏览器没有 require，必须在装载对应脚本**之前**把 JSON 挂到全局。
 * 来源：扫描装载链中所有 `.json` require（2026-10-25 实测 3 处）。
 */
export const CARD_DATA_GLOBALS = [
  { path: '地图/places.json', global: 'CxxCityData' },
  { path: '剧情/盗芯之夜.json', global: 'CxxChapterData' },
  { path: '运行时/police-rules.json', global: 'CxxPoliceRules' },
];
