/** Actual creator state against the maintained SQL columns and constraints. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {cardModule,cardRuleChain} from '../src/reuse/card.mjs';
import {createRulesEngine} from '../src/rules/engine.mjs';
const identity=cardModule('运行时/identity.js'),operations=cardModule('运行时/player-operations.js'),rows=cardModule('数据/rows.js');
const setup=identity.snapshot('street','',identity.initialSetup('street'));setup.setupToken='synthetic-sql-contract';
const state=operations.plan(createRulesEngine({chain:cardRuleChain()}).emptyRoot(),{action:'initialize'},{identity:setup,newChat:true}),projected=rows.projectAll(state.terminal,0);
const pairs=projected.cxx_equipment.map(row=>row.actor_key+' / '+row.slot);assert.equal(new Set(pairs).size,pairs.length,'Different actual equipment slots must not collapse into one SQL key');
const template=JSON.parse(fs.readFileSync(new URL('../../数据/表格模板-cxx15.json',import.meta.url),'utf8')),db=new DatabaseSync(':memory:');
try{for(const [name,data]of Object.entries(projected)){
 const table=template['sheet_'+name];if(!table)continue;db.exec(table.sourceData.ddl);const fields=new Set(db.prepare('PRAGMA table_info('+name+')').all().map(row=>row.name));
 for(const row of data){const entries=Object.entries(row).filter(([key])=>fields.has(key));db.prepare('INSERT INTO '+name+' ('+entries.map(([key])=>key).join(',')+') VALUES ('+entries.map(()=>'?').join(',')+')').run(...entries.map(([,value])=>value));}
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM '+name).get().n,data.length);
}console.log(JSON.stringify({ok:true,actors:Object.keys(state.terminal.ensemble.actors).length,equipment:projected.cxx_equipment.length,tables:Object.keys(projected).length,scope:'Actual creator/rules/projectors and maintained DDL; in-memory Node SQLite only, no player database'}));}finally{db.close();}
