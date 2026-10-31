// Offline DOM model using the installed ST HTML parser. No browser is started.
const path=require('node:path'),modules=process.env.CXX_ST_NODE_MODULES||'D:/SillyTavern/node_modules';
const cheerio=require(path.join(modules,'cheerio')),utils=require(path.join(modules,'domutils'));
function document(html){
  const $=cheerio.load(html),root=$.root()[0];let doc;
  function decorate(node){
    if(!node||node.__fixture)return node;node.__fixture=true;node.listeners=new Map();
    // domhandler uses .type for its internal node kind; browsers use button.type as an attribute.
    if(node.name==='button')Object.defineProperty(node,'type',{get:()=> 'tag',set:value=>{node.attribs.type=value;}});
    Object.defineProperties(node,{
      ownerDocument:{get:()=>doc},isConnected:{get(){for(let n=this;n;n=n.parent)if(n===root)return true;return false;}},
      parentElement:{get(){return this.parent?.type==='tag'?this.parent:null;}},
      textContent:{get(){return utils.textContent(this);},set(value){this.children=[];this.append(String(value));}},
      classList:{value:{contains:name=>(node.attribs?.class||'').split(/\s+/).includes(name),add(...names){node.attribs.class=[...new Set([...(node.attribs.class||'').split(/\s+/).filter(Boolean),...names])].join(' ');},remove(...names){node.attribs.class=(node.attribs.class||'').split(/\s+/).filter(n=>!names.includes(n)).join(' ');},toggle(name,on){const value=on??!this.contains(name);this[value?'add':'remove'](name);return value;}}},
      dataset:{value:new Proxy({}, {get:(_,key)=>node.attribs?.['data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())],set:(_,key,value)=>{node.attribs['data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=String(value);return true;}})},
      className:{get:()=>node.attribs?.class||'',set:value=>{node.attribs.class=value;}},
      id:{get:()=>node.attribs?.id||'',set:value=>{node.attribs.id=value;}},
      open:{get:()=>node.attribs?.open!==undefined,set:value=>{if(value)node.attribs.open='';else delete node.attribs.open;}},
      hidden:{get:()=>node.attribs?.hidden!==undefined,set:value=>{if(value)node.attribs.hidden='';else delete node.attribs.hidden;}}
    });
    Object.assign(node,{
      querySelectorAll(selector){if(selector.startsWith(':scope > '))return (this.children||[]).filter(n=>n.type==='tag'&&$(n).is(selector.slice(9))).map(decorate);return $(selector,this).toArray().map(decorate);},
      querySelector(selector){return this.querySelectorAll(selector)[0]||null;},matches(selector){return $(this).is(selector);},closest(selector){return decorate($(this).closest(selector)[0])||null;},
      contains(other){for(let n=other;n;n=n.parent)if(n===this)return true;return false;},
      getAttribute(name){return this.attribs?.[name]??null;},hasAttribute(name){return this.getAttribute(name)!==null;},setAttribute(name,value){this.attribs[name]=String(value);},removeAttribute(name){delete this.attribs[name];},
      append(...nodes){for(let child of nodes){if(typeof child==='string')child=doc.createTextNode(child);utils.removeElement(child);utils.appendChild(this,child);}},
      prepend(...nodes){for(const child of [...nodes].reverse()){utils.removeElement(child);utils.prependChild(this,child);}},
      before(...nodes){for(const child of nodes){utils.removeElement(child);utils.prepend(this,child);}},
      remove(){utils.removeElement(this);},replaceWith(...nodes){this.before(...nodes);this.remove();},
      splitText(offset){const tail=doc.createTextNode(this.data.slice(offset));this.data=this.data.slice(0,offset);utils.append(this,tail);return tail;},
      normalize(){for(let n=this.firstChild;n;n=n.nextSibling){if(n.nodeType===3){while(n.nextSibling?.nodeType===3){const next=n.nextSibling;n.data+=next.data;next.remove();}}else n.normalize?.();}},
      addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);},removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);},
      dispatchEvent(event){if(!event.target)event.target=this;for(const fn of this.listeners.get(event.type)||[])fn(event);return !event.defaultPrevented;},
      click(){this.dispatchEvent({type:'click',target:this});},focus(){doc.activeElement=this;}
    });
    for(const child of node.children||[])decorate(child);return node;
  }
  decorate(root);doc=root;doc.head=doc.querySelector('head');doc.body=doc.querySelector('body');doc.readyState='complete';
  doc.createElement=tag=>decorate(cheerio.load('<'+tag+'></'+tag+'>',null,false).root()[0].firstChild);
  doc.createTextNode=text=>{const element=cheerio.load('',null,false);element.root().text(text);return decorate(element.root()[0].firstChild);};
  doc.getElementById=id=>doc.querySelector('#'+id);
  doc.createTreeWalker=container=>{const nodes=[];function visit(n){if(n.nodeType===3)nodes.push(n);else for(const child of n.childNodes||[])visit(child);}visit(container);let i=0;return {currentNode:null,nextNode(){this.currentNode=nodes[i++];return Boolean(this.currentNode);}};};
  doc.html=()=>$.html();return doc;
}
module.exports={document};
