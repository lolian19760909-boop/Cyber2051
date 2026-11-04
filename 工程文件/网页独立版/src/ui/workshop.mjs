import {sourceScript,sourceText} from './source.mjs';
export async function createWorkshopView({session,onChanged}){
 await sourceScript('运行时/workshop-panel.js');
 const view=globalThis.CxxWorkshopPanel.create({document,css:(globalThis.CxxThemeCSS||'')+await sourceText('运行时/workshop-panel.css'),service:{read:options=>session.workshop.read(options),command:value=>session.workshop.command(value)},onChanged});
 const destroy=view.destroy;view.destroy=()=>{destroy();if(globalThis.CxxWorkshopWebsite===view)delete globalThis.CxxWorkshopWebsite;};globalThis.CxxWorkshopWebsite=view;return view;
}
