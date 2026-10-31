/** Original ST dependencies, with deterministic injection only when a caller supplies random/now. */
import * as chevrotain from './dependencies/chevrotain.mjs';
import nativeSeedrandom from './dependencies/seedrandom.mjs';
import nativeDroll from './dependencies/droll.mjs';
import moment from './dependencies/moment.mjs';
import {getMacroHost} from './host.mjs';
export {chevrotain,moment};
moment.now=()=>getMacroHost().now?.getTime?.()??Date.now();
export function seedrandom(seed,options){return options?.entropy&&getMacroHost().random?getMacroHost().random:nativeSeedrandom(seed,options);}
export const droll={...nativeDroll,roll(formula){const random=getMacroHost().random;if(!random)return nativeDroll.roll(formula);const previous=Math.random;try{Math.random=random;return nativeDroll.roll(formula);}finally{Math.random=previous;}}};
