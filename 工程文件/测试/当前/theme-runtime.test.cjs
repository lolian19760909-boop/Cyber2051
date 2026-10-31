'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Theme=require('../../卡片源码/主题/runtime.js'),Build=require('../../工具/lib/ui-theme.cjs'),DOM=require('../lib/dom.cjs');
const source=file=>fs.readFileSync(path.join(__dirname,'../../卡片源码',file),'utf8');
function events(target={}){
  const listeners=new Map();
  return Object.assign(target,{listeners,
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    dispatchEvent(event){for(const fn of [...listeners.get(event.type)||[]])fn(event);return true;}
  });
}
function fixture(){
  const document=DOM.document('<!doctype html><html><head></head><body></body></html>'),store=new Map();
  document.documentElement=document.querySelector('html');
  const win=events({document,Event:class {constructor(type){this.type=type;}},localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))}});
  document.defaultView=win;
  return {document,win,store};
}
const count=(target,type)=>target.listeners.get(type)?.size||0;

test('website and play documents keep all three tones across tabs and navigation',()=>{
  const website=fixture(),play=fixture(),shared=new Map([[Theme.key,'yellow']]);
  const storage={getItem:key=>shared.get(key)||null,setItem:(key,value)=>shared.set(key,String(value))};
  website.win.localStorage=storage;play.win.localStorage=storage;
  const siteTheme=Theme.install(website.win),playTheme=Theme.install(play.win);
  assert.equal(siteTheme.read(),'yellow');assert.equal(playTheme.read(),'yellow');
  for(const tone of ['night','red','yellow']){
    siteTheme.set(tone);play.win.dispatchEvent({type:'storage',key:Theme.key,newValue:tone});
    assert.equal(playTheme.read(),tone);assert.equal(play.document.documentElement.getAttribute('data-cxx-theme'),tone);
    playTheme.set('night');website.win.dispatchEvent({type:'storage',key:Theme.key,newValue:'night'});
    assert.equal(siteTheme.read(),'night');
  }
  playTheme.set('yellow');playTheme.destroy();
  const afterNavigation=Theme.install(play.win);
  assert.equal(afterNavigation.read(),'yellow');
  siteTheme.destroy();afterNavigation.destroy();
});

test('twenty theme replacements release every document and owner pagehide listener',()=>{
  const host=fixture(),child=fixture(),owner=events(),frame=host.document.createElement('iframe');
  frame.contentDocument=child.document;host.document.body.append(frame);
  let service,previous;
  for(let i=0;i<20;i++){
    service=Theme.install(host.win,owner,'/* carriers */');previous?.destroy();
    assert.equal(host.win.CxxTheme,service);
    assert.equal(count(host.win,'pagehide'),1);
    assert.equal(count(child.win,'pagehide'),1);
    assert.equal(count(owner,'pagehide'),1);
    assert.equal(count(host.document,'load'),1);
    previous=service;
  }
  service.destroy();service.destroy();
  for(const target of [host.win,child.win,owner])assert.equal(count(target,'pagehide'),0);
  for(const target of [host.document,child.document])assert.equal(count(target,'load'),0);
  assert.equal(count(host.win,'storage'),0);
  assert.equal(host.win.CxxTheme,undefined);
});

test('a virtual Shadow Root document follows later theme changes without SVG APIs',()=>{
  const host=fixture(),shadow=fixture();
  // Cxx249Shadow exposes an HTML document facade without createElementNS.
  assert.equal(shadow.document.createElementNS,undefined);
  const service=Theme.install(host.win,host.win,Build.runtimeSheet(source));
  service.attach(shadow.document);
  service.set('yellow');assert.equal(shadow.document.documentElement.getAttribute('data-cxx-theme'),'yellow');
  service.set('night');assert.equal(shadow.document.documentElement.getAttribute('data-cxx-theme'),'night');
  assert.equal(shadow.document.getElementById('cxx-theme-carriers').textContent,Build.runtimeSheet(source));
  service.destroy();assert.equal(count(shadow.win,'pagehide'),0);assert.equal(count(shadow.document,'load'),0);
});

test('late iframe load and document pagehide attach and release only the current child',()=>{
  const host=fixture(),child=fixture(),service=Theme.install(host.win,host.win,'/* carriers */');
  service.set('yellow');
  const frame=host.document.createElement('iframe');frame.tagName='IFRAME';frame.contentDocument=child.document;
  host.document.body.append(frame);host.document.dispatchEvent({type:'load',target:frame});
  assert.equal(child.document.documentElement.getAttribute('data-cxx-theme'),'yellow');
  child.win.dispatchEvent({type:'pagehide'});frame.remove();
  assert.equal(count(child.win,'pagehide'),0);assert.equal(count(child.document,'load'),0);
  service.set('night');assert.equal(child.document.documentElement.getAttribute('data-cxx-theme'),'yellow');
  service.destroy();
});

test('one persistent carrier reuses the existing offline font in each document before a menu exists',()=>{
  const host=fixture(),child=fixture(),font=JSON.parse(source('运行时/hub-assets.json')).font,sheet=Build.runtimeSheet(source);
  assert.match(sheet,/@font-face\{font-family:Rajdhani/);assert(sheet.includes(font));assert(!sheet.includes('https://'));
  const service=Theme.install(host.win,host.win,sheet);service.attach(child.document);
  const first=host.document.getElementById('cxx-theme-carriers'),childFirst=child.document.getElementById('cxx-theme-carriers');
  for(const id of ['yellow','night','red'])service.set(id);
  assert.equal(host.document.getElementById('cxx-theme-carriers'),first);
  assert.equal(child.document.getElementById('cxx-theme-carriers'),childFirst);
  assert.equal(host.document.querySelectorAll('#cxx-theme-carriers').length,1);
  assert.equal(first.textContent,sheet);assert.equal(childFirst.textContent,sheet);
  service.destroy();
  const replacement=Theme.install(host.win,host.win,sheet);
  assert.equal(host.document.getElementById('cxx-theme-carriers'),first);
  replacement.destroy();
});
