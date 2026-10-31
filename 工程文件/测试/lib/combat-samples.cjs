'use strict';
// Display fixtures only; these are recorded results, not a second combat engine.
const assessment={result:{known:true,playerPower:153.4,enemyPower:127.2,playerChance:.61,incapacitated:false}};
const unknown={reason:'reinforcement',result:{known:false}};
const round={round:2,source:{floor:1,swipe:0},advantage:'player',stillFighting:true,actors:[
 {name:'丰川祥子',hp:90,after:71,hpMax:100},
 {name:'NIGHTRUNNERABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ',hp:120,after:94,hpMax:120}
]};
module.exports={assessment,unknown,round,cases:[
 {id:'gal-combat-known',speaker:'丰川祥子',cast:['丰川祥子'],combat:[assessment]},
 {id:'gal-combat-unknown',speaker:'千早爱音',cast:['千早爱音'],combat:[unknown]},
 {id:'gal-combat-round',speaker:'丰川祥子',cast:['丰川祥子'],combat:[round]},
 {id:'gal-combat-long',speaker:'丰川祥子',cast:['丰川祥子','千早爱音'],combat:[assessment,round],text:'战况只是刚才交锋的记录。她把路线图收好，转头确认同伴仍在身边。'.repeat(45)+'【战况正文终点】'}
]};
