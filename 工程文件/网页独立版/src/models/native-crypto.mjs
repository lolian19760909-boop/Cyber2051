import Sha512 from './native/sha512.mjs';
import {ByteBuffer} from './native-crypto-buffer.mjs';
export default {
 createHash(algorithm){if(algorithm!=='sha512')throw Error('Unsupported native hash: '+algorithm);return new Sha512();},
 randomBytes(size){return globalThis.crypto.getRandomValues(new ByteBuffer(size));},
};
