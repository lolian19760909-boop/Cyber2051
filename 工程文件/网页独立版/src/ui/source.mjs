/** Load only trusted maintained UI modules; no preset/model HTML is executable. */
import {appUrl} from '../platform/paths.mjs';
const scripts=new Map(),styles=new Map(),texts=new Map();
export const cardUrl=file=>appUrl('card/'+file.split('/').map(encodeURIComponent).join('/'));
export function sourceText(file){if(!texts.has(file))texts.set(file,fetch(cardUrl(file)).then(response=>{if(!response.ok)throw new Error('界面维护源读取失败：'+file);return response.text();}).catch(error=>{texts.delete(file);throw error;}));return texts.get(file);}
export async function sourceJson(file){return JSON.parse(await sourceText(file));}
export function sourceScript(file,{adapted=false,fresh=false}={}){const url=adapted?appUrl('src/ui/card/'+file.split('/').map(encodeURIComponent).join('/')):file.startsWith('@')?appUrl(file.slice(1)):cardUrl(file);if(fresh)scripts.delete(url);if(!scripts.has(url))scripts.set(url,new Promise((resolve,reject)=>{const script=document.createElement('script');script.async=false;script.src=url;script.onload=resolve;script.onerror=()=>{scripts.delete(url);reject(new Error('界面组件读取失败：'+file));};document.head.append(script);}));return scripts.get(url);}
/** Start downloads together; async=false preserves the maintained dependency order. */
export function sourceScripts(files,{adapted=new Set()}={}){return Promise.all(files.map(file=>sourceScript(file,{adapted:adapted.has(file)})));}
export async function sourceStyle(file,{root=document.head,adapt=''}={}){const key=file+':'+adapt;if(root===document.head&&styles.has(key))return;let css=await sourceText(file);if(adapt)css=css.replaceAll(':root',adapt).replaceAll(':host',adapt);const style=document.createElement('style');style.dataset.cxxSource=file;style.textContent=css;root.append(style);if(root===document.head)styles.set(key,style);return style;}
export async function loadFoundation({assets,onTheme}={}){
  globalThis.__cxxStandaloneUI=true;
  const {createMotion}=await import(appUrl('shared/visual/runtime/motion.mjs'));
  globalThis.TavernMotion=createMotion({settings:()=>({enabled:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches})});
  const cssFiles=['主题/tokens.css','主题/carriers.css','运行时/boot-loader.css','主题/opening.css','主题/player.css','主题/feedback.css'];
  await Promise.all([
    Promise.all(cssFiles.map(sourceText)).then(async()=>{for(const file of cssFiles)await sourceStyle(file);}),
    sourceScripts(['共享/popover.js','共享/motion.js','主题/runtime.js','运行时/crypto-compat.js','运行时/visual-projects.js','运行时/boot-loader.js','Gal/landscape.js','运行时/entry-experience.js'],{adapted:new Set(['Gal/landscape.js','运行时/boot-loader.js','运行时/entry-experience.js'])}),
  ]);
  globalThis.CxxResources=assets;
  const carriers=await sourceText('主题/carriers.css');const theme=globalThis.CxxThemeRuntime.install(window,window,carriers);if(onTheme)theme.subscribe(onTheme);
  const response=await fetch(appUrl('data/ui.json'));if(!response.ok)throw Error('原卡界面资源未完成构建');const data=await response.json(),globals=data.globals||{};globalThis.CxxWebUIData=data;
  if(data.fontCSS){const style=document.createElement('style');style.dataset.cxxSource='官方完整中文字体';style.textContent=data.fontCSS.replace(/url\((["']?)(assets\/[^)"']+)\1\)/g,(_,quote,url)=>'url("'+appUrl(url)+'")');document.head.append(style);}
  Object.assign(globalThis,globals);return {theme,globals,destroy:()=>{theme.destroy();globalThis.TavernMotion?.dispose?.();}};
}
