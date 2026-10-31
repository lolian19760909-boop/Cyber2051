import { createBridge } from './bridge.mjs';
import { createAuxiliary } from './auxiliary.mjs';
const context=()=>SillyTavern.getContext();
const bridge=createBridge({context,auxiliary:createAuxiliary({context}),report:message=>globalThis.toastr?.error(message,'Cyber2051 上下文桥')});
globalThis.CxxContextBridge=bridge;
globalThis.CxxContextBridge_intercept=bridge.intercept;
export function clean(){bridge.destroy();if(globalThis.CxxContextBridge===bridge){delete globalThis.CxxContextBridge;delete globalThis.CxxContextBridge_intercept;}}
