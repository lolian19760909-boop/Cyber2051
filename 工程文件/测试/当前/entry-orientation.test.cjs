'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Entry=require('../../卡片源码/运行时/entry-experience.js');
function fixture(){
 const win=new EventTarget(),orientation=new EventTarget(),storage=new Map(),parent={children:[],append(node){this.children.push(node);}};
 orientation.type='landscape-primary';Object.assign(win,{screen:{orientation},innerWidth:844,innerHeight:390,CustomEvent,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{createElement:()=>({style:{},setAttribute(key,value){this[key]=value;},remove(){this.removed=true;}})}});
 const destroy=Entry.button(win,parent);return {win,orientation,storage,button:parent.children[0],destroy};
}
test('automatic orientation updates the visible action on screen change and viewport resize',()=>{
 const f=fixture();assert.equal(f.button.textContent,'切换竖屏');
 f.orientation.type='portrait-primary';f.win.innerWidth=390;f.win.innerHeight=844;f.orientation.dispatchEvent(new Event('change'));
 assert.equal(f.button.textContent,'切换横屏');assert.equal(f.button['aria-label'],'手机切换横屏');
 f.orientation.type='landscape-primary';f.win.dispatchEvent(new Event('resize'));assert.equal(f.button.textContent,'切换竖屏');
 f.destroy();f.orientation.type='portrait-primary';f.orientation.dispatchEvent(new Event('change'));f.win.dispatchEvent(new Event('resize'));assert.equal(f.button.textContent,'切换竖屏');assert(f.button.removed);
});
test('an explicit app orientation remains selected across physical rotation',()=>{
 const f=fixture();f.button.onclick();assert.equal(f.storage.get(Entry.orientationKey),'portrait');assert.equal(f.button.textContent,'切换横屏');
 f.orientation.type='portrait-primary';f.orientation.dispatchEvent(new Event('change'));f.win.dispatchEvent(new Event('resize'));assert.equal(f.button.textContent,'切换横屏');
 f.button.onclick();assert.equal(f.storage.get(Entry.orientationKey),'landscape');assert.equal(f.button.textContent,'切换竖屏');f.destroy();
});
