/* Derived from 卡片源码/数值引擎/src/numeric-rules.js; source SHA256 4ce6143d5a53d45772cd0999b496ae6fbb3422b5ff2c7135041078403d125e36. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxNumericRules=value;})(globalThis,function(){
  'use strict';
  return {
    id:'tokyo_soft_power',version:2,
    health:{base:80,body:5,level:5},attack:{scale:.4,level:1.5},defenseCap:.8,
    attributes:{body:4,reflexes:4,intelligence:4,technical:4,cool:4},
    exponent:3,offenseShare:0.5,criticalMultiplier:1.5,
    vitals:{hp:100,stamina:100,ram:10},
    injuryWeight:0.3,
    districts:{ordinary:1,corporate:1.15,combat_zone:1.25},
    templates:{
      police_patrol:{label:'普通巡警',defaultLevel:8,attributes:{body:8,reflexes:8,intelligence:5,technical:7,cool:7},tags:['human','gun','armored'],fixedEquipment:['pistol_t1','armor_vest_t1']},
      police_armed:{label:'武装警员',defaultLevel:14,attributes:{body:11,reflexes:11,intelligence:7,technical:9,cool:10},tags:['human','gun','armored'],fixedEquipment:['rifle_t2','armor_vest_t2']},
      police_elite:{label:'精锐警员',defaultLevel:20,attributes:{body:13,reflexes:14,intelligence:9,technical:12,cool:12},tags:['human','gun','armored'],fixedEquipment:['rifle_t3','subdermal_armor_t3']},
      police_special:{label:'暴恐机动队员',defaultLevel:25,attributes:{body:16,reflexes:18,intelligence:12,technical:15,cool:17},tags:['human','gun','armored','cyberware'],fixedEquipment:['rifle_t4','subdermal_armor_t4','sandevistan_t4']},
      civilian:{label:'普通市民',defaultLevel:1,attributes:{body:3,reflexes:3,intelligence:3,technical:3,cool:3},tags:[]},
      thug:{label:'街头枪手',defaultLevel:3,attributes:{body:6,reflexes:5,intelligence:3,technical:4,cool:4},tags:['human','gun']},
      guard:{label:'安保人员',defaultLevel:8,attributes:{body:8,reflexes:8,intelligence:5,technical:7,cool:7},tags:['human','gun','armored']},
      netrunner:{label:'网络行者',defaultLevel:12,attributes:{body:4,reflexes:6,intelligence:13,technical:10,cool:7},tags:['human','cyberdeck']},
      elite:{label:'精锐战斗员',defaultLevel:20,attributes:{body:13,reflexes:14,intelligence:9,technical:12,cool:12},tags:['human','gun','armored']},
      cyberpsycho:{label:'失控义体战士',defaultLevel:25,attributes:{body:18,reflexes:17,intelligence:8,technical:16,cool:10},tags:['human','cyberware','armored']},
      drone:{label:'巡逻无人机',defaultLevel:6,attributes:{body:5,reflexes:9,intelligence:3,technical:9,cool:5},tags:['machine','gun']},
      brawler:{label:'近战打手',defaultLevel:4,attributes:{body:9,reflexes:6,intelligence:3,technical:3,cool:4},tags:['human','melee']},
      scavenger:{label:'拾荒者',defaultLevel:4,attributes:{body:6,reflexes:5,intelligence:4,technical:7,cool:4},tags:['human','gun']},
      raider:{label:'荒野掠夺者',defaultLevel:7,attributes:{body:9,reflexes:8,intelligence:4,technical:6,cool:6},tags:['human','gun']},
      assault:{label:'突击手',defaultLevel:10,attributes:{body:10,reflexes:11,intelligence:5,technical:7,cool:7},tags:['human','gun','armored']},
      sniper:{label:'狙击手',defaultLevel:12,attributes:{body:5,reflexes:12,intelligence:7,technical:7,cool:14},tags:['human','gun']},
      heavy:{label:'重装火力手',defaultLevel:15,attributes:{body:16,reflexes:7,intelligence:5,technical:12,cool:8},tags:['human','gun','armored']},
      blade:{label:'义体刀手',defaultLevel:15,attributes:{body:10,reflexes:17,intelligence:5,technical:10,cool:12},tags:['human','melee','cyberware']},
      officer:{label:'战术指挥官',defaultLevel:18,attributes:{body:10,reflexes:12,intelligence:12,technical:10,cool:15},tags:['human','gun','armored']},
      special_ops:{label:'特勤干员',defaultLevel:25,attributes:{body:16,reflexes:18,intelligence:12,technical:15,cool:17},tags:['human','gun','armored','cyberware']},
      turret:{label:'自动炮塔',defaultLevel:10,attributes:{body:10,reflexes:5,intelligence:3,technical:14,cool:10},tags:['machine','gun','armored']},
      combat_drone:{label:'战斗无人机',defaultLevel:14,attributes:{body:9,reflexes:15,intelligence:5,technical:14,cool:10},tags:['machine','gun','armored']},
      mech:{label:'重型安保机甲',defaultLevel:22,attributes:{body:20,reflexes:8,intelligence:4,technical:18,cool:12},tags:['machine','gun','armored']}
    },
    // Scene recognition chooses labels only. The engine owns their numbers.
    encounter:{ranks:{rookie:-2,regular:0,veteran:5,elite:10},health:{healthy:1,wounded:.65,critical:.25,incapacitated:0}}
  };
});
