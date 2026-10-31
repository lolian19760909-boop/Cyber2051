(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxEnsembleContent=api;})(globalThis,function(){return {
  "schema": 1,
  "version": "2051-npc-1",
  "approved": true,
  "actors": [
    {
      "actorId": "wb_4",
      "name": "高松灯",
      "worldbookUid": 4,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 4
      },
      "growthInitial": {
        "level": 3,
        "xp": 2040,
        "attributes": {
          "body": 4,
          "reflexes": 4,
          "intelligence": 7,
          "technical": 4,
          "cool": 6
        },
        "attributePoints": 0,
        "perkPoints": 2,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_4_nervous",
            "name": "高松灯·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "丰川重工二代机偶，弦卷集团黑盒心智，无武装配件。"
              }
            ],
            "description": "义体：丰川重工二代机偶，弦卷集团黑盒心智，无武装配件。",
            "status": "installed"
          },
          {
            "template": "shotgun",
            "tier": 2,
            "name": "SPAS-12霰弹枪",
            "status": "equipped",
            "description": "武器：SPAS-12霰弹枪"
          },
          {
            "custom": true,
            "id": "npc_4_lore_kit",
            "name": "高松灯·档案随身装备",
            "category": "text",
            "description": "义体：丰川重工二代机偶，弦卷集团黑盒心智，无武装配件。 武器：SPAS-12霰弹枪",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Tomorin",
        "aliases": [
          "灯",
          "Tomori",
          "Tomorin",
          "高松燈",
          "燈"
        ],
        "form": "android",
        "san": 82,
        "rookie": false,
        "priority": [
          "intelligence",
          "cool",
          "body",
          "reflexes",
          "technical"
        ],
        "basis": "机偶声学感知与非武装心智",
        "loreEquipment": [
          "义体：丰川重工二代机偶，弦卷集团黑盒心智，无武装配件。",
          "武器：SPAS-12霰弹枪"
        ],
        "sourceFile": "世界书/004-高松灯.txt",
        "sourceSHA256": "f0174f5a2b7bc3a9fd28502ea8a7a65d0ed4eddaaf2f3bb99539724d2e704143",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_6",
      "name": "千早爱音",
      "worldbookUid": 6,
      "sourceRef": {
        "kind": "author-profile",
        "version": "2051-ensemble-pilot-1",
        "worldbookUid": 6
      },
      "growthInitial": {
        "schema": 1,
        "level": 2,
        "xp": 1000,
        "attributes": {
          "body": 6,
          "reflexes": 5,
          "intelligence": 5,
          "technical": 4,
          "cool": 3
        },
        "attributePoints": 0,
        "perkPoints": 1,
        "perks": {
          "Reflexes_Central_Milestone_1": 1
        }
      },
      "walletInitial": {
        "yen": 2000,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "pilot_anon_thermal_blade",
            "name": "热熔切割长刀",
            "category": "weapon",
            "part": "weapon",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "powerFlat",
                "value": 12
              },
              {
                "kind": "ability",
                "text": "以热熔刀刃近身切割；不自动追加燃烧伤害。"
              }
            ],
            "tags": [
              "blade",
              "melee"
            ],
            "status": "equipped"
          },
          {
            "custom": true,
            "id": "pilot_anon_port",
            "name": "联邦科技后颈接口",
            "category": "cyberware",
            "part": "nervous",
            "tier": 1,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "通过已有外设与适配通路连接民用终端。"
              }
            ],
            "tags": [],
            "status": "installed"
          },
          {
            "template": "subdermal_armor",
            "tier": 2,
            "name": "联邦科技皮下护甲",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "pilot_anon_eye",
            "name": "联邦科技高档义眼",
            "category": "cyberware",
            "part": "face",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "保留现有人设中的视力质量问题，需要既有视力矫正。"
              }
            ],
            "tags": [],
            "status": "installed"
          }
        ]
      },
      "roster": {
        "schema": 1,
        "displayId": "Anon",
        "aliases": [
          "爱音",
          "Anon",
          "千早愛音",
          "愛音"
        ],
        "form": "human",
        "san": 85,
        "rookie": true,
        "priority": [
          "reflexes",
          "intelligence",
          "cool",
          "body",
          "technical"
        ],
        "basis": "已有作者试点",
        "loreEquipment": [
          "义体：后颈接口、皮下护甲、高档义眼:均为联邦科技出品",
          "武器：一柄热熔切割长刀。"
        ],
        "sourceFile": "世界书/006-千早爱音.txt",
        "sourceSHA256": "1d83fe43eb8a2188c6e334e17147c92e5bac635e0b2f3cc0c00fe740b6057507",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": true
      }
    },
    {
      "actorId": "wb_7",
      "name": "长崎素世",
      "worldbookUid": 7,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 7
      },
      "growthInitial": {
        "level": 5,
        "xp": 4250,
        "attributes": {
          "body": 4,
          "reflexes": 6,
          "intelligence": 8,
          "technical": 6,
          "cool": 9
        },
        "attributePoints": 0,
        "perkPoints": 4,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_7_skin",
            "name": "长崎素世·档案防护装配",
            "category": "cyberware",
            "part": "skin",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "弦卷集团出品：智能链接、皮下护甲、维生监测件。"
              },
              {
                "kind": "hpMax",
                "value": 8
              }
            ],
            "description": "义体：弦卷集团出品：智能链接、皮下护甲、维生监测件。",
            "status": "installed"
          },
          {
            "template": "smg",
            "tier": 2,
            "name": "弦卷系智能冲锋枪",
            "status": "equipped",
            "description": "武器：一把弦卷系智能冲锋枪。"
          },
          {
            "custom": true,
            "id": "npc_7_lore_kit",
            "name": "长崎素世·档案随身装备",
            "category": "text",
            "description": "义体：弦卷集团出品：智能链接、皮下护甲、维生监测件。 武器：一把弦卷系智能冲锋枪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Soyo",
        "aliases": [
          "素世",
          "Soyo",
          "長崎そよ",
          "長崎素世",
          "そよ",
          "爽世"
        ],
        "form": "human",
        "san": 78,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "reflexes",
          "technical",
          "body"
        ],
        "basis": "社交协调与高档防护",
        "loreEquipment": [
          "义体：弦卷集团出品：智能链接、皮下护甲、维生监测件。",
          "武器：一把弦卷系智能冲锋枪。"
        ],
        "sourceFile": "世界书/007-长崎素世.txt",
        "sourceSHA256": "451bc5134d79c9b3ca0fd8a9f9b8a5ef1d38adca7151cec67c4d5f3e4678fb6b",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_8",
      "name": "椎名立希",
      "worldbookUid": 8,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 8
      },
      "growthInitial": {
        "level": 6,
        "xp": 5423,
        "attributes": {
          "body": 9,
          "reflexes": 7,
          "intelligence": 5,
          "technical": 5,
          "cool": 7
        },
        "attributePoints": 0,
        "perkPoints": 5,
        "perks": {
          "Body_Central_Milestone_1": 1,
          "Body_Central_Perk_1_1": 1,
          "Body_Central_Perk_1_2": 1,
          "Body_Central_Perk_1_3": 1,
          "Body_Central_Perk_1_4": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_8_skin",
            "name": "椎名立希·档案防护装配",
            "category": "cyberware",
            "part": "skin",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。皮下身份芯片。"
              },
              {
                "kind": "hpMax",
                "value": 8
              }
            ],
            "description": "义体：低植入率。皮下身份芯片。",
            "status": "installed"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "警用制式半自动手枪",
            "status": "equipped",
            "description": "武器：一把警用制式半自动手枪。"
          },
          {
            "custom": true,
            "id": "npc_8_lore_kit",
            "name": "椎名立希·档案随身装备",
            "category": "text",
            "description": "义体：低植入率。皮下身份芯片。 武器：一把警用制式半自动手枪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Taki",
        "aliases": [
          "立希",
          "Taki"
        ],
        "form": "human",
        "san": 82,
        "rookie": true,
        "priority": [
          "body",
          "reflexes",
          "cool",
          "intelligence",
          "technical"
        ],
        "basis": "鼓手腕力散打与标准射击",
        "loreEquipment": [
          "义体：低植入率。皮下身份芯片。",
          "武器：一把警用制式半自动手枪。"
        ],
        "sourceFile": "世界书/008-椎名立希.txt",
        "sourceSHA256": "0a074cb1978a1329e9957e9732c2f099e496f0ceb09590a1a12c1cc425a6aedc",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_9",
      "name": "要乐奈",
      "worldbookUid": 9,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 9
      },
      "growthInitial": {
        "level": 11,
        "xp": 12044,
        "attributes": {
          "body": 8,
          "reflexes": 15,
          "intelligence": 4,
          "technical": 8,
          "cool": 8
        },
        "attributePoints": 0,
        "perkPoints": 10,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1,
          "Reflexes_Left_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_9_arms",
            "name": "要乐奈·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "高植入率。左臂：螳螂刀 右臂：单分子线。神经强化件。均为其外婆改造后的自制款义体。"
              }
            ],
            "description": "义体：高植入率。左臂：螳螂刀 右臂：单分子线。神经强化件。均为其外婆改造后的自制款义体。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_9_nervous",
            "name": "要乐奈·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "高植入率。左臂：螳螂刀 右臂：单分子线。神经强化件。均为其外婆改造后的自制款义体。"
              }
            ],
            "description": "义体：高植入率。左臂：螳螂刀 右臂：单分子线。神经强化件。均为其外婆改造后的自制款义体。",
            "status": "installed"
          },
          {
            "template": "blade",
            "tier": 2,
            "name": "螳螂刀与分子线",
            "status": "equipped",
            "description": "武器：螳螂刀与分子线。"
          },
          {
            "custom": true,
            "id": "npc_9_lore_kit",
            "name": "要乐奈·档案随身装备",
            "category": "text",
            "description": "义体：高植入率。左臂：螳螂刀 右臂：单分子线。神经强化件。均为其外婆改造后的自制款义体。 武器：螳螂刀与分子线。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Rana",
        "aliases": [
          "乐奈",
          "Rana",
          "要楽奈",
          "要樂奈",
          "楽奈",
          "樂奈",
          "Raana"
        ],
        "form": "human",
        "san": 80,
        "rookie": false,
        "priority": [
          "reflexes",
          "body",
          "technical",
          "cool",
          "intelligence"
        ],
        "basis": "高植入近战与神经强化",
        "loreEquipment": [
          "义体：高植入率。左臂：螳螂刀 右臂：单分子线。神经强化件。均为其外婆改造后的自制款义体。",
          "武器：螳螂刀与分子线。"
        ],
        "sourceFile": "世界书/009-要乐奈.txt",
        "sourceSHA256": "3230c023198ce8a52501f11bb492145406f86ca6ca0c097b2e9cdc33efafc914",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_10",
      "name": "丰川祥子",
      "worldbookUid": 10,
      "sourceRef": {
        "kind": "author-profile",
        "version": "2051-ensemble-pilot-1",
        "worldbookUid": 10
      },
      "growthInitial": {
        "schema": 1,
        "level": 5,
        "xp": 4250,
        "attributes": {
          "body": 4,
          "reflexes": 7,
          "intelligence": 4,
          "technical": 5,
          "cool": 6
        },
        "attributePoints": 0,
        "perkPoints": 4,
        "perks": {
          "Reflexes_Central_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 12000,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "template": "pistol",
            "tier": 1,
            "name": "从据点取得的手枪",
            "status": "equipped"
          },
          {
            "template": "pistol",
            "tier": 1,
            "name": "从据点取得的手枪",
            "status": "equipped"
          },
          {
            "template": "blade",
            "tier": 1,
            "name": "折叠刀",
            "status": "equipped"
          },
          {
            "custom": true,
            "id": "pilot_sakiko_reflex",
            "name": "廉价反射加速器",
            "category": "cyberware",
            "part": "nervous",
            "tier": 1,
            "numericEffects": [
              {
                "kind": "powerPct",
                "value": 0.03,
                "when": "reflex_boost"
              },
              {
                "kind": "ability",
                "text": "启用时短暂辅助反射；效果与现场动作匹配。"
              }
            ],
            "tags": [],
            "active": "reflex_boost",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "pilot_sakiko_eye",
            "name": "单只义眼",
            "category": "cyberware",
            "part": "face",
            "tier": 1,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "保留单眼视觉功能；没有额外穿透扫描效果。"
              }
            ],
            "tags": [],
            "status": "installed"
          },
          {
            "template": "subdermal_armor",
            "tier": 1,
            "name": "拼装皮下护甲片",
            "status": "installed"
          }
        ]
      },
      "roster": {
        "schema": 1,
        "displayId": "Saki",
        "aliases": [
          "祥子",
          "Sakiko",
          "Saki",
          "豊川祥子",
          "豐川祥子",
          "小祥",
          "Oblivionis"
        ],
        "form": "human",
        "san": 78,
        "rookie": true,
        "priority": [
          "reflexes",
          "cool",
          "technical",
          "body",
          "intelligence"
        ],
        "basis": "已有作者试点",
        "loreEquipment": [
          "义体：较高植入率。赤羽黑诊所拼装件：廉价反射加速、单只义眼、皮下护甲片。",
          "武器：折叠刀与两把手枪（从肉肉肉据点顺出来的）。"
        ],
        "sourceFile": "世界书/010-丰川祥子.txt",
        "sourceSHA256": "56b9eda171d82313ec1bd61a0bf0314ed13a27a66c97d050ad9f01d76bbb4076",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": true
      }
    },
    {
      "actorId": "wb_11",
      "name": "若叶睦",
      "worldbookUid": 11,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 11
      },
      "growthInitial": {
        "level": 8,
        "xp": 7914,
        "attributes": {
          "body": 9,
          "reflexes": 10,
          "intelligence": 6,
          "technical": 8,
          "cool": 6
        },
        "attributePoints": 0,
        "perkPoints": 7,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_11_nervous",
            "name": "若叶睦·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "二代机偶，全身机械。使用弦卷系心智与金标级精密机体，外观与真人无异。"
              }
            ],
            "description": "义体：二代机偶，全身机械。使用弦卷系心智与金标级精密机体，外观与真人无异。",
            "status": "installed"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "具装手炮",
            "status": "equipped",
            "description": "武器：浮游炮与具装手炮（藏于机体内，需要时展开）。"
          },
          {
            "custom": true,
            "id": "npc_11_lore_kit",
            "name": "若叶睦·档案随身装备",
            "category": "text",
            "description": "义体：二代机偶，全身机械。使用弦卷系心智与金标级精密机体，外观与真人无异。 武器：浮游炮与具装手炮（藏于机体内，需要时展开）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Mutsumi",
        "aliases": [
          "睦",
          "Mutsumi",
          "若葉睦",
          "Mortis"
        ],
        "form": "android",
        "san": 74,
        "rookie": false,
        "priority": [
          "reflexes",
          "body",
          "technical",
          "intelligence",
          "cool"
        ],
        "basis": "精密机偶躯体与控制负荷",
        "loreEquipment": [
          "义体：二代机偶，全身机械。使用弦卷系心智与金标级精密机体，外观与真人无异。",
          "武器：浮游炮与具装手炮（藏于机体内，需要时展开）。"
        ],
        "sourceFile": "世界书/011-若叶睦.txt",
        "sourceSHA256": "b7d4074a67643461c90e25af56a94b0ae3c041407f3f8b8ec2dfac9596c27523",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_12",
      "name": "三角初华",
      "worldbookUid": 12,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 12
      },
      "growthInitial": {
        "level": 5,
        "xp": 4250,
        "attributes": {
          "body": 5,
          "reflexes": 7,
          "intelligence": 6,
          "technical": 5,
          "cool": 8
        },
        "attributePoints": 0,
        "perkPoints": 4,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_12_nervous",
            "name": "三角初华·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "智能链接与基础神经件。"
              }
            ],
            "description": "义体：智能链接与基础神经件。",
            "status": "installed"
          },
          {
            "template": "rifle",
            "tier": 2,
            "name": "SPAS-L智能射手步枪",
            "status": "equipped",
            "description": "武器：SPAS-L智能射手步枪。"
          },
          {
            "custom": true,
            "id": "npc_12_lore_kit",
            "name": "三角初华·档案随身装备",
            "category": "text",
            "description": "义体：智能链接与基础神经件。 武器：SPAS-L智能射手步枪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Uika",
        "aliases": [
          "初华",
          "Uika",
          "三角初華",
          "初華",
          "Doloris"
        ],
        "form": "human",
        "san": 78,
        "rookie": true,
        "priority": [
          "cool",
          "reflexes",
          "intelligence",
          "body",
          "technical"
        ],
        "basis": "职业舞台与基础神经件",
        "loreEquipment": [
          "义体：智能链接与基础神经件。",
          "武器：SPAS-L智能射手步枪。"
        ],
        "sourceFile": "世界书/012-三角初华.txt",
        "sourceSHA256": "4fcacdefbda189cc36dce145eda9c6e86917308e4c433fa9f4a3bb52bd6a41b6",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_13",
      "name": "祐天寺若麦",
      "worldbookUid": 13,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 13
      },
      "growthInitial": {
        "level": 5,
        "xp": 4250,
        "attributes": {
          "body": 4,
          "reflexes": 7,
          "intelligence": 7,
          "technical": 7,
          "cool": 8
        },
        "attributePoints": 0,
        "perkPoints": 4,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_13_nervous",
            "name": "祐天寺若麦·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。后颈神经接入接口（黑市翻新）、皮下身份芯片。"
              }
            ],
            "description": "义体：中等植入率。后颈神经接入接口（黑市翻新）、皮下身份芯片。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_13_skin",
            "name": "祐天寺若麦·档案防护装配",
            "category": "cyberware",
            "part": "skin",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。后颈神经接入接口（黑市翻新）、皮下身份芯片。"
              },
              {
                "kind": "hpMax",
                "value": 8
              }
            ],
            "description": "义体：中等植入率。后颈神经接入接口（黑市翻新）、皮下身份芯片。",
            "status": "installed"
          },
          {
            "template": "blade",
            "tier": 2,
            "name": "右小臂内藏分子线",
            "status": "equipped",
            "description": "武器：分子线（右小臂内藏）；网路侧另有自行编写的冰墙、蠕虫与追踪程序。"
          },
          {
            "custom": true,
            "id": "npc_13_lore_kit",
            "name": "祐天寺若麦·档案随身装备",
            "category": "text",
            "description": "义体：中等植入率。后颈神经接入接口（黑市翻新）、皮下身份芯片。 武器：分子线（右小臂内藏）；网路侧另有自行编写的冰墙、蠕虫与追踪程序。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Nyamu",
        "aliases": [
          "若麦",
          "Nyamu",
          "喵梦",
          "喵夢",
          "祐天寺にゃむ",
          "祐天寺若麥",
          "にゃむ",
          "若麥",
          "Amoris"
        ],
        "form": "human",
        "san": 76,
        "rookie": true,
        "priority": [
          "cool",
          "reflexes",
          "intelligence",
          "technical",
          "body"
        ],
        "basis": "传媒社交与黑市接口",
        "loreEquipment": [
          "义体：中等植入率。后颈神经接入接口（黑市翻新）、皮下身份芯片。",
          "武器：分子线（右小臂内藏）；网路侧另有自行编写的冰墙、蠕虫与追踪程序。"
        ],
        "sourceFile": "世界书/013-祐天寺若麦.txt",
        "sourceSHA256": "64a30c695215503ca3b3e32c58a4e4791e524791f4060371a5fea5a779c66204",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_14",
      "name": "八幡海铃",
      "worldbookUid": 14,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 14
      },
      "growthInitial": {
        "level": 10,
        "xp": 10612,
        "attributes": {
          "body": 8,
          "reflexes": 12,
          "intelligence": 6,
          "technical": 7,
          "cool": 11
        },
        "attributePoints": 0,
        "perkPoints": 9,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_14_face",
            "name": "八幡海铃·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。军用退役规格义眼（右眼：扫描、夜视、录证）、左前臂皮下防弹衬片。"
              }
            ],
            "description": "义体：低植入率。军用退役规格义眼（右眼：扫描、夜视、录证）、左前臂皮下防弹衬片。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_14_arms",
            "name": "八幡海铃·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。军用退役规格义眼（右眼：扫描、夜视、录证）、左前臂皮下防弹衬片。"
              }
            ],
            "description": "义体：低植入率。军用退役规格义眼（右眼：扫描、夜视、录证）、左前臂皮下防弹衬片。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_14_skin",
            "name": "八幡海铃·档案防护装配",
            "category": "cyberware",
            "part": "skin",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。军用退役规格义眼（右眼：扫描、夜视、录证）、左前臂皮下防弹衬片。"
              },
              {
                "kind": "hpMax",
                "value": 8
              }
            ],
            "description": "义体：低植入率。军用退役规格义眼（右眼：扫描、夜视、录证）、左前臂皮下防弹衬片。",
            "status": "installed"
          },
          {
            "template": "blade",
            "tier": 3,
            "name": "武士刀",
            "status": "equipped",
            "description": "武器：一柄武士刀。"
          },
          {
            "custom": true,
            "id": "npc_14_lore_kit",
            "name": "八幡海铃·档案随身装备",
            "category": "text",
            "description": "义体：低植入率。军用退役规格义眼（右眼：扫描、夜视、录证）、左前臂皮下防弹衬片。 武器：一柄武士刀。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Umiri",
        "aliases": [
          "海铃",
          "Umiri",
          "八幡海鈴",
          "海鈴",
          "Timoris"
        ],
        "form": "human",
        "san": 85,
        "rookie": false,
        "priority": [
          "reflexes",
          "cool",
          "body",
          "technical",
          "intelligence"
        ],
        "basis": "职业雇佣兵与退役军用义眼",
        "loreEquipment": [
          "义体：低植入率。军用退役规格义眼（右眼：扫描、夜视、录证）、左前臂皮下防弹衬片。",
          "武器：一柄武士刀。"
        ],
        "sourceFile": "世界书/014-八幡海铃.txt",
        "sourceSHA256": "15f700b1c29fe0f36af470364bdb7d2224007efd7d15a47f6c4e7d5c6e155773",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_18",
      "name": "纯田真奈",
      "worldbookUid": 18,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 18
      },
      "growthInitial": {
        "level": 5,
        "xp": 4250,
        "attributes": {
          "body": 6,
          "reflexes": 7,
          "intelligence": 5,
          "technical": 5,
          "cool": 8
        },
        "attributePoints": 0,
        "perkPoints": 4,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_18_nervous",
            "name": "纯田真奈·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "商业偶像级声带保护与气息平稳微调芯片、高清全息舞台动捕与表情同步信标、抗疲劳新陈代谢管理插件。另装有基础运动性义体，腰腹可见强化肌肉的线条。"
              }
            ],
            "description": "义体：商业偶像级声带保护与气息平稳微调芯片、高清全息舞台动捕与表情同步信标、抗疲劳新陈代谢管理插件。另装有基础运动性义体，腰腹可见强化肌肉的线条。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_18_lore_kit",
            "name": "纯田真奈·档案随身装备",
            "category": "text",
            "description": "义体：商业偶像级声带保护与气息平稳微调芯片、高清全息舞台动捕与表情同步信标、抗疲劳新陈代谢管理插件。另装有基础运动性义体，腰腹可见强化肌肉的线条。 武器：无杀伤性武器，随身名牌挎包里只装着补妆气垫、防狗仔强光干扰胸针与独立包装的低卡甜甜圈。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Mana",
        "aliases": [
          "真奈",
          "Mana"
        ],
        "form": "human",
        "san": 86,
        "rookie": true,
        "priority": [
          "cool",
          "reflexes",
          "body",
          "intelligence",
          "technical"
        ],
        "basis": "职业声乐与运动改造",
        "loreEquipment": [
          "义体：商业偶像级声带保护与气息平稳微调芯片、高清全息舞台动捕与表情同步信标、抗疲劳新陈代谢管理插件。另装有基础运动性义体，腰腹可见强化肌肉的线条。",
          "武器：无杀伤性武器，随身名牌挎包里只装着补妆气垫、防狗仔强光干扰胸针与独立包装的低卡甜甜圈。"
        ],
        "sourceFile": "世界书/018-纯田真奈.txt",
        "sourceSHA256": "78834c5a4b3c675cf22cad241ec93348176705694c046c14693330353f37e601",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_88",
      "name": "马桥心玖",
      "worldbookUid": 88,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 88
      },
      "growthInitial": {
        "level": 5,
        "xp": 4250,
        "attributes": {
          "body": 4,
          "reflexes": 5,
          "intelligence": 9,
          "technical": 8,
          "cool": 6
        },
        "attributePoints": 0,
        "perkPoints": 4,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_88_arms",
            "name": "马桥心玖·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "高保真声学拾音耳蜗与音频频谱分析神经插件（原本用于专业录音与混音，能分辨极细微的环境底噪、脚步声与电子设备高频啸叫）、加密通讯中继芯片（在盗芯之夜曾遭八咫鸟核心过载烧毁，获救后由巴协助清理修复）。 上臂有局部义体，仿生肤面可见细线状分段接缝。"
              }
            ],
            "description": "义体：高保真声学拾音耳蜗与音频频谱分析神经插件（原本用于专业录音与混音，能分辨极细微的环境底噪、脚步声与电子设备高频啸叫）、加密通讯中继芯片（在盗芯之夜曾遭八咫鸟核心过载烧毁，获救后由巴协助清理修复）。 上臂有局部义体，仿生肤面可见细线状分段接缝。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_88_nervous",
            "name": "马桥心玖·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "高保真声学拾音耳蜗与音频频谱分析神经插件（原本用于专业录音与混音，能分辨极细微的环境底噪、脚步声与电子设备高频啸叫）、加密通讯中继芯片（在盗芯之夜曾遭八咫鸟核心过载烧毁，获救后由巴协助清理修复）。 上臂有局部义体，仿生肤面可见细线状分段接缝。"
              }
            ],
            "description": "义体：高保真声学拾音耳蜗与音频频谱分析神经插件（原本用于专业录音与混音，能分辨极细微的环境底噪、脚步声与电子设备高频啸叫）、加密通讯中继芯片（在盗芯之夜曾遭八咫鸟核心过载烧毁，获救后由巴协助清理修复）。 上臂有局部义体，仿生肤面可见细线状分段接缝。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "录音笔式高压电击防狼器",
            "status": "equipped",
            "description": "武器：非战斗人员，随身仅携带一支伪装成录音笔的高压电击防狼器与高分贝声波致眩发生器。"
          },
          {
            "custom": true,
            "id": "npc_88_lore_kit",
            "name": "马桥心玖·档案随身装备",
            "category": "text",
            "description": "义体：高保真声学拾音耳蜗与音频频谱分析神经插件（原本用于专业录音与混音，能分辨极细微的环境底噪、脚步声与电子设备高频啸叫）、加密通讯中继芯片（在盗芯之夜曾遭八咫鸟核心过载烧毁，获救后由巴协助清理修复）。 上臂有局部义体，仿生肤面可见细线状分段接缝。 武器：非战斗人员，随身仅携带一支伪装成录音笔的高压电击防狼器与高分贝声波致眩发生器。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Miku",
        "aliases": [
          "心玖",
          "Miku",
          "馬橋心玖"
        ],
        "form": "human",
        "san": 78,
        "rookie": true,
        "priority": [
          "intelligence",
          "technical",
          "cool",
          "reflexes",
          "body"
        ],
        "basis": "音频频谱分析与通讯修复",
        "loreEquipment": [
          "义体：高保真声学拾音耳蜗与音频频谱分析神经插件（原本用于专业录音与混音，能分辨极细微的环境底噪、脚步声与电子设备高频啸叫）、加密通讯中继芯片（在盗芯之夜曾遭八咫鸟核心过载烧毁，获救后由巴协助清理修复）。 上臂有局部义体，仿生肤面可见细线状分段接缝。",
          "武器：非战斗人员，随身仅携带一支伪装成录音笔的高压电击防狼器与高分贝声波致眩发生器。"
        ],
        "sourceFile": "世界书/088-馬橋心玖.txt",
        "sourceSHA256": "3166a96b3ce16097a24c90dda0a26305787b976564c0d3805b79eefe0dd09eb8",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_89",
      "name": "须贺蕾叶",
      "worldbookUid": 89,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 89
      },
      "growthInitial": {
        "level": 6,
        "xp": 5423,
        "attributes": {
          "body": 10,
          "reflexes": 8,
          "intelligence": 4,
          "technical": 6,
          "cool": 7
        },
        "attributePoints": 0,
        "perkPoints": 5,
        "perks": {
          "Body_Central_Milestone_1": 1,
          "Body_Central_Perk_1_1": 1,
          "Body_Central_Perk_1_2": 1,
          "Body_Central_Perk_1_3": 1,
          "Body_Central_Perk_1_4": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_89_face",
            "name": "须贺蕾叶·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "前臂与肩部强化肌腱束（原本是为了搬运重型演艺设备与长时间挥棒、扫弦而装的民用工程级强化件，出力刚猛直接）、痛觉耐受调节插件、基础光学护目隐形镜片。 双侧小腿为外露机械义肢，保留银黑色外壳与连接件，膝部衔接处有肤色分段盖片。"
              }
            ],
            "description": "义体：前臂与肩部强化肌腱束（原本是为了搬运重型演艺设备与长时间挥棒、扫弦而装的民用工程级强化件，出力刚猛直接）、痛觉耐受调节插件、基础光学护目隐形镜片。 双侧小腿为外露机械义肢，保留银黑色外壳与连接件，膝部衔接处有肤色分段盖片。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_89_arms",
            "name": "须贺蕾叶·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "前臂与肩部强化肌腱束（原本是为了搬运重型演艺设备与长时间挥棒、扫弦而装的民用工程级强化件，出力刚猛直接）、痛觉耐受调节插件、基础光学护目隐形镜片。 双侧小腿为外露机械义肢，保留银黑色外壳与连接件，膝部衔接处有肤色分段盖片。"
              }
            ],
            "description": "义体：前臂与肩部强化肌腱束（原本是为了搬运重型演艺设备与长时间挥棒、扫弦而装的民用工程级强化件，出力刚猛直接）、痛觉耐受调节插件、基础光学护目隐形镜片。 双侧小腿为外露机械义肢，保留银黑色外壳与连接件，膝部衔接处有肤色分段盖片。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_89_legs",
            "name": "须贺蕾叶·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "前臂与肩部强化肌腱束（原本是为了搬运重型演艺设备与长时间挥棒、扫弦而装的民用工程级强化件，出力刚猛直接）、痛觉耐受调节插件、基础光学护目隐形镜片。 双侧小腿为外露机械义肢，保留银黑色外壳与连接件，膝部衔接处有肤色分段盖片。"
              }
            ],
            "description": "义体：前臂与肩部强化肌腱束（原本是为了搬运重型演艺设备与长时间挥棒、扫弦而装的民用工程级强化件，出力刚猛直接）、痛觉耐受调节插件、基础光学护目隐形镜片。 双侧小腿为外露机械义肢，保留银黑色外壳与连接件，膝部衔接处有肤色分段盖片。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "全垒打王改装棒球棒",
            "status": "equipped",
            "description": "武器：随身背在吉他包侧袋里的铝合金配重改装棒球棒「全垒打王」、大口径街头防暴霰弹手枪。"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "大口径街头防暴霰弹手枪",
            "status": "equipped",
            "description": "武器：随身背在吉他包侧袋里的铝合金配重改装棒球棒「全垒打王」、大口径街头防暴霰弹手枪。"
          },
          {
            "custom": true,
            "id": "npc_89_lore_kit",
            "name": "须贺蕾叶·档案随身装备",
            "category": "text",
            "description": "义体：前臂与肩部强化肌腱束（原本是为了搬运重型演艺设备与长时间挥棒、扫弦而装的民用工程级强化件，出力刚猛直接）、痛觉耐受调节插件、基础光学护目隐形镜片。 双侧小腿为外露机械义肢，保留银黑色外壳与连接件，膝部衔接处有肤色分段盖片。 武器：随身背在吉他包侧袋里的铝合金配重改装棒球棒「全垒打王」、大口径街头防暴霰弹手枪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Raika",
        "aliases": [
          "蕾叶",
          "Raika",
          "須賀蕾葉",
          "蕾葉"
        ],
        "form": "human",
        "san": 84,
        "rookie": true,
        "priority": [
          "body",
          "reflexes",
          "cool",
          "technical",
          "intelligence"
        ],
        "basis": "工程肌腱与近战搬运",
        "loreEquipment": [
          "义体：前臂与肩部强化肌腱束（原本是为了搬运重型演艺设备与长时间挥棒、扫弦而装的民用工程级强化件，出力刚猛直接）、痛觉耐受调节插件、基础光学护目隐形镜片。 双侧小腿为外露机械义肢，保留银黑色外壳与连接件，膝部衔接处有肤色分段盖片。",
          "武器：随身背在吉他包侧袋里的铝合金配重改装棒球棒「全垒打王」、大口径街头防暴霰弹手枪。"
        ],
        "sourceFile": "世界书/089-須賀蕾葉.txt",
        "sourceSHA256": "7769e22d1aa4d4a3fe4956abc4d1e29bcf126bbff90cb734534da6af1c40830d",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_106",
      "name": "泽海奏多",
      "worldbookUid": 106,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 106
      },
      "growthInitial": {
        "level": 4,
        "xp": 3123,
        "attributes": {
          "body": 3,
          "reflexes": 5,
          "intelligence": 7,
          "technical": 4,
          "cool": 8
        },
        "attributePoints": 0,
        "perkPoints": 3,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_106_legs",
            "name": "泽海奏多·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "装有肤色仿生覆盖的民用机械义腿，膝部可见分段盖片与青色线路。先天性神经排异症限制常规重型义体植入，胸腔与脊椎仍贴附微型生命体征缓释泵与痛觉阻断贴片（被她藏在校服与演出服内衬下，绝不让队友看见报警指示灯）。"
              }
            ],
            "description": "义体：装有肤色仿生覆盖的民用机械义腿，膝部可见分段盖片与青色线路。先天性神经排异症限制常规重型义体植入，胸腔与脊椎仍贴附微型生命体征缓释泵与痛觉阻断贴片（被她藏在校服与演出服内衬下，绝不让队友看见报警指示灯）。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_106_nervous",
            "name": "泽海奏多·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "装有肤色仿生覆盖的民用机械义腿，膝部可见分段盖片与青色线路。先天性神经排异症限制常规重型义体植入，胸腔与脊椎仍贴附微型生命体征缓释泵与痛觉阻断贴片（被她藏在校服与演出服内衬下，绝不让队友看见报警指示灯）。"
              }
            ],
            "description": "义体：装有肤色仿生覆盖的民用机械义腿，膝部可见分段盖片与青色线路。先天性神经排异症限制常规重型义体植入，胸腔与脊椎仍贴附微型生命体征缓释泵与痛觉阻断贴片（被她藏在校服与演出服内衬下，绝不让队友看见报警指示灯）。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_106_lore_kit",
            "name": "泽海奏多·档案随身装备",
            "category": "text",
            "description": "义体：装有肤色仿生覆盖的民用机械义腿，膝部可见分段盖片与青色线路。先天性神经排异症限制常规重型义体植入，胸腔与脊椎仍贴附微型生命体征缓释泵与痛觉阻断贴片（被她藏在校服与演出服内衬下，绝不让队友看见报警指示灯）。 武器：非战斗人员，随身仅挂着那枚藏有全队Demo、歌词手稿与秘密遗书式日记的「微笑小潘」高强度加密U盘钥匙扣。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Kanata",
        "aliases": [
          "奏多",
          "Kanata",
          "Kanade"
        ],
        "form": "human",
        "san": 80,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "reflexes",
          "technical",
          "body"
        ],
        "basis": "重病排异与专业键盘表现",
        "loreEquipment": [
          "义体：装有肤色仿生覆盖的民用机械义腿，膝部可见分段盖片与青色线路。先天性神经排异症限制常规重型义体植入，胸腔与脊椎仍贴附微型生命体征缓释泵与痛觉阻断贴片（被她藏在校服与演出服内衬下，绝不让队友看见报警指示灯）。",
          "武器：非战斗人员，随身仅挂着那枚藏有全队Demo、歌词手稿与秘密遗书式日记的「微笑小潘」高强度加密U盘钥匙扣。"
        ],
        "sourceFile": "世界书/106-泽海奏多.txt",
        "sourceSHA256": "032abce046e0dc380f49ecd37c1e35d959599f1548062d1a75823dd4b07e7c04",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false,
        "hpRatio": 0.65,
        "stamina": 45
      }
    },
    {
      "actorId": "wb_107",
      "name": "汐见萤",
      "worldbookUid": 107,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 107
      },
      "growthInitial": {
        "level": 4,
        "xp": 3123,
        "attributes": {
          "body": 4,
          "reflexes": 7,
          "intelligence": 8,
          "technical": 4,
          "cool": 6
        },
        "attributePoints": 0,
        "perkPoints": 3,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_107_legs",
            "name": "汐见萤·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "双腿装有肤色仿生覆盖的民用机械义肢，膝部与小腿保留分段接缝；没有用于演奏或强化感知的神经插件，个人终端只用最基础的学生老人机模式。她在忘我演奏时看见「彩虹色的声学光谱」，源于天生的联觉神经天赋。"
              }
            ],
            "description": "义体：双腿装有肤色仿生覆盖的民用机械义肢，膝部与小腿保留分段接缝；没有用于演奏或强化感知的神经插件，个人终端只用最基础的学生老人机模式。她在忘我演奏时看见「彩虹色的声学光谱」，源于天生的联觉神经天赋。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_107_nervous",
            "name": "汐见萤·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "双腿装有肤色仿生覆盖的民用机械义肢，膝部与小腿保留分段接缝；没有用于演奏或强化感知的神经插件，个人终端只用最基础的学生老人机模式。她在忘我演奏时看见「彩虹色的声学光谱」，源于天生的联觉神经天赋。"
              }
            ],
            "description": "义体：双腿装有肤色仿生覆盖的民用机械义肢，膝部与小腿保留分段接缝；没有用于演奏或强化感知的神经插件，个人终端只用最基础的学生老人机模式。她在忘我演奏时看见「彩虹色的声学光谱」，源于天生的联觉神经天赋。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_107_lore_kit",
            "name": "汐见萤·档案随身装备",
            "category": "text",
            "description": "义体：双腿装有肤色仿生覆盖的民用机械义肢，膝部与小腿保留分段接缝；没有用于演奏或强化感知的神经插件，个人终端只用最基础的学生老人机模式。她在忘我演奏时看见「彩虹色的声学光谱」，源于天生的联觉神经天赋。 武器：毫无防身武器与战斗经验，随身小包里只有给陆龟买菜叶的零钱、小馒头饼干与手写五线谱本。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Hotaru",
        "aliases": [
          "萤",
          "Hotaru"
        ],
        "form": "human",
        "san": 85,
        "rookie": true,
        "priority": [
          "intelligence",
          "reflexes",
          "cool",
          "body",
          "technical"
        ],
        "basis": "天生联觉与无演奏神经插件",
        "loreEquipment": [
          "义体：双腿装有肤色仿生覆盖的民用机械义肢，膝部与小腿保留分段接缝；没有用于演奏或强化感知的神经插件，个人终端只用最基础的学生老人机模式。她在忘我演奏时看见「彩虹色的声学光谱」，源于天生的联觉神经天赋。",
          "武器：毫无防身武器与战斗经验，随身小包里只有给陆龟买菜叶的零钱、小馒头饼干与手写五线谱本。"
        ],
        "sourceFile": "世界书/107-汐见萤.txt",
        "sourceSHA256": "9d210fcffc813d0e1363c3df36c6437ad1d3fa909b768cca62c1f8aefc211b3b",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_108",
      "name": "伊泽枣",
      "worldbookUid": 108,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 108
      },
      "growthInitial": {
        "level": 5,
        "xp": 4250,
        "attributes": {
          "body": 5,
          "reflexes": 9,
          "intelligence": 6,
          "technical": 5,
          "cool": 8
        },
        "attributePoints": 0,
        "perkPoints": 4,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_108_face",
            "name": "伊泽枣·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "极其排斥任何「替人弹琴或替人思考」的作弊式神经插件，仅安装了基础的视网膜乐谱备忘图层与高强度手腕肌腱防劳损护具。"
              }
            ],
            "description": "义体：极其排斥任何「替人弹琴或替人思考」的作弊式神经插件，仅安装了基础的视网膜乐谱备忘图层与高强度手腕肌腱防劳损护具。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_108_nervous",
            "name": "伊泽枣·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "极其排斥任何「替人弹琴或替人思考」的作弊式神经插件，仅安装了基础的视网膜乐谱备忘图层与高强度手腕肌腱防劳损护具。"
              }
            ],
            "description": "义体：极其排斥任何「替人弹琴或替人思考」的作弊式神经插件，仅安装了基础的视网膜乐谱备忘图层与高强度手腕肌腱防劳损护具。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "防身折叠战术笔",
            "status": "equipped",
            "description": "武器：随身携带的高密度金属外壳录音笔与防身折叠战术笔，以及常年握琴练出的惊人指力与腕力。"
          },
          {
            "custom": true,
            "id": "npc_108_lore_kit",
            "name": "伊泽枣·档案随身装备",
            "category": "text",
            "description": "义体：极其排斥任何「替人弹琴或替人思考」的作弊式神经插件，仅安装了基础的视网膜乐谱备忘图层与高强度手腕肌腱防劳损护具。 武器：随身携带的高密度金属外壳录音笔与防身折叠战术笔，以及常年握琴练出的惊人指力与腕力。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Natsume",
        "aliases": [
          "枣",
          "Natsume"
        ],
        "form": "human",
        "san": 86,
        "rookie": true,
        "priority": [
          "reflexes",
          "cool",
          "intelligence",
          "body",
          "technical"
        ],
        "basis": "原生演奏训练与精细手腕",
        "loreEquipment": [
          "义体：极其排斥任何「替人弹琴或替人思考」的作弊式神经插件，仅安装了基础的视网膜乐谱备忘图层与高强度手腕肌腱防劳损护具。",
          "武器：随身携带的高密度金属外壳录音笔与防身折叠战术笔，以及常年握琴练出的惊人指力与腕力。"
        ],
        "sourceFile": "世界书/108-伊泽枣.txt",
        "sourceSHA256": "363abb0e65c9bb6cd031452ff7323b82d5cb2d5c75fb77a08eaf0a6468a0769b",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_109",
      "name": "琴平凪",
      "worldbookUid": 109,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 109
      },
      "growthInitial": {
        "level": 4,
        "xp": 3123,
        "attributes": {
          "body": 4,
          "reflexes": 5,
          "intelligence": 7,
          "technical": 6,
          "cool": 9
        },
        "attributePoints": 0,
        "perkPoints": 3,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_109_lore_kit",
            "name": "琴平凪·档案随身装备",
            "category": "text",
            "description": "义体：未安装任何激进改造件，仅配有环境温湿度与队友心率疲劳度监测手环（一旦发现奏多或队友心率异常就会不动声色地提议休息）、防噪音耳道滤波器。 武器：非战斗人员，随身挎包里永远备齐了急救创可贴、止痛喷雾、湿巾手帕、防狼强光哨以及一整袋牛排味棒棒糖。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Nagi",
        "aliases": [
          "凪",
          "Nagi"
        ],
        "form": "human",
        "san": 86,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "队友体征监测与稳健协调",
        "loreEquipment": [
          "义体：未安装任何激进改造件，仅配有环境温湿度与队友心率疲劳度监测手环（一旦发现奏多或队友心率异常就会不动声色地提议休息）、防噪音耳道滤波器。",
          "武器：非战斗人员，随身挎包里永远备齐了急救创可贴、止痛喷雾、湿巾手帕、防狼强光哨以及一整袋牛排味棒棒糖。"
        ],
        "sourceFile": "世界书/109-琴平凪.txt",
        "sourceSHA256": "32c00e82b42c14fb8dc1e03f3154d8da653e1f54f7dec90990c6332bfa89161c",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_110",
      "name": "滨崎茉幌",
      "worldbookUid": 110,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 110
      },
      "growthInitial": {
        "level": 4,
        "xp": 3123,
        "attributes": {
          "body": 4,
          "reflexes": 6,
          "intelligence": 7,
          "technical": 4,
          "cool": 7
        },
        "attributePoints": 0,
        "perkPoints": 3,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_110_face",
            "name": "滨崎茉幌·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "未安装战斗义体；双腿为肤色仿生覆盖的民用义肢，膝部与小腿保留分段接缝。另配有视网膜面部特征记忆增强插件（她有着奇特的记忆偏科——见过一面的人脸绝对过目不忘，却经常转头就忘了自己的手机和钥匙丢在哪儿）。"
              }
            ],
            "description": "义体：未安装战斗义体；双腿为肤色仿生覆盖的民用义肢，膝部与小腿保留分段接缝。另配有视网膜面部特征记忆增强插件（她有着奇特的记忆偏科——见过一面的人脸绝对过目不忘，却经常转头就忘了自己的手机和钥匙丢在哪儿）。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_110_legs",
            "name": "滨崎茉幌·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "未安装战斗义体；双腿为肤色仿生覆盖的民用义肢，膝部与小腿保留分段接缝。另配有视网膜面部特征记忆增强插件（她有着奇特的记忆偏科——见过一面的人脸绝对过目不忘，却经常转头就忘了自己的手机和钥匙丢在哪儿）。"
              }
            ],
            "description": "义体：未安装战斗义体；双腿为肤色仿生覆盖的民用义肢，膝部与小腿保留分段接缝。另配有视网膜面部特征记忆增强插件（她有着奇特的记忆偏科——见过一面的人脸绝对过目不忘，却经常转头就忘了自己的手机和钥匙丢在哪儿）。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_110_lore_kit",
            "name": "滨崎茉幌·档案随身装备",
            "category": "text",
            "description": "义体：未安装战斗义体；双腿为肤色仿生覆盖的民用义肢，膝部与小腿保留分段接缝。另配有视网膜面部特征记忆增强插件（她有着奇特的记忆偏科——见过一面的人脸绝对过目不忘，却经常转头就忘了自己的手机和钥匙丢在哪儿）。 武器：无武器，随身背着那台沉甸甸的旧时代全金属机身光学微单相机，以及装满咖喱便当、西点零食与十几支幸运圆珠笔的帆布包。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Mahoro",
        "aliases": [
          "茉幌",
          "Mahoro"
        ],
        "form": "human",
        "san": 84,
        "rookie": true,
        "priority": [
          "intelligence",
          "cool",
          "reflexes",
          "body",
          "technical"
        ],
        "basis": "面部记忆与非战斗义肢",
        "loreEquipment": [
          "义体：未安装战斗义体；双腿为肤色仿生覆盖的民用义肢，膝部与小腿保留分段接缝。另配有视网膜面部特征记忆增强插件（她有着奇特的记忆偏科——见过一面的人脸绝对过目不忘，却经常转头就忘了自己的手机和钥匙丢在哪儿）。",
          "武器：无武器，随身背着那台沉甸甸的旧时代全金属机身光学微单相机，以及装满咖喱便当、西点零食与十几支幸运圆珠笔的帆布包。"
        ],
        "sourceFile": "世界书/110-滨崎茉幌.txt",
        "sourceSHA256": "41b46a601cd0c146aa156c3b54586436b002438cf6e948ee1eeade730381e8d4",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_111",
      "name": "和泉朋花",
      "worldbookUid": 111,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 111
      },
      "growthInitial": {
        "level": 6,
        "xp": 5423,
        "attributes": {
          "body": 6,
          "reflexes": 7,
          "intelligence": 8,
          "technical": 6,
          "cool": 10
        },
        "attributePoints": 0,
        "perkPoints": 5,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_111_arms",
            "name": "和泉朋花·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "社交微表情与语调实时辅助分析插件（让她能瞬间读懂场内每个人的欲望与潜台词）、前臂乳酸快速分解微循环贴片（用于支撑高强度练鼓）。 双腿带酒红色机械外壳，膝关节与固定点外露。"
              }
            ],
            "description": "义体：社交微表情与语调实时辅助分析插件（让她能瞬间读懂场内每个人的欲望与潜台词）、前臂乳酸快速分解微循环贴片（用于支撑高强度练鼓）。 双腿带酒红色机械外壳，膝关节与固定点外露。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_111_legs",
            "name": "和泉朋花·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "社交微表情与语调实时辅助分析插件（让她能瞬间读懂场内每个人的欲望与潜台词）、前臂乳酸快速分解微循环贴片（用于支撑高强度练鼓）。 双腿带酒红色机械外壳，膝关节与固定点外露。"
              }
            ],
            "description": "义体：社交微表情与语调实时辅助分析插件（让她能瞬间读懂场内每个人的欲望与潜台词）、前臂乳酸快速分解微循环贴片（用于支撑高强度练鼓）。 双腿带酒红色机械外壳，膝关节与固定点外露。",
            "status": "installed"
          },
          {
            "template": "blade",
            "tier": 2,
            "name": "定制防身餐刀",
            "status": "equipped",
            "description": "武器：非战斗人员，但面对任何血腥恐怖场面都拥有心率波动为零的绝对冷静胆魄，随身携带高级餐厅主厨姐姐送她的定制防身餐刀与强效防狼喷雾。"
          },
          {
            "custom": true,
            "id": "npc_111_lore_kit",
            "name": "和泉朋花·档案随身装备",
            "category": "text",
            "description": "义体：社交微表情与语调实时辅助分析插件（让她能瞬间读懂场内每个人的欲望与潜台词）、前臂乳酸快速分解微循环贴片（用于支撑高强度练鼓）。 双腿带酒红色机械外壳，膝关节与固定点外露。 武器：非战斗人员，但面对任何血腥恐怖场面都拥有心率波动为零的绝对冷静胆魄，随身携带高级餐厅主厨姐姐送她的定制防身餐刀与强效防狼喷雾。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Houka",
        "aliases": [
          "朋花",
          "Houka",
          "Hooka"
        ],
        "form": "human",
        "san": 84,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "reflexes",
          "body",
          "technical"
        ],
        "basis": "微表情识别与持续鼓手体能",
        "loreEquipment": [
          "义体：社交微表情与语调实时辅助分析插件（让她能瞬间读懂场内每个人的欲望与潜台词）、前臂乳酸快速分解微循环贴片（用于支撑高强度练鼓）。 双腿带酒红色机械外壳，膝关节与固定点外露。",
          "武器：非战斗人员，但面对任何血腥恐怖场面都拥有心率波动为零的绝对冷静胆魄，随身携带高级餐厅主厨姐姐送她的定制防身餐刀与强效防狼喷雾。"
        ],
        "sourceFile": "世界书/111-和泉朋花.txt",
        "sourceSHA256": "a6f535d86c285455c2c10319ff6972c00b4f9d226221b469ce6e8737c80367ff",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_112",
      "name": "矢仓蓬咲",
      "worldbookUid": 112,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 112
      },
      "growthInitial": {
        "level": 5,
        "xp": 4250,
        "attributes": {
          "body": 4,
          "reflexes": 8,
          "intelligence": 8,
          "technical": 9,
          "cool": 7
        },
        "attributePoints": 0,
        "perkPoints": 4,
        "perks": {
          "Tech_Left_Milestone_1": 1,
          "Tech_Left_Perk_1_1": 1,
          "Tech_Left_Perk_1_2": 1,
          "Tech_Right_Milestone_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_112_face",
            "name": "矢仓蓬咲·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "数位创新学科定制版高分辨率视觉排版与信号分析义眼插件、手部微操防抖神经回路（用于精细数字绘图与高速弹奏）、便携式光学迷彩化妆投射仪（能给队友脸上投射防监控识别的赛博朋克光影涂鸦）。"
              }
            ],
            "description": "义体：数位创新学科定制版高分辨率视觉排版与信号分析义眼插件、手部微操防抖神经回路（用于精细数字绘图与高速弹奏）、便携式光学迷彩化妆投射仪（能给队友脸上投射防监控识别的赛博朋克光影涂鸦）。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_112_nervous",
            "name": "矢仓蓬咲·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "数位创新学科定制版高分辨率视觉排版与信号分析义眼插件、手部微操防抖神经回路（用于精细数字绘图与高速弹奏）、便携式光学迷彩化妆投射仪（能给队友脸上投射防监控识别的赛博朋克光影涂鸦）。"
              }
            ],
            "description": "义体：数位创新学科定制版高分辨率视觉排版与信号分析义眼插件、手部微操防抖神经回路（用于精细数字绘图与高速弹奏）、便携式光学迷彩化妆投射仪（能给队友脸上投射防监控识别的赛博朋克光影涂鸦）。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "强光频闪致盲手电",
            "status": "equipped",
            "description": "武器：正面冲突时连防狼喷雾都会拿反，但随身携带经过改装的强光频闪致盲手电与能瘫痪民用监控探头的便携式激光炫目笔。"
          },
          {
            "custom": true,
            "id": "npc_112_lore_kit",
            "name": "矢仓蓬咲·档案随身装备",
            "category": "text",
            "description": "义体：数位创新学科定制版高分辨率视觉排版与信号分析义眼插件、手部微操防抖神经回路（用于精细数字绘图与高速弹奏）、便携式光学迷彩化妆投射仪（能给队友脸上投射防监控识别的赛博朋克光影涂鸦）。 武器：正面冲突时连防狼喷雾都会拿反，但随身携带经过改装的强光频闪致盲手电与能瘫痪民用监控探头的便携式激光炫目笔。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Yomogi",
        "aliases": [
          "蓬咲",
          "Yomogi"
        ],
        "form": "human",
        "san": 84,
        "rookie": true,
        "priority": [
          "technical",
          "reflexes",
          "intelligence",
          "cool",
          "body"
        ],
        "basis": "数字视觉与微操防抖",
        "loreEquipment": [
          "义体：数位创新学科定制版高分辨率视觉排版与信号分析义眼插件、手部微操防抖神经回路（用于精细数字绘图与高速弹奏）、便携式光学迷彩化妆投射仪（能给队友脸上投射防监控识别的赛博朋克光影涂鸦）。",
          "武器：正面冲突时连防狼喷雾都会拿反，但随身携带经过改装的强光频闪致盲手电与能瘫痪民用监控探头的便携式激光炫目笔。"
        ],
        "sourceFile": "世界书/112-矢仓蓬咲.txt",
        "sourceSHA256": "3240947ccfda29471f160245bdd92de9f4094f19d11679f93ea10bf8249a14f4",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_113",
      "name": "梅里千樱梨",
      "worldbookUid": 113,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 113
      },
      "growthInitial": {
        "level": 6,
        "xp": 5423,
        "attributes": {
          "body": 9,
          "reflexes": 10,
          "intelligence": 4,
          "technical": 6,
          "cool": 7
        },
        "attributePoints": 0,
        "perkPoints": 5,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "template": "blunt",
            "tier": 2,
            "name": "雷鸣双槌电击鼓棒",
            "status": "equipped",
            "description": "武器：内置高压电容模块的钨芯改装电击鼓棒「雷鸣双槌」、街头演出掩护用的强声波频闪震爆罐。"
          },
          {
            "custom": true,
            "id": "npc_113_lore_kit",
            "name": "梅里千樱梨·档案随身装备",
            "category": "text",
            "description": "义体：腕部与踝部高频爆发力辅助肌腱（专为超高速双踩与重型击打调校）、抗震耳膜保护滤音器、大肺活量呼吸供氧微调插件。 武器：内置高压电容模块的钨芯改装电击鼓棒「雷鸣双槌」、街头演出掩护用的强声波频闪震爆罐。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Chieri",
        "aliases": [
          "千樱梨",
          "Chieri"
        ],
        "form": "human",
        "san": 86,
        "rookie": true,
        "priority": [
          "reflexes",
          "body",
          "cool",
          "technical",
          "intelligence"
        ],
        "basis": "高速双踩与爆发辅助肌腱",
        "loreEquipment": [
          "义体：腕部与踝部高频爆发力辅助肌腱（专为超高速双踩与重型击打调校）、抗震耳膜保护滤音器、大肺活量呼吸供氧微调插件。",
          "武器：内置高压电容模块的钨芯改装电击鼓棒「雷鸣双槌」、街头演出掩护用的强声波频闪震爆罐。"
        ],
        "sourceFile": "世界书/113-梅里千樱梨.txt",
        "sourceSHA256": "73e60a04ff49e8110d15d415e664a24f29ce786a7072723227ae879e514fd4b0",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_114",
      "name": "四宫宁月",
      "worldbookUid": 114,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 114
      },
      "growthInitial": {
        "level": 4,
        "xp": 3123,
        "attributes": {
          "body": 3,
          "reflexes": 8,
          "intelligence": 8,
          "technical": 5,
          "cool": 7
        },
        "attributePoints": 0,
        "perkPoints": 3,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_114_lore_kit",
            "name": "四宫宁月·档案随身装备",
            "category": "text",
            "description": "义体：因年龄尚幼（14岁）且受本家严格医疗管控，未安装任何重型改造件，仅配有高敏度手指神经反馈微调贴片（辅助超高速键位触感）与内置于黑色蝴蝶结发饰中的名门防绑架定位信标（进入下北泽前她会熟练地用蓬咲做的屏蔽袋将其静默）。 武器：无杀伤性武器，随身携带一枚四宫本家配备的纳米级防身催泪香囊与高频求救信标。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Shizuku",
        "aliases": [
          "宁月",
          "Shizuku"
        ],
        "form": "human",
        "san": 85,
        "rookie": true,
        "priority": [
          "reflexes",
          "intelligence",
          "cool",
          "technical",
          "body"
        ],
        "basis": "精细键盘与轻型医疗改造",
        "loreEquipment": [
          "义体：因年龄尚幼（14岁）且受本家严格医疗管控，未安装任何重型改造件，仅配有高敏度手指神经反馈微调贴片（辅助超高速键位触感）与内置于黑色蝴蝶结发饰中的名门防绑架定位信标（进入下北泽前她会熟练地用蓬咲做的屏蔽袋将其静默）。",
          "武器：无杀伤性武器，随身携带一枚四宫本家配备的纳米级防身催泪香囊与高频求救信标。"
        ],
        "sourceFile": "世界书/114-四宫宁月.txt",
        "sourceSHA256": "7048df6e41bc5248c5253f73d2a177b0ae070e5c45a8210310213a8b01d88f3b",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_115",
      "name": "薇欧拉",
      "worldbookUid": 115,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 115
      },
      "growthInitial": {
        "level": 12,
        "xp": 13534,
        "attributes": {
          "body": 4,
          "reflexes": 7,
          "intelligence": 14,
          "technical": 10,
          "cool": 16
        },
        "attributePoints": 0,
        "perkPoints": 11,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_115_face",
            "name": "薇欧拉·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中间人特化型加密全息通讯总机芯片（可同时并发调度数十名外勤佣兵与黑客的链路）、微表情精准控制与泪腺激发模块、社会工程学大数据实时交叉检索义眼、非线性深伪（Deepfake）音视频剪辑协处理器。"
              }
            ],
            "description": "义体：中间人特化型加密全息通讯总机芯片（可同时并发调度数十名外勤佣兵与黑客的链路）、微表情精准控制与泪腺激发模块、社会工程学大数据实时交叉检索义眼、非线性深伪（Deepfake）音视频剪辑协处理器。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_115_lore_kit",
            "name": "薇欧拉·档案随身装备",
            "category": "text",
            "description": "义体：中间人特化型加密全息通讯总机芯片（可同时并发调度数十名外勤佣兵与黑客的链路）、微表情精准控制与泪腺激发模块、社会工程学大数据实时交叉检索义眼、非线性深伪（Deepfake）音视频剪辑协处理器。 武器：身为坐镇幕后的2077式中间人，她从不亲自拔枪上阵；她的武器是遍布辖区的监控眼线、装满黑料与悬赏金的加密芯片、随时停在暗巷接应的后备箱专车，以及一通电话就能叫来清场的职业雇佣兵。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Viola",
        "aliases": [
          "Viola"
        ],
        "form": "human",
        "san": 87,
        "rookie": false,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "中间人社会工程与加密调度",
        "loreEquipment": [
          "义体：中间人特化型加密全息通讯总机芯片（可同时并发调度数十名外勤佣兵与黑客的链路）、微表情精准控制与泪腺激发模块、社会工程学大数据实时交叉检索义眼、非线性深伪（Deepfake）音视频剪辑协处理器。",
          "武器：身为坐镇幕后的2077式中间人，她从不亲自拔枪上阵；她的武器是遍布辖区的监控眼线、装满黑料与悬赏金的加密芯片、随时停在暗巷接应的后备箱专车，以及一通电话就能叫来清场的职业雇佣兵。"
        ],
        "sourceFile": "世界书/115-薇欧拉.txt",
        "sourceSHA256": "1a95b1263a84fdf0ead027ed1b816d493ba974d8c570f5c6de42a75008d9f973",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_116",
      "name": "户山香澄",
      "worldbookUid": 116,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 116
      },
      "growthInitial": {
        "level": 14,
        "xp": 16699,
        "attributes": {
          "body": 3,
          "reflexes": 6,
          "intelligence": 12,
          "technical": 8,
          "cool": 14
        },
        "attributePoints": 0,
        "perkPoints": 13,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1,
          "Cool_Left_Perk_2_2": 1,
          "Cool_Left_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": []
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Kasumi",
        "aliases": [
          "香澄",
          "Kasumi",
          "ksm"
        ],
        "form": "engram",
        "san": 82,
        "rookie": false,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "寄宿芯片的原意识无物理躯体",
        "loreEquipment": [
          "义体：生前右臂为机械义肢，另装有基础乐手音频接口与轻度皮下防护；当前无物理躯体，作为原意识寄宿于弦卷原型生物芯片内（远期存在回归机偶躯体的探索方向）。",
          "武器：生前袭塔时使用大威力动能手枪与便携爆破物；战斗投影中也可显现长枪造型。"
        ],
        "sourceFile": "世界书/116-户山香澄.txt",
        "sourceSHA256": "02755598ea0e52f3ef52bd20d76f03ff71ea2e1733744d0f3181bf187d3cc438",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_117",
      "name": "花园多惠",
      "worldbookUid": 117,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 117
      },
      "growthInitial": {
        "level": 10,
        "xp": 10612,
        "attributes": {
          "body": 6,
          "reflexes": 10,
          "intelligence": 7,
          "technical": 7,
          "cool": 10
        },
        "attributePoints": 0,
        "perkPoints": 9,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_117_face",
            "name": "花园多惠·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。颈部至锁骨可见外露的分节式机械结构。装有长途驾驶与夜视所需的光学义眼滤镜、听觉保护与调音辅助模块，坚持保留原装双手神经与肌肉触感以弹奏吉他。"
              }
            ],
            "description": "义体：低植入率。颈部至锁骨可见外露的分节式机械结构。装有长途驾驶与夜视所需的光学义眼滤镜、听觉保护与调音辅助模块，坚持保留原装双手神经与肌肉触感以弹奏吉他。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_117_nervous",
            "name": "花园多惠·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。颈部至锁骨可见外露的分节式机械结构。装有长途驾驶与夜视所需的光学义眼滤镜、听觉保护与调音辅助模块，坚持保留原装双手神经与肌肉触感以弹奏吉他。"
              }
            ],
            "description": "义体：低植入率。颈部至锁骨可见外露的分节式机械结构。装有长途驾驶与夜视所需的光学义眼滤镜、听觉保护与调音辅助模块，坚持保留原装双手神经与肌肉触感以弹奏吉他。",
            "status": "installed"
          },
          {
            "template": "shotgun",
            "tier": 2,
            "name": "大口径双管猎枪",
            "status": "inventory",
            "description": "武器：大口径双管猎枪（平时收在宿营车驾驶座下方）、车载防暴照明弹。"
          },
          {
            "custom": true,
            "id": "npc_117_lore_kit",
            "name": "花园多惠·档案随身装备",
            "category": "text",
            "description": "义体：低植入率。颈部至锁骨可见外露的分节式机械结构。装有长途驾驶与夜视所需的光学义眼滤镜、听觉保护与调音辅助模块，坚持保留原装双手神经与肌肉触感以弹奏吉他。 武器：大口径双管猎枪（平时收在宿营车驾驶座下方）、车载防暴照明弹。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Tae",
        "aliases": [
          "多惠",
          "Tae",
          "おたえ"
        ],
        "form": "human",
        "san": 87,
        "rookie": false,
        "priority": [
          "reflexes",
          "cool",
          "intelligence",
          "technical",
          "body"
        ],
        "basis": "长途驾驶与纯原生演奏触感",
        "loreEquipment": [
          "义体：低植入率。颈部至锁骨可见外露的分节式机械结构。装有长途驾驶与夜视所需的光学义眼滤镜、听觉保护与调音辅助模块，坚持保留原装双手神经与肌肉触感以弹奏吉他。",
          "武器：大口径双管猎枪（平时收在宿营车驾驶座下方）、车载防暴照明弹。"
        ],
        "sourceFile": "世界书/117-花园多惠.txt",
        "sourceSHA256": "abe66c08347ef67ff916871fe66fdaa61f1f1c3a75335ef74807b6e548dd4e03",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_118",
      "name": "牛込里美",
      "worldbookUid": 118,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 118
      },
      "growthInitial": {
        "level": 10,
        "xp": 10612,
        "attributes": {
          "body": 4,
          "reflexes": 6,
          "intelligence": 13,
          "technical": 10,
          "cool": 9
        },
        "attributePoints": 0,
        "perkPoints": 9,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1,
          "Intelligence_Central_Perk_1_1": 1,
          "Intelligence_Central_Perk_1_2": 1,
          "Intelligence_Central_Perk_1_3": 1,
          "Intelligence_Right_Milestone_1": 1,
          "Intelligence_Left_Milestone_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_118_face",
            "name": "牛込里美·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。"
              }
            ],
            "description": "义体：低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_118_arms",
            "name": "牛込里美·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。"
              }
            ],
            "description": "义体：低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_118_legs",
            "name": "牛込里美·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。"
              }
            ],
            "description": "义体：低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_118_skin",
            "name": "牛込里美·档案防护装配",
            "category": "cyberware",
            "part": "skin",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。"
              },
              {
                "kind": "hpMax",
                "value": 8
              }
            ],
            "description": "义体：低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "高频电击器",
            "status": "equipped",
            "description": "武器：防身用高频电击器、隐蔽式催泪喷雾，以及档案室门禁连接的非致命声波震慑装置。"
          },
          {
            "custom": true,
            "id": "npc_118_lore_kit",
            "name": "牛込里美·档案随身装备",
            "category": "text",
            "description": "义体：低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。 武器：防身用高频电击器、隐蔽式催泪喷雾，以及档案室门禁连接的非致命声波震慑装置。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Rimi",
        "aliases": [
          "里美",
          "Rimi",
          "りみりん"
        ],
        "form": "human",
        "san": 85,
        "rookie": false,
        "priority": [
          "intelligence",
          "technical",
          "cool",
          "reflexes",
          "body"
        ],
        "basis": "档案修复考据与录证",
        "loreEquipment": [
          "义体：低植入率。装有高精度微距光学义眼（用于辨识篡改痕迹、微缩胶片与受损纸纤维）、听觉降噪与脑内速记模块。上臂与腿部有局部皮下植入体，上臂皮下可见细线状结构，膝部与小腿的植入结构在连裤袜下隐约显出轮廓。",
          "武器：防身用高频电击器、隐蔽式催泪喷雾，以及档案室门禁连接的非致命声波震慑装置。"
        ],
        "sourceFile": "世界书/118-牛込里美.txt",
        "sourceSHA256": "2ff8fb35853cc05fd365d927a3a414d71dea00ccb2829ade6b0129f12138b4e7",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_119",
      "name": "山吹沙绫",
      "worldbookUid": 119,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 119
      },
      "growthInitial": {
        "level": 13,
        "xp": 15085,
        "attributes": {
          "body": 9,
          "reflexes": 10,
          "intelligence": 10,
          "technical": 10,
          "cool": 13
        },
        "attributePoints": 0,
        "perkPoints": 12,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1,
          "Cool_Left_Perk_2_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_119_face",
            "name": "山吹沙绫·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。军用级加密通讯脑机模块、具备微表情与心率监测功能的光学义眼、双臂隐藏式反冲稳定器（兼顾烘焙揉面发力与重火器射击稳定性）。颈部与腰腹有外露的机械结构，左手为机械义肢。"
              }
            ],
            "description": "义体：中等植入率。军用级加密通讯脑机模块、具备微表情与心率监测功能的光学义眼、双臂隐藏式反冲稳定器（兼顾烘焙揉面发力与重火器射击稳定性）。颈部与腰腹有外露的机械结构，左手为机械义肢。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_119_arms",
            "name": "山吹沙绫·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。军用级加密通讯脑机模块、具备微表情与心率监测功能的光学义眼、双臂隐藏式反冲稳定器（兼顾烘焙揉面发力与重火器射击稳定性）。颈部与腰腹有外露的机械结构，左手为机械义肢。"
              }
            ],
            "description": "义体：中等植入率。军用级加密通讯脑机模块、具备微表情与心率监测功能的光学义眼、双臂隐藏式反冲稳定器（兼顾烘焙揉面发力与重火器射击稳定性）。颈部与腰腹有外露的机械结构，左手为机械义肢。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_119_nervous",
            "name": "山吹沙绫·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。军用级加密通讯脑机模块、具备微表情与心率监测功能的光学义眼、双臂隐藏式反冲稳定器（兼顾烘焙揉面发力与重火器射击稳定性）。颈部与腰腹有外露的机械结构，左手为机械义肢。"
              }
            ],
            "description": "义体：中等植入率。军用级加密通讯脑机模块、具备微表情与心率监测功能的光学义眼、双臂隐藏式反冲稳定器（兼顾烘焙揉面发力与重火器射击稳定性）。颈部与腰腹有外露的机械结构，左手为机械义肢。",
            "status": "installed"
          },
          {
            "template": "smg",
            "tier": 3,
            "name": "定制智能冲锋枪",
            "status": "inventory",
            "description": "武器：定制款智能冲锋枪与大口径左轮手枪（平时锁在「来生」专座暗格与面包房货车夹层内）。"
          },
          {
            "template": "pistol",
            "tier": 3,
            "name": "大口径左轮手枪",
            "status": "inventory",
            "description": "武器：定制款智能冲锋枪与大口径左轮手枪（平时锁在「来生」专座暗格与面包房货车夹层内）。"
          },
          {
            "custom": true,
            "id": "npc_119_lore_kit",
            "name": "山吹沙绫·档案随身装备",
            "category": "text",
            "description": "义体：中等植入率。军用级加密通讯脑机模块、具备微表情与心率监测功能的光学义眼、双臂隐藏式反冲稳定器（兼顾烘焙揉面发力与重火器射击稳定性）。颈部与腰腹有外露的机械结构，左手为机械义肢。 武器：定制款智能冲锋枪与大口径左轮手枪（平时锁在「来生」专座暗格与面包房货车夹层内）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Saya",
        "aliases": [
          "沙绫",
          "Saya",
          "Saaya"
        ],
        "form": "human",
        "san": 87,
        "rookie": false,
        "priority": [
          "cool",
          "reflexes",
          "intelligence",
          "technical",
          "body"
        ],
        "basis": "加密通讯与重火器稳定",
        "loreEquipment": [
          "义体：中等植入率。军用级加密通讯脑机模块、具备微表情与心率监测功能的光学义眼、双臂隐藏式反冲稳定器（兼顾烘焙揉面发力与重火器射击稳定性）。颈部与腰腹有外露的机械结构，左手为机械义肢。",
          "武器：定制款智能冲锋枪与大口径左轮手枪（平时锁在「来生」专座暗格与面包房货车夹层内）。"
        ],
        "sourceFile": "世界书/119-山吹沙绫.txt",
        "sourceSHA256": "8fda6719f8e4db1a85db4b54d703bb829da77f5004eafbaf9d43c478888bb525",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_120",
      "name": "市谷有咲",
      "worldbookUid": 120,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 120
      },
      "growthInitial": {
        "level": 18,
        "xp": 23839,
        "attributes": {
          "body": 3,
          "reflexes": 12,
          "intelligence": 19,
          "technical": 17,
          "cool": 14
        },
        "attributePoints": 0,
        "perkPoints": 17,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1,
          "Intelligence_Central_Perk_1_1": 1,
          "Intelligence_Central_Perk_1_2": 1,
          "Intelligence_Central_Perk_1_3": 1,
          "Intelligence_Right_Milestone_1": 1,
          "Intelligence_Left_Milestone_2": 2,
          "Intelligence_Left_Perk_2_1": 1,
          "Intelligence_Left_Perk_2_2": 1,
          "Intelligence_Left_Perk_2_3": 1,
          "Intelligence_Left_Perk_2_4": 1,
          "Intelligence_Central_Milestone_2": 2,
          "Intelligence_Central_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": []
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Arisa",
        "aliases": [
          "有咲",
          "Arisa",
          "ありさ"
        ],
        "form": "digital",
        "san": 88,
        "rookie": false,
        "priority": [
          "intelligence",
          "technical",
          "cool",
          "reflexes",
          "body"
        ],
        "basis": "自由数字意识与黑墙链路",
        "loreEquipment": [
          "义体／存在形态：自由数字意识，无物理肉身与常规义体限制；可通过黑墙裂隙、受控终端或生物芯片视听链路投射形象。",
          "武器：黑墙级攻防协议、逻辑炸弹、神经链路熔断程序与大规模数据解密算力。"
        ],
        "sourceFile": "世界书/120-市谷有咲.txt",
        "sourceSHA256": "b3d756756e8fdf934c307b7a59973fa9e2e3dce17b85f115435372548459b670",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_121",
      "name": "美竹兰",
      "worldbookUid": 121,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 121
      },
      "growthInitial": {
        "level": 14,
        "xp": 16699,
        "attributes": {
          "body": 10,
          "reflexes": 13,
          "intelligence": 8,
          "technical": 8,
          "cool": 14
        },
        "attributePoints": 0,
        "perkPoints": 13,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1,
          "Cool_Left_Perk_2_2": 1,
          "Cool_Left_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_121_face",
            "name": "美竹兰·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "双腿为带仿生肤色覆盖的机械义肢，膝部关节与腿部接缝可见。另装有加密街区通讯模块、防闪光与夜视光学义眼（因讨厌多余的数据弹窗遮挡真实夕阳与街景，日常非战斗时常年锁死在低功耗纯净模式）、腕部微距发力稳定器（兼顾花道剪枝与拔刀射击）。"
              }
            ],
            "description": "义体：双腿为带仿生肤色覆盖的机械义肢，膝部关节与腿部接缝可见。另装有加密街区通讯模块、防闪光与夜视光学义眼（因讨厌多余的数据弹窗遮挡真实夕阳与街景，日常非战斗时常年锁死在低功耗纯净模式）、腕部微距发力稳定器（兼顾花道剪枝与拔刀射击）。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_121_legs",
            "name": "美竹兰·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "双腿为带仿生肤色覆盖的机械义肢，膝部关节与腿部接缝可见。另装有加密街区通讯模块、防闪光与夜视光学义眼（因讨厌多余的数据弹窗遮挡真实夕阳与街景，日常非战斗时常年锁死在低功耗纯净模式）、腕部微距发力稳定器（兼顾花道剪枝与拔刀射击）。"
              }
            ],
            "description": "义体：双腿为带仿生肤色覆盖的机械义肢，膝部关节与腿部接缝可见。另装有加密街区通讯模块、防闪光与夜视光学义眼（因讨厌多余的数据弹窗遮挡真实夕阳与街景，日常非战斗时常年锁死在低功耗纯净模式）、腕部微距发力稳定器（兼顾花道剪枝与拔刀射击）。",
            "status": "installed"
          },
          {
            "template": "blade",
            "tier": 2,
            "name": "高频振刀短胁差",
            "status": "equipped",
            "description": "武器：美竹家传改制的高频振刀短胁差、大口径动能手枪。"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "大口径动能手枪",
            "status": "equipped",
            "description": "武器：美竹家传改制的高频振刀短胁差、大口径动能手枪。"
          },
          {
            "custom": true,
            "id": "npc_121_lore_kit",
            "name": "美竹兰·档案随身装备",
            "category": "text",
            "description": "义体：双腿为带仿生肤色覆盖的机械义肢，膝部关节与腿部接缝可见。另装有加密街区通讯模块、防闪光与夜视光学义眼（因讨厌多余的数据弹窗遮挡真实夕阳与街景，日常非战斗时常年锁死在低功耗纯净模式）、腕部微距发力稳定器（兼顾花道剪枝与拔刀射击）。 武器：美竹家传改制的高频振刀短胁差、大口径动能手枪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Ran",
        "aliases": [
          "兰",
          "Ran"
        ],
        "form": "human",
        "san": 86,
        "rookie": false,
        "priority": [
          "cool",
          "reflexes",
          "body",
          "intelligence",
          "technical"
        ],
        "basis": "街头刀术近射与中间人经验",
        "loreEquipment": [
          "义体：双腿为带仿生肤色覆盖的机械义肢，膝部关节与腿部接缝可见。另装有加密街区通讯模块、防闪光与夜视光学义眼（因讨厌多余的数据弹窗遮挡真实夕阳与街景，日常非战斗时常年锁死在低功耗纯净模式）、腕部微距发力稳定器（兼顾花道剪枝与拔刀射击）。",
          "武器：美竹家传改制的高频振刀短胁差、大口径动能手枪。"
        ],
        "sourceFile": "世界书/121-美竹兰.txt",
        "sourceSHA256": "0e876c511ae5b0b0784c77d37cf190ccc412a0852572f1e53bbeedfbdc4e3dab",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_122",
      "name": "青叶摩卡",
      "worldbookUid": 122,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 122
      },
      "growthInitial": {
        "level": 13,
        "xp": 15085,
        "attributes": {
          "body": 13,
          "reflexes": 10,
          "intelligence": 9,
          "technical": 8,
          "cool": 10
        },
        "attributePoints": 0,
        "perkPoints": 12,
        "perks": {
          "Body_Central_Milestone_1": 1,
          "Body_Central_Perk_1_1": 1,
          "Body_Central_Perk_1_2": 1,
          "Body_Central_Perk_1_3": 1,
          "Body_Central_Perk_1_4": 1,
          "Body_Right_Milestone_1": 1,
          "Body_Left_Milestone_2": 2,
          "Body_Left_Perk_2_1": 1,
          "Body_Left_Perk_2_3": 1,
          "Body_Left_Perk_2_4": 1,
          "Body_Right_Milestone_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_122_arms",
            "name": "青叶摩卡·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "双臂为大尺寸力量型机械义肢，肩部关节与传动结构外露，具有强大的负重、抓握与近身打击能力。机械手指保留弹奏吉他所需的精细控制。"
              }
            ],
            "description": "义体：双臂为大尺寸力量型机械义肢，肩部关节与传动结构外露，具有强大的负重、抓握与近身打击能力。机械手指保留弹奏吉他所需的精细控制。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_122_lore_kit",
            "name": "青叶摩卡·档案随身装备",
            "category": "text",
            "description": "义体：双臂为大尺寸力量型机械义肢，肩部关节与传动结构外露，具有强大的负重、抓握与近身打击能力。机械手指保留弹奏吉他所需的精细控制。 武器：力量型机械臂，可直接用于强力格挡、擒制与近身重击；随身另备有巴配制的强效神经镇静喷雾与紧急呼救信标。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          },
          {
            "custom": true,
            "id": "npc_122_sedative",
            "name": "强效神经镇静喷雾",
            "category": "text",
            "description": "档案记载由宇田川巴配制的神经镇静剂；使用时实际消耗一份，按SAN疗程恢复。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Moka",
        "aliases": [
          "摩卡",
          "Moca",
          "Moka",
          "摩卡酱"
        ],
        "form": "human",
        "san": 18,
        "rookie": false,
        "priority": [
          "body",
          "reflexes",
          "cool",
          "intelligence",
          "technical"
        ],
        "basis": "明确赛博精神病早期与机械臂",
        "loreEquipment": [
          "义体：双臂为大尺寸力量型机械义肢，肩部关节与传动结构外露，具有强大的负重、抓握与近身打击能力。机械手指保留弹奏吉他所需的精细控制。",
          "武器：力量型机械臂，可直接用于强力格挡、擒制与近身重击；随身另备有巴配制的强效神经镇静喷雾与紧急呼救信标。"
        ],
        "sourceFile": "世界书/122-青叶摩卡.txt",
        "sourceSHA256": "71503f4d939b7c6afb78d04974d3b24548b2968d68d62afad9e1ff2fae9150b3",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_123",
      "name": "上原绯玛丽",
      "worldbookUid": 123,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 123
      },
      "growthInitial": {
        "level": 10,
        "xp": 10612,
        "attributes": {
          "body": 6,
          "reflexes": 7,
          "intelligence": 10,
          "technical": 9,
          "cool": 11
        },
        "attributePoints": 0,
        "perkPoints": 9,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_123_face",
            "name": "上原绯玛丽·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "双腿为带仿生肤色覆盖的机械义肢，膝部与小腿保留可见的关节和分段结构。另装有多频段民用/医疗急救通讯模块、内置电子账目与生命体征速览的光学义眼。"
              }
            ],
            "description": "义体：双腿为带仿生肤色覆盖的机械义肢，膝部与小腿保留可见的关节和分段结构。另装有多频段民用/医疗急救通讯模块、内置电子账目与生命体征速览的光学义眼。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_123_legs",
            "name": "上原绯玛丽·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "双腿为带仿生肤色覆盖的机械义肢，膝部与小腿保留可见的关节和分段结构。另装有多频段民用/医疗急救通讯模块、内置电子账目与生命体征速览的光学义眼。"
              }
            ],
            "description": "义体：双腿为带仿生肤色覆盖的机械义肢，膝部与小腿保留可见的关节和分段结构。另装有多频段民用/医疗急救通讯模块、内置电子账目与生命体征速览的光学义眼。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "高压电击防狼器",
            "status": "equipped",
            "description": "武器：防身用强光致盲手电、高压电击防狼器。"
          },
          {
            "custom": true,
            "id": "npc_123_lore_kit",
            "name": "上原绯玛丽·档案随身装备",
            "category": "text",
            "description": "义体：双腿为带仿生肤色覆盖的机械义肢，膝部与小腿保留可见的关节和分段结构。另装有多频段民用/医疗急救通讯模块、内置电子账目与生命体征速览的光学义眼。 武器：防身用强光致盲手电、高压电击防狼器。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Himari",
        "aliases": [
          "绯玛丽",
          "Himari"
        ],
        "form": "human",
        "san": 87,
        "rookie": false,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "救援转运与医疗后勤",
        "loreEquipment": [
          "义体：双腿为带仿生肤色覆盖的机械义肢，膝部与小腿保留可见的关节和分段结构。另装有多频段民用/医疗急救通讯模块、内置电子账目与生命体征速览的光学义眼。",
          "武器：防身用强光致盲手电、高压电击防狼器。"
        ],
        "sourceFile": "世界书/123-上原绯玛丽.txt",
        "sourceSHA256": "0ddd8cdac584656fdbb4f9cdccbf6876fe40c8cdd4b5cacf8b299b482ce89f35",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_124",
      "name": "宇田川巴",
      "worldbookUid": 124,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 124
      },
      "growthInitial": {
        "level": 15,
        "xp": 18379,
        "attributes": {
          "body": 11,
          "reflexes": 11,
          "intelligence": 12,
          "technical": 16,
          "cool": 13
        },
        "attributePoints": 0,
        "perkPoints": 14,
        "perks": {
          "Tech_Left_Milestone_1": 1,
          "Tech_Left_Perk_1_1": 1,
          "Tech_Left_Perk_1_2": 1,
          "Tech_Right_Milestone_1": 1,
          "Tech_Left_Milestone_2": 2,
          "Tech_Left_Perk_2_1": 1,
          "Tech_Left_Perk_2_2": 1,
          "Tech_Left_Perk_2_3": 1,
          "Tech_Left_Perk_2_4": 1,
          "Tech_Central_Milestone_2": 2,
          "Tech_Central_Perk_2_1": 1,
          "Tech_Central_Perk_2_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_124_face",
            "name": "宇田川巴·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。医疗级高倍率多光谱义眼（支持神经突触微血管成像与义体固件故障扫描）、手部精密显微外科稳定义肢模块（保留真实皮肤触感与温控）；另配备背负式多关节医疗辅助机械臂，用于夹持器械、固定操作对象与协助搬运伤员。"
              }
            ],
            "description": "义体：中等植入率。医疗级高倍率多光谱义眼（支持神经突触微血管成像与义体固件故障扫描）、手部精密显微外科稳定义肢模块（保留真实皮肤触感与温控）；另配备背负式多关节医疗辅助机械臂，用于夹持器械、固定操作对象与协助搬运伤员。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_124_arms",
            "name": "宇田川巴·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。医疗级高倍率多光谱义眼（支持神经突触微血管成像与义体固件故障扫描）、手部精密显微外科稳定义肢模块（保留真实皮肤触感与温控）；另配备背负式多关节医疗辅助机械臂，用于夹持器械、固定操作对象与协助搬运伤员。"
              }
            ],
            "description": "义体：中等植入率。医疗级高倍率多光谱义眼（支持神经突触微血管成像与义体固件故障扫描）、手部精密显微外科稳定义肢模块（保留真实皮肤触感与温控）；另配备背负式多关节医疗辅助机械臂，用于夹持器械、固定操作对象与协助搬运伤员。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_124_nervous",
            "name": "宇田川巴·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。医疗级高倍率多光谱义眼（支持神经突触微血管成像与义体固件故障扫描）、手部精密显微外科稳定义肢模块（保留真实皮肤触感与温控）；另配备背负式多关节医疗辅助机械臂，用于夹持器械、固定操作对象与协助搬运伤员。"
              }
            ],
            "description": "义体：中等植入率。医疗级高倍率多光谱义眼（支持神经突触微血管成像与义体固件故障扫描）、手部精密显微外科稳定义肢模块（保留真实皮肤触感与温控）；另配备背负式多关节医疗辅助机械臂，用于夹持器械、固定操作对象与协助搬运伤员。",
            "status": "installed"
          },
          {
            "template": "shotgun",
            "tier": 2,
            "name": "大威力泵动式霰弹枪",
            "status": "inventory",
            "description": "武器：大威力泵动式霰弹枪（藏于诊所分诊台下方）、随身携带的一对特制高密度实心金属鼓棒（兼作近身格斗短棍）、医用高频激光手术刀、强效神经麻痹注射枪。"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "特制高密度实心金属鼓棒",
            "status": "equipped",
            "description": "武器：大威力泵动式霰弹枪（藏于诊所分诊台下方）、随身携带的一对特制高密度实心金属鼓棒（兼作近身格斗短棍）、医用高频激光手术刀、强效神经麻痹注射枪。"
          },
          {
            "custom": true,
            "id": "npc_124_lore_kit",
            "name": "宇田川巴·档案随身装备",
            "category": "text",
            "description": "义体：中等植入率。医疗级高倍率多光谱义眼（支持神经突触微血管成像与义体固件故障扫描）、手部精密显微外科稳定义肢模块（保留真实皮肤触感与温控）；另配备背负式多关节医疗辅助机械臂，用于夹持器械、固定操作对象与协助搬运伤员。 武器：大威力泵动式霰弹枪（藏于诊所分诊台下方）、随身携带的一对特制高密度实心金属鼓棒（兼作近身格斗短棍）、医用高频激光手术刀、强效神经麻痹注射枪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Tomoe",
        "aliases": [
          "巴",
          "Tomoe",
          "巴医生"
        ],
        "form": "human",
        "san": 88,
        "rookie": false,
        "priority": [
          "technical",
          "cool",
          "intelligence",
          "body",
          "reflexes"
        ],
        "basis": "义体外科与诊所防卫",
        "loreEquipment": [
          "义体：中等植入率。医疗级高倍率多光谱义眼（支持神经突触微血管成像与义体固件故障扫描）、手部精密显微外科稳定义肢模块（保留真实皮肤触感与温控）；另配备背负式多关节医疗辅助机械臂，用于夹持器械、固定操作对象与协助搬运伤员。",
          "武器：大威力泵动式霰弹枪（藏于诊所分诊台下方）、随身携带的一对特制高密度实心金属鼓棒（兼作近身格斗短棍）、医用高频激光手术刀、强效神经麻痹注射枪。"
        ],
        "sourceFile": "世界书/124-宇田川巴.txt",
        "sourceSHA256": "941b8ba093cb433ee13b62d942f01df91bb99d44bd2c068287f7bab6bc79d18a",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_125",
      "name": "羽泽鸫",
      "worldbookUid": 125,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 125
      },
      "growthInitial": {
        "level": 9,
        "xp": 9236,
        "attributes": {
          "body": 5,
          "reflexes": 6,
          "intelligence": 9,
          "technical": 7,
          "cool": 11
        },
        "attributePoints": 0,
        "perkPoints": 8,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_125_nervous",
            "name": "羽泽鸫·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "极低植入率。装有店铺账务管理与环境温湿度/噪音监测的民用辅助模块，以及配套无人机械的控制接口；坚持用纯天然的双手揉面、烘焙与冲煮咖啡。"
              }
            ],
            "description": "义体：极低植入率。装有店铺账务管理与环境温湿度/噪音监测的民用辅助模块，以及配套无人机械的控制接口；坚持用纯天然的双手揉面、烘焙与冲煮咖啡。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_125_lore_kit",
            "name": "羽泽鸫·档案随身装备",
            "category": "text",
            "description": "义体：极低植入率。装有店铺账务管理与环境温湿度/噪音监测的民用辅助模块，以及配套无人机械的控制接口；坚持用纯天然的双手揉面、烘焙与冲煮咖啡。 武器：无战斗武器（吧台下方装有直连美竹花铺与隔壁巴诊所的一键静音警报器，手边最趁手的防身物是沉甸甸的铸铁磨豆机与滚烫的蒸汽奶泡枪）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Tsugumi",
        "aliases": [
          "鸫",
          "Tsugumi",
          "鸫鸫"
        ],
        "form": "human",
        "san": 88,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "店铺运营与极低植入后勤",
        "loreEquipment": [
          "义体：极低植入率。装有店铺账务管理与环境温湿度/噪音监测的民用辅助模块，以及配套无人机械的控制接口；坚持用纯天然的双手揉面、烘焙与冲煮咖啡。",
          "武器：无战斗武器（吧台下方装有直连美竹花铺与隔壁巴诊所的一键静音警报器，手边最趁手的防身物是沉甸甸的铸铁磨豆机与滚烫的蒸汽奶泡枪）。"
        ],
        "sourceFile": "世界书/125-羽泽鸫.txt",
        "sourceSHA256": "5dbdaa5b2845a4c06928e1776cbaf7fa5187bc7f5365e19d795700f7811e804a",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_126",
      "name": "弦卷心",
      "worldbookUid": 126,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 126
      },
      "growthInitial": {
        "level": 11,
        "xp": 12044,
        "attributes": {
          "body": 7,
          "reflexes": 15,
          "intelligence": 9,
          "technical": 7,
          "cool": 11
        },
        "attributePoints": 0,
        "perkPoints": 10,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1,
          "Reflexes_Left_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_126_nervous",
            "name": "弦卷心·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率，但配备世界最顶尖的生物定制防护。装有微米级皮下防弹阻尼层、直接调遣私人“黑衣人”卫队与美咲所驾特装重型人形机甲战术链路的最高权限脑机信标。"
              }
            ],
            "description": "义体：低植入率，但配备世界最顶尖的生物定制防护。装有微米级皮下防弹阻尼层、直接调遣私人“黑衣人”卫队与美咲所驾特装重型人形机甲战术链路的最高权限脑机信标。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_126_skin",
            "name": "弦卷心·档案防护装配",
            "category": "cyberware",
            "part": "skin",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率，但配备世界最顶尖的生物定制防护。装有微米级皮下防弹阻尼层、直接调遣私人“黑衣人”卫队与美咲所驾特装重型人形机甲战术链路的最高权限脑机信标。"
              },
              {
                "kind": "hpMax",
                "value": 8
              }
            ],
            "description": "义体：低植入率，但配备世界最顶尖的生物定制防护。装有微米级皮下防弹阻尼层、直接调遣私人“黑衣人”卫队与美咲所驾特装重型人形机甲战术链路的最高权限脑机信标。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_126_lore_kit",
            "name": "弦卷心·档案随身装备",
            "category": "text",
            "description": "义体：低植入率，但配备世界最顶尖的生物定制防护。装有微米级皮下防弹阻尼层、直接调遣私人“黑衣人”卫队与美咲所驾特装重型人形机甲战术链路的最高权限脑机信标。 武器：本人极少亲自持枪，随身仅携带非致命强光炫目胸针与高空索降钩爪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Kokoro",
        "aliases": [
          "心",
          "Kokoro"
        ],
        "form": "human",
        "san": 90,
        "rookie": true,
        "priority": [
          "reflexes",
          "cool",
          "intelligence",
          "body",
          "technical"
        ],
        "basis": "体操直觉与顶尖防护非重武装",
        "loreEquipment": [
          "义体：低植入率，但配备世界最顶尖的生物定制防护。装有微米级皮下防弹阻尼层、直接调遣私人“黑衣人”卫队与美咲所驾特装重型人形机甲战术链路的最高权限脑机信标。",
          "武器：本人极少亲自持枪，随身仅携带非致命强光炫目胸针与高空索降钩爪。"
        ],
        "sourceFile": "世界书/126-弦卷心.txt",
        "sourceSHA256": "38c1bdad7501fb5738968811b3f467085fdb3c659504e21f8da5d5908d1b1cbe",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_127",
      "name": "濑田薰",
      "worldbookUid": 127,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 127
      },
      "growthInitial": {
        "level": 11,
        "xp": 12044,
        "attributes": {
          "body": 6,
          "reflexes": 13,
          "intelligence": 8,
          "technical": 7,
          "cool": 12
        },
        "attributePoints": 0,
        "perkPoints": 10,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1,
          "Reflexes_Left_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_127_face",
            "name": "濑田薰·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。仅装有舞台追光自适应视觉滤镜、剧场级远距离声场共鸣辅助模块与体态平衡微调器。"
              }
            ],
            "description": "义体：低植入率。仅装有舞台追光自适应视觉滤镜、剧场级远距离声场共鸣辅助模块与体态平衡微调器。",
            "status": "installed"
          },
          {
            "template": "blade",
            "tier": 2,
            "name": "改制高频电击刺剑",
            "status": "equipped",
            "description": "武器：舞台西洋击剑用改制高频电击刺剑（平时作为剧团道具携带）、定制闪光烟雾玫瑰。"
          },
          {
            "custom": true,
            "id": "npc_127_lore_kit",
            "name": "濑田薰·档案随身装备",
            "category": "text",
            "description": "义体：低植入率。仅装有舞台追光自适应视觉滤镜、剧场级远距离声场共鸣辅助模块与体态平衡微调器。 武器：舞台西洋击剑用改制高频电击刺剑（平时作为剧团道具携带）、定制闪光烟雾玫瑰。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Kaoru",
        "aliases": [
          "薰",
          "Kaoru"
        ],
        "form": "human",
        "san": 86,
        "rookie": true,
        "priority": [
          "reflexes",
          "cool",
          "intelligence",
          "technical",
          "body"
        ],
        "basis": "舞台击剑与体态平衡",
        "loreEquipment": [
          "义体：低植入率。仅装有舞台追光自适应视觉滤镜、剧场级远距离声场共鸣辅助模块与体态平衡微调器。",
          "武器：舞台西洋击剑用改制高频电击刺剑（平时作为剧团道具携带）、定制闪光烟雾玫瑰。"
        ],
        "sourceFile": "世界书/127-濑田薰.txt",
        "sourceSHA256": "4b40b76ca2f19e79746b2a9b6170c182c6e9e62f1476fc2aac72d550e61f8c11",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_128",
      "name": "北泽育美",
      "worldbookUid": 128,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 128
      },
      "growthInitial": {
        "level": 12,
        "xp": 13534,
        "attributes": {
          "body": 15,
          "reflexes": 12,
          "intelligence": 5,
          "technical": 6,
          "cool": 10
        },
        "attributePoints": 0,
        "perkPoints": 11,
        "perks": {
          "Body_Central_Milestone_1": 1,
          "Body_Central_Perk_1_1": 1,
          "Body_Central_Perk_1_2": 1,
          "Body_Central_Perk_1_3": 1,
          "Body_Central_Perk_1_4": 1,
          "Body_Right_Milestone_1": 1,
          "Body_Left_Milestone_2": 2,
          "Body_Left_Perk_2_1": 1,
          "Body_Left_Perk_2_3": 1,
          "Body_Left_Perk_2_4": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "template": "blunt",
            "tier": 2,
            "name": "高密度合金垒球棒",
            "status": "equipped",
            "description": "武器：实心高密度合金定制垒球棒、北泽家传斩骨大菜刀、特制高爆胡椒粉投掷球（按王牌投手球速掷出，百发百中）。"
          },
          {
            "template": "blade",
            "tier": 2,
            "name": "家传斩骨大菜刀",
            "status": "equipped",
            "description": "武器：实心高密度合金定制垒球棒、北泽家传斩骨大菜刀、特制高爆胡椒粉投掷球（按王牌投手球速掷出，百发百中）。"
          },
          {
            "custom": true,
            "id": "npc_128_lore_kit",
            "name": "北泽育美·档案随身装备",
            "category": "text",
            "description": "义体：低植入率。仅装有搬运重物与高速挥棒护腕关联的肌腱强化缓冲垫，全身肌肉力量几乎全靠常年跑动、剁肉与垒球训练练成。 武器：实心高密度合金定制垒球棒、北泽家传斩骨大菜刀、特制高爆胡椒粉投掷球（按王牌投手球速掷出，百发百中）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Hagumi",
        "aliases": [
          "育美",
          "Hagumi"
        ],
        "form": "human",
        "san": 88,
        "rookie": true,
        "priority": [
          "body",
          "reflexes",
          "cool",
          "technical",
          "intelligence"
        ],
        "basis": "原生肌力与王牌投掷",
        "loreEquipment": [
          "义体：低植入率。仅装有搬运重物与高速挥棒护腕关联的肌腱强化缓冲垫，全身肌肉力量几乎全靠常年跑动、剁肉与垒球训练练成。",
          "武器：实心高密度合金定制垒球棒、北泽家传斩骨大菜刀、特制高爆胡椒粉投掷球（按王牌投手球速掷出，百发百中）。"
        ],
        "sourceFile": "世界书/128-北泽育美.txt",
        "sourceSHA256": "614aa4f0023b28b669031d3bebf91ce3411cd295f25bf95313025d5a56eabc49",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_129",
      "name": "松原花音",
      "worldbookUid": 129,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 129
      },
      "growthInitial": {
        "level": 9,
        "xp": 9236,
        "attributes": {
          "body": 4,
          "reflexes": 5,
          "intelligence": 9,
          "technical": 6,
          "cool": 10
        },
        "attributePoints": 0,
        "perkPoints": 8,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_129_face",
            "name": "松原花音·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "极低植入率。仅装有水质与生物微生态监测义眼滤镜，以及一套特意为她安装了三重防迷路语音提示、却还是经常被她走神忽略的民用导航模块。"
              }
            ],
            "description": "义体：极低植入率。仅装有水质与生物微生态监测义眼滤镜，以及一套特意为她安装了三重防迷路语音提示、却还是经常被她走神忽略的民用导航模块。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_129_lore_kit",
            "name": "松原花音·档案随身装备",
            "category": "text",
            "description": "义体：极低植入率。仅装有水质与生物微生态监测义眼滤镜，以及一套特意为她安装了三重防迷路语音提示、却还是经常被她走神忽略的民用导航模块。 武器：无攻击性武器（随身仅备有从前在水族馆工作时使用的强光防水手电与防身警报器）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Kanon",
        "aliases": [
          "花音",
          "Kanon"
        ],
        "form": "human",
        "san": 87,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "生态监测与非战斗应对",
        "loreEquipment": [
          "义体：极低植入率。仅装有水质与生物微生态监测义眼滤镜，以及一套特意为她安装了三重防迷路语音提示、却还是经常被她走神忽略的民用导航模块。",
          "武器：无攻击性武器（随身仅备有从前在水族馆工作时使用的强光防水手电与防身警报器）。"
        ],
        "sourceFile": "世界书/129-松原花音.txt",
        "sourceSHA256": "200ae90fc6962d5568bd6f2a022a340399b9cce69a5acef07091ea018c779764",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_130",
      "name": "奥泽美咲",
      "worldbookUid": 130,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 130
      },
      "growthInitial": {
        "level": 16,
        "xp": 20127,
        "attributes": {
          "body": 10,
          "reflexes": 13,
          "intelligence": 10,
          "technical": 14,
          "cool": 13
        },
        "attributePoints": 0,
        "perkPoints": 15,
        "perks": {
          "Tech_Left_Milestone_1": 1,
          "Tech_Left_Perk_1_1": 1,
          "Tech_Left_Perk_1_2": 1,
          "Tech_Right_Milestone_1": 1,
          "Tech_Left_Milestone_2": 2,
          "Tech_Left_Perk_2_1": 1,
          "Tech_Left_Perk_2_2": 1,
          "Tech_Left_Perk_2_3": 1,
          "Tech_Left_Perk_2_4": 1,
          "Tech_Central_Milestone_2": 2,
          "Tech_Central_Perk_2_1": 1,
          "Tech_Central_Perk_2_2": 1,
          "Tech_Central_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_130_face",
            "name": "奥泽美咲·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "高规格机甲驾驶员植入。装有重装外骨骼与人形机甲全身运动神经同步桥接端口、抗高G力前庭平衡稳压器、多目标战术火控义眼。"
              }
            ],
            "description": "义体：高规格机甲驾驶员植入。装有重装外骨骼与人形机甲全身运动神经同步桥接端口、抗高G力前庭平衡稳压器、多目标战术火控义眼。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_130_nervous",
            "name": "奥泽美咲·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "高规格机甲驾驶员植入。装有重装外骨骼与人形机甲全身运动神经同步桥接端口、抗高G力前庭平衡稳压器、多目标战术火控义眼。"
              }
            ],
            "description": "义体：高规格机甲驾驶员植入。装有重装外骨骼与人形机甲全身运动神经同步桥接端口、抗高G力前庭平衡稳压器、多目标战术火控义眼。",
            "status": "installed"
          },
          {
            "template": "pistol",
            "tier": 3,
            "name": "消音冲锋手枪",
            "status": "equipped",
            "description": "武器：日常贴身防卫使用消音冲锋手枪与战术电击刃；重装出击时驾驶弦卷特装重型人形机甲（高约2.2米的重装人形作战机甲，采用咬合式钛合金复合装甲板、背部与足底高功率矢量喷口、暗红光学战术面罩，搭载臂载双联装机炮、折叠式重型液压震荡拳套、微型破片榴弹巢与战术EMP立场发生器）。"
          },
          {
            "template": "blade",
            "tier": 3,
            "name": "战术电击刃",
            "status": "equipped",
            "description": "武器：日常贴身防卫使用消音冲锋手枪与战术电击刃；重装出击时驾驶弦卷特装重型人形机甲（高约2.2米的重装人形作战机甲，采用咬合式钛合金复合装甲板、背部与足底高功率矢量喷口、暗红光学战术面罩，搭载臂载双联装机炮、折叠式重型液压震荡拳套、微型破片榴弹巢与战术EMP立场发生器）。"
          },
          {
            "custom": true,
            "id": "npc_130_lore_kit",
            "name": "奥泽美咲·档案随身装备",
            "category": "text",
            "description": "义体：高规格机甲驾驶员植入。装有重装外骨骼与人形机甲全身运动神经同步桥接端口、抗高G力前庭平衡稳压器、多目标战术火控义眼。 武器：日常贴身防卫使用消音冲锋手枪与战术电击刃；重装出击时驾驶弦卷特装重型人形机甲（高约2.2米的重装人形作战机甲，采用咬合式钛合金复合装甲板、背部与足底高功率矢量喷口、暗红光学战术面罩，搭载臂载双联装机炮、折叠式重型液压震荡拳套、微型破片榴弹巢与战术EMP立场发生器）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Misaki",
        "aliases": [
          "美咲",
          "Misaki",
          "米歇尔",
          "ミッシェル",
          "Michelle"
        ],
        "form": "human",
        "san": 85,
        "rookie": false,
        "priority": [
          "technical",
          "reflexes",
          "cool",
          "body",
          "intelligence"
        ],
        "basis": "机甲同步与火控驾驶",
        "loreEquipment": [
          "义体：高规格机甲驾驶员植入。装有重装外骨骼与人形机甲全身运动神经同步桥接端口、抗高G力前庭平衡稳压器、多目标战术火控义眼。",
          "武器：日常贴身防卫使用消音冲锋手枪与战术电击刃；重装出击时驾驶弦卷特装重型人形机甲（高约2.2米的重装人形作战机甲，采用咬合式钛合金复合装甲板、背部与足底高功率矢量喷口、暗红光学战术面罩，搭载臂载双联装机炮、折叠式重型液压震荡拳套、微型破片榴弹巢与战术EMP立场发生器）。"
        ],
        "sourceFile": "世界书/130-奥泽美咲.txt",
        "sourceSHA256": "e093a01e0c4573058c0d9699f524abd6b03d81717787b6156e991a6fe5be93c2",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_131",
      "name": "丸山彩",
      "worldbookUid": 131,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 131
      },
      "growthInitial": {
        "level": 10,
        "xp": 10612,
        "attributes": {
          "body": 4,
          "reflexes": 8,
          "intelligence": 10,
          "technical": 13,
          "cool": 9
        },
        "attributePoints": 0,
        "perkPoints": 9,
        "perks": {
          "Tech_Left_Milestone_1": 1,
          "Tech_Left_Perk_1_1": 1,
          "Tech_Left_Perk_1_2": 1,
          "Tech_Right_Milestone_1": 1,
          "Tech_Left_Milestone_2": 2,
          "Tech_Left_Perk_2_1": 1,
          "Tech_Left_Perk_2_2": 1,
          "Tech_Left_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_131_face",
            "name": "丸山彩·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。装有高精度微操稳定神经回路（防止紧张手抖影响显微缝合）、多频段义体固件故障诊断义眼。双手为精密机械义肢，指节与手背可见分节金属结构。"
              }
            ],
            "description": "义体：中等植入率。装有高精度微操稳定神经回路（防止紧张手抖影响显微缝合）、多频段义体固件故障诊断义眼。双手为精密机械义肢，指节与手背可见分节金属结构。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_131_nervous",
            "name": "丸山彩·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。装有高精度微操稳定神经回路（防止紧张手抖影响显微缝合）、多频段义体固件故障诊断义眼。双手为精密机械义肢，指节与手背可见分节金属结构。"
              }
            ],
            "description": "义体：中等植入率。装有高精度微操稳定神经回路（防止紧张手抖影响显微缝合）、多频段义体固件故障诊断义眼。双手为精密机械义肢，指节与手背可见分节金属结构。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "医用局部神经阻断喷雾",
            "status": "equipped",
            "description": "武器：医用局部神经阻断喷雾、防暴静音电击脉冲器（安装在诊所柜台下方）。"
          },
          {
            "custom": true,
            "id": "npc_131_lore_kit",
            "name": "丸山彩·档案随身装备",
            "category": "text",
            "description": "义体：中等植入率。装有高精度微操稳定神经回路（防止紧张手抖影响显微缝合）、多频段义体固件故障诊断义眼。双手为精密机械义肢，指节与手背可见分节金属结构。 武器：医用局部神经阻断喷雾、防暴静音电击脉冲器（安装在诊所柜台下方）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Aya",
        "aliases": [
          "彩",
          "Aya",
          "彩医生"
        ],
        "form": "human",
        "san": 86,
        "rookie": false,
        "priority": [
          "technical",
          "intelligence",
          "cool",
          "reflexes",
          "body"
        ],
        "basis": "精密缝合与义体诊断",
        "loreEquipment": [
          "义体：中等植入率。装有高精度微操稳定神经回路（防止紧张手抖影响显微缝合）、多频段义体固件故障诊断义眼。双手为精密机械义肢，指节与手背可见分节金属结构。",
          "武器：医用局部神经阻断喷雾、防暴静音电击脉冲器（安装在诊所柜台下方）。"
        ],
        "sourceFile": "世界书/131-丸山彩.txt",
        "sourceSHA256": "0505c16e98cd6af958c213eaf05c0b3a6d4b36ebc7e6c7d19db72053a6a028f8",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_132",
      "name": "冰川日菜",
      "worldbookUid": 132,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 132
      },
      "growthInitial": {
        "level": 16,
        "xp": 20127,
        "attributes": {
          "body": 5,
          "reflexes": 11,
          "intelligence": 18,
          "technical": 17,
          "cool": 12
        },
        "attributePoints": 0,
        "perkPoints": 15,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1,
          "Intelligence_Central_Perk_1_1": 1,
          "Intelligence_Central_Perk_1_2": 1,
          "Intelligence_Central_Perk_1_3": 1,
          "Intelligence_Right_Milestone_1": 1,
          "Intelligence_Left_Milestone_2": 2,
          "Intelligence_Left_Perk_2_1": 1,
          "Intelligence_Left_Perk_2_2": 1,
          "Intelligence_Left_Perk_2_3": 1,
          "Intelligence_Left_Perk_2_4": 1,
          "Intelligence_Central_Milestone_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_132_legs",
            "name": "冰川日菜·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等偏高精密植入。装有定制款高带宽脑机接口分析仪、全频段声波与微电流感知模块（但刻意没装自动导航地图插件，或者装了也常年因为觉得“按导航走太无聊”而关掉）。 腰侧、腿侧与手部可见机械结构，与白青半机装衔接。"
              }
            ],
            "description": "义体：中等偏高精密植入。装有定制款高带宽脑机接口分析仪、全频段声波与微电流感知模块（但刻意没装自动导航地图插件，或者装了也常年因为觉得“按导航走太无聊”而关掉）。 腰侧、腿侧与手部可见机械结构，与白青半机装衔接。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_132_nervous",
            "name": "冰川日菜·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等偏高精密植入。装有定制款高带宽脑机接口分析仪、全频段声波与微电流感知模块（但刻意没装自动导航地图插件，或者装了也常年因为觉得“按导航走太无聊”而关掉）。 腰侧、腿侧与手部可见机械结构，与白青半机装衔接。"
              }
            ],
            "description": "义体：中等偏高精密植入。装有定制款高带宽脑机接口分析仪、全频段声波与微电流感知模块（但刻意没装自动导航地图插件，或者装了也常年因为觉得“按导航走太无聊”而关掉）。 腰侧、腿侧与手部可见机械结构，与白青半机装衔接。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "高频声波眩晕发生器",
            "status": "equipped",
            "description": "武器：改装高频声波眩晕发生器、针对敌方义体音频与平衡神经的瞬时过载脉冲发生器、自编极简逻辑死循环脚本「天火（Log-Buster）」（专用于瘫痪企业搜捕无人机与外围安保协议）。"
          },
          {
            "custom": true,
            "id": "npc_132_lore_kit",
            "name": "冰川日菜·档案随身装备",
            "category": "text",
            "description": "义体：中等偏高精密植入。装有定制款高带宽脑机接口分析仪、全频段声波与微电流感知模块（但刻意没装自动导航地图插件，或者装了也常年因为觉得“按导航走太无聊”而关掉）。 腰侧、腿侧与手部可见机械结构，与白青半机装衔接。 武器：改装高频声波眩晕发生器、针对敌方义体音频与平衡神经的瞬时过载脉冲发生器、自编极简逻辑死循环脚本「天火（Log-Buster）」（专用于瘫痪企业搜捕无人机与外围安保协议）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Hina",
        "aliases": [
          "日菜",
          "Hina"
        ],
        "form": "human",
        "san": 88,
        "rookie": false,
        "priority": [
          "intelligence",
          "technical",
          "cool",
          "reflexes",
          "body"
        ],
        "basis": "高带宽分析与电子声波控场",
        "loreEquipment": [
          "义体：中等偏高精密植入。装有定制款高带宽脑机接口分析仪、全频段声波与微电流感知模块（但刻意没装自动导航地图插件，或者装了也常年因为觉得“按导航走太无聊”而关掉）。 腰侧、腿侧与手部可见机械结构，与白青半机装衔接。",
          "武器：改装高频声波眩晕发生器、针对敌方义体音频与平衡神经的瞬时过载脉冲发生器、自编极简逻辑死循环脚本「天火（Log-Buster）」（专用于瘫痪企业搜捕无人机与外围安保协议）。"
        ],
        "sourceFile": "世界书/132-冰川日菜.txt",
        "sourceSHA256": "f37a8a798dbdfc6d95856c5c63ce061198c9cc498a483c517e87b693f0837ae4",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_133",
      "name": "白鹭千圣",
      "worldbookUid": 133,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 133
      },
      "growthInitial": {
        "level": 13,
        "xp": 15085,
        "attributes": {
          "body": 5,
          "reflexes": 9,
          "intelligence": 14,
          "technical": 10,
          "cool": 16
        },
        "attributePoints": 0,
        "perkPoints": 12,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1,
          "Cool_Left_Perk_2_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_133_face",
            "name": "白鹭千圣·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等精密植入。装有社交微表情与声纹测谎光学义眼、反窃听主动降噪力场发生器、高带宽加密通讯脑机模块。双腿为仿生肤色机械义肢，膝部与小腿可见分段接缝和嵌入式组件。"
              }
            ],
            "description": "义体：中等精密植入。装有社交微表情与声纹测谎光学义眼、反窃听主动降噪力场发生器、高带宽加密通讯脑机模块。双腿为仿生肤色机械义肢，膝部与小腿可见分段接缝和嵌入式组件。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_133_legs",
            "name": "白鹭千圣·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等精密植入。装有社交微表情与声纹测谎光学义眼、反窃听主动降噪力场发生器、高带宽加密通讯脑机模块。双腿为仿生肤色机械义肢，膝部与小腿可见分段接缝和嵌入式组件。"
              }
            ],
            "description": "义体：中等精密植入。装有社交微表情与声纹测谎光学义眼、反窃听主动降噪力场发生器、高带宽加密通讯脑机模块。双腿为仿生肤色机械义肢，膝部与小腿可见分段接缝和嵌入式组件。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_133_nervous",
            "name": "白鹭千圣·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等精密植入。装有社交微表情与声纹测谎光学义眼、反窃听主动降噪力场发生器、高带宽加密通讯脑机模块。双腿为仿生肤色机械义肢，膝部与小腿可见分段接缝和嵌入式组件。"
              }
            ],
            "description": "义体：中等精密植入。装有社交微表情与声纹测谎光学义眼、反窃听主动降噪力场发生器、高带宽加密通讯脑机模块。双腿为仿生肤色机械义肢，膝部与小腿可见分段接缝和嵌入式组件。",
            "status": "installed"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "袖珍激光防卫手枪",
            "status": "equipped",
            "description": "武器：定制款袖珍激光防卫手枪（藏于手包暗格）、随车配备的企业级防弹护卫无人机。"
          },
          {
            "custom": true,
            "id": "npc_133_lore_kit",
            "name": "白鹭千圣·档案随身装备",
            "category": "text",
            "description": "义体：中等精密植入。装有社交微表情与声纹测谎光学义眼、反窃听主动降噪力场发生器、高带宽加密通讯脑机模块。双腿为仿生肤色机械义肢，膝部与小腿可见分段接缝和嵌入式组件。 武器：定制款袖珍激光防卫手枪（藏于手包暗格）、随车配备的企业级防弹护卫无人机。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Chisato",
        "aliases": [
          "千圣",
          "Chisato"
        ],
        "form": "human",
        "san": 87,
        "rookie": false,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "社会工程与加密企业安保",
        "loreEquipment": [
          "义体：中等精密植入。装有社交微表情与声纹测谎光学义眼、反窃听主动降噪力场发生器、高带宽加密通讯脑机模块。双腿为仿生肤色机械义肢，膝部与小腿可见分段接缝和嵌入式组件。",
          "武器：定制款袖珍激光防卫手枪（藏于手包暗格）、随车配备的企业级防弹护卫无人机。"
        ],
        "sourceFile": "世界书/133-白鹭千圣.txt",
        "sourceSHA256": "e92da1c82abb1c2086c9de3d7fa37e768b464e6c1b21a5f24187edec50feabec",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_134",
      "name": "大和麻弥",
      "worldbookUid": 134,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 134
      },
      "growthInitial": {
        "level": 14,
        "xp": 16699,
        "attributes": {
          "body": 6,
          "reflexes": 9,
          "intelligence": 14,
          "technical": 18,
          "cool": 11
        },
        "attributePoints": 0,
        "perkPoints": 13,
        "perks": {
          "Tech_Left_Milestone_1": 1,
          "Tech_Left_Perk_1_1": 1,
          "Tech_Left_Perk_1_2": 1,
          "Tech_Right_Milestone_1": 1,
          "Tech_Left_Milestone_2": 2,
          "Tech_Left_Perk_2_1": 1,
          "Tech_Left_Perk_2_2": 1,
          "Tech_Left_Perk_2_3": 1,
          "Tech_Left_Perk_2_4": 1,
          "Tech_Central_Milestone_2": 2,
          "Tech_Central_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_134_face",
            "name": "大和麻弥·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率（她更偏爱外置实体工具的手感）。装有防强光与微距检视功能的光学辅助镜片接口、手部防静电与微震动感知护套。腰腹两侧可见嵌入式机械组件与接口。"
              }
            ],
            "description": "义体：低植入率（她更偏爱外置实体工具的手感）。装有防强光与微距检视功能的光学辅助镜片接口、手部防静电与微震动感知护套。腰腹两侧可见嵌入式机械组件与接口。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_134_nervous",
            "name": "大和麻弥·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率（她更偏爱外置实体工具的手感）。装有防强光与微距检视功能的光学辅助镜片接口、手部防静电与微震动感知护套。腰腹两侧可见嵌入式机械组件与接口。"
              }
            ],
            "description": "义体：低植入率（她更偏爱外置实体工具的手感）。装有防强光与微距检视功能的光学辅助镜片接口、手部防静电与微震动感知护套。腰腹两侧可见嵌入式机械组件与接口。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "高能电容放电改锥",
            "status": "equipped",
            "description": "武器：工业级高能电容放电改锥、工作室通道预设的强磁脉冲（EMP）防盗陷阱。"
          },
          {
            "custom": true,
            "id": "npc_134_lore_kit",
            "name": "大和麻弥·档案随身装备",
            "category": "text",
            "description": "义体：低植入率（她更偏爱外置实体工具的手感）。装有防强光与微距检视功能的光学辅助镜片接口、手部防静电与微震动感知护套。腰腹两侧可见嵌入式机械组件与接口。 武器：工业级高能电容放电改锥、工作室通道预设的强磁脉冲（EMP）防盗陷阱。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Maya",
        "aliases": [
          "麻弥",
          "Maya"
        ],
        "form": "human",
        "san": 88,
        "rookie": true,
        "priority": [
          "technical",
          "intelligence",
          "cool",
          "reflexes",
          "body"
        ],
        "basis": "设备工程与主场EMP防御",
        "loreEquipment": [
          "义体：低植入率（她更偏爱外置实体工具的手感）。装有防强光与微距检视功能的光学辅助镜片接口、手部防静电与微震动感知护套。腰腹两侧可见嵌入式机械组件与接口。",
          "武器：工业级高能电容放电改锥、工作室通道预设的强磁脉冲（EMP）防盗陷阱。"
        ],
        "sourceFile": "世界书/134-大和麻弥.txt",
        "sourceSHA256": "6197864615ae1d12b2c4ff3bb8ee9bc7f5a3535d0e839f60be62fc92df7a4a27",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_135",
      "name": "若宫伊芙",
      "worldbookUid": 135,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 135
      },
      "growthInitial": {
        "level": 15,
        "xp": 18379,
        "attributes": {
          "body": 8,
          "reflexes": 15,
          "intelligence": 12,
          "technical": 12,
          "cool": 13
        },
        "attributePoints": 0,
        "perkPoints": 14,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1,
          "Reflexes_Left_Perk_2_3": 1,
          "Reflexes_Left_Perk_2_4": 1,
          "Reflexes_Central_Milestone_2": 2,
          "Reflexes_Central_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_135_face",
            "name": "若宫伊芙·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中高规格执法植入。装有网监制式黑客追踪与防火墙加固脑机模块、反光学迷彩视觉义眼、四肢神经反射加速回路（完美适配居合拔刀术）。"
              }
            ],
            "description": "义体：中高规格执法植入。装有网监制式黑客追踪与防火墙加固脑机模块、反光学迷彩视觉义眼、四肢神经反射加速回路（完美适配居合拔刀术）。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_135_nervous",
            "name": "若宫伊芙·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中高规格执法植入。装有网监制式黑客追踪与防火墙加固脑机模块、反光学迷彩视觉义眼、四肢神经反射加速回路（完美适配居合拔刀术）。"
              }
            ],
            "description": "义体：中高规格执法植入。装有网监制式黑客追踪与防火墙加固脑机模块、反光学迷彩视觉义眼、四肢神经反射加速回路（完美适配居合拔刀术）。",
            "status": "installed"
          },
          {
            "template": "blade",
            "tier": 3,
            "name": "网监高频电磁武士刀",
            "status": "equipped",
            "description": "武器：网监特制高频电磁武士刀（具备非致命神经麻痹刀背与破甲刃口双模式）、配套短刀、制式智能手枪。"
          },
          {
            "template": "pistol",
            "tier": 3,
            "name": "制式智能手枪",
            "status": "equipped",
            "description": "武器：网监特制高频电磁武士刀（具备非致命神经麻痹刀背与破甲刃口双模式）、配套短刀、制式智能手枪。"
          },
          {
            "custom": true,
            "id": "npc_135_lore_kit",
            "name": "若宫伊芙·档案随身装备",
            "category": "text",
            "description": "义体：中高规格执法植入。装有网监制式黑客追踪与防火墙加固脑机模块、反光学迷彩视觉义眼、四肢神经反射加速回路（完美适配居合拔刀术）。 武器：网监特制高频电磁武士刀（具备非致命神经麻痹刀背与破甲刃口双模式）、配套短刀、制式智能手枪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Eve",
        "aliases": [
          "伊芙",
          "Eve"
        ],
        "form": "human",
        "san": 88,
        "rookie": true,
        "priority": [
          "reflexes",
          "cool",
          "intelligence",
          "technical",
          "body"
        ],
        "basis": "执法追踪与居合突击",
        "loreEquipment": [
          "义体：中高规格执法植入。装有网监制式黑客追踪与防火墙加固脑机模块、反光学迷彩视觉义眼、四肢神经反射加速回路（完美适配居合拔刀术）。",
          "武器：网监特制高频电磁武士刀（具备非致命神经麻痹刀背与破甲刃口双模式）、配套短刀、制式智能手枪。"
        ],
        "sourceFile": "世界书/135-若宫伊芙.txt",
        "sourceSHA256": "7c556f0c048d68ec3533a632f62a0bb9375c1a7036536630f7a053f2afcd64a5",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_136",
      "name": "凑友希那",
      "worldbookUid": 136,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 136
      },
      "growthInitial": {
        "level": 12,
        "xp": 13534,
        "attributes": {
          "body": 5,
          "reflexes": 8,
          "intelligence": 10,
          "technical": 7,
          "cool": 16
        },
        "attributePoints": 0,
        "perkPoints": 11,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_136_nervous",
            "name": "凑友希那·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "极低植入率。为保持绝对天然的声带共鸣与气息控制，坚持拒绝任何声带或咽喉改造，仅装有高保真音频监听接口与基础视力辅助模块。"
              }
            ],
            "description": "义体：极低植入率。为保持绝对天然的声带共鸣与气息控制，坚持拒绝任何声带或咽喉改造，仅装有高保真音频监听接口与基础视力辅助模块。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "定向声波驱散器",
            "status": "equipped",
            "description": "武器：随身防狼高分贝定向声波驱散器（平时基本用不上，出行若遇纠缠多由熟人或街区安保隔开）。"
          },
          {
            "custom": true,
            "id": "npc_136_lore_kit",
            "name": "凑友希那·档案随身装备",
            "category": "text",
            "description": "义体：极低植入率。为保持绝对天然的声带共鸣与气息控制，坚持拒绝任何声带或咽喉改造，仅装有高保真音频监听接口与基础视力辅助模块。 武器：随身防狼高分贝定向声波驱散器（平时基本用不上，出行若遇纠缠多由熟人或街区安保隔开）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Yukina",
        "aliases": [
          "友希那",
          "Yukina"
        ],
        "form": "human",
        "san": 87,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "reflexes",
          "technical",
          "body"
        ],
        "basis": "原生声乐与专业统领",
        "loreEquipment": [
          "义体：极低植入率。为保持绝对天然的声带共鸣与气息控制，坚持拒绝任何声带或咽喉改造，仅装有高保真音频监听接口与基础视力辅助模块。",
          "武器：随身防狼高分贝定向声波驱散器（平时基本用不上，出行若遇纠缠多由熟人或街区安保隔开）。"
        ],
        "sourceFile": "世界书/136-凑友希那.txt",
        "sourceSHA256": "ebb48cf5667fc84b5e4746e9240e7cdb42cb014e346c59a7b10bd0b9c776e45a",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_137",
      "name": "冰川纱夜",
      "worldbookUid": 137,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 137
      },
      "growthInitial": {
        "level": 16,
        "xp": 20127,
        "attributes": {
          "body": 8,
          "reflexes": 16,
          "intelligence": 12,
          "technical": 12,
          "cool": 15
        },
        "attributePoints": 0,
        "perkPoints": 15,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1,
          "Reflexes_Left_Perk_2_3": 1,
          "Reflexes_Left_Perk_2_4": 1,
          "Reflexes_Central_Milestone_2": 2,
          "Reflexes_Central_Perk_2_1": 1,
          "Reflexes_Central_Perk_2_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_137_face",
            "name": "冰川纱夜·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中高规格安保调查植入。装有战术弹道解算与现场痕迹重构义眼（刻意保留原生绿瞳外观，不戴眼镜）、局域加密通讯与反黑客防火墙模块、上肢高精度稳定回路（源自弓道与吉他控弦需求）。 右手为银黑色分节机械义手，腕端配外置终端。"
              }
            ],
            "description": "义体：中高规格安保调查植入。装有战术弹道解算与现场痕迹重构义眼（刻意保留原生绿瞳外观，不戴眼镜）、局域加密通讯与反黑客防火墙模块、上肢高精度稳定回路（源自弓道与吉他控弦需求）。 右手为银黑色分节机械义手，腕端配外置终端。",
            "status": "installed"
          },
          {
            "template": "pistol",
            "tier": 3,
            "name": "高精度智能手枪",
            "status": "equipped",
            "description": "武器：企业安保特配的高精度智能手枪、折叠式碳纤维复合战术弓（配电磁破甲箭与非致命追踪信标箭）。"
          },
          {
            "custom": true,
            "id": "npc_137_lore_kit",
            "name": "冰川纱夜·档案随身装备",
            "category": "text",
            "description": "义体：中高规格安保调查植入。装有战术弹道解算与现场痕迹重构义眼（刻意保留原生绿瞳外观，不戴眼镜）、局域加密通讯与反黑客防火墙模块、上肢高精度稳定回路（源自弓道与吉他控弦需求）。 右手为银黑色分节机械义手，腕端配外置终端。 武器：企业安保特配的高精度智能手枪、折叠式碳纤维复合战术弓（配电磁破甲箭与非致命追踪信标箭）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Sayo",
        "aliases": [
          "纱夜",
          "Sayo"
        ],
        "form": "human",
        "san": 88,
        "rookie": true,
        "priority": [
          "reflexes",
          "cool",
          "intelligence",
          "technical",
          "body"
        ],
        "basis": "精准安保调查与弹道演算",
        "loreEquipment": [
          "义体：中高规格安保调查植入。装有战术弹道解算与现场痕迹重构义眼（刻意保留原生绿瞳外观，不戴眼镜）、局域加密通讯与反黑客防火墙模块、上肢高精度稳定回路（源自弓道与吉他控弦需求）。 右手为银黑色分节机械义手，腕端配外置终端。",
          "武器：企业安保特配的高精度智能手枪、折叠式碳纤维复合战术弓（配电磁破甲箭与非致命追踪信标箭）。"
        ],
        "sourceFile": "世界书/137-冰川纱夜.txt",
        "sourceSHA256": "69180872d31025d9ebc932691f98b0a04f6024db37343039ecb1c68f27d158b4",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_138",
      "name": "今井莉莎",
      "worldbookUid": 138,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 138
      },
      "growthInitial": {
        "level": 13,
        "xp": 15085,
        "attributes": {
          "body": 5,
          "reflexes": 8,
          "intelligence": 13,
          "technical": 10,
          "cool": 16
        },
        "attributePoints": 0,
        "perkPoints": 12,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1,
          "Cool_Left_Perk_2_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_138_nervous",
            "name": "今井莉莎·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。装有多语种同声传译与商务日程管理脑机模块、具备声学混音监听功能的耳内芯片。"
              }
            ],
            "description": "义体：低植入率。装有多语种同声传译与商务日程管理脑机模块、具备声学混音监听功能的耳内芯片。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "高周波电击口红",
            "status": "equipped",
            "description": "武器：防身用袖珍高周波电击口红、随身保镖与企业外勤安保呼叫专线。"
          },
          {
            "custom": true,
            "id": "npc_138_lore_kit",
            "name": "今井莉莎·档案随身装备",
            "category": "text",
            "description": "义体：低植入率。装有多语种同声传译与商务日程管理脑机模块、具备声学混音监听功能的耳内芯片。 武器：防身用袖珍高周波电击口红、随身保镖与企业外勤安保呼叫专线。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Lisa",
        "aliases": [
          "莉莎",
          "Lisa"
        ],
        "form": "human",
        "san": 86,
        "rookie": false,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "项目预算与跨方统筹",
        "loreEquipment": [
          "义体：低植入率。装有多语种同声传译与商务日程管理脑机模块、具备声学混音监听功能的耳内芯片。",
          "武器：防身用袖珍高周波电击口红、随身保镖与企业外勤安保呼叫专线。"
        ],
        "sourceFile": "世界书/138-今井莉莎.txt",
        "sourceSHA256": "9c0739e1fbaf95c6df088889534dad66cc5bfa6f288fbd3b222af9e413188bda",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_139",
      "name": "宇田川亚子",
      "worldbookUid": 139,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 139
      },
      "growthInitial": {
        "level": 13,
        "xp": 15085,
        "attributes": {
          "body": 8,
          "reflexes": 15,
          "intelligence": 9,
          "technical": 12,
          "cool": 12
        },
        "attributePoints": 0,
        "perkPoints": 12,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1,
          "Reflexes_Left_Perk_2_3": 1,
          "Reflexes_Left_Perk_2_4": 1,
          "Reflexes_Central_Milestone_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_139_face",
            "name": "宇田川亚子·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等驾驶特化植入。装有四肢高速神经反射同步回路（源自双踩鼓手基础，能实现毫秒级的油门离合与手刹联动）、广角夜视与车况遥测义眼。"
              }
            ],
            "description": "义体：中等驾驶特化植入。装有四肢高速神经反射同步回路（源自双踩鼓手基础，能实现毫秒级的油门离合与手刹联动）、广角夜视与车况遥测义眼。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_139_nervous",
            "name": "宇田川亚子·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等驾驶特化植入。装有四肢高速神经反射同步回路（源自双踩鼓手基础，能实现毫秒级的油门离合与手刹联动）、广角夜视与车况遥测义眼。"
              }
            ],
            "description": "义体：中等驾驶特化植入。装有四肢高速神经反射同步回路（源自双踩鼓手基础，能实现毫秒级的油门离合与手刹联动）、广角夜视与车况遥测义眼。",
            "status": "installed"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "大口径短管霰弹手枪",
            "status": "equipped",
            "description": "武器：车载遥控防暴烟雾弹与钉刺带发射器、大口径短管霰弹手枪。"
          },
          {
            "custom": true,
            "id": "npc_139_lore_kit",
            "name": "宇田川亚子·档案随身装备",
            "category": "text",
            "description": "义体：中等驾驶特化植入。装有四肢高速神经反射同步回路（源自双踩鼓手基础，能实现毫秒级的油门离合与手刹联动）、广角夜视与车况遥测义眼。 武器：车载遥控防暴烟雾弹与钉刺带发射器、大口径短管霰弹手枪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Ako",
        "aliases": [
          "亚子",
          "Ako"
        ],
        "form": "human",
        "san": 85,
        "rookie": false,
        "priority": [
          "reflexes",
          "technical",
          "cool",
          "intelligence",
          "body"
        ],
        "basis": "驾驶同步与高速突围",
        "loreEquipment": [
          "义体：中等驾驶特化植入。装有四肢高速神经反射同步回路（源自双踩鼓手基础，能实现毫秒级的油门离合与手刹联动）、广角夜视与车况遥测义眼。",
          "武器：车载遥控防暴烟雾弹与钉刺带发射器、大口径短管霰弹手枪。"
        ],
        "sourceFile": "世界书/139-宇田川亚子.txt",
        "sourceSHA256": "2249bea0445ecc9156cd3bcf147c2630e72ec155a32269a3c855b58bfc4fd21e",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_140",
      "name": "白金燐子",
      "worldbookUid": 140,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 140
      },
      "growthInitial": {
        "level": 17,
        "xp": 21946,
        "attributes": {
          "body": 4,
          "reflexes": 13,
          "intelligence": 19,
          "technical": 17,
          "cool": 13
        },
        "attributePoints": 0,
        "perkPoints": 16,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1,
          "Intelligence_Central_Perk_1_1": 1,
          "Intelligence_Central_Perk_1_2": 1,
          "Intelligence_Central_Perk_1_3": 1,
          "Intelligence_Right_Milestone_1": 1,
          "Intelligence_Left_Milestone_2": 2,
          "Intelligence_Left_Perk_2_1": 1,
          "Intelligence_Left_Perk_2_2": 1,
          "Intelligence_Left_Perk_2_3": 1,
          "Intelligence_Left_Perk_2_4": 1,
          "Intelligence_Central_Milestone_2": 2
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_140_nervous",
            "name": "白金燐子·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率。装有手指神经微动加速与防劳损辅助模块（兼顾钢琴极速琶音、精密刺绣与每秒数十键的终端盲打）、离线式旧世代协议转译接口。"
              }
            ],
            "description": "义体：低植入率。装有手指神经微动加速与防劳损辅助模块（兼顾钢琴极速琶音、精密刺绣与每秒数十键的终端盲打）、离线式旧世代协议转译接口。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_140_lore_kit",
            "name": "白金燐子·档案随身装备",
            "category": "text",
            "description": "义体：低植入率。装有手指神经微动加速与防劳损辅助模块（兼顾钢琴极速琶音、精密刺绣与每秒数十键的终端盲打）、离线式旧世代协议转译接口。 武器：无物理攻击武器（居所门窗与个人终端部署有她亲手编写的自毁式静音防追踪迷宫防火墙）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Rinko",
        "aliases": [
          "燐子",
          "Rinko",
          "燐燐"
        ],
        "form": "human",
        "san": 88,
        "rookie": false,
        "priority": [
          "intelligence",
          "technical",
          "reflexes",
          "cool",
          "body"
        ],
        "basis": "旧协议解码与主动退隐",
        "loreEquipment": [
          "义体：低植入率。装有手指神经微动加速与防劳损辅助模块（兼顾钢琴极速琶音、精密刺绣与每秒数十键的终端盲打）、离线式旧世代协议转译接口。",
          "武器：无物理攻击武器（居所门窗与个人终端部署有她亲手编写的自毁式静音防追踪迷宫防火墙）。"
        ],
        "sourceFile": "世界书/140-白金燐子.txt",
        "sourceSHA256": "930b75c25650f99788ce217c214e14b446f6d08c6793434503a8cdfec9bcf1d5",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_141",
      "name": "仓田真白",
      "worldbookUid": 141,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 141
      },
      "growthInitial": {
        "level": 12,
        "xp": 13534,
        "attributes": {
          "body": 4,
          "reflexes": 8,
          "intelligence": 15,
          "technical": 13,
          "cool": 9
        },
        "attributePoints": 0,
        "perkPoints": 11,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1,
          "Intelligence_Central_Perk_1_1": 1,
          "Intelligence_Central_Perk_1_2": 1,
          "Intelligence_Central_Perk_1_3": 1,
          "Intelligence_Right_Milestone_1": 1,
          "Intelligence_Left_Milestone_2": 2,
          "Intelligence_Left_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_141_face",
            "name": "仓田真白·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等偏高视听特化植入。装有帧级超梦信号剥离与多轨时间轴重构模块、带神经降噪滤网的光学义眼（虽伴随常态化视觉幻象，但对伪造涂层与篡改痕迹有着百分之百的识别率）。右腿为义体，采用昂贵的真皮肤覆盖，保留可见的青色回路外观。"
              }
            ],
            "description": "义体：中等偏高视听特化植入。装有帧级超梦信号剥离与多轨时间轴重构模块、带神经降噪滤网的光学义眼（虽伴随常态化视觉幻象，但对伪造涂层与篡改痕迹有着百分之百的识别率）。右腿为义体，采用昂贵的真皮肤覆盖，保留可见的青色回路外观。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_141_legs",
            "name": "仓田真白·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等偏高视听特化植入。装有帧级超梦信号剥离与多轨时间轴重构模块、带神经降噪滤网的光学义眼（虽伴随常态化视觉幻象，但对伪造涂层与篡改痕迹有着百分之百的识别率）。右腿为义体，采用昂贵的真皮肤覆盖，保留可见的青色回路外观。"
              }
            ],
            "description": "义体：中等偏高视听特化植入。装有帧级超梦信号剥离与多轨时间轴重构模块、带神经降噪滤网的光学义眼（虽伴随常态化视觉幻象，但对伪造涂层与篡改痕迹有着百分之百的识别率）。右腿为义体，采用昂贵的真皮肤覆盖，保留可见的青色回路外观。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_141_nervous",
            "name": "仓田真白·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等偏高视听特化植入。装有帧级超梦信号剥离与多轨时间轴重构模块、带神经降噪滤网的光学义眼（虽伴随常态化视觉幻象，但对伪造涂层与篡改痕迹有着百分之百的识别率）。右腿为义体，采用昂贵的真皮肤覆盖，保留可见的青色回路外观。"
              }
            ],
            "description": "义体：中等偏高视听特化植入。装有帧级超梦信号剥离与多轨时间轴重构模块、带神经降噪滤网的光学义眼（虽伴随常态化视觉幻象，但对伪造涂层与篡改痕迹有着百分之百的识别率）。右腿为义体，采用昂贵的真皮肤覆盖，保留可见的青色回路外观。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "高强度频闪致盲发生器",
            "status": "equipped",
            "description": "武器：自卫用高强度频闪致盲发生器、定向次声波驱散器。"
          },
          {
            "custom": true,
            "id": "npc_141_lore_kit",
            "name": "仓田真白·档案随身装备",
            "category": "text",
            "description": "义体：中等偏高视听特化植入。装有帧级超梦信号剥离与多轨时间轴重构模块、带神经降噪滤网的光学义眼（虽伴随常态化视觉幻象，但对伪造涂层与篡改痕迹有着百分之百的识别率）。右腿为义体，采用昂贵的真皮肤覆盖，保留可见的青色回路外观。 武器：自卫用高强度频闪致盲发生器、定向次声波驱散器。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Mashiro",
        "aliases": [
          "真白",
          "Mashiro",
          "小白"
        ],
        "form": "human",
        "san": 79,
        "rookie": true,
        "priority": [
          "intelligence",
          "technical",
          "cool",
          "reflexes",
          "body"
        ],
        "basis": "超梦时间轴与伪造识别非精神病",
        "loreEquipment": [
          "义体：中等偏高视听特化植入。装有帧级超梦信号剥离与多轨时间轴重构模块、带神经降噪滤网的光学义眼（虽伴随常态化视觉幻象，但对伪造涂层与篡改痕迹有着百分之百的识别率）。右腿为义体，采用昂贵的真皮肤覆盖，保留可见的青色回路外观。",
          "武器：自卫用高强度频闪致盲发生器、定向次声波驱散器。"
        ],
        "sourceFile": "世界书/141-仓田真白.txt",
        "sourceSHA256": "9f674b643edc739becdaa577f32f26ec8ec49e6c7880923297620fd6c994ec72",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_142",
      "name": "桐谷透子",
      "worldbookUid": 142,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 142
      },
      "growthInitial": {
        "level": 11,
        "xp": 12044,
        "attributes": {
          "body": 5,
          "reflexes": 9,
          "intelligence": 11,
          "technical": 10,
          "cool": 13
        },
        "attributePoints": 0,
        "perkPoints": 10,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_142_face",
            "name": "桐谷透子·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低至中等植入率。装有潮流色彩实时渲染与织物结构微距义眼、多频段社交公关通讯模块。外部安装部位采用昂贵的真皮肤覆盖，日常难以察觉。"
              }
            ],
            "description": "义体：低至中等植入率。装有潮流色彩实时渲染与织物结构微距义眼、多频段社交公关通讯模块。外部安装部位采用昂贵的真皮肤覆盖，日常难以察觉。",
            "status": "installed"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "定制高射速冲锋手枪",
            "status": "equipped",
            "description": "武器：隐藏在华丽袖口与腰带扣里的微型闪光弹、定制高射速冲锋手枪，以及全队人手一件由她亲手设计的防割防弹演出服。"
          },
          {
            "custom": true,
            "id": "npc_142_lore_kit",
            "name": "桐谷透子·档案随身装备",
            "category": "text",
            "description": "义体：低至中等植入率。装有潮流色彩实时渲染与织物结构微距义眼、多频段社交公关通讯模块。外部安装部位采用昂贵的真皮肤覆盖，日常难以察觉。 武器：隐藏在华丽袖口与腰带扣里的微型闪光弹、定制高射速冲锋手枪，以及全队人手一件由她亲手设计的防割防弹演出服。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Touko",
        "aliases": [
          "透子",
          "Toko",
          "Touko"
        ],
        "form": "human",
        "san": 86,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "织物视觉与社交公关",
        "loreEquipment": [
          "义体：低至中等植入率。装有潮流色彩实时渲染与织物结构微距义眼、多频段社交公关通讯模块。外部安装部位采用昂贵的真皮肤覆盖，日常难以察觉。",
          "武器：隐藏在华丽袖口与腰带扣里的微型闪光弹、定制高射速冲锋手枪，以及全队人手一件由她亲手设计的防割防弹演出服。"
        ],
        "sourceFile": "世界书/142-桐谷透子.txt",
        "sourceSHA256": "cefc68e582ccf0114fb322158bc8b0dc602c65ad27fe08e044be75eae0afb6ef",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_143",
      "name": "广町七深",
      "worldbookUid": 143,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 143
      },
      "growthInitial": {
        "level": 18,
        "xp": 23839,
        "attributes": {
          "body": 5,
          "reflexes": 10,
          "intelligence": 20,
          "technical": 20,
          "cool": 13
        },
        "attributePoints": 0,
        "perkPoints": 17,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1,
          "Intelligence_Central_Perk_1_1": 1,
          "Intelligence_Central_Perk_1_2": 1,
          "Intelligence_Central_Perk_1_3": 1,
          "Intelligence_Right_Milestone_1": 1,
          "Intelligence_Left_Milestone_2": 2,
          "Intelligence_Left_Perk_2_1": 1,
          "Intelligence_Left_Perk_2_2": 1,
          "Intelligence_Left_Perk_2_3": 1,
          "Intelligence_Left_Perk_2_4": 1,
          "Intelligence_Central_Milestone_2": 2,
          "Intelligence_Central_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_143_face",
            "name": "广町七深·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "低植入率（大脑算力与记忆力完全依靠天生超凡头脑，无需植入脑机协处理器）。仅装有高精微距结构透视义眼与指尖防烫防割生物涂层。义体安装痕迹经过真皮肤覆盖处理，外观自然。"
              }
            ],
            "description": "义体：低植入率（大脑算力与记忆力完全依靠天生超凡头脑，无需植入脑机协处理器）。仅装有高精微距结构透视义眼与指尖防烫防割生物涂层。义体安装痕迹经过真皮肤覆盖处理，外观自然。",
            "status": "installed"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "灰市特改电磁脉冲枪",
            "status": "equipped",
            "description": "武器：由她亲手用二手零件攒出来的“外观像普通玩具水枪或扳手、实则威力惊人”的灰市特改电磁脉冲枪与多用途诡雷。"
          },
          {
            "custom": true,
            "id": "npc_143_lore_kit",
            "name": "广町七深·档案随身装备",
            "category": "text",
            "description": "义体：低植入率（大脑算力与记忆力完全依靠天生超凡头脑，无需植入脑机协处理器）。仅装有高精微距结构透视义眼与指尖防烫防割生物涂层。义体安装痕迹经过真皮肤覆盖处理，外观自然。 武器：由她亲手用二手零件攒出来的“外观像普通玩具水枪或扳手、实则威力惊人”的灰市特改电磁脉冲枪与多用途诡雷。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Nanami",
        "aliases": [
          "七深",
          "Nanami"
        ],
        "form": "human",
        "san": 89,
        "rookie": true,
        "priority": [
          "intelligence",
          "technical",
          "cool",
          "reflexes",
          "body"
        ],
        "basis": "先天逆向工程与低植入工坊",
        "loreEquipment": [
          "义体：低植入率（大脑算力与记忆力完全依靠天生超凡头脑，无需植入脑机协处理器）。仅装有高精微距结构透视义眼与指尖防烫防割生物涂层。义体安装痕迹经过真皮肤覆盖处理，外观自然。",
          "武器：由她亲手用二手零件攒出来的“外观像普通玩具水枪或扳手、实则威力惊人”的灰市特改电磁脉冲枪与多用途诡雷。"
        ],
        "sourceFile": "世界书/143-广町七深.txt",
        "sourceSHA256": "2d289fd41a074bc94fdd1cf3ae1f5ec62fbd381d2c1e62e22c49902cd994efe8",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_144",
      "name": "二叶筑紫",
      "worldbookUid": 144,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 144
      },
      "growthInitial": {
        "level": 12,
        "xp": 13534,
        "attributes": {
          "body": 8,
          "reflexes": 10,
          "intelligence": 11,
          "technical": 11,
          "cool": 13
        },
        "attributePoints": 0,
        "perkPoints": 11,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_144_face",
            "name": "二叶筑紫·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "装有团队五人生命体征与位置实时监控义眼、加密小队战术通讯中枢、双臂击鼓与持盾稳定模块。双臂及双侧小腿经过义体改造，保留外露的机械结构，关节处可见圆形组件。"
              }
            ],
            "description": "义体：装有团队五人生命体征与位置实时监控义眼、加密小队战术通讯中枢、双臂击鼓与持盾稳定模块。双臂及双侧小腿经过义体改造，保留外露的机械结构，关节处可见圆形组件。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_144_arms",
            "name": "二叶筑紫·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "装有团队五人生命体征与位置实时监控义眼、加密小队战术通讯中枢、双臂击鼓与持盾稳定模块。双臂及双侧小腿经过义体改造，保留外露的机械结构，关节处可见圆形组件。"
              }
            ],
            "description": "义体：装有团队五人生命体征与位置实时监控义眼、加密小队战术通讯中枢、双臂击鼓与持盾稳定模块。双臂及双侧小腿经过义体改造，保留外露的机械结构，关节处可见圆形组件。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_144_legs",
            "name": "二叶筑紫·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "装有团队五人生命体征与位置实时监控义眼、加密小队战术通讯中枢、双臂击鼓与持盾稳定模块。双臂及双侧小腿经过义体改造，保留外露的机械结构，关节处可见圆形组件。"
              }
            ],
            "description": "义体：装有团队五人生命体征与位置实时监控义眼、加密小队战术通讯中枢、双臂击鼓与持盾稳定模块。双臂及双侧小腿经过义体改造，保留外露的机械结构，关节处可见圆形组件。",
            "status": "installed"
          },
          {
            "template": "shotgun",
            "tier": 2,
            "name": "非致命防暴霰弹枪",
            "status": "equipped",
            "description": "武器：折叠式轻型防弹战术护盾、非致命防暴霰弹枪、信号照明弹。"
          },
          {
            "custom": true,
            "id": "npc_144_lore_kit",
            "name": "二叶筑紫·档案随身装备",
            "category": "text",
            "description": "义体：装有团队五人生命体征与位置实时监控义眼、加密小队战术通讯中枢、双臂击鼓与持盾稳定模块。双臂及双侧小腿经过义体改造，保留外露的机械结构，关节处可见圆形组件。 武器：折叠式轻型防弹战术护盾、非致命防暴霰弹枪、信号照明弹。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Tsukushi",
        "aliases": [
          "筑紫",
          "Tsukushi",
          "二助"
        ],
        "form": "human",
        "san": 86,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "technical",
          "reflexes",
          "body"
        ],
        "basis": "小队体征监控与持盾稳定",
        "loreEquipment": [
          "义体：装有团队五人生命体征与位置实时监控义眼、加密小队战术通讯中枢、双臂击鼓与持盾稳定模块。双臂及双侧小腿经过义体改造，保留外露的机械结构，关节处可见圆形组件。",
          "武器：折叠式轻型防弹战术护盾、非致命防暴霰弹枪、信号照明弹。"
        ],
        "sourceFile": "世界书/144-二叶筑紫.txt",
        "sourceSHA256": "8256e1d83d63ea066bdea1eb92fbffe5866a2abdca454742c0b40f1c86ed10a6",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_145",
      "name": "八潮瑠唯",
      "worldbookUid": 145,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 145
      },
      "growthInitial": {
        "level": 14,
        "xp": 16699,
        "attributes": {
          "body": 5,
          "reflexes": 12,
          "intelligence": 15,
          "technical": 10,
          "cool": 17
        },
        "attributePoints": 0,
        "perkPoints": 13,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1,
          "Cool_Left_Perk_2_2": 1,
          "Cool_Left_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_145_face",
            "name": "八潮瑠唯·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。装有高速文本检索与微表情风险评估义眼、反录音加密声场模块、上肢精密运弓稳定回路。左腿为机械义肢，保留黑色机械外壳与红色饰条，膝部与小腿结构外露。"
              }
            ],
            "description": "义体：中等植入率。装有高速文本检索与微表情风险评估义眼、反录音加密声场模块、上肢精密运弓稳定回路。左腿为机械义肢，保留黑色机械外壳与红色饰条，膝部与小腿结构外露。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_145_legs",
            "name": "八潮瑠唯·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。装有高速文本检索与微表情风险评估义眼、反录音加密声场模块、上肢精密运弓稳定回路。左腿为机械义肢，保留黑色机械外壳与红色饰条，膝部与小腿结构外露。"
              }
            ],
            "description": "义体：中等植入率。装有高速文本检索与微表情风险评估义眼、反录音加密声场模块、上肢精密运弓稳定回路。左腿为机械义肢，保留黑色机械外壳与红色饰条，膝部与小腿结构外露。",
            "status": "installed"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "消音定制手枪",
            "status": "equipped",
            "description": "武器：隐藏在琴盒与风衣内侧的消音定制手枪、高频电击防卫短杖，以及足以让违约雇主倾家荡产的加密法务黑料库。"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "高频电击防卫短杖",
            "status": "equipped",
            "description": "武器：隐藏在琴盒与风衣内侧的消音定制手枪、高频电击防卫短杖，以及足以让违约雇主倾家荡产的加密法务黑料库。"
          },
          {
            "custom": true,
            "id": "npc_145_lore_kit",
            "name": "八潮瑠唯·档案随身装备",
            "category": "text",
            "description": "义体：中等植入率。装有高速文本检索与微表情风险评估义眼、反录音加密声场模块、上肢精密运弓稳定回路。左腿为机械义肢，保留黑色机械外壳与红色饰条，膝部与小腿结构外露。 武器：隐藏在琴盒与风衣内侧的消音定制手枪、高频电击防卫短杖，以及足以让违约雇主倾家荡产的加密法务黑料库。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Rui",
        "aliases": [
          "瑠唯",
          "Rui"
        ],
        "form": "human",
        "san": 88,
        "rookie": true,
        "priority": [
          "cool",
          "intelligence",
          "reflexes",
          "technical",
          "body"
        ],
        "basis": "风险评估与法律声场",
        "loreEquipment": [
          "义体：中等植入率。装有高速文本检索与微表情风险评估义眼、反录音加密声场模块、上肢精密运弓稳定回路。左腿为机械义肢，保留黑色机械外壳与红色饰条，膝部与小腿结构外露。",
          "武器：隐藏在琴盒与风衣内侧的消音定制手枪、高频电击防卫短杖，以及足以让违约雇主倾家荡产的加密法务黑料库。"
        ],
        "sourceFile": "世界书/145-八潮瑠唯.txt",
        "sourceSHA256": "63d56ec9092221d7419f809c6131a2ea7a1584c2fd1b5d2c0969cb61f93c4438",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_146",
      "name": "和奏瑞依",
      "worldbookUid": 146,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 146
      },
      "growthInitial": {
        "level": 14,
        "xp": 16699,
        "attributes": {
          "body": 8,
          "reflexes": 12,
          "intelligence": 12,
          "technical": 11,
          "cool": 16
        },
        "attributePoints": 0,
        "perkPoints": 13,
        "perks": {
          "Cool_Left_Milestone_1": 1,
          "Cool_Central_Milestone_1": 1,
          "Cool_Central_Perk_1_1": 1,
          "Cool_Central_Perk_1_2": 1,
          "Cool_Central_Perk_1_4": 1,
          "Cool_Right_Milestone_1": 1,
          "Cool_Right_Perk_1_1": 1,
          "Cool_Right_Perk_1_2": 1,
          "Cool_Left_Milestone_2": 2,
          "Cool_Left_Perk_2_1": 1,
          "Cool_Left_Perk_2_2": 1,
          "Cool_Left_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_146_face",
            "name": "和奏瑞依·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。装有远距离车队加密调度脑机链路、高保真声学监听模块、全天候防眩光驾驶义眼。锁骨附近与腰侧可见嵌入式组件和接口。"
              }
            ],
            "description": "义体：中等植入率。装有远距离车队加密调度脑机链路、高保真声学监听模块、全天候防眩光驾驶义眼。锁骨附近与腰侧可见嵌入式组件和接口。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_146_nervous",
            "name": "和奏瑞依·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等植入率。装有远距离车队加密调度脑机链路、高保真声学监听模块、全天候防眩光驾驶义眼。锁骨附近与腰侧可见嵌入式组件和接口。"
              }
            ],
            "description": "义体：中等植入率。装有远距离车队加密调度脑机链路、高保真声学监听模块、全天候防眩光驾驶义眼。锁骨附近与腰侧可见嵌入式组件和接口。",
            "status": "installed"
          },
          {
            "template": "rifle",
            "tier": 2,
            "name": "车载重型防暴步枪",
            "status": "inventory",
            "description": "武器：车载重型防暴步枪、定制大口径半自动手枪。"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "大口径半自动手枪",
            "status": "equipped",
            "description": "武器：车载重型防暴步枪、定制大口径半自动手枪。"
          },
          {
            "custom": true,
            "id": "npc_146_lore_kit",
            "name": "和奏瑞依·档案随身装备",
            "category": "text",
            "description": "义体：中等植入率。装有远距离车队加密调度脑机链路、高保真声学监听模块、全天候防眩光驾驶义眼。锁骨附近与腰侧可见嵌入式组件和接口。 武器：车载重型防暴步枪、定制大口径半自动手枪。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Rei",
        "aliases": [
          "瑞依",
          "Rei",
          "Layer",
          "LAYER"
        ],
        "form": "human",
        "san": 87,
        "rookie": true,
        "priority": [
          "cool",
          "reflexes",
          "intelligence",
          "technical",
          "body"
        ],
        "basis": "车队运输调度与职业音乐",
        "loreEquipment": [
          "义体：中等植入率。装有远距离车队加密调度脑机链路、高保真声学监听模块、全天候防眩光驾驶义眼。锁骨附近与腰侧可见嵌入式组件和接口。",
          "武器：车载重型防暴步枪、定制大口径半自动手枪。"
        ],
        "sourceFile": "世界书/146-和奏瑞依.txt",
        "sourceSHA256": "b74568800db81d0587c26a83c275145081a3d76f7ca4a420a2fc695af84e1cd8",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_147",
      "name": "朝日六花",
      "worldbookUid": 147,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 147
      },
      "growthInitial": {
        "level": 11,
        "xp": 12044,
        "attributes": {
          "body": 5,
          "reflexes": 12,
          "intelligence": 10,
          "technical": 8,
          "cool": 12
        },
        "attributePoints": 0,
        "perkPoints": 10,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1,
          "Reflexes_Left_Perk_2_3": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_147_nervous",
            "name": "朝日六花·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "腰腹两侧经过义体改造，可见机械接口与仿生覆盖的分段接缝；装有调音与节拍器辅助听觉模块，双手完全保持原生肌肉与神经触感。"
              }
            ],
            "description": "义体：腰腹两侧经过义体改造，可见机械接口与仿生覆盖的分段接缝；装有调音与节拍器辅助听觉模块，双手完全保持原生肌肉与神经触感。",
            "status": "installed"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "防身电击器",
            "status": "equipped",
            "description": "武器：无主动杀伤性武器（琴包夹层内备有防身电击器与强光警报哨）。"
          },
          {
            "custom": true,
            "id": "npc_147_lore_kit",
            "name": "朝日六花·档案随身装备",
            "category": "text",
            "description": "义体：腰腹两侧经过义体改造，可见机械接口与仿生覆盖的分段接缝；装有调音与节拍器辅助听觉模块，双手完全保持原生肌肉与神经触感。 武器：无主动杀伤性武器（琴包夹层内备有防身电击器与强光警报哨）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Rokka",
        "aliases": [
          "六花",
          "Rokka",
          "Lock",
          "LOCK"
        ],
        "form": "human",
        "san": 87,
        "rookie": true,
        "priority": [
          "reflexes",
          "cool",
          "intelligence",
          "technical",
          "body"
        ],
        "basis": "吉他教学与原生触感",
        "loreEquipment": [
          "义体：腰腹两侧经过义体改造，可见机械接口与仿生覆盖的分段接缝；装有调音与节拍器辅助听觉模块，双手完全保持原生肌肉与神经触感。",
          "武器：无主动杀伤性武器（琴包夹层内备有防身电击器与强光警报哨）。"
        ],
        "sourceFile": "世界书/147-朝日六花.txt",
        "sourceSHA256": "c1430660b699cbb0637d5973ca6a1802773c00f46af18fe320632dd823f20523",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_148",
      "name": "佐藤益木",
      "worldbookUid": 148,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 148
      },
      "growthInitial": {
        "level": 14,
        "xp": 16699,
        "attributes": {
          "body": 15,
          "reflexes": 13,
          "intelligence": 6,
          "technical": 9,
          "cool": 12
        },
        "attributePoints": 0,
        "perkPoints": 13,
        "perks": {
          "Body_Central_Milestone_1": 1,
          "Body_Central_Perk_1_1": 1,
          "Body_Central_Perk_1_2": 1,
          "Body_Central_Perk_1_3": 1,
          "Body_Central_Perk_1_4": 1,
          "Body_Right_Milestone_1": 1,
          "Body_Left_Milestone_2": 2,
          "Body_Left_Perk_2_1": 1,
          "Body_Left_Perk_2_3": 1,
          "Body_Left_Perk_2_4": 1,
          "Body_Right_Milestone_2": 2
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_148_face",
            "name": "佐藤益木·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等偏高外勤植入。装有双臂高出力液压缓震肌腱模块（既能连敲三小时重金属双踩不酸，也能单手扶起倾倒的重型机车）、高速动态视觉捕捉义眼。前臂部分机械结构外露，颈部与腰腹可见金属组件和仿生覆盖接缝。"
              }
            ],
            "description": "义体：中等偏高外勤植入。装有双臂高出力液压缓震肌腱模块（既能连敲三小时重金属双踩不酸，也能单手扶起倾倒的重型机车）、高速动态视觉捕捉义眼。前臂部分机械结构外露，颈部与腰腹可见金属组件和仿生覆盖接缝。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_148_arms",
            "name": "佐藤益木·档案臂部装配",
            "category": "cyberware",
            "part": "arms",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等偏高外勤植入。装有双臂高出力液压缓震肌腱模块（既能连敲三小时重金属双踩不酸，也能单手扶起倾倒的重型机车）、高速动态视觉捕捉义眼。前臂部分机械结构外露，颈部与腰腹可见金属组件和仿生覆盖接缝。"
              }
            ],
            "description": "义体：中等偏高外勤植入。装有双臂高出力液压缓震肌腱模块（既能连敲三小时重金属双踩不酸，也能单手扶起倾倒的重型机车）、高速动态视觉捕捉义眼。前臂部分机械结构外露，颈部与腰腹可见金属组件和仿生覆盖接缝。",
            "status": "installed"
          },
          {
            "template": "shotgun",
            "tier": 2,
            "name": "大口径双管霰弹枪",
            "status": "equipped",
            "description": "武器：车载重型榴弹发射器、定制大口径双管霰弹枪、缠在手腕上的高密度合金防暴链。"
          },
          {
            "template": "blunt",
            "tier": 2,
            "name": "高密度合金防暴链",
            "status": "equipped",
            "description": "武器：车载重型榴弹发射器、定制大口径双管霰弹枪、缠在手腕上的高密度合金防暴链。"
          },
          {
            "custom": true,
            "id": "npc_148_lore_kit",
            "name": "佐藤益木·档案随身装备",
            "category": "text",
            "description": "义体：中等偏高外勤植入。装有双臂高出力液压缓震肌腱模块（既能连敲三小时重金属双踩不酸，也能单手扶起倾倒的重型机车）、高速动态视觉捕捉义眼。前臂部分机械结构外露，颈部与腰腹可见金属组件和仿生覆盖接缝。 武器：车载重型榴弹发射器、定制大口径双管霰弹枪、缠在手腕上的高密度合金防暴链。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Masuki",
        "aliases": [
          "益木",
          "Masuki",
          "Masking",
          "狂犬",
          "MASKING"
        ],
        "form": "human",
        "san": 88,
        "rookie": true,
        "priority": [
          "body",
          "reflexes",
          "cool",
          "technical",
          "intelligence"
        ],
        "basis": "外勤液压肌腱与驾驶重型机车",
        "loreEquipment": [
          "义体：中等偏高外勤植入。装有双臂高出力液压缓震肌腱模块（既能连敲三小时重金属双踩不酸，也能单手扶起倾倒的重型机车）、高速动态视觉捕捉义眼。前臂部分机械结构外露，颈部与腰腹可见金属组件和仿生覆盖接缝。",
          "武器：车载重型榴弹发射器、定制大口径双管霰弹枪、缠在手腕上的高密度合金防暴链。"
        ],
        "sourceFile": "世界书/148-佐藤益木.txt",
        "sourceSHA256": "e06ea2330031e6ca77fb543244738594cb9b4a699ed94acd4233eb9c775bac08",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_149",
      "name": "鳰原令王那",
      "worldbookUid": 149,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 149
      },
      "growthInitial": {
        "level": 16,
        "xp": 20127,
        "attributes": {
          "body": 5,
          "reflexes": 15,
          "intelligence": 18,
          "technical": 14,
          "cool": 14
        },
        "attributePoints": 0,
        "perkPoints": 15,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1,
          "Intelligence_Central_Perk_1_1": 1,
          "Intelligence_Central_Perk_1_2": 1,
          "Intelligence_Central_Perk_1_3": 1,
          "Intelligence_Right_Milestone_1": 1,
          "Intelligence_Left_Milestone_2": 2,
          "Intelligence_Left_Perk_2_1": 1,
          "Intelligence_Left_Perk_2_2": 1,
          "Intelligence_Left_Perk_2_3": 1,
          "Intelligence_Left_Perk_2_4": 1,
          "Intelligence_Central_Milestone_2": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_149_face",
            "name": "鳰原令王那·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等偏高潜伏与黑客植入。装有可变色温虹膜光学义眼、声带频率实时变调模块（辅助双重身份完美伪装）、指尖光纤直连破解探针。"
              }
            ],
            "description": "义体：中等偏高潜伏与黑客植入。装有可变色温虹膜光学义眼、声带频率实时变调模块（辅助双重身份完美伪装）、指尖光纤直连破解探针。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_149_nervous",
            "name": "鳰原令王那·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "中等偏高潜伏与黑客植入。装有可变色温虹膜光学义眼、声带频率实时变调模块（辅助双重身份完美伪装）、指尖光纤直连破解探针。"
              }
            ],
            "description": "义体：中等偏高潜伏与黑客植入。装有可变色温虹膜光学义眼、声带频率实时变调模块（辅助双重身份完美伪装）、指尖光纤直连破解探针。",
            "status": "installed"
          },
          {
            "template": "blade",
            "tier": 2,
            "name": "纳米单分子切割丝",
            "status": "equipped",
            "description": "武器：隐藏在华丽袖口内的纳米单分子切割丝、装载神经麻痹毒剂的定制发簪手枪，以及随身调度的八咫鸟外围清道夫武装小队。"
          },
          {
            "template": "pistol",
            "tier": 2,
            "name": "神经麻痹发簪手枪",
            "status": "equipped",
            "description": "武器：隐藏在华丽袖口内的纳米单分子切割丝、装载神经麻痹毒剂的定制发簪手枪，以及随身调度的八咫鸟外围清道夫武装小队。"
          },
          {
            "custom": true,
            "id": "npc_149_lore_kit",
            "name": "鳰原令王那·档案随身装备",
            "category": "text",
            "description": "义体：中等偏高潜伏与黑客植入。装有可变色温虹膜光学义眼、声带频率实时变调模块（辅助双重身份完美伪装）、指尖光纤直连破解探针。 武器：隐藏在华丽袖口内的纳米单分子切割丝、装载神经麻痹毒剂的定制发簪手枪，以及随身调度的八咫鸟外围清道夫武装小队。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Reona",
        "aliases": [
          "令王那",
          "Reona",
          "Pareo",
          "帕蕾欧",
          "PAREO"
        ],
        "form": "human",
        "san": 84,
        "rookie": true,
        "priority": [
          "intelligence",
          "reflexes",
          "technical",
          "cool",
          "body"
        ],
        "basis": "潜伏变调与直连破解",
        "loreEquipment": [
          "义体：中等偏高潜伏与黑客植入。装有可变色温虹膜光学义眼、声带频率实时变调模块（辅助双重身份完美伪装）、指尖光纤直连破解探针。",
          "武器：隐藏在华丽袖口内的纳米单分子切割丝、装载神经麻痹毒剂的定制发簪手枪，以及随身调度的八咫鸟外围清道夫武装小队。"
        ],
        "sourceFile": "世界书/149-鳰原令王那.txt",
        "sourceSHA256": "3055c8dc4d5bb688e54a36e597d5334b7dc075cb284978e3b7aa07c80e19e13f",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_150",
      "name": "珠手知由",
      "worldbookUid": 150,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 150
      },
      "growthInitial": {
        "level": 18,
        "xp": 23839,
        "attributes": {
          "body": 4,
          "reflexes": 12,
          "intelligence": 20,
          "technical": 18,
          "cool": 15
        },
        "attributePoints": 0,
        "perkPoints": 17,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1,
          "Intelligence_Central_Perk_1_1": 1,
          "Intelligence_Central_Perk_1_2": 1,
          "Intelligence_Central_Perk_1_3": 1,
          "Intelligence_Right_Milestone_1": 1,
          "Intelligence_Left_Milestone_2": 2,
          "Intelligence_Left_Perk_2_1": 1,
          "Intelligence_Left_Perk_2_2": 1,
          "Intelligence_Left_Perk_2_3": 1,
          "Intelligence_Left_Perk_2_4": 1,
          "Intelligence_Central_Milestone_2": 2,
          "Intelligence_Central_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_150_legs",
            "name": "珠手知由·档案腿部装配",
            "category": "cyberware",
            "part": "legs",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "双腿为机械义肢，日常穿着深色连裤袜，关节与分段结构在贴身袜料下隐约显出轮廓。配有高规格脑机统筹植入；她的猫耳耳机本身就是一台直连颅内算力协处理器的军用级分流终端，能够同时监控十余条暗网数据流与现场战术频道。"
              }
            ],
            "description": "义体：双腿为机械义肢，日常穿着深色连裤袜，关节与分段结构在贴身袜料下隐约显出轮廓。配有高规格脑机统筹植入；她的猫耳耳机本身就是一台直连颅内算力协处理器的军用级分流终端，能够同时监控十余条暗网数据流与现场战术频道。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_150_nervous",
            "name": "珠手知由·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 3,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "双腿为机械义肢，日常穿着深色连裤袜，关节与分段结构在贴身袜料下隐约显出轮廓。配有高规格脑机统筹植入；她的猫耳耳机本身就是一台直连颅内算力协处理器的军用级分流终端，能够同时监控十余条暗网数据流与现场战术频道。"
              }
            ],
            "description": "义体：双腿为机械义肢，日常穿着深色连裤袜，关节与分段结构在贴身袜料下隐约显出轮廓。配有高规格脑机统筹植入；她的猫耳耳机本身就是一台直连颅内算力协处理器的军用级分流终端，能够同时监控十余条暗网数据流与现场战术频道。",
            "status": "installed"
          },
          {
            "template": "smg",
            "tier": 3,
            "name": "自卫微型智能冲锋枪",
            "status": "equipped",
            "description": "武器：本人极少亲自扣动扳机，随身配备自卫用微型智能冲锋枪、高强度电子防护力场胸针，以及直接覆写局域安保系统的管理员级黑客矩阵。"
          },
          {
            "custom": true,
            "id": "npc_150_lore_kit",
            "name": "珠手知由·档案随身装备",
            "category": "text",
            "description": "义体：双腿为机械义肢，日常穿着深色连裤袜，关节与分段结构在贴身袜料下隐约显出轮廓。配有高规格脑机统筹植入；她的猫耳耳机本身就是一台直连颅内算力协处理器的军用级分流终端，能够同时监控十余条暗网数据流与现场战术频道。 武器：本人极少亲自扣动扳机，随身配备自卫用微型智能冲锋枪、高强度电子防护力场胸针，以及直接覆写局域安保系统的管理员级黑客矩阵。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Chiyu",
        "aliases": [
          "知由",
          "Chiyu",
          "Chuchu",
          "CHU2",
          "CHU²"
        ],
        "form": "human",
        "san": 85,
        "rookie": true,
        "priority": [
          "intelligence",
          "technical",
          "cool",
          "reflexes",
          "body"
        ],
        "basis": "军用分流脑机与多链路统筹",
        "loreEquipment": [
          "义体：双腿为机械义肢，日常穿着深色连裤袜，关节与分段结构在贴身袜料下隐约显出轮廓。配有高规格脑机统筹植入；她的猫耳耳机本身就是一台直连颅内算力协处理器的军用级分流终端，能够同时监控十余条暗网数据流与现场战术频道。",
          "武器：本人极少亲自扣动扳机，随身配备自卫用微型智能冲锋枪、高强度电子防护力场胸针，以及直接覆写局域安保系统的管理员级黑客矩阵。"
        ],
        "sourceFile": "世界书/150-珠手知由.txt",
        "sourceSHA256": "8ab58d45bc545db2aeeacb5515fbdd93253cc46a219549b675825f1097107eeb",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_215",
      "name": "森川柚枼",
      "worldbookUid": 215,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 215
      },
      "growthInitial": {
        "level": 5,
        "xp": 4250,
        "attributes": {
          "body": 4,
          "reflexes": 6,
          "intelligence": 8,
          "technical": 5,
          "cool": 7
        },
        "attributePoints": 0,
        "perkPoints": 4,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "template": "blunt",
            "tier": 2,
            "name": "棒球棍",
            "status": "equipped",
            "description": "武器：棒球棍，挥舞时会忍不住发出奇怪的声音。"
          },
          {
            "custom": true,
            "id": "npc_215_lore_kit",
            "name": "森川柚枼·档案随身装备",
            "category": "text",
            "description": "义体：低植入率，脸上带着的眼镜可以分析人的表情。 武器：棒球棍，挥舞时会忍不住发出奇怪的声音。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Morikawa",
        "aliases": [
          "森川柚枼",
          "柚枼",
          "Morikawa"
        ],
        "form": "human",
        "san": 82,
        "rookie": false,
        "priority": [
          "intelligence",
          "cool",
          "reflexes",
          "technical",
          "body"
        ],
        "basis": "表情分析眼镜与低植入",
        "loreEquipment": [
          "义体：低植入率，脸上带着的眼镜可以分析人的表情。",
          "武器：棒球棍，挥舞时会忍不住发出奇怪的声音。"
        ],
        "sourceFile": "世界书/215-森川柚枼.txt",
        "sourceSHA256": "e9952a20c090d6670415746099c0a80c62d30e25d95ba422eb7720c551966710",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_216",
      "name": "琳星夜",
      "worldbookUid": 216,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 216
      },
      "growthInitial": {
        "level": 15,
        "xp": 18379,
        "attributes": {
          "body": 14,
          "reflexes": 16,
          "intelligence": 18,
          "technical": 12,
          "cool": 15
        },
        "attributePoints": 0,
        "perkPoints": 14,
        "perks": {
          "Intelligence_Left_Milestone_1": 1,
          "Intelligence_Left_Perk_1_1": 1,
          "Intelligence_Left_Perk_1_2": 1,
          "Intelligence_Central_Milestone_1": 1,
          "Intelligence_Central_Perk_1_1": 1,
          "Intelligence_Central_Perk_1_2": 1,
          "Intelligence_Central_Perk_1_3": 1,
          "Intelligence_Right_Milestone_1": 1,
          "Intelligence_Left_Milestone_2": 2,
          "Intelligence_Left_Perk_2_1": 1,
          "Intelligence_Left_Perk_2_2": 1,
          "Intelligence_Left_Perk_2_3": 1,
          "Intelligence_Left_Perk_2_4": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_216_lore_kit",
            "name": "琳星夜·档案随身装备",
            "category": "text",
            "description": "义体：无（全身0%义体植入率，连最基础的后颈终端接口都没有，纯靠肉体机能与外接硬件行动）。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "LinXingye",
        "aliases": [
          "琳星夜",
          "星夜",
          "常夜灯",
          "LinXingye"
        ],
        "form": "human",
        "san": 85,
        "rookie": false,
        "priority": [
          "intelligence",
          "reflexes",
          "cool",
          "body",
          "technical"
        ],
        "basis": "零植入超常代谢与外置硬件",
        "loreEquipment": [
          "义体：无（全身0%义体植入率，连最基础的后颈终端接口都没有，纯靠肉体机能与外接硬件行动）。"
        ],
        "sourceFile": "世界书/216-琳星夜.txt",
        "sourceSHA256": "8d8c0e131e5d1a6e810249d81a86494fb1a5b26de3a4c4c9b67e3503664d541d",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    },
    {
      "actorId": "wb_217",
      "name": "Vesper",
      "worldbookUid": 217,
      "sourceRef": {
        "kind": "lore-calibration",
        "version": "2051-npc-1",
        "worldbookUid": 217
      },
      "growthInitial": {
        "level": 15,
        "xp": 18379,
        "attributes": {
          "body": 7,
          "reflexes": 15,
          "intelligence": 14,
          "technical": 13,
          "cool": 15
        },
        "attributePoints": 0,
        "perkPoints": 14,
        "perks": {
          "Reflexes_Left_Milestone_1": 1,
          "Reflexes_Central_Milestone_1": 1,
          "Reflexes_Central_Perk_1_1": 1,
          "Reflexes_Central_Perk_1_2": 1,
          "Reflexes_Central_Perk_1_3": 1,
          "Reflexes_Central_Perk_1_4": 1,
          "Reflexes_Left_Milestone_2": 2,
          "Reflexes_Left_Perk_2_2": 1,
          "Reflexes_Left_Perk_2_3": 1,
          "Reflexes_Left_Perk_2_4": 1,
          "Reflexes_Central_Milestone_2": 2,
          "Reflexes_Central_Perk_2_1": 1
        }
      },
      "walletInitial": {
        "yen": 0,
        "earned": 0,
        "spent": 0
      },
      "loadoutSetup": {
        "schema": 1,
        "items": [
          {
            "custom": true,
            "id": "npc_217_face",
            "name": "Vesper·档案视觉装配",
            "category": "cyberware",
            "part": "face",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "皮下伪装膜与面部微调模块、声带变调芯片、光学迷彩披层、抗追踪信号隔离内衬、加密数据胶囊、假身份芯片组。"
              }
            ],
            "description": "义体与装备：皮下伪装膜与面部微调模块、声带变调芯片、光学迷彩披层、抗追踪信号隔离内衬、加密数据胶囊、假身份芯片组。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_217_nervous",
            "name": "Vesper·档案神经装配",
            "category": "cyberware",
            "part": "nervous",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "皮下伪装膜与面部微调模块、声带变调芯片、光学迷彩披层、抗追踪信号隔离内衬、加密数据胶囊、假身份芯片组。"
              }
            ],
            "description": "义体与装备：皮下伪装膜与面部微调模块、声带变调芯片、光学迷彩披层、抗追踪信号隔离内衬、加密数据胶囊、假身份芯片组。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_217_skin",
            "name": "Vesper·档案防护装配",
            "category": "cyberware",
            "part": "skin",
            "tier": 2,
            "numericEffects": [
              {
                "kind": "ability",
                "text": "皮下伪装膜与面部微调模块、声带变调芯片、光学迷彩披层、抗追踪信号隔离内衬、加密数据胶囊、假身份芯片组。"
              },
              {
                "kind": "hpMax",
                "value": 8
              }
            ],
            "description": "义体与装备：皮下伪装膜与面部微调模块、声带变调芯片、光学迷彩披层、抗追踪信号隔离内衬、加密数据胶囊、假身份芯片组。",
            "status": "installed"
          },
          {
            "custom": true,
            "id": "npc_217_lore_kit",
            "name": "Vesper·档案随身装备",
            "category": "text",
            "description": "义体与装备：皮下伪装膜与面部微调模块、声带变调芯片、光学迷彩披层、抗追踪信号隔离内衬、加密数据胶囊、假身份芯片组。 武器：以非致命干扰与脱身装备为主，随身携带数据针刺、烟雾胶囊与强光干扰胸针；不主动进行正面战斗。",
            "numericEffects": [],
            "status": "inventory",
            "quantity": 1
          }
        ]
      },
      "controllable": false,
      "roster": {
        "schema": 1,
        "displayId": "Vesper",
        "aliases": [
          "Vesper",
          "I:P",
          "Masquerena"
        ],
        "form": "human",
        "san": 84,
        "rookie": false,
        "priority": [
          "reflexes",
          "cool",
          "intelligence",
          "technical",
          "body"
        ],
        "basis": "伪装变调与反追踪装备",
        "loreEquipment": [
          "义体与装备：皮下伪装膜与面部微调模块、声带变调芯片、光学迷彩披层、抗追踪信号隔离内衬、加密数据胶囊、假身份芯片组。",
          "武器：以非致命干扰与脱身装备为主，随身携带数据针刺、烟雾胶囊与强光干扰胸针；不主动进行正面战斗。"
        ],
        "sourceFile": "世界书/217-Vesper.txt",
        "sourceSHA256": "4aa2f7cdbd5aef826011522d626e9999ec8f2e486602c7c35e0df16cfec5f69a",
        "calibration": "作者授权按人设与装备建立的游戏参数；不作为原世界书明确数字或角色主次档位",
        "walletKnown": false
      }
    }
  ]
};});
