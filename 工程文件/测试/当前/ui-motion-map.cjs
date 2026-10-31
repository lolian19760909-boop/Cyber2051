'use strict';
// Reuse the project's real atlas acceptance paths with this batch's source overlay and Suite.
const fs=require('node:fs'),path=require('node:path');
const {overlay}=require('../../工具/lib/ui-motion-overlay.cjs'),root=path.resolve(__dirname,'../..'),suite=path.join(root,'配套扩展/tavern-runtime-suite');
const url=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
let engine=fs.readFileSync(path.join(suite,'visual/runtime/motion.mjs'),'utf8');
for(const name of ['graphic','interface'])engine=engine.replace(`'../recipes/${name}.mjs'`,JSON.stringify(url(fs.readFileSync(path.join(suite,`visual/recipes/${name}.mjs`),'utf8'))));
process.env.CXX_TEST_CARD=process.env.CXX_TEST_CARD||path.join(process.env.CXX_WORK||root+'/.cache/ui-motion-20261024','candidate.json');
process.env.CXX_EVIDENCE=process.env.CXX_EVIDENCE||path.join(process.env.CXX_WORK||root+'/.cache/ui-motion-20261024','map');
process.env.CXX_WIDTHS=process.env.CXX_WIDTHS||'1440,390';
overlay(async()=>{const T=require('../../工具/lib/terminal-preview.cjs'),original=T.environment;T.environment=(browser,host,card,width,height,options={})=>original(browser,host,card,width,height,options,{prepare:async page=>{await page.evaluate(async src=>{const {createMotion}=await import(src);window.TavernMotion=createMotion();Cxx236Preferences.read=()=>({level:'high',device:innerWidth<700?'mobile':'desktop'});},url(engine));}});require('./map-visual-browser.cjs');}).catch(error=>{console.error(error);process.exitCode=1;});
