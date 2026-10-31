import {play} from './assets/game-ui/ascii/runtime/player.js';
import * as sakiko from './assets/game-ui/ascii/pieces/sakiko-run.js';

// The runner belongs to the finite loading film, whose owner stops it on exit.
export function mountLoadingAscii(node,{still=false}={}){
 return play(node.querySelector('.boot-ascii pre'),sakiko,{maxFps:24,still,look:{mono:true}});
}
