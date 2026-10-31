/* Derived from 卡片源码/运行时/tactical-rules.js; source SHA256 1cce8c429d545038534255f5fa394b8d43498b08c057b0f62af60441fe2b0f51. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxTacticalRules=value;})(globalThis,function(){
 'use strict';
 // Tactical rules advance by completed actions and rounds.
 const weapons={
  unarmed:{name:'徒手',damage:20,rof:2,magazine:0,ammo:null,attribute:'body',range:[0,0],stamina:8},
  pistol:{name:'手枪',damage:27,rof:2,magazine:12,ammo:'light',attribute:'cool',range:[0,1],stamina:2},
  revolver:{name:'左轮',damage:49,rof:1,magazine:6,ammo:'heavy',attribute:'cool',range:[0,2],stamina:3},
  smg:{name:'冲锋枪',damage:18,rof:3,magazine:30,ammo:'light',attribute:'reflexes',range:[0,1],stamina:2},
  rifle:{name:'突击步枪',damage:48,rof:1,magazine:30,ammo:'heavy',attribute:'reflexes',range:[1,2],stamina:3},
  shotgun:{name:'霰弹枪',damage:58,rof:1,magazine:8,ammo:'shell',attribute:'body',range:[0,0],stamina:4},
  precision:{name:'精准步枪',damage:52,rof:1,magazine:10,ammo:'precision',attribute:'cool',range:[1,3],stamina:3},
  sniper:{name:'狙击步枪',damage:65,rof:1,magazine:5,ammo:'precision',attribute:'cool',range:[2,4],stamina:5},
  lmg:{name:'轻机枪',damage:18,rof:3,magazine:60,ammo:'heavy',attribute:'body',range:[1,2],stamina:3},
  blade:{name:'刀剑',damage:27,rof:2,magazine:0,ammo:null,attribute:'reflexes',range:[0,0],stamina:7},
  blunt:{name:'钝器',damage:48,rof:1,magazine:0,ammo:null,attribute:'body',range:[0,0],stamina:10},
  throwing:{name:'投掷武器',damage:42,rof:1,magazine:1,ammo:'throwing',attribute:'cool',range:[0,1],stamina:5},
  monowire:{name:'单分子线',damage:25,rof:2,magazine:0,ammo:null,attribute:'intelligence',range:[0,0],stamina:7},
  launcher:{name:'射弹发射器',damage:68,rof:1,magazine:1,ammo:'rocket',attribute:'technical',range:[0,2],stamina:3}
 };
 const programs={
  ping:{name:'目标定位',kind:'covert',ram:2,upload:0,trace:0,target:'any',effect:'scan'},
  reboot_optics:{name:'重启义眼',kind:'control',ram:3,upload:1,trace:15,target:'cyber',status:'blind',duration:2},
  weapon_glitch:{name:'武器故障',kind:'control',ram:4,upload:1,trace:20,target:'cyber',status:'weapon_jam',duration:2},
  sonic_shock:{name:'音波震荡',kind:'covert',ram:3,upload:1,trace:0,target:'cyber',status:'isolated',duration:2},
  short_circuit:{name:'短路',kind:'damage',ram:4,upload:1,trace:20,target:'cyber',damage:38},
  overheat:{name:'过热',kind:'damage',ram:4,upload:1,trace:20,target:'cyber',status:'burn',duration:3,potency:16},
  contagion:{name:'连带传染',kind:'damage',ram:5,upload:1,trace:25,target:'cyber',status:'poison',duration:3,potency:10,spread:true},
  cyberware_malfunction:{name:'义体故障',kind:'control',ram:4,upload:1,trace:20,target:'cyber',status:'malfunction',duration:3},
  cripple_movement:{name:'义体运动阻断',kind:'control',ram:4,upload:1,trace:20,target:'cyber',status:'slow',duration:2},
  memory_wipe:{name:'记忆清除',kind:'covert',ram:6,upload:1,trace:-40,target:'cyber',effect:'memory'},
  system_reset:{name:'系统重置',kind:'ultimate',ram:10,upload:2,trace:35,target:'cyber',effect:'incapacitate'},
  synapse_burnout:{name:'突触熔断',kind:'damage',ram:7,upload:2,trace:30,target:'cyber',damage:64},
  control_device:{name:'设备接管',kind:'device',ram:3,upload:1,trace:15,target:'node',effect:'control'},
  overload_device:{name:'装置过载',kind:'device',ram:5,upload:1,trace:35,target:'node',effect:'explode'}
 };
 const devices={drone:{name:'侦战无人机',hp:70,damage:22,defense:15,ammo:24,mobile:true},turret:{name:'便携炮台',hp:100,damage:30,defense:35,ammo:30,mobile:false},trap:{name:'感应陷阱',hp:15,damage:55,defense:0,ammo:1,mobile:false}};
 const supplies={light:'轻型弹药',heavy:'重型弹药',shell:'霰弹',precision:'精准弹药',rocket:'发射器弹药',throwing:'备用投掷武器',frag:'破片手雷',smoke:'烟雾手雷',flash:'闪光手雷',emp:'EMP手雷',med:'战斗治疗剂'};
 const active={sandevistan:{name:'斯安威斯坦',duration:2,cooldown:5,stamina:15},berserk:{name:'狂暴',duration:3,cooldown:5,stamina:15},optical_camo:{name:'光学迷彩',duration:2,cooldown:4,stamina:10},kerenzikov:{name:'克伦齐科夫',duration:1,cooldown:3,stamina:8},blood_pump:{name:'血泵急救',duration:1,cooldown:5,stamina:0},overclock:{name:'脑机超频',duration:3,cooldown:5,stamina:0}};
 const statuses={burn:'燃烧',poison:'中毒',bleed:'流血',stun:'眩晕',blind:'致盲',slow:'减速',weapon_jam:'武器故障',malfunction:'义体故障',isolated:'通讯隔离',suppressed:'受压制',adrenaline:'气血护持',focus:'聚焦',aiming:'瞄准',charged:'已蓄能',smoke:'烟雾'};
 const npcWeapon={civilian:'unarmed',thug:'pistol',guard:'pistol',netrunner:'pistol',elite:'rifle',cyberpsycho:'blade',drone:'smg',brawler:'blunt',scavenger:'shotgun',raider:'rifle',assault:'rifle',sniper:'sniper',heavy:'lmg',blade:'blade',officer:'pistol',special_ops:'rifle',turret:'lmg',combat_drone:'rifle',mech:'lmg'};
 // Stable catalogue IDs; these are explicit card adaptations, never inferred from prose at runtime.
 const cyber={};
 function map(keys,effect,note){for(const key of keys.split(' '))cyber['cp_c_'+key]={effect,note};}
 map('adrenaline_converter adreno_trigger','openingMove','公开交战首轮增加一次移动。');
 map('atomic_sensors','covertMove','未暴露且追踪大于零时，移动可跨两个相邻距离段。');
 map('axolotl','killCooldown2','击倒敌人时，正在冷却的主动义体减少两轮。');
 map('newton_module','killCooldown1','击倒敌人时，正在冷却的主动义体减少一轮；与 Axolotl 取高。');
 map('basic_kiroshi_optics','cameraStealth','有摄像头的潜入区域，移动隐蔽检定增加 10 个百分点。');
 map('biomonitor','autoMed','每场一次，生命低于一半时自动消耗一份已有治疗剂，恢复 35 生命。');
 map('clutch_padding','gunStamina','枪械耐力消耗降低 25%。');
 map('isometric_stabilizer','attackStamina','攻击耐力消耗降低 20%，与其他耐力减免相乘。');
 map('defenzikov','afterKerenzikov','克伦齐科夫结束后两轮，受到伤害乘 0.85。');
 map('fortified_ankles reinforced_tendons','jump','允许跳跃跨两个有通路的区域；不穿墙或飞行。');
 map('immovable_force shock_absorber','recoil','枪械命中增加 5 个百分点；两者不重复叠加。');
 map('jenkins_tendons','firstDash','每场第一次冲刺不消耗耐力。');
 map('kerenzikov_boost_system','kerenzikovBoost','克伦齐科夫持续增加一轮。');
 map('kiroshi_clairvoyant_optics kiroshi_stalker_optics','scanPeople','观察揭示当前与相邻区域的已有参战者；不会创建未知人物。');
 map('kiroshi_doomsayer_optics','scanGrenades','观察揭示当前与相邻区域的已有爆炸物。');
 map('kiroshi_sentry_optics','scanDevices','观察揭示当前与相邻区域的已有摄像头和炮台。');
 map('kiroshi_the_oracle_optics','scanAll','观察结合人形、爆炸物、摄像头和炮台标记。');
 map('leeroy_ligament_system','longMove','移动最多跨两个已有通路的距离段。');
 map('lynx_paws','quietMove','蹲行被发现的概率降低 15 个百分点。');
 map('microgenerator','emptyReloadShock','空仓换弹后，下一次命中的首发额外造成 12 电击伤害。');
 map('painducer','delayedDamage','受到伤害的 25% 延后到下一轮末支付；不能转成治疗。');
 map('quantum_tuner','resetCooldown','每场首次主动义体进入冷却时，将该项冷却清零。');
 map('reflex_tuner revulsor','dangerSlow','每场一次，存活且生命低于 25% 时获得一轮反应加速。');
 map('second_heart','medicalRevive','第二心脏保留需明确医疗处理的复苏规则，不提供自动复活。');
 map('self_ice','ice','每场拦截一次敌方快速破解。');
 map('smart_link tattoo_johnny_s_special tattoo_together_forever tattoo_tyger_claws_dermal_imprint','smartLink','解锁智能武器追踪锁定；没有连接仍可普通瞄准射击。');
 map('synaptic_accelerator','alertSlow','第一次暴露时获得一轮反应加速。');
 map('threatevac','escapeMove','生命低于 25% 时移动可跨两段，撤离成功率增加 15 个百分点。');
 map('tyrosine_injector','killFocus','击倒目标后一轮，精瞄命中增加 5 个百分点，移动可跨两段。');
 map('universal_booster','medicalBoost','使用实际治疗剂后两轮，受到伤害乘 0.9，并恢复 10 耐力。');
 map('microrotors','meleeRof','近战每次主要攻击增加一击，逐击消耗耐力。');
 map('behavioral_imprint_synced_faceplate','identity','身份伪装继续依据剧情持有的印记，不自动创造权限。');
 map('chrome_compressor titanium_bones','capacity','强化机体承载与结构支撑。');
 const specialWeapons={cp_w_errata:{status:'burn',chance:.25,duration:2,potency:8},cp_w_scalpel:{status:'bleed',chance:1,duration:2,potency:8,when:'sandevistan'},cp_w_blue_fang:{status:'stun',chance:.4,duration:1},cp_w_stinger:{status:'poison',chance:.3,duration:2,potency:8},cp_w_yinglong:{status:'malfunction',chance:.2,duration:1},cp_w_psalm_11_6:{status:'burn',chance:.3,duration:2,potency:8},cp_w_ambition:{status:'blind',chance:.2,duration:1}};
 return {schema:1,version:'1.0.0',weapons,programs,devices,supplies,active,statuses,npcWeapon,cyber,specialWeapons,tierScale:[1,1.15,1.35,1.6,1.9],baseHit:.7,attributeHit:.03,crit:.05,critMultiplier:1.5,tracePerRound:10,overclockHpPerRam:8};
});
