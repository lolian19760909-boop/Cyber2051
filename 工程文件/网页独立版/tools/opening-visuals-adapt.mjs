import {createRequire} from 'node:module';
const B=createRequire(import.meta.url)('../../工具/lib/card-ast.cjs');
export const creationFooterCSS=`@media(max-width:620px){
 .cxx-game-menu.cx77[data-page=create] .cxx-opening-flow .opening-footer{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;padding:10px 12px}
 .cxx-game-menu.cx77[data-page=create] .opening-footer>:is(.cx77-cc-emblem,.cx77-audio-dock,.cxx-orientation-toggle){grid-row:1;grid-column:span 2;min-width:0;margin:0}
 .cxx-game-menu.cx77[data-page=create] .opening-footer .cx77-cc-emblem{font-size:10px;gap:5px}
 .cxx-game-menu.cx77[data-page=create] .opening-footer .cx77-cc-emblem svg{width:28px}
 .cxx-game-menu.cx77[data-page=create] .opening-footer .cxx-orientation-toggle{padding:0 6px;white-space:nowrap;font-size:13px}
 .cxx-game-menu.cx77[data-page=create] .opening-footer>:is(.opening-back,.opening-next){grid-row:2;grid-column:span 2;width:100%;min-width:0;padding:0 6px;white-space:nowrap;font-size:14px}
 .cxx-game-menu.cx77[data-page=create] .opening-footer .cx77-audio-dock[data-compact=true]{order:0;flex-basis:auto;justify-content:center}
 .cxx-game-menu.cx77[data-page=create] .opening-footer .cx77-audio-toggle{width:100%;min-width:0;padding:8px}
 .cxx-game-menu.cx77[data-page=create] .opening-footer .cx77-audio:not([hidden]){position:absolute;bottom:100%;right:0;max-width:calc(100vw - 24px)}
}`;
export function adaptCreationVisuals(code){
 const from='if (sel.dataset.cx77Seg || sel.options.length < 2 || sel.options.length > 5) return;';
 if(code.split(from).length!==2)throw Error('开局选择控件适配接点变化');
 code=code.replace(from,"if (sel.hasAttribute('data-cxx-native-select') || sel.dataset.cx77Seg || sel.options.length < 2 || sel.options.length > 5) return;");
 const found=[];B.walk(B.acorn.parse(code,{ecmaVersion:'latest',sourceType:'module'}),n=>{if(n.type==='VariableDeclarator'&&n.id?.name==='THEME_CSS'&&typeof n.init?.value==='string')found.push(n.init);});
 if(found.length!==1)throw Error('开局主题样式接点变化');const value=found[0];return code.slice(0,value.start)+JSON.stringify(value.value+'\n'+creationFooterCSS)+code.slice(value.end);
}
