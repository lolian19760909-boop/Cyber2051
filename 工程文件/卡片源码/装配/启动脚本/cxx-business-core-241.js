(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxSha256=api;})(globalThis,function(){const module={exports:{}};const window=undefined,self=undefined,process=undefined,define=undefined;
/**
 * [js-sha256]{@link https://github.com/emn178/js-sha256}
 *
 * @version 0.11.1
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2025
 * @license MIT
 */
/*jslint bitwise: true */
(function () {
  'use strict';

  var ERROR = 'input is invalid type';
  var WINDOW = typeof window === 'object';
  var root = WINDOW ? window : {};
  if (root.JS_SHA256_NO_WINDOW) {
    WINDOW = false;
  }
  var WEB_WORKER = !WINDOW && typeof self === 'object';
  var NODE_JS = !root.JS_SHA256_NO_NODE_JS && typeof process === 'object' && process.versions && process.versions.node && process.type != 'renderer';
  if (NODE_JS) {
    root = global;
  } else if (WEB_WORKER) {
    root = self;
  }
  var COMMON_JS = !root.JS_SHA256_NO_COMMON_JS && typeof module === 'object' && module.exports;
  var AMD = typeof define === 'function' && define.amd;
  var ARRAY_BUFFER = !root.JS_SHA256_NO_ARRAY_BUFFER && typeof ArrayBuffer !== 'undefined';
  var HEX_CHARS = '0123456789abcdef'.split('');
  var EXTRA = [-2147483648, 8388608, 32768, 128];
  var SHIFT = [24, 16, 8, 0];
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  var OUTPUT_TYPES = ['hex', 'array', 'digest', 'arrayBuffer'];

  var blocks = [];

  if (root.JS_SHA256_NO_NODE_JS || !Array.isArray) {
    Array.isArray = function (obj) {
      return Object.prototype.toString.call(obj) === '[object Array]';
    };
  }

  if (ARRAY_BUFFER && (root.JS_SHA256_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
    ArrayBuffer.isView = function (obj) {
      return typeof obj === 'object' && obj.buffer && obj.buffer.constructor === ArrayBuffer;
    };
  }

  var createOutputMethod = function (outputType, is224) {
    return function (message) {
      return new Sha256(is224, true).update(message)[outputType]();
    };
  };

  var createMethod = function (is224) {
    var method = createOutputMethod('hex', is224);
    if (NODE_JS) {
      method = nodeWrap(method, is224);
    }
    method.create = function () {
      return new Sha256(is224);
    };
    method.update = function (message) {
      return method.create().update(message);
    };
    for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
      var type = OUTPUT_TYPES[i];
      method[type] = createOutputMethod(type, is224);
    }
    return method;
  };

  var nodeWrap = function (method, is224) {
    var crypto = require('crypto')
    var Buffer = require('buffer').Buffer;
    var algorithm = is224 ? 'sha224' : 'sha256';
    var bufferFrom;
    if (Buffer.from && !root.JS_SHA256_NO_BUFFER_FROM) {
      bufferFrom = Buffer.from;
    } else {
      bufferFrom = function (message) {
        return new Buffer(message);
      };
    }
    var nodeMethod = function (message) {
      if (typeof message === 'string') {
        return crypto.createHash(algorithm).update(message, 'utf8').digest('hex');
      } else {
        if (message === null || message === undefined) {
          throw new Error(ERROR);
        } else if (message.constructor === ArrayBuffer) {
          message = new Uint8Array(message);
        }
      }
      if (Array.isArray(message) || ArrayBuffer.isView(message) ||
        message.constructor === Buffer) {
        return crypto.createHash(algorithm).update(bufferFrom(message)).digest('hex');
      } else {
        return method(message);
      }
    };
    return nodeMethod;
  };

  var createHmacOutputMethod = function (outputType, is224) {
    return function (key, message) {
      return new HmacSha256(key, is224, true).update(message)[outputType]();
    };
  };

  var createHmacMethod = function (is224) {
    var method = createHmacOutputMethod('hex', is224);
    method.create = function (key) {
      return new HmacSha256(key, is224);
    };
    method.update = function (key, message) {
      return method.create(key).update(message);
    };
    for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
      var type = OUTPUT_TYPES[i];
      method[type] = createHmacOutputMethod(type, is224);
    }
    return method;
  };

  function Sha256(is224, sharedMemory) {
    if (sharedMemory) {
      blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] =
        blocks[4] = blocks[5] = blocks[6] = blocks[7] =
        blocks[8] = blocks[9] = blocks[10] = blocks[11] =
        blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
      this.blocks = blocks;
    } else {
      this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    if (is224) {
      this.h0 = 0xc1059ed8;
      this.h1 = 0x367cd507;
      this.h2 = 0x3070dd17;
      this.h3 = 0xf70e5939;
      this.h4 = 0xffc00b31;
      this.h5 = 0x68581511;
      this.h6 = 0x64f98fa7;
      this.h7 = 0xbefa4fa4;
    } else { // 256
      this.h0 = 0x6a09e667;
      this.h1 = 0xbb67ae85;
      this.h2 = 0x3c6ef372;
      this.h3 = 0xa54ff53a;
      this.h4 = 0x510e527f;
      this.h5 = 0x9b05688c;
      this.h6 = 0x1f83d9ab;
      this.h7 = 0x5be0cd19;
    }

    this.block = this.start = this.bytes = this.hBytes = 0;
    this.finalized = this.hashed = false;
    this.first = true;
    this.is224 = is224;
  }

  Sha256.prototype.update = function (message) {
    if (this.finalized) {
      return;
    }
    var notString, type = typeof message;
    if (type !== 'string') {
      if (type === 'object') {
        if (message === null) {
          throw new Error(ERROR);
        } else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
          message = new Uint8Array(message);
        } else if (!Array.isArray(message)) {
          if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
            throw new Error(ERROR);
          }
        }
      } else {
        throw new Error(ERROR);
      }
      notString = true;
    }
    var code, index = 0, i, length = message.length, blocks = this.blocks;
    while (index < length) {
      if (this.hashed) {
        this.hashed = false;
        blocks[0] = this.block;
        this.block = blocks[16] = blocks[1] = blocks[2] = blocks[3] =
          blocks[4] = blocks[5] = blocks[6] = blocks[7] =
          blocks[8] = blocks[9] = blocks[10] = blocks[11] =
          blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
      }

      if (notString) {
        for (i = this.start; index < length && i < 64; ++index) {
          blocks[i >>> 2] |= message[index] << SHIFT[i++ & 3];
        }
      } else {
        for (i = this.start; index < length && i < 64; ++index) {
          code = message.charCodeAt(index);
          if (code < 0x80) {
            blocks[i >>> 2] |= code << SHIFT[i++ & 3];
          } else if (code < 0x800) {
            blocks[i >>> 2] |= (0xc0 | (code >>> 6)) << SHIFT[i++ & 3];
            blocks[i >>> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else if (code < 0xd800 || code >= 0xe000) {
            blocks[i >>> 2] |= (0xe0 | (code >>> 12)) << SHIFT[i++ & 3];
            blocks[i >>> 2] |= (0x80 | ((code >>> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >>> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else {
            code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++index) & 0x3ff));
            blocks[i >>> 2] |= (0xf0 | (code >>> 18)) << SHIFT[i++ & 3];
            blocks[i >>> 2] |= (0x80 | ((code >>> 12) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >>> 2] |= (0x80 | ((code >>> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >>> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          }
        }
      }

      this.lastByteIndex = i;
      this.bytes += i - this.start;
      if (i >= 64) {
        this.block = blocks[16];
        this.start = i - 64;
        this.hash();
        this.hashed = true;
      } else {
        this.start = i;
      }
    }
    if (this.bytes > 4294967295) {
      this.hBytes += this.bytes / 4294967296 << 0;
      this.bytes = this.bytes % 4294967296;
    }
    return this;
  };

  Sha256.prototype.finalize = function () {
    if (this.finalized) {
      return;
    }
    this.finalized = true;
    var blocks = this.blocks, i = this.lastByteIndex;
    blocks[16] = this.block;
    blocks[i >>> 2] |= EXTRA[i & 3];
    this.block = blocks[16];
    if (i >= 56) {
      if (!this.hashed) {
        this.hash();
      }
      blocks[0] = this.block;
      blocks[16] = blocks[1] = blocks[2] = blocks[3] =
        blocks[4] = blocks[5] = blocks[6] = blocks[7] =
        blocks[8] = blocks[9] = blocks[10] = blocks[11] =
        blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
    }
    blocks[14] = this.hBytes << 3 | this.bytes >>> 29;
    blocks[15] = this.bytes << 3;
    this.hash();
  };

  Sha256.prototype.hash = function () {
    var a = this.h0, b = this.h1, c = this.h2, d = this.h3, e = this.h4, f = this.h5, g = this.h6,
      h = this.h7, blocks = this.blocks, j, s0, s1, maj, t1, t2, ch, ab, da, cd, bc;

    for (j = 16; j < 64; ++j) {
      // rightrotate
      t1 = blocks[j - 15];
      s0 = ((t1 >>> 7) | (t1 << 25)) ^ ((t1 >>> 18) | (t1 << 14)) ^ (t1 >>> 3);
      t1 = blocks[j - 2];
      s1 = ((t1 >>> 17) | (t1 << 15)) ^ ((t1 >>> 19) | (t1 << 13)) ^ (t1 >>> 10);
      blocks[j] = blocks[j - 16] + s0 + blocks[j - 7] + s1 << 0;
    }

    bc = b & c;
    for (j = 0; j < 64; j += 4) {
      if (this.first) {
        if (this.is224) {
          ab = 300032;
          t1 = blocks[0] - 1413257819;
          h = t1 - 150054599 << 0;
          d = t1 + 24177077 << 0;
        } else {
          ab = 704751109;
          t1 = blocks[0] - 210244248;
          h = t1 - 1521486534 << 0;
          d = t1 + 143694565 << 0;
        }
        this.first = false;
      } else {
        s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        ab = a & b;
        maj = ab ^ (a & c) ^ bc;
        ch = (e & f) ^ (~e & g);
        t1 = h + s1 + ch + K[j] + blocks[j];
        t2 = s0 + maj;
        h = d + t1 << 0;
        d = t1 + t2 << 0;
      }
      s0 = ((d >>> 2) | (d << 30)) ^ ((d >>> 13) | (d << 19)) ^ ((d >>> 22) | (d << 10));
      s1 = ((h >>> 6) | (h << 26)) ^ ((h >>> 11) | (h << 21)) ^ ((h >>> 25) | (h << 7));
      da = d & a;
      maj = da ^ (d & b) ^ ab;
      ch = (h & e) ^ (~h & f);
      t1 = g + s1 + ch + K[j + 1] + blocks[j + 1];
      t2 = s0 + maj;
      g = c + t1 << 0;
      c = t1 + t2 << 0;
      s0 = ((c >>> 2) | (c << 30)) ^ ((c >>> 13) | (c << 19)) ^ ((c >>> 22) | (c << 10));
      s1 = ((g >>> 6) | (g << 26)) ^ ((g >>> 11) | (g << 21)) ^ ((g >>> 25) | (g << 7));
      cd = c & d;
      maj = cd ^ (c & a) ^ da;
      ch = (g & h) ^ (~g & e);
      t1 = f + s1 + ch + K[j + 2] + blocks[j + 2];
      t2 = s0 + maj;
      f = b + t1 << 0;
      b = t1 + t2 << 0;
      s0 = ((b >>> 2) | (b << 30)) ^ ((b >>> 13) | (b << 19)) ^ ((b >>> 22) | (b << 10));
      s1 = ((f >>> 6) | (f << 26)) ^ ((f >>> 11) | (f << 21)) ^ ((f >>> 25) | (f << 7));
      bc = b & c;
      maj = bc ^ (b & d) ^ cd;
      ch = (f & g) ^ (~f & h);
      t1 = e + s1 + ch + K[j + 3] + blocks[j + 3];
      t2 = s0 + maj;
      e = a + t1 << 0;
      a = t1 + t2 << 0;
      this.chromeBugWorkAround = true;
    }

    this.h0 = this.h0 + a << 0;
    this.h1 = this.h1 + b << 0;
    this.h2 = this.h2 + c << 0;
    this.h3 = this.h3 + d << 0;
    this.h4 = this.h4 + e << 0;
    this.h5 = this.h5 + f << 0;
    this.h6 = this.h6 + g << 0;
    this.h7 = this.h7 + h << 0;
  };

  Sha256.prototype.hex = function () {
    this.finalize();

    var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5,
      h6 = this.h6, h7 = this.h7;

    var hex = HEX_CHARS[(h0 >>> 28) & 0x0F] + HEX_CHARS[(h0 >>> 24) & 0x0F] +
      HEX_CHARS[(h0 >>> 20) & 0x0F] + HEX_CHARS[(h0 >>> 16) & 0x0F] +
      HEX_CHARS[(h0 >>> 12) & 0x0F] + HEX_CHARS[(h0 >>> 8) & 0x0F] +
      HEX_CHARS[(h0 >>> 4) & 0x0F] + HEX_CHARS[h0 & 0x0F] +
      HEX_CHARS[(h1 >>> 28) & 0x0F] + HEX_CHARS[(h1 >>> 24) & 0x0F] +
      HEX_CHARS[(h1 >>> 20) & 0x0F] + HEX_CHARS[(h1 >>> 16) & 0x0F] +
      HEX_CHARS[(h1 >>> 12) & 0x0F] + HEX_CHARS[(h1 >>> 8) & 0x0F] +
      HEX_CHARS[(h1 >>> 4) & 0x0F] + HEX_CHARS[h1 & 0x0F] +
      HEX_CHARS[(h2 >>> 28) & 0x0F] + HEX_CHARS[(h2 >>> 24) & 0x0F] +
      HEX_CHARS[(h2 >>> 20) & 0x0F] + HEX_CHARS[(h2 >>> 16) & 0x0F] +
      HEX_CHARS[(h2 >>> 12) & 0x0F] + HEX_CHARS[(h2 >>> 8) & 0x0F] +
      HEX_CHARS[(h2 >>> 4) & 0x0F] + HEX_CHARS[h2 & 0x0F] +
      HEX_CHARS[(h3 >>> 28) & 0x0F] + HEX_CHARS[(h3 >>> 24) & 0x0F] +
      HEX_CHARS[(h3 >>> 20) & 0x0F] + HEX_CHARS[(h3 >>> 16) & 0x0F] +
      HEX_CHARS[(h3 >>> 12) & 0x0F] + HEX_CHARS[(h3 >>> 8) & 0x0F] +
      HEX_CHARS[(h3 >>> 4) & 0x0F] + HEX_CHARS[h3 & 0x0F] +
      HEX_CHARS[(h4 >>> 28) & 0x0F] + HEX_CHARS[(h4 >>> 24) & 0x0F] +
      HEX_CHARS[(h4 >>> 20) & 0x0F] + HEX_CHARS[(h4 >>> 16) & 0x0F] +
      HEX_CHARS[(h4 >>> 12) & 0x0F] + HEX_CHARS[(h4 >>> 8) & 0x0F] +
      HEX_CHARS[(h4 >>> 4) & 0x0F] + HEX_CHARS[h4 & 0x0F] +
      HEX_CHARS[(h5 >>> 28) & 0x0F] + HEX_CHARS[(h5 >>> 24) & 0x0F] +
      HEX_CHARS[(h5 >>> 20) & 0x0F] + HEX_CHARS[(h5 >>> 16) & 0x0F] +
      HEX_CHARS[(h5 >>> 12) & 0x0F] + HEX_CHARS[(h5 >>> 8) & 0x0F] +
      HEX_CHARS[(h5 >>> 4) & 0x0F] + HEX_CHARS[h5 & 0x0F] +
      HEX_CHARS[(h6 >>> 28) & 0x0F] + HEX_CHARS[(h6 >>> 24) & 0x0F] +
      HEX_CHARS[(h6 >>> 20) & 0x0F] + HEX_CHARS[(h6 >>> 16) & 0x0F] +
      HEX_CHARS[(h6 >>> 12) & 0x0F] + HEX_CHARS[(h6 >>> 8) & 0x0F] +
      HEX_CHARS[(h6 >>> 4) & 0x0F] + HEX_CHARS[h6 & 0x0F];
    if (!this.is224) {
      hex += HEX_CHARS[(h7 >>> 28) & 0x0F] + HEX_CHARS[(h7 >>> 24) & 0x0F] +
        HEX_CHARS[(h7 >>> 20) & 0x0F] + HEX_CHARS[(h7 >>> 16) & 0x0F] +
        HEX_CHARS[(h7 >>> 12) & 0x0F] + HEX_CHARS[(h7 >>> 8) & 0x0F] +
        HEX_CHARS[(h7 >>> 4) & 0x0F] + HEX_CHARS[h7 & 0x0F];
    }
    return hex;
  };

  Sha256.prototype.toString = Sha256.prototype.hex;

  Sha256.prototype.digest = function () {
    this.finalize();

    var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5,
      h6 = this.h6, h7 = this.h7;

    var arr = [
      (h0 >>> 24) & 0xFF, (h0 >>> 16) & 0xFF, (h0 >>> 8) & 0xFF, h0 & 0xFF,
      (h1 >>> 24) & 0xFF, (h1 >>> 16) & 0xFF, (h1 >>> 8) & 0xFF, h1 & 0xFF,
      (h2 >>> 24) & 0xFF, (h2 >>> 16) & 0xFF, (h2 >>> 8) & 0xFF, h2 & 0xFF,
      (h3 >>> 24) & 0xFF, (h3 >>> 16) & 0xFF, (h3 >>> 8) & 0xFF, h3 & 0xFF,
      (h4 >>> 24) & 0xFF, (h4 >>> 16) & 0xFF, (h4 >>> 8) & 0xFF, h4 & 0xFF,
      (h5 >>> 24) & 0xFF, (h5 >>> 16) & 0xFF, (h5 >>> 8) & 0xFF, h5 & 0xFF,
      (h6 >>> 24) & 0xFF, (h6 >>> 16) & 0xFF, (h6 >>> 8) & 0xFF, h6 & 0xFF
    ];
    if (!this.is224) {
      arr.push((h7 >>> 24) & 0xFF, (h7 >>> 16) & 0xFF, (h7 >>> 8) & 0xFF, h7 & 0xFF);
    }
    return arr;
  };

  Sha256.prototype.array = Sha256.prototype.digest;

  Sha256.prototype.arrayBuffer = function () {
    this.finalize();

    var buffer = new ArrayBuffer(this.is224 ? 28 : 32);
    var dataView = new DataView(buffer);
    dataView.setUint32(0, this.h0);
    dataView.setUint32(4, this.h1);
    dataView.setUint32(8, this.h2);
    dataView.setUint32(12, this.h3);
    dataView.setUint32(16, this.h4);
    dataView.setUint32(20, this.h5);
    dataView.setUint32(24, this.h6);
    if (!this.is224) {
      dataView.setUint32(28, this.h7);
    }
    return buffer;
  };

  function HmacSha256(key, is224, sharedMemory) {
    var i, type = typeof key;
    if (type === 'string') {
      var bytes = [], length = key.length, index = 0, code;
      for (i = 0; i < length; ++i) {
        code = key.charCodeAt(i);
        if (code < 0x80) {
          bytes[index++] = code;
        } else if (code < 0x800) {
          bytes[index++] = (0xc0 | (code >>> 6));
          bytes[index++] = (0x80 | (code & 0x3f));
        } else if (code < 0xd800 || code >= 0xe000) {
          bytes[index++] = (0xe0 | (code >>> 12));
          bytes[index++] = (0x80 | ((code >>> 6) & 0x3f));
          bytes[index++] = (0x80 | (code & 0x3f));
        } else {
          code = 0x10000 + (((code & 0x3ff) << 10) | (key.charCodeAt(++i) & 0x3ff));
          bytes[index++] = (0xf0 | (code >>> 18));
          bytes[index++] = (0x80 | ((code >>> 12) & 0x3f));
          bytes[index++] = (0x80 | ((code >>> 6) & 0x3f));
          bytes[index++] = (0x80 | (code & 0x3f));
        }
      }
      key = bytes;
    } else {
      if (type === 'object') {
        if (key === null) {
          throw new Error(ERROR);
        } else if (ARRAY_BUFFER && key.constructor === ArrayBuffer) {
          key = new Uint8Array(key);
        } else if (!Array.isArray(key)) {
          if (!ARRAY_BUFFER || !ArrayBuffer.isView(key)) {
            throw new Error(ERROR);
          }
        }
      } else {
        throw new Error(ERROR);
      }
    }

    if (key.length > 64) {
      key = (new Sha256(is224, true)).update(key).array();
    }

    var oKeyPad = [], iKeyPad = [];
    for (i = 0; i < 64; ++i) {
      var b = key[i] || 0;
      oKeyPad[i] = 0x5c ^ b;
      iKeyPad[i] = 0x36 ^ b;
    }

    Sha256.call(this, is224, sharedMemory);

    this.update(iKeyPad);
    this.oKeyPad = oKeyPad;
    this.inner = true;
    this.sharedMemory = sharedMemory;
  }
  HmacSha256.prototype = new Sha256();

  HmacSha256.prototype.finalize = function () {
    Sha256.prototype.finalize.call(this);
    if (this.inner) {
      this.inner = false;
      var innerHash = this.array();
      Sha256.call(this, this.is224, this.sharedMemory);
      this.update(this.oKeyPad);
      this.update(innerHash);
      Sha256.prototype.finalize.call(this);
    }
  };

  var exports = createMethod();
  exports.sha256 = exports;
  exports.sha224 = createMethod(true);
  exports.sha256.hmac = createHmacMethod();
  exports.sha224.hmac = createHmacMethod(true);

  if (COMMON_JS) {
    module.exports = exports;
  } else {
    root.sha256 = exports.sha256;
    root.sha224 = exports.sha224;
    if (AMD) {
      define(function () {
        return exports;
      });
    }
  }
})();

return module.exports;});
;
(function(root,factory){root.CxxCrypto=factory();})(globalThis,function(){throw Error("Unassembled module: CxxCrypto");});

;
(async()=>{await waitGlobalInitialized('Cxx233Updater');/* Initialize readers and draft services before a story exists. Each write checks the installer journal in its own transaction. */
let cxxOwner;const cxxRunCurrent=()=>cxxOwner?.alive===true&&parent.Cxx233Runtime===cxxOwner;
/* Shared, pure inventory and cyberware rules. No DOM or host writes. */
/* Shared, pure inventory and cyberware rules. No DOM or host writes. */
/* Definition identity is shared by saved inventory, numeric effects and content sync. */
(function(root,factory){root.CxxItemDefinitions=factory();})(globalThis,function(){throw Error("Unassembled module: CxxItemDefinitions");});

;

;
(function(root,factory){root.CxxCombatView=factory();})(globalThis,function(){throw Error("Unassembled module: CxxCombatView");});


;
/* Data only: no expressions, executable descriptions, or player balance ceiling. */
(function(root,factory){root.CxxItemArt=factory();})(globalThis,function(){throw Error("Unassembled module: CxxItemArt");});
;
(function(root,factory){root.CxxItemModel=factory();})(globalThis,function(){throw Error("Unassembled module: CxxItemModel");});

;
/* Generated by 工具/构建/装配战斗/catalog.cjs. Edit the source mappings there. */
(function(root,factory){root.CxxItemCatalog=factory();})(globalThis,function(){throw Error("Unassembled module: CxxItemCatalog");});

;
/* Shared, pure inventory and cyberware rules. No DOM or host writes. */
(function(root,factory){root.CxxLoadout=factory();})(globalThis,function(){throw Error("Unassembled module: CxxLoadout");});


;
(function(root,factory){root.CxxPlayerAssets=factory();})(globalThis,function(){throw Error("Unassembled module: CxxPlayerAssets");});

;
(function(root,factory){root.CxxPlayerArt=factory();})(globalThis,function(){throw Error("Unassembled module: CxxPlayerArt");});

;
(function(root,factory){root.CxxItemEditor=factory();})(globalThis,function(){throw Error("Unassembled module: CxxItemEditor");});

;
(function(root,factory){root.CxxLoadoutSetup=factory();})(globalThis,function(){throw Error("Unassembled module: CxxLoadoutSetup");});


;

;
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxNumericRules=value;})(globalThis,function(){
  'use strict';
  return {
    id:'tokyo_soft_power',version:2,
    health:{base:80,body:5,level:5},attack:{scale:.4,level:1.5},defenseCap:.8,
    attributes:{body:4,reflexes:4,intelligence:4,technical:4,cool:4},
    exponent:3,offenseShare:0.5,criticalMultiplier:1.5,
    vitals:{hp:100,stamina:100,ram:10},
    injuryWeight:0.3,
    districts:{ordinary:1,corporate:1.15,combat_zone:1.25},
    templates:{
      civilian:{label:'普通市民',defaultLevel:1,attributes:{body:3,reflexes:3,intelligence:3,technical:3,cool:3},tags:[]},
      thug:{label:'街头枪手',defaultLevel:3,attributes:{body:6,reflexes:5,intelligence:3,technical:4,cool:4},tags:['human','gun']},
      guard:{label:'安保人员',defaultLevel:8,attributes:{body:8,reflexes:8,intelligence:5,technical:7,cool:7},tags:['human','gun','armored']},
      netrunner:{label:'网络行者',defaultLevel:12,attributes:{body:4,reflexes:6,intelligence:13,technical:10,cool:7},tags:['human','cyberdeck']},
      elite:{label:'精锐战斗员',defaultLevel:20,attributes:{body:13,reflexes:14,intelligence:9,technical:12,cool:12},tags:['human','gun','armored']},
      cyberpsycho:{label:'失控义体战士',defaultLevel:25,attributes:{body:18,reflexes:17,intelligence:8,technical:16,cool:10},tags:['human','cyberware','armored']},
      drone:{label:'巡逻无人机',defaultLevel:6,attributes:{body:5,reflexes:9,intelligence:3,technical:9,cool:5},tags:['machine','gun']},
      brawler:{label:'近战打手',defaultLevel:4,attributes:{body:9,reflexes:6,intelligence:3,technical:3,cool:4},tags:['human','melee']},
      scavenger:{label:'拾荒者',defaultLevel:4,attributes:{body:6,reflexes:5,intelligence:4,technical:7,cool:4},tags:['human','gun']},
      raider:{label:'荒野掠夺者',defaultLevel:7,attributes:{body:9,reflexes:8,intelligence:4,technical:6,cool:6},tags:['human','gun']},
      assault:{label:'突击手',defaultLevel:10,attributes:{body:10,reflexes:11,intelligence:5,technical:7,cool:7},tags:['human','gun','armored']},
      sniper:{label:'狙击手',defaultLevel:12,attributes:{body:5,reflexes:12,intelligence:7,technical:7,cool:14},tags:['human','gun']},
      heavy:{label:'重装火力手',defaultLevel:15,attributes:{body:16,reflexes:7,intelligence:5,technical:12,cool:8},tags:['human','gun','armored']},
      blade:{label:'义体刀手',defaultLevel:15,attributes:{body:10,reflexes:17,intelligence:5,technical:10,cool:12},tags:['human','melee','cyberware']},
      officer:{label:'战术指挥官',defaultLevel:18,attributes:{body:10,reflexes:12,intelligence:12,technical:10,cool:15},tags:['human','gun','armored']},
      special_ops:{label:'特勤干员',defaultLevel:25,attributes:{body:16,reflexes:18,intelligence:12,technical:15,cool:17},tags:['human','gun','armored','cyberware']},
      turret:{label:'自动炮塔',defaultLevel:10,attributes:{body:10,reflexes:5,intelligence:3,technical:14,cool:10},tags:['machine','gun','armored']},
      combat_drone:{label:'战斗无人机',defaultLevel:14,attributes:{body:9,reflexes:15,intelligence:5,technical:14,cool:10},tags:['machine','gun','armored']},
      mech:{label:'重型安保机甲',defaultLevel:22,attributes:{body:20,reflexes:8,intelligence:4,technical:18,cool:12},tags:['machine','gun','armored']}
    },
    // Scene recognition chooses labels only. The engine owns their numbers.
    encounter:{ranks:{rookie:-2,regular:0,veteran:5,elite:10},health:{healthy:1,wounded:.65,critical:.25,incapacitated:0}}
  };
});



;
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxTalentRules=value;})(globalThis,function(){
  'use strict';
  // Explicit adaptations, never a parser of the original game's prose. Each array is one rank.
  const e=(kind,value,when='')=>({kind,value,when});
  const p=(n,w='')=>e('powerPct',n/100,w),c=(n,w='')=>e('critChance',n/100,w),d=(n,w='')=>e('critDamage',n/100,w);
  const a=(text,w='')=>({kind:'ability',text,when:w}),h=n=>e('hpMax',n),s=n=>e('staminaMax',n),r=n=>e('ramMax',n);
  const heavy='shotgun|lmg|hmg',auto='rifle|smg',precise='pistol|revolver|precision|sniper';
  const definitions={
    Body_Central_Milestone_1:[[a('战斗中可以通过短暂喘息恢复生命；由正文登记恢复事件。')]],
    Body_Central_Perk_1_1:[[p(4,'sprinting')]],
    Body_Central_Perk_1_2:[[p(8,'hp\x3c30')]],
    Body_Central_Perk_1_3:[[p(5,'surrounded')]],
    Body_Central_Perk_1_4:[[p(8,'recent_heal')]],
    Body_Right_Milestone_1:[[p(12,'vehicle&ramming'),a('撞击时优先保护己方乘员。','vehicle')]],
    Body_Right_Milestone_2:[[p(5,'blunt')],[a('持钝器可格挡冲锋并撞倒目标。','blunt'),p(6,'blunt&charging')]],
    Body_Right_Perk_2_1:[[p(10,'blunt&blocking&enemy:gun')]],
    Body_Right_Perk_2_2:[[p(8,'blunt&recent_block')]],
    Body_Right_Perk_2_3:[[a('钝器反击可以造成击晕，防御攻击可以击倒。','blunt'),p(6,'blunt&counter')]],
    Body_Right_Perk_2_4:[[p(10,'blunt&heavy_attack&enemy:armored')]],
    Body_Left_Milestone_2:[[c(10,heavy+'&stamina\x3c33')],[p(5,heavy+'&stamina\x3c50')]],
    Body_Left_Perk_2_1:[[p(5,heavy+'&moving')]],
    Body_Left_Perk_2_3:[[p(7,heavy+'&stamina\x3c33')]],
    Body_Left_Perk_2_4:[[a('持重型枪械仍能灵活移动。',heavy),p(4,heavy+'&moving')]],
    Body_Right_Milestone_3:[[p(5,'blunt')],[p(6,'blunt')],[a('钝器可砸地震退周围目标。','blunt'),p(8,'blunt&ground_slam')]],
    Body_Right_Perk_3_1:[[p(8,'blunt&ground_slam&airborne')]],
    Body_Right_Perk_3_2:[[a('砸地命中后可以恢复耐力，按正文登记实际恢复。','blunt')]],
    Body_Inbetween_Right_3:[[a('砸地命中后可以恢复生命，按正文登记实际恢复。','blunt')]],
    Body_Central_Milestone_3:[[h(20)],[a('治疗时可获得额外恢复。')],[a('治疗可以产生临时气血护持。'),p(8,'adrenaline')]],
    Body_Central_Perk_3_1:[[a('气血护持可以维持至下一次有效交锋结束。')]],
    Body_Central_Perk_3_2:[[p(10,'adrenaline')]],
    Body_Central_Perk_3_4:[[a('气血护持期间抵抗减速、打倒与致盲。','adrenaline')]],
    Body_Inbetween_Left_3:[[a('气血护持期间压制近敌可以延续护持。','adrenaline')]],
    Body_Left_Milestone_3:[[c(10,heavy+'&stamina\x3c33')],[p(6,heavy+'&close')],[a('重型枪械能够迅速压制濒临失能的近敌。',heavy),p(8,heavy+'&enemy:low_hp')]],
    Body_Left_Perk_3_1:[[p(6,heavy+'&recent_kill')]],
    Body_Left_Perk_3_2:[[p(12,'quick_melee&stamina\x3c33')]],
    Body_Left_Perk_3_3:[[p(8,heavy+'&enemy:armored')]],
    Body_Left_Perk_3_4:[[p(8,heavy+'&close&enemy:low_hp')]],
    Body_Master_Perk_1:[[p(15,'shotgun&melee_combo'),a('霰弹与近战交替能够形成连击优势。','shotgun')]],
    Body_Master_Perk_2:[[a('轻机枪击败目标后可趁势补充枪内弹药；仍须实际持有弹药。','lmg')]],
    Body_Master_Perk_3:[[a('气血护持期间击败目标有利于恢复治疗资源。','adrenaline')]],
    Body_Master_Perk_5:[[a('可对失能边缘的目标实施钝器终结或摔投；不强制致死。','blunt'),p(15,'blunt&enemy:low_hp')]],
    Reflexes_Central_Milestone_1:[[p(6,'moving')]],
    Reflexes_Central_Perk_1_1:[[a('可以进行长距离滑铲。')]],
    Reflexes_Central_Perk_1_2:[[a('可在冲刺、翻越和滑铲中换弹。')]],
    Reflexes_Central_Perk_1_3:[[a('可以快速攀爬和翻越。'),p(4,'climbing')]],
    Reflexes_Central_Perk_1_4:[[a('可在冲刺、翻越和滑铲中开火。','gun'),p(4,'gun&moving')]],
    Reflexes_Left_Milestone_1:[[a('可以跳车拔枪或驾驶射击。','vehicle&gun'),p(8,'vehicle&gun')]],
    Reflexes_Left_Milestone_2:[[p(5,auto)],[p(5,auto+'&stamina>50')]],
    Reflexes_Left_Perk_2_2:[[p(5,auto+'&weapon_switch')]],
    Reflexes_Left_Perk_2_3:[[p(5,auto+'&aiming')]],
    Reflexes_Left_Perk_2_4:[[p(6,auto+'&ranged')]],
    Reflexes_Central_Milestone_2:[[s(10)],[a('解锁突进，可快速穿越近距离并越过低矮障碍。'),p(6,'dashing')]],
    Reflexes_Central_Perk_2_1:[[p(6,'dashing&closing')]],
    Reflexes_Central_Perk_2_2:[[p(8,'dashing')]],
    Reflexes_Central_Perk_2_3:[[a('突进中击败目标可以恢复耐力。')]],
    Reflexes_Central_Perk_2_4:[[a('可在突进中开火。','gun'),p(5,'gun&dashing')]],
    Reflexes_Inbetween_Right_2:[[a('刀剑重击可跃向近距离目标。','blade'),p(10,'blade&leap_attack')]],
    Reflexes_Right_Milestone_2:[[p(5,'blade')],[a('刀剑可以消耗耐力格挡射弹。','blade'),p(6,'blade&blocking')]],
    Reflexes_Right_Perk_2_1:[[p(10,'blade&blocking&stamina>33')]],
    Reflexes_Right_Perk_2_2:[[p(8,'blade&counter')]],
    Reflexes_Right_Perk_2_3:[[c(25,'blade&counter&time_slow')]],
    Reflexes_Right_Milestone_3:[[p(5,'blade')],[p(6,'blade')],[a('刀剑可以终结濒临失能目标，成功后有机会恢复生命。','blade'),p(10,'blade&enemy:low_hp')]],
    Reflexes_Right_Perk_3_1:[[p(8,'blade&recent_finisher')]],
    Reflexes_Right_Perk_3_3:[[p(8,'blade&enemy:stunned|enemy:bleeding|enemy:blind')]],
    Reflexes_Right_Perk_3_4:[[a('可从更远处切入刀剑终结动作。','blade')]],
    Reflexes_Central_Milestone_3:[[s(10)],[p(6,'dashing')],[a('解锁空中突进。'),p(6,'air_dash')]],
    Reflexes_Central_Perk_3_2:[[p(5,'airborne')]],
    Reflexes_Central_Perk_3_3:[[p(8,'airborne')]],
    Reflexes_Inbetween_Left_3:[[a('可借克伦齐科夫进行短暂空中悬停。','kerenzikov'),p(8,'kerenzikov&airborne')]],
    Reflexes_Left_Milestone_3:[[p(5,auto+'&aiming')],[p(5,auto)],[p(8,auto+'&sustained_fire')]],
    Reflexes_Left_Perk_3_1:[[a('自动武器可边瞄准边快速移动，翻越时也可开火。',auto),p(4,auto+'&moving')]],
    Reflexes_Left_Perk_3_2:[[p(5,auto+'&hip_fire')]],
    Reflexes_Left_Perk_3_3:[[c(10,auto+'&sustained_fire'),d(15,auto+'&sustained_fire')]],
    Reflexes_Left_Perk_3_4:[[p(8,auto+'&sustained_fire&enemy:armored')]],
    Reflexes_Master_Perk_1:[[p(15,'rifle&sustained_fire')]],
    Reflexes_Master_Perk_2:[[p(12,'smg&weapon_switch'),a('切入冲锋枪时可以迅速装填已有弹药。','smg')]],
    Reflexes_Master_Perk_3:[[a('空中突进不再额外消耗耐力；二段跳仍须实际具备。')]],
    Reflexes_Master_Perk_5:[[a('刀剑攻击可造成流血，利于后续终结。','blade'),p(12,'blade&enemy:bleeding')]],
    Intelligence_Left_Milestone_1:[[a('可识别附近摄像头和接入点，借摄像头施加控制破解。','cyberdeck'),p(6,'cyberdeck&camera')]],
    Intelligence_Left_Perk_1_1:[[p(12,'cyberdeck&device_explosion')]],
    Intelligence_Left_Perk_1_2:[[a('接入点破解所需步骤减少。','cyberdeck')]],
    Intelligence_Right_Milestone_1:[[a('解锁车辆快速破解，可用指令取决于实际网络接入仓。','cyberdeck')]],
    Intelligence_Central_Milestone_1:[[a('有网络接入仓时，短暂调整可恢复RAM。','cyberdeck')]],
    Intelligence_Central_Perk_1_1:[[p(6,'cyberdeck&stealth')]],
    Intelligence_Central_Perk_1_2:[[p(6,'cyberdeck&close')]],
    Intelligence_Central_Perk_1_3:[[p(8,'cyberdeck&enemy:full_hp')]],
    Intelligence_Left_Milestone_2:[[r(1)],[a('可连续排入两项破解形成组合。','cyberdeck'),p(6,'cyberdeck&hack_queue')]],
    Intelligence_Left_Perk_2_1:[[a('被敌方黑客锁定时可反向追踪和破解。','cyberdeck'),p(8,'cyberdeck&enemy:netrunner')]],
    Intelligence_Left_Perk_2_2:[[a('目标失能后，可回收尚未执行的破解所占RAM。','cyberdeck')]],
    Intelligence_Left_Perk_2_3:[[a('反向破解可沿连接影响敌方队友。','cyberdeck'),p(8,'cyberdeck&enemy:netrunner&outnumbered')]],
    Intelligence_Left_Perk_2_4:[[p(5,'cyberdeck&hack_queue')]],
    Intelligence_Central_Milestone_2:[[r(1)],[p(12,'cyberdeck&enemy:hacked')]],
    Intelligence_Central_Perk_2_1:[[a('战斗破解击败目标后可回收部分RAM。','cyberdeck')]],
    Intelligence_Central_Perk_2_2:[[p(5,'cyberdeck&enemy:hacked')]],
    Intelligence_Central_Perk_2_3:[[p(8,'cyberdeck&enemy:multiple_debuffs')]],
    Intelligence_Central_Perk_2_4:[[a('隐蔽击倒可以中断当前追踪。','cyberdeck')]],
    Intelligence_Inbetween_Left_2:[[a('单分子线命中可回收RAM。','monowire&cyberdeck'),p(6,'monowire&cyberdeck')]],
    Intelligence_Inbetween_Right_2:[[a('智能武器击败目标后可回收RAM。','smart&cyberdeck'),p(6,'smart&cyberdeck&enemy:hacked')]],
    Intelligence_Right_Milestone_2:[[p(5,'smart')],[a('智能武器换弹可保持锁定。','smart'),p(5,'smart&locked')]],
    Intelligence_Right_Perk_2_1:[[a('持续射击可维持智能武器锁定。','smart')]],
    Intelligence_Right_Perk_2_2:[[p(6,'smart&cyberdeck')]],
    Intelligence_Right_Milestone_3:[[p(5,'smart')],[p(6,'smart&weakpoint')],[a('切换智能武器可维持锁定。','smart')]],
    Intelligence_Right_Perk_3_1:[[a('智能武器可以同时锁定多个目标。','smart'),p(8,'smart&outnumbered')]],
    Intelligence_Right_Perk_3_2:[[p(8,'smart&recent_kill')]],
    Intelligence_Central_Milestone_3:[[r(1)],[p(6,'cyberdeck')],[a('可启动脑机超频，允许以生命代替不足的RAM；由正文明确登记代价。','cyberdeck'),p(10,'cyberdeck&overclock')]],
    Intelligence_Central_Perk_3_1:[[p(12,'cyberdeck&overclock&hp\x3c30')]],
    Intelligence_Central_Perk_3_2:[[a('超频期间回收RAM也可恢复生命。','cyberdeck&overclock')]],
    Intelligence_Central_Perk_3_3:[[a('启动超频时可恢复生命。','cyberdeck')]],
    Intelligence_Inbetween_Left_3:[[a('超频期间队列目标失能可恢复生命。','cyberdeck&overclock')]],
    Intelligence_Left_Milestone_3:[[r(1)],[p(5,'cyberdeck&device')],[a('破解队列再增加一个位置，后续上传更顺畅。','cyberdeck'),p(6,'cyberdeck&hack_queue')]],
    Intelligence_Left_Perk_3_1:[[a('不同类别破解组合可节约RAM。','cyberdeck')]],
    Intelligence_Left_Perk_3_2:[[p(6,'cyberdeck&hack_queue')]],
    Intelligence_Left_Perk_3_4:[[a('可用单分子线终结已遭破解且濒临失能的目标，并恢复资源。','monowire&cyberdeck'),p(12,'monowire&cyberdeck&enemy:low_hp')]],
    Intelligence_Master_Perk_1:[[a('破解队列再增加一格；完整队列能持续压制目标。','cyberdeck'),p(12,'cyberdeck&hack_queue')]],
    Intelligence_Master_Perk_3:[[a('超频破解可以沿连接传播至附近目标。','cyberdeck&overclock'),p(12,'cyberdeck&overclock&outnumbered')]],
    Intelligence_Master_Perk_4:[[p(15,'smart&cyberdeck&overclock&enemy:hacked')]],
    Tech_Left_Milestone_1:[[a('可在喘息期间更快整备已有治疗道具和手雷。')]],
    Tech_Left_Perk_1_1:[[a('最后一份治疗道具可以发挥更强恢复作用。')]],
    Tech_Left_Perk_1_2:[[a('治疗资源不足时，优先整备剩余治疗道具。')]],
    Tech_Right_Milestone_1:[[p(12,'vehicle')]],
    Tech_Central_Milestone_2:[[p(6,'cyberware')],[p(3,'cyberware_coordinated'),a('安装至少三件义体时，协调性提高。')]],
    Tech_Central_Perk_2_1:[[a('已装义体可以发挥一项额外辅助特性，须符合该义体定义。','cyberware'),p(5,'cyberware')]],
    Tech_Central_Perk_2_2:[[p(3,'cyberware_coordinated'),a('安装至少三件义体时，发挥额外协调收益。')]],
    Tech_Central_Perk_2_3:[[a('拆解与回收时可获得更多可用材料。')]],
    Tech_Central_Perk_2_4:[[p(8,'body_coverage')]],
    Tech_Inbetween_Right_2:[[a('升级义体时可选择不同附加特性；不直接获得或升级义体。')]],
    Tech_Left_Milestone_2:[[a('治疗与手雷可在喘息时更快完成整备。')],[a('可多准备一份治疗道具，实际物资仍须取得。')]],
    Tech_Left_Perk_2_1:[[a('可多准备一份手雷，实际物资仍须取得。')]],
    Tech_Left_Perk_2_2:[[a('重伤且治疗耗尽时，击败目标可创造紧急自救机会。'),p(8,'hp\x3c25&healing_empty&recent_kill')]],
    Tech_Left_Perk_2_3:[[a('战斗中可以迅速使用治疗道具。')]],
    Tech_Left_Perk_2_4:[[a('手雷耗尽后可更快整备已有备用物资。')]],
    Tech_Right_Milestone_3:[[p(5,'tech_weapon')],[p(6,'tech_weapon&charged')],[a('可把握蓄能时机打出穿透掩体的爆能。','tech_weapon'),p(10,'tech_weapon&bolt')]],
    Tech_Right_Perk_3_1:[[a('技术武器蓄满后可以继续保持待发。','tech_weapon')]],
    Tech_Right_Perk_3_2:[[p(6,'tech_weapon&bolt')]],
    Tech_Right_Perk_3_3:[[p(12,'tech_weapon&bolt&enemy:armored')]],
    Tech_Right_Perk_3_4:[[p(8,'tech_weapon&sustained_fire')]],
    Tech_Central_Milestone_3:[[p(6,'cyberware')],[e('powerFlat',8)],[p(3,'skeleton_pair'),a('安装至少两件骨骼义体时，协同效率提高。')]],
    Tech_Central_Perk_3_1:[[a('已装义体的主动效果可维持至下一次有效交锋结束。','cyberware')]],
    Tech_Central_Perk_3_2:[[p(3,'hands_pair'),a('安装至少两件手掌义体时，协同效率提高。')]],
    Tech_Central_Perk_3_3:[[a('获得安装细胞适配的资格，仍须购买并由医生安装。')]],
    Tech_Central_Perk_3_4:[[p(8,'wide_coverage')]],
    Tech_Inbetween_Left_3:[[a('已装射弹发射系统可以更快整备并多备一次发射。','launcher'),p(8,'launcher')]],
    Tech_Left_Milestone_3:[[a('治疗与手雷整备能力进一步提高。')],[p(6,'explosives|launcher')],[p(10,'explosives|launcher&recent_explosion')]],
    Tech_Left_Perk_3_1:[[p(10,'explosion_exposure')]],
    Tech_Left_Perk_3_2:[[a('连续爆炸压制后，可趁势整备已有手雷。','explosives')]],
    Tech_Left_Perk_3_3:[[a('闪光、烟雾和侦查手雷可多作一份准备；仍需实际物资。')]],
    Tech_Left_Perk_3_4:[[p(8,'recent_explosion')]],
    Tech_Master_Perk_2:[[a('启动已安装的狂暴、斯安威斯坦或脑机超频后，可释放近距离EMP。','berserk|sandevistan|cyberdeck'),p(12,'emp_burst')]],
    Tech_Master_Perk_3:[[a('可协调复杂义体组合；暴怒状态仍由实际剧情触发，不因负荷数字自动受伤。'),p(3,'cyberware_coordinated'),p(10,'fury'),c(20,'fury'),d(25,'fury')]],
    Tech_Master_Perk_5:[[a('爆能可转为电弧打击附近多个目标。','tech_weapon'),p(15,'tech_weapon&bolt&outnumbered')]],
    Cool_Left_Milestone_1:[[a('驾驶时可以使用已安装的时间减速义体。','vehicle'),p(10,'vehicle&drifting|airborne')]],
    Cool_Central_Milestone_1:[[p(6,'crouching')]],
    Cool_Central_Perk_1_1:[[p(6,'cover&aiming')]],
    Cool_Central_Perk_1_2:[[p(6,'crouching&stationary')]],
    Cool_Central_Perk_1_4:[[p(6,'crouching&stealth')]],
    Cool_Right_Milestone_1:[[p(10,'throwing|silenced&stealth')]],
    Cool_Right_Perk_1_1:[[a('刚暴露时迅速压制发现者，可以延缓敌群警觉。')]],
    Cool_Right_Perk_1_2:[[p(6,'stealth&recent_kill')]],
    Cool_Right_Milestone_2:[[p(5,'throwing')],[a('精准投掷可以附加中毒。','throwing'),p(6,'throwing&enemy:poisoned')]],
    Cool_Right_Perk_2_1:[[a('投掷毒性效果也可干扰机械目标。','throwing'),p(8,'throwing&enemy:machine')]],
    Cool_Right_Perk_2_2:[[a('投掷毒性效果还能致盲并限制冲刺。','throwing')]],
    Cool_Right_Perk_2_3:[[p(10,'throwing|heavy_attack&enemy:poisoned')]],
    Cool_Right_Perk_2_4:[[a('精准投掷得手后可恢复少量生命。','throwing')]],
    Cool_Left_Milestone_2:[[p(6,precise+'&weakpoint')],[p(8,precise+'&aiming&stamina>85'),a('解锁聚焦，可以集中精神进行短暂精准射击。',precise)]],
    Cool_Left_Perk_2_1:[[a('聚焦期间击败目标可以维持专注。',precise)]],
    Cool_Left_Perk_2_2:[[p(6,precise+'&recent_kill')]],
    Cool_Left_Perk_2_3:[[a('聚焦中可尝试射爆空中手雷。',precise)]],
    Cool_Left_Perk_2_4:[[a('聚焦期间击败目标有利于节约耐力。',precise)]],
    Cool_Inbetween_Left_2:[[p(6,'focus')]],
    Cool_Right_Milestone_3:[[p(5,'throwing')],[p(8,'throwing&weakpoint')],[a('精准投掷击败目标后，可快速再次投掷已有武器。','throwing'),p(6,'throwing&recent_kill')]],
    Cool_Right_Perk_3_1:[[p(12,'throwing&retrieved_weapon&melee')]],
    Cool_Right_Perk_3_2:[[a('可用投掷武器终结濒临失能目标，成功后可恢复生命。','throwing'),p(12,'throwing&enemy:low_hp')]],
    Cool_Right_Perk_3_4:[[d(25,'throwing&recent_kill')]],
    Cool_Inbetween_Right_3:[[a('投掷命中可为接近目标并实施终结创造机会。','throwing')]],
    Cool_Central_Milestone_3:[[p(5,'crouching')],[p(5,'crouching')],[a('可消耗耐力进行安静的蹲伏冲刺。'),p(6,'crouch_sprint')]],
    Cool_Central_Perk_3_1:[[p(8,'crouch_sprint')]],
    Cool_Central_Perk_3_2:[[a('未暴露或光学迷彩期间击败目标，可恢复生命与耐力。'),p(6,'stealth|optical_camo&recent_kill')]],
    Cool_Central_Perk_3_4:[[a('蹲伏冲刺可节约耐力。')]],
    Cool_Inbetween_Left_3:[[a('蹲伏冲刺或滑铲时可启动已安装的光学迷彩，仍消耗其资源。','optical_camo_equipped')]],
    Cool_Left_Milestone_3:[[p(6,precise+'&weakpoint')],[p(5,precise)],[p(12,precise+'&stamina>85&weakpoint')]],
    Cool_Left_Perk_3_1:[[p(6,precise+'&weapon_switch')]],
    Cool_Left_Perk_3_2:[[p(8,precise+'&stamina>85&recent_kill')]],
    Cool_Left_Perk_3_3:[[p(8,precise+'&stamina>85&ranged')]],
    Cool_Left_Perk_3_4:[[a('精准远程击败目标后可恢复耐力。',precise)]],
    Cool_Master_Perk_1:[[c(35,'revolver|precision|sniper&stamina>85&weakpoint'),p(10,'revolver|precision|sniper&ranged')]],
    Cool_Master_Perk_2:[[a('手枪盲射不额外耗耐力。','pistol'),p(10,'pistol&focus')]],
    Cool_Master_Perk_4:[[c(35,'throwing&moving'),a('瞄准投掷时仍可灵活移动。','throwing')]]
  };
  const labels={cyberware_coordinated:'已安装至少三件义体',skeleton_pair:'至少两件骨骼义体',hands_pair:'至少两件手掌义体',body_coverage:'骨骼与表皮各至少两件义体',wide_coverage:'义体覆盖至少六个部位',shotgun:'霰弹枪',lmg:'轻机枪',hmg:'重机枪',rifle:'突击步枪',smg:'冲锋枪',pistol:'手枪',revolver:'左轮',precision:'精准步枪',sniper:'狙击步枪',gun:'枪械',blade:'刀剑',blunt:'钝器',throwing:'投掷武器',silenced:'消音武器',smart:'智能武器',tech_weapon:'技术武器',cyberdeck:'网络接入仓',cyberware:'已装义体',monowire:'单分子线',launcher:'射弹发射系统',vehicle:'车辆',berserk:'狂暴',sandevistan:'斯安威斯坦',kerenzikov:'克伦齐科夫',sprinting:'冲刺',surrounded:'被包围',recent_heal:'刚完成治疗',ramming:'车辆撞击',charging:'冲锋',blocking:'格挡',recent_block:'刚成功格挡',counter:'反击',heavy_attack:'重击',moving:'移动中',ground_slam:'砸地',airborne:'空中',adrenaline:'气血护持',close:'近距离',recent_kill:'本次交锋已击败目标',quick_melee:'敏捷近战',melee_combo:'霰弹近战连击',climbing:'攀爬',weapon_switch:'切换武器',aiming:'瞄准',ranged:'远距离',dashing:'突进',closing:'接近目标',leap_attack:'跃进攻击',time_slow:'时间减速',recent_finisher:'刚完成终结',air_dash:'空中突进',sustained_fire:'持续射击',hip_fire:'盲射',camera:'摄像头通路',device_explosion:'设备爆炸',stealth:'尚未暴露',hack_queue:'组合破解',outnumbered:'敌方多人',locked:'已锁定',weakpoint:'针对弱点',overclock:'脑机超频',device:'设备目标',skeleton_filled:'骨骼义体已装满',skin_filled:'表皮义体已装满',healing_empty:'治疗耗尽',charged:'蓄能射击',bolt:'爆能',all_cyberware_filled:'可用义体槽已装满',explosives:'爆炸武器',recent_explosion:'本次交锋已造成爆炸',explosion_exposure:'受爆炸威胁',emp_burst:'EMP爆发',fury:'暴怒',drifting:'漂移',crouching:'蹲伏',cover:'掩体',stationary:'静止',focus:'聚焦',retrieved_weapon:'刚取回投掷武器',melee:'近战',crouch_sprint:'蹲伏冲刺',optical_camo:'光学迷彩生效',optical_camo_equipped:'已装光学迷彩',human:'人类',machine:'机械',armored:'装甲',netrunner:'黑客',low_hp:'重伤',full_hp:'满血',hacked:'受破解影响',multiple_debuffs:'多种负面状态',stunned:'失衡或眩晕',bleeding:'流血',blind:'致盲',poisoned:'中毒'};
  function conditionText(value){return value.split('&').map(group=>group.split('|').map(t=>{const resource=t.match(/^(hp|stamina)([\x3c>])(\d+)$/);if(resource)return (resource[1]==='hp'?'生命':'耐力')+(resource[2]==='\x3c'?'低于':'高于')+resource[3]+'%';return t.startsWith('enemy:')?'敌方'+(labels[t.slice(6)]||t.slice(6)):(labels[t]||t);}).join('或')).join('且');}
  function describe(effect){const prefix=effect.when?conditionText(effect.when)+'：':'';if(effect.kind==='ability')return prefix+effect.text;const labels={powerPct:'有效战力',powerFlat:'基础战力',critChance:'暴击率',critDamage:'暴击额外收益',hpMax:'生命上限',staminaMax:'耐力上限',ramMax:'RAM上限'};const pct=['powerPct','critChance','critDamage'].includes(effect.kind);return prefix+(labels[effect.kind]||effect.kind)+' +'+(pct?Number((effect.value*100).toFixed(3))+'%':effect.value)+(effect.kind.startsWith('crit')?'（折算为预期进攻收益）':'')+'。';}
  return {id:'tokyo_talent_adaptation',version:1,definitions,labels,conditionText,describe};
});


;
(function(root,factory){root.CxxTalentData=factory();})(globalThis,function(){throw Error("Unassembled module: CxxTalentData");});

;
(function(root,factory){root.CxxGrowthRules=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGrowthRules");});

;
(function(root,factory){const local=typeof module==='object'&&module.exports;const value=factory(local?require('./talent-rules.js'):root.CxxTalentRules);if(local)module.exports=value;else root.CxxTalentEffects=value;})(globalThis,function(rules){
  'use strict';
  return Object.fromEntries(Object.entries(rules.definitions).map(([id,ranks])=>[id,ranks.map(effects=>effects.map(rules.describe).join(''))]));
});

;
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxNumericGrowthBase=value;})(globalThis,function(){
'use strict';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = v => JSON.parse(JSON.stringify(v));
  function fail(code, message) { throw Object.assign(new Error(message), { code }); }
  function id(v) { if (typeof v !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v) || ['constructor','prototype','__proto__'].includes(v)) fail('gameplay-id', '玩法编号只能使用字母、数字、横线与下划线'); }
  function text(v, max = 4000) { if (typeof v !== 'string' || !v.trim() || v.length > max || /\x3c\x25|\x3c\s*\/?\s*script\b|javascript\s*:/i.test(v)) fail('gameplay-text', '玩法内容只接受有长度限制的静态文字'); }
  function integer(v, min = 0, max = 1000000000) { if (!Number.isSafeInteger(v) || v < min || v > max) fail('gameplay-number', '玩法数量超出允许范围'); }
  function keys(v, allowed) { if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) fail('gameplay-field', '玩法定义含未支持字段，需要匹配的新版角色卡'); }
  const normalized = v => Array.isArray(v) ? v.map(normalized) : object(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalized(v[k])])) : v;
  const same = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));

  const growthNumber=(value,min=0)=>integer(value,min,Number.MAX_SAFE_INTEGER);
  function validateGrowthRules(rules) {
    keys(rules,['schema','id','version','levels']);
    if(rules.schema!==1)fail('growth-rules','成长规则版本尚不支持');
    id(rules.id);text(rules.version,128);
    if(!Array.isArray(rules.levels) || !rules.levels.length)fail('growth-rules','成长规则缺少等级表');
    let previous=-1;
    rules.levels.forEach((row,index)=>{
      keys(row,['level','xp','attributePoints','perkPoints']);
      if(row.level!==index+1)fail('growth-rules','成长等级必须从1开始连续排列');
      growthNumber(row.xp);growthNumber(row.attributePoints);growthNumber(row.perkPoints);
      if(row.xp<=previous || index===0 && row.xp!==0)fail('growth-rules','等级表使用从0开始、严格递增的累计经验门槛');
      if(index===0 && (row.attributePoints || row.perkPoints))fail('growth-rules','初始点数由确认后的开局配置提供，不放入升级奖励');
      previous=row.xp;
    });
    return rules;
  }
  function growthLevel(xp,rules) {
    let level=1;
    for(const row of rules.levels){if(row.xp>xp)break;level=row.level;}
    return level;
  }
  function readGrowth(state,rules) {
    validateGrowthRules(rules);
    if(!object(state) || state.schema!==1)fail('growth-uninitialized','请先确认当前角色的成长起点');
    if(!same(state.rulesRef,{id:rules.id,version:rules.version}))fail('growth-rules-ref','当前角色应使用其保存的成长规则版本');
    for(const key of ['level','xp','attributePoints','perkPoints'])growthNumber(state[key],key==='level'?1:0);
    const offset=state.unrestricted===true?(state.levelOffset??0):0;growthNumber(offset,-Number.MAX_SAFE_INTEGER);
    if(state.level!==growthLevel(state.xp,rules)+offset)fail('growth-state','已保存等级与累计经验不一致，不自动重算角色');
    if(!object(state.rewards))fail('growth-state','成长记录缺少奖励来源表');
    return clone(state);
  }
  function initializeGrowth(rules,initial) {
    validateGrowthRules(rules);
    if(!object(initial))fail('growth-uninitialized','需要已经确认的初始等级、经验和可用点数');
    for(const key of ['level','xp','attributePoints','perkPoints'])growthNumber(initial[key],key==='level'?1:0);
    if(initial.rewards!==undefined && Object.keys(initial.rewards || {}).length)fail('growth-initial','已有奖励记录的角色应直接读取，不能重新初始化');
    const offset=initial.unrestricted===true?{levelOffset:initial.level-growthLevel(initial.xp,rules)}:{};
    return readGrowth({...clone(initial),...offset,schema:1,rulesRef:{id:rules.id,version:rules.version},rewards:{}},rules);
  }
  function planGrowthReward(state,rules,grant) {
    const current=readGrowth(state,rules);
    keys(grant,['id','source','xp','attributePoints','perkPoints']);id(grant.id);
    keys(grant.source,['kind','id','definitionRef']);
    if(!['quest','story','training','activity'].includes(grant.source.kind))fail('growth-source','奖励须关联委托、剧情、训练或行动');
    text(grant.source.id,256);
    if(grant.source.definitionRef!==undefined){
      keys(grant.source.definitionRef,['packageId','version','kind','id']);
      for(const value of Object.values(grant.source.definitionRef))text(value,128);
      for(const key of ['packageId','version','kind','id'])if(!grant.source.definitionRef[key])fail('growth-source','奖励定义引用不完整');
    }
    const award={source:clone(grant.source),xp:grant.xp??0,attributePoints:grant.attributePoints??0,perkPoints:grant.perkPoints??0};
    for(const key of ['xp','attributePoints','perkPoints'])growthNumber(award[key]);
    if(!award.xp && !award.attributePoints && !award.perkPoints)fail('growth-reward','这条奖励没有经验或点数');
    const previous=current.rewards[grant.id];
    if(previous!==undefined){
      if(!same(previous.award,award))fail('growth-reward-conflict','同一奖励编号已有不同内容，请保留原结算');
      return {state:current,changes:[],duplicate:true,earned:{xp:0,attributePoints:0,perkPoints:0,levels:0}};
    }
    const next=clone(current),earned={xp:award.xp,attributePoints:award.attributePoints,perkPoints:award.perkPoints,levels:0};
    growthNumber(next.xp+award.xp);next.xp+=award.xp;
    const beforeProgression=growthLevel(current.xp,rules),afterProgression=growthLevel(next.xp,rules);
    next.level=afterProgression+(current.unrestricted===true?(current.levelOffset??0):0);growthNumber(next.level,1);
    earned.levels=next.level-current.level;
    for(const row of rules.levels){
      if(row.level>beforeProgression && row.level<=afterProgression){
        earned.attributePoints+=row.attributePoints;earned.perkPoints+=row.perkPoints;
      }
    }
    for(const key of ['attributePoints','perkPoints']){growthNumber(earned[key]);growthNumber(next[key]+earned[key]);next[key]+=earned[key];}
    next.rewards[grant.id]={award,earned:clone(earned),fromLevel:current.level,toLevel:next.level};
    return {state:next,duplicate:false,earned,changes:[{path:['terminal','gameplay','growth'],before:current,missing:false,after:clone(next)}]};
  }

return {same,validateRules:validateGrowthRules,read:readGrowth,initialize:initializeGrowth,planReward:planGrowthReward};
});

;
(function(root,factory){root.CxxNumericGrowth=factory();})(globalThis,function(){throw Error("Unassembled module: CxxNumericGrowth");});

;

;
(function(root,factory){root.CxxNumericEngine=factory();})(globalThis,function(){throw Error("Unassembled module: CxxNumericEngine");});








;

;
(function(root,factory){root.CxxNumericMvu=factory();})(globalThis,function(){throw Error("Unassembled module: CxxNumericMvu");});

;
(function(root,factory){root.CxxEnsembleContent=factory();})(globalThis,function(){throw Error("Unassembled module: CxxEnsembleContent");});
;
(function(root,factory){root.CxxEnsembleState=factory();})(globalThis,function(){throw Error("Unassembled module: CxxEnsembleState");});
;
(function(root,factory){root.CxxRoster=factory();})(globalThis,function(){throw Error("Unassembled module: CxxRoster");});
(function(root,factory){root.CxxEnsembleMvu=factory();})(globalThis,function(){throw Error("Unassembled module: CxxEnsembleMvu");});
;
(function(root,factory){root.CxxEnsembleView=factory();})(globalThis,function(){throw Error("Unassembled module: CxxEnsembleView");});
;
(function(root,factory){root.CxxEnsembleUI=factory();})(globalThis,function(){throw Error("Unassembled module: CxxEnsembleUI");});

(function(root,factory){root.CxxContextSource=factory();})(globalThis,function(){throw Error("Unassembled module: CxxContextSource");});

(function(root,factory){root.CxxContextHost=factory();})(globalThis,function(){throw Error("Unassembled module: CxxContextHost");});

(function(root,factory){root.CxxContextRequests=factory();})(globalThis,function(){throw Error("Unassembled module: CxxContextRequests");});
(function(root,factory){root.CxxContextStore=factory();})(globalThis,function(){throw Error("Unassembled module: CxxContextStore");});
(function(root,factory){root.CxxContextCompact=factory();})(globalThis,function(){throw Error("Unassembled module: CxxContextCompact");});
(function(root,factory){root.CxxContextController=factory();})(globalThis,function(){throw Error("Unassembled module: CxxContextController");});




;
(function(root,factory){root.CxxGameplay=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGameplay");});

globalThis.CxxTalentAssets={};
// Author-maintained definitions. IDs referenced by MVU resolve here, never from generated prose.
// Author-maintained definitions. IDs referenced by MVU resolve here, never from generated prose.
(function(root,factory){root.CxxNumericContent=factory();})(globalThis,function(){throw Error("Unassembled module: CxxNumericContent");});


;
/* Pure bridge from this card's confirmed growth actions to the standalone numeric engine. */
/* Pure bridge from this card's confirmed growth actions to the standalone numeric engine. */
/* Pure bridge from this card's confirmed growth actions to the standalone numeric engine. */
(function(root,factory){root.CxxNumericHost=factory();})(globalThis,function(){throw Error("Unassembled module: CxxNumericHost");});



;
(function(root,factory){root.CxxTalents=factory();})(globalThis,function(){throw Error("Unassembled module: CxxTalents");});


;
(function(root,factory){root.CxxTalentUI=factory();})(globalThis,function(){throw Error("Unassembled module: CxxTalentUI");});



;
(function(root,factory){root.CxxBattle=factory();})(globalThis,function(){throw Error("Unassembled module: CxxBattle");});





;
(function(root,factory){root.CxxBattleUI=factory();})(globalThis,function(){throw Error("Unassembled module: CxxBattleUI");});




;
(function(root,factory){root.CxxTacticalRules=factory();})(globalThis,function(){throw Error("Unassembled module: CxxTacticalRules");});
;
(function(root,factory){root.CxxTacticalEngine=factory();})(globalThis,function(){throw Error("Unassembled module: CxxTacticalEngine");});
;
(function(root,factory){root.CxxPlayerOperations=factory();})(globalThis,function(){throw Error("Unassembled module: CxxPlayerOperations");});





;

;
(function(root,factory){root.CxxPlayerUI=factory();})(globalThis,function(){throw Error("Unassembled module: CxxPlayerUI");});





;

;
(function(root,factory){root.CxxPlayerHost=factory();})(globalThis,function(){throw Error("Unassembled module: CxxPlayerHost");});










;



(function(root,factory){root.CxxUpdateCore=factory();})(globalThis,function(){throw Error("Unassembled module: CxxUpdateCore");});
(function(root,factory){root.Cxx236Zod=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx236Zod");});
(function(root,factory){root.Cxx236Applier=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx236Applier");});
(function(root,factory){root.CxxDataSchema=factory();})(globalThis,function(){throw Error("Unassembled module: CxxDataSchema");});
(function(root,factory){root.CxxDataStore=factory();})(globalThis,function(){throw Error("Unassembled module: CxxDataStore");});
(function(root,factory){root.CxxDataRows=factory();})(globalThis,function(){throw Error("Unassembled module: CxxDataRows");});
(function(root,factory){root.CxxDataSync=factory();})(globalThis,function(){throw Error("Unassembled module: CxxDataSync");});
(function(root,factory){root.CxxDataRead=factory();})(globalThis,function(){throw Error("Unassembled module: CxxDataRead");});
(function(root,factory){root.CxxDataWrite=factory();})(globalThis,function(){throw Error("Unassembled module: CxxDataWrite");});


(function(root,factory){root.CxxContent=factory();})(globalThis,function(){throw Error("Unassembled module: CxxContent");});

(function(root,factory){root.CxxIdentity=factory();})(globalThis,function(){throw Error("Unassembled module: CxxIdentity");});



/* One dialogue reader for Gal, native bubbles and outbound assistant history.
 * Transforms copies only. CSS classes remain compatible with the preset skin.
 */
(function(root,factory){root.Cxx238Dialogue=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx238Dialogue");});

/* Read-only adapter: maintained card protocols and the project's Izumi preset.
 * Auxiliary preset output is excluded from Gal narration only.
 * No game variables or source message text are written.
 */
/* Read-only adapter: maintained card protocols and the project's Izumi preset.
 * Auxiliary preset output is excluded from Gal narration only.
 * No game variables or source message text are written.
 */
/* Read-only adapter: maintained card protocols and the project's Izumi preset.
 * Auxiliary preset output is excluded from Gal narration only.
 * No game variables or source message text are written.
 */
/* Read-only adapter: maintained card protocols and the project's Izumi preset.
 * Auxiliary preset output is excluded from Gal narration only.
 * No game variables or source message text are written.
 */
/* Read-only adapter: maintained card protocols and the project's Izumi preset.
 * Auxiliary preset output is excluded from Gal narration only.
 * No game variables or source message text are written.
 */
/* Read-only adapter: maintained card protocols and the project's Izumi preset.
 * Auxiliary preset output is excluded from Gal narration only.
 * No game variables or source message text are written.
 */
(function(root,factory){root.CxxGalParser=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGalParser");});





/* Explicit per-line expressions only. Names are exact card aliases; no emotion inference. */
(function(root,factory){root.CxxGalSprites=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGalSprites");});

/* Location -> region -> generic city. Background selection never reads the cast. */
/* Location -> region -> generic city. Background selection never reads the cast. */
(function(root,factory){root.CxxGalBackgrounds=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGalBackgrounds");});


/* Read-only HUD snapshot. Fields come from maintained worldbook 015/002/052/053.
 * Read one explicit message floor and its selected swipe; never inherit a floor.
 * scene is accepted by the host contract, but never used to guess a speaker.
 */
(function(root,factory){root.CxxGalHud=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGalHud");});

/* The one shared bridge. Model text is data, never executable HTML. */
/* The one shared bridge. Model text is data, never executable HTML. */
/* The one shared bridge. Model text is data, never executable HTML. */
/* The one shared bridge. Model text is data, never executable HTML. */
__cxxBuildSlot("shared-runtime");




;
/* Owned by the shared runtime: removed on card reload or character change. */
(function(api){
 const win=api.parent||api,runtime=win.Cxx233Runtime,view=api.CxxCombatView;
 runtime.register('CxxCombatView',view);
 const service=view.native({api,win,runtime});
 runtime.register('CxxCombatCards',service,()=>service.destroy(),['CxxCombatView']);
})(globalThis);

const releaseActorState=parent.Cxx233Runtime.register('CxxEnsembleState',CxxEnsembleState);
const releaseRoster=parent.Cxx233Runtime.register('CxxRoster',CxxRoster);
window.addEventListener('pagehide',()=>{releaseRoster();releaseActorState();},{once:true});
const cxx233Shared={CxxUpdateCore,CxxContent,CxxGameplay,CxxIdentity,CxxGalParser,CxxGalSprites,CxxGalBackgrounds,CxxGalHud};
const unregisterShared=parent.Cxx233Runtime.register('Cxx233Shared',cxx233Shared);window.addEventListener('pagehide',unregisterShared,{once:true});
cxxOwner=parent.Cxx233Runtime;
/* Trusted opening templates have a stable host, independent of native message mounts. */
/* Trusted opening templates have a stable host, independent of native message mounts. */
/* Trusted opening templates have a stable host, independent of native message mounts. */
/* One opening surface and draft, shared by native chat and Gal. */
/* One chat owns one draft and one final submission. Views never write game state. */
(function(root,factory){root.CxxOpeningFlow=factory();})(globalThis,function(){throw Error("Unassembled module: CxxOpeningFlow");});

;
(function(root,factory){root.CxxOpeningUI=factory();})(globalThis,function(){throw Error("Unassembled module: CxxOpeningUI");});

globalThis.CxxOpeningStyle="";
globalThis.CxxOpeningCatalog={};
parent.Cxx233Runtime.register("CxxOpeningFlow",CxxOpeningFlow);
/* One opening surface and draft, shared by native chat and Gal. */
(function(root,factory){root.Cxx236Openings=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx236Openings");});



/* One chat-local write for the first-run choices. No writes from render callbacks. */
/* One chat-local write for the first-run choices. No writes from render callbacks. */
/* One chat-local write for the first-run choices. No writes from render callbacks. */
/* One chat-local write for the first-run choices. No writes from render callbacks. */
/* One chat-local write for the first-run choices. No writes from render callbacks. */
(function(root,factory){root.Cxx236Preferences=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx236Preferences");});


/* All decorative work subscribes to the same chat preference. Functional timers are untouched. */
/* All decorative work subscribes to the same chat preference. Functional timers are untouched. */
(function(root,factory){root.Cxx236Effects=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx236Effects");});


/* Card schema: parsing returns a copy; callers choose when normalized values may be committed. */
/* Card schema: parsing returns a copy; callers choose when normalized values may be committed. */
/* Card schema: parsing returns a copy; callers choose when normalized values may be committed. */
(function(root,factory){root.Cxx236Schema=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx236Schema");});



/* MVU 438f9ffc: validate its parsed batch and its final state, without replacing its executor. */
/* MVU 438f9ffc: validate its parsed batch and its final state, without replacing its executor. */
/* MVU 438f9ffc: validate its parsed batch and its final state, without replacing its executor. */
/* MVU 438f9ffc: validate its parsed batch and its final state, without replacing its executor. */
/* MVU 438f9ffc: validate its parsed batch and its final state, without replacing its executor. */
(function(root,factory){root.Cxx236Variables=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx236Variables");});




(function(root,factory){root.Cxx236VariablePolicy=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx236VariablePolicy");});


const zod236=(globalThis.Cxx236Zod&&globalThis.Cxx236Zod.z)||parent.z||globalThis.z;let schema236;try{schema236=Cxx236Schema.build(zod236);}catch{}const guard236=Cxx236Variables.create({api:globalThis,win:parent,runtime:parent.Cxx233Runtime,schema:schema236,buildSchema:()=>Cxx236Schema.build(zod236),greetings:[],policy:Cxx236VariablePolicy.create({api:globalThis,win:parent,content:CxxContent})});parent.Cxx233Runtime.register('Cxx236VariableGuard',guard236,()=>guard236.destroy(),['Cxx233Shared']);
const store236=CxxDataStore.create({api:globalThis,scope:parent,template:CxxDataSchema});
parent.Cxx233Runtime.register('CxxDataStore',store236,()=>{},['Cxx233Shared','Cxx236VariableGuard']);
const sync236=CxxDataSync.create({store:store236,rows:CxxDataRows});
parent.Cxx233Runtime.register('CxxDataSync',sync236,()=>{},['Cxx233Shared','CxxDataStore']);
// 每回合把 MVU 的 terminal 快照镜像进数据库（镜像失败只上报，不打断游玩）
function mirror236(){
  try{
    // Web commits already own the selected floor. Only the source-bound worker mirrors them.
    if(webFloor236()){
      const projection=parent.Cxx2051StProjection;
      if(projection&&typeof projection.schedule==='function')Promise.resolve(projection.schedule()).catch(()=>{});
      return;
    }
    // 状态入口是 Cxx236State（表优先、变量兜底）；只有它缺席时才退回 MVU 接口。
    const state236=parent.Cxx236State;
    const fromState=state236&&typeof state236.stat==='function'?state236.stat():null;
    const mvu=fromState?null:parent.Mvu;
    const data=mvu&&typeof mvu.getCurrentMvuData==='function'?mvu.getCurrentMvuData():null;
    const stat=fromState||(data&&data.stat_data);
    const terminal=stat&&stat.terminal;
    if(!terminal)return;
    const turn=Number(terminal.turn||(data&&data.turn)||0);
    // 16 表闭环：有 pushAll 就整库镜像（钱包/名册/场景/效果/偏好/战斗/战术/委托/回合摘要），
    // 旧包只有 push 时退回 5 表镜像，不会因为多带表把同步整段打断。
    const mirror=typeof sync236.pushAll==='function'?sync236.pushAll:sync236.push;
    Promise.resolve(mirror.call(sync236,terminal,turn)).then(result=>{
      if(!result||result.ok)return;
      parent.CxxDiagnostics&&parent.CxxDiagnostics.report&&parent.CxxDiagnostics.report({module:'数据库镜像',stage:'同步',message:String(result.reason||'')});
    }).catch(()=>{});
  }catch(error){
    parent.CxxDiagnostics&&parent.CxxDiagnostics.report&&parent.CxxDiagnostics.report({module:'数据库镜像',stage:'同步',message:String((error&&error.message)||error)});
  }
}
parent.CxxDataSyncRun=mirror236;
try{const ev236=parent.tavern_events||{};if(parent.eventOn&&ev236.MESSAGE_RECEIVED)parent.eventOn(ev236.MESSAGE_RECEIVED,mirror236);}catch(error){}

// 读侧／写侧：数据库作为唯一状态源（dataStore 开关见设置页；shadow 时只写不读）
const read236=CxxDataRead.create({store:store236});
parent.Cxx233Runtime.register('CxxDataRead',read236,()=>{},['Cxx233Shared','CxxDataStore']);
const write236=CxxDataWrite.create({store:store236});
parent.Cxx233Runtime.register('CxxDataWrite',write236,()=>{},['Cxx233Shared','CxxDataStore']);

// 状态统一入口 state236()：面板、状态条、Gal HUD、通讯器、任务面板、战斗面板一律先问这里。
// 优先级：dataStore==='shadow' 时仍以 MVU 变量为准；否则先读数据库表。
// 表的五张表（人物／数值／背包／装备／物品定义）是数值的权威来源；表尚未覆盖的字段（gameplay、quests 等）继续取变量里的值，
// 这条回退路径随表覆盖扩大而收缩，接口形状不变。
function dataStoreMode236(){
  try{
    const preferences=parent.Cxx236Preferences;
    if(preferences&&typeof preferences.read==='function'){
      const value=preferences.read();
      if(value&&value.dataStore==='shadow')return 'shadow';
    }
  }catch(error){}
  return 'on';
}
function mvuStat236(){
  try{
    const api=parent.SillyTavern&&typeof parent.SillyTavern.getContext==='function'?parent.SillyTavern.getContext():null;
    const chat=(api&&api.chat)||[];
    for(let i=chat.length-1;i>=0;i--){
      const row=chat[i];
      if(!row)continue;
      const value=Array.isArray(row.variables)?row.variables[row.swipe_id||0]:row.variables;
      if(value&&value.stat_data)return value.stat_data;
    }
  }catch(error){}
  try{
    const mvu=parent.Mvu;
    const data=mvu&&typeof mvu.getCurrentMvuData==='function'?mvu.getCurrentMvuData():null;
    if(data&&data.stat_data)return data.stat_data;
  }catch(error){}
  return null;
}
// Web floors stay authoritative while derived tables are rebuilding, failed, or from another branch.
function webFloor236(){
  try{
    const c=parent.SillyTavern&&parent.SillyTavern.getContext();
    for(let i=(c&&c.chat||[]).length-1;i>=0;i--){
      const row=c.chat[i];if(!row||row.is_user||row.is_system)continue;
      const value=Array.isArray(row.variables)?row.variables[row.swipe_id||0]:row.variables;
      const marker=value&&value.__cxx_web_commit,identity=row.swipe_info&&row.swipe_info[row.swipe_id||0]&&row.swipe_info[row.swipe_id||0].extra&&row.swipe_info[row.swipe_id||0].extra.cxx2051_node||row.extra&&row.extra.cxx2051_node;
      return marker&&marker.owner==='web'&&identity===marker.nodeId&&value.stat_data?value.stat_data:null;
    }
  }catch(error){}
  return null;
}
function tableView236(){
  let result=null;
  try{result=read236.snapshot();}catch(error){result={ok:false,reason:String((error&&error.message)||error)};}
  if(result&&result.ok){
    let counts=null;
    try{counts=(read236.counts()||{}).counts||null;}catch(error){counts=null;}
    return {ok:true,empty:!!result.empty,terminal:result.terminal||null,counts};
  }
  return {ok:false,empty:true,terminal:null,counts:null,reason:String((result&&result.reason)||'读表失败')};
}
function state236(){
  const dataStore=dataStoreMode236();
  const committed=webFloor236();
  if(committed)return {ok:true,empty:false,source:'web-floor',dataStore,table:null,terminal:committed.terminal||{},counts:null};
  const table=tableView236();
  const stat=mvuStat236();
  const actors=(table.ok&&table.terminal&&table.terminal.ensemble&&table.terminal.ensemble.actors)||null;
  const tableHasActors=!!(actors&&Object.keys(actors).length);
  const source=tableHasActors&&stat?'table+mvu':tableHasActors?'table':stat?'mvu':'none';
  if(!table.ok&&!stat)return {ok:false,empty:true,source,dataStore,reason:String(table.reason||'状态尚未就绪')};
  const terminal=(stat&&stat.terminal)||(table.ok?table.terminal:null)||{};
  return {ok:true,empty:!tableHasActors&&!stat,source,dataStore,table:table.ok?table.terminal:null,terminal,counts:table.counts};
}
// 面板用的整棵变量视图：变量在就交变量整棵树（含 gameplay／quests 等尚未建表的字段），
// 变量缺席时交表的投影，保证摘干净 MVU 之后仍有东西可渲染。
function stat236(){
  const stat=mvuStat236();
  if(stat)return stat;
  const state=state236();
  return state&&state.ok&&state.terminal?{terminal:state.terminal}:{};
}
// 数值／背包／装备的权威读数：表里的这一行优先，shadow 模式下交回 null 让消费者自己走变量。
function vitals236(actorKey){
  const key=String(actorKey||'player'),state=state236();
  if(!state.ok||state.dataStore==='shadow')return null;
  const actors=(state.table&&state.table.ensemble&&state.table.ensemble.actors)||null;
  const actor=actors&&actors[key];
  if(!actor)return null;
  const stat=Array.isArray(actor.stat)?actor.stat:[];
  if(stat.length<4)return null;
  return {actorKey:key,name:actor.name||'',hp:stat[0],sanity:stat[1],fatigue:stat[2],yen:stat[3],inventory:actor.inventory||{},equipment:actor.equipment||{},source:'table'};
}
const stateApi236={read:state236,stat:stat236,vitals:vitals236,counts:()=>{try{return read236.counts();}catch(error){return {ok:false,reason:String((error&&error.message)||error)};}}};
parent.Cxx236State=stateApi236;
try{parent.Cxx233Runtime.register('Cxx236State',stateApi236,()=>{},['Cxx233Shared','CxxDataRead']);}catch(error){}
// 旧入口兼容：CxxDataReadRun 现在指向统一入口，形状仍带 ok／terminal／reason。
parent.CxxDataReadRun=state236;
// 旧档判定：消息里带 stat_data.terminal，说明这是把整棵状态写进变量时代的存档。
function legacyChat236(){
  try{
    const chat=(parent.SillyTavern&&parent.SillyTavern.getContext&&parent.SillyTavern.getContext().chat)||[];
    return chat.some(function(row){const value=Array.isArray(row&&row.variables)?row.variables[row.swipe_id||0]:row&&row.variables;return !!(value&&value.stat_data&&value.stat_data.terminal);});
  }catch(error){return false;}
}
function legacyRefusal236(){
  const table=tableView236();
  if(!legacyChat236()||!table.empty)return null;
  return {ok:false,state:'legacy-save-unsupported',reason:'legacy-save-unsupported',message:'这是旧版本存档（状态存在 MVU 变量里），数据库表里还没有这份状态；请新开一局，或用「旧版续玩导出」把进度搬到新档。'};
}
async function writeFact236(receipt,kind,payload,turn){
  try{
    const legacy=legacyRefusal236();
    if(legacy){
      parent.CxxDiagnostics&&parent.CxxDiagnostics.report&&parent.CxxDiagnostics.report({module:'数据库写入',stage:'旧档判定',message:legacy.message});
      return legacy;
    }
    const result=await write236.apply({receipt:String(receipt||''),kind:'fact',turn:turn,payload:payload,fact:{fact_key:String(receipt||''),kind:kind,payload:payload}});
    if(!result||!result.ok){parent.CxxDiagnostics&&parent.CxxDiagnostics.report&&parent.CxxDiagnostics.report({module:'数据库写入',stage:'落表',message:String((result&&result.reason)||'')});}
    return result;
  }catch(error){
    return {ok:false,reason:String((error&&error.message)||error)};
  }
}
parent.CxxDataWriteRun=writeFact236;

parent.Cxx233Runtime.register('Cxx236OpeningMap',Cxx236Openings,undefined,['Cxx233Shared']);
const preferences236=Cxx236Preferences.create({api:globalThis,win:parent,runtime:parent.Cxx233Runtime,verifySaved:Cxx236Preferences.verifySaved});parent.Cxx233Runtime.register('Cxx236Preferences',preferences236,()=>preferences236.destroy(),['Cxx233Shared']);__cxxBuildSlot('opening-startup');

const effects236=Cxx236Effects.create({win:parent,preferences:preferences236});parent.Cxx233Runtime.register('Cxx236Effects',effects236,()=>effects236.destroy(),['Cxx233Shared']);const galEffects236=effects236.attach(parent,{parentSurface:true});parent.Cxx233Runtime.register('Cxx236GalEffects',galEffects236,()=>galEffects236.destroy(),['Cxx236Effects']);

(function(root,factory){root.CxxDisplayGuard235=factory();})(globalThis,function(){throw Error("Unassembled module: CxxDisplayGuard235");});


const stopDisplay235=CxxDisplayGuard235.install({top:parent,api:globalThis,runtime:parent.Cxx233Runtime,parser:CxxGalParser});parent.Cxx233Runtime.register('Cxx235DisplayGuard',{},stopDisplay235,['Cxx233Shared']);

;
(async()=>{
'use strict';
let ended=false,cleanups=[];
const own=fn=>{if(ended)fn();else cleanups.push(fn);};
const stop=()=>{if(ended)return;ended=true;cleanups.splice(0).reverse().forEach(fn=>{try{fn();}catch(e){console.error('[233 cleanup]',e);}});window.removeEventListener('pagehide',stop);};
window.addEventListener('pagehide',stop,{once:true});
for(const name of ["Cxx233Runtime","Cxx233Shared"]){let deadline;try{await Promise.race([waitGlobalInitialized(name),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('依赖 '+name+' 未就绪，请查看助手脚本错误并重新加载。')),10000);own(()=>clearTimeout(deadline));})]);}finally{clearTimeout(deadline);}if(ended||!cxxRunCurrent())return;}
const runtime=Cxx233Runtime;if(!runtime.alive)return;
Object.assign(globalThis,Cxx233Shared);
const publish=(name,value,dispose)=>runtime.register(name,value,dispose,["Cxx233Shared"]);
(function(root,factory){root.CxxUpdateBackup=factory();})(globalThis,function(){throw Error("Unassembled module: CxxUpdateBackup");});

own(publish('Cxx233Backup',{CxxUpdateBackup}));
})().catch(error=>{__cxxStageError("[存档与迁移]",error);parent.toastr?.error(error.message,"存档与迁移");});

;
(async()=>{
'use strict';
let ended=false,cleanups=[];
const own=fn=>{if(ended)fn();else cleanups.push(fn);};
const stop=()=>{if(ended)return;ended=true;cleanups.splice(0).reverse().forEach(fn=>{try{fn();}catch(e){console.error('[233 cleanup]',e);}});window.removeEventListener('pagehide',stop);};
window.addEventListener('pagehide',stop,{once:true});
for(const name of ["Cxx233Runtime","Cxx233Shared","Cxx233Backup"]){let deadline;try{await Promise.race([waitGlobalInitialized(name),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('依赖 '+name+' 未就绪，请查看助手脚本错误并重新加载。')),10000);own(()=>clearTimeout(deadline));})]);}finally{clearTimeout(deadline);}if(ended||!cxxRunCurrent())return;}
const runtime=Cxx233Runtime;if(!runtime.alive)return;
Object.assign(globalThis,Cxx233Shared);
Object.assign(globalThis,Cxx233Backup);
const publish=(name,value,dispose)=>runtime.register(name,value,dispose,["Cxx233Shared","Cxx233Backup"]);
(function(root,factory){root.CxxGameplayActions=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGameplayActions");});


(function(root,factory){root.CxxGameplayHost=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGameplayHost");});




own(publish('Cxx233Gameplay',{CxxGameplayActions,CxxGameplayHost}));
(function(root,factory){root.CxxBusinessContentSync=factory();})(globalThis,function(){throw Error("Unassembled module: CxxBusinessContentSync");});

(function(root,factory){root.CxxUpdaterHandoff=factory();})(globalThis,function(){throw Error("Unassembled module: CxxUpdaterHandoff");});



await waitGlobalInitialized('Cxx233Updater');if(ended||!cxxRunCurrent())return;
const handoff=CxxUpdaterHandoff.create({api:globalThis,Core:CxxUpdateCore,requirement:getVariables({type:'script'}).__cxx_required_updater,active:()=>!ended&&cxxRunCurrent(),reload:()=>parent.location.reload(),notify:message=>parent.toastr?.info(message,'正在完成卡内更新')});
if(await handoff.ensure()!==true||ended||!cxxRunCurrent())return;
const updater=parent.Cxx233Updater;
const gameplay=CxxGameplayHost.create({api:globalThis,host:updater.host,backup:updater.backup,getSeed:updater.readSeed,waitForInstall:()=>updater.whenIdle(),core:CxxUpdateCore,content:CxxContent});
own(updater.attachGameplay(gameplay));own(()=>gameplay.stop());gameplay.start();
const contextService=CxxContextHost.create({api:globalThis,top:parent,host:updater.host});
const contextPolicy=CxxContextController.create({api:globalThis,top:parent,host:updater.host,source:contextService,parser:CxxGalParser});
contextService.use(contextPolicy);own(publish('CxxContextCompression',contextPolicy,()=>contextPolicy.destroy()));
own(publish('CxxContext',contextService,()=>contextService.destroy()));contextService.start();
const sync=CxxBusinessContentSync.create({api:globalThis,Core:CxxUpdateCore,Content:CxxContent,Host:updater.hostModule,Gameplay:CxxGameplay,host:updater.host,readSeed:updater.readSeed,transaction:updater.transaction});
own(updater.attachContentSync(sync));updater.check(false);

})().catch(error=>{__cxxStageError("[玩法与 MVU 接线]",error);parent.toastr?.error(error.message,"玩法与 MVU 接线");});

;


;
(async()=>{
'use strict';
let ended=false,cleanups=[];
const own=fn=>{if(ended)fn();else cleanups.push(fn);};
const stop=()=>{if(ended)return;ended=true;cleanups.splice(0).reverse().forEach(fn=>{try{fn();}catch(e){console.error('[233 cleanup]',e);}});window.removeEventListener('pagehide',stop);};
window.addEventListener('pagehide',stop,{once:true});
for(const name of ["Cxx233Runtime","Cxx233Shared"]){let deadline;try{await Promise.race([waitGlobalInitialized(name),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('依赖 '+name+' 未就绪，请查看助手脚本错误并重新加载。')),10000);own(()=>clearTimeout(deadline));})]);}finally{clearTimeout(deadline);}if(ended||!cxxRunCurrent())return;}
const runtime=Cxx233Runtime;if(!runtime.alive)return;
Object.assign(globalThis,Cxx233Shared);
const publish=(name,value,dispose)=>runtime.register(name,value,dispose,["Cxx233Shared"]);
(function(root,factory){root.CxxCityNews=factory();})(globalThis,function(){throw Error("Unassembled module: CxxCityNews");});

(function(root,factory){root.CxxStorySummaries=factory();})(globalThis,function(){throw Error("Unassembled module: CxxStorySummaries");});

(function(root,factory){root.CxxUtilityApi=factory();})(globalThis,function(){throw Error("Unassembled module: CxxUtilityApi");});



;
(function(root,factory){root.CxxBattleContext=factory();})(globalThis,function(){throw Error("Unassembled module: CxxBattleContext");});

;
(function(root,factory){root.CxxBattleHost=factory();})(globalThis,function(){throw Error("Unassembled module: CxxBattleHost");});




;
(function(root,factory){root.CxxBattleSurface=factory();})(globalThis,function(){throw Error("Unassembled module: CxxBattleSurface");});




;
/* Shared OpenAI-compatible discovery; listing never sends conversation data. */
(function(root,factory){root.CxxApiConnection=factory();})(globalThis,function(){throw Error("Unassembled module: CxxApiConnection");});

;
(function(root,factory){root.CxxTacticalAssets=factory();})(globalThis,function(){throw Error("Unassembled module: CxxTacticalAssets");});
;
(function(root,factory){root.CxxTacticalUI=factory();})(globalThis,function(){throw Error("Unassembled module: CxxTacticalUI");});
;
(function(root,factory){root.CxxTacticalHost=factory();})(globalThis,function(){throw Error("Unassembled module: CxxTacticalHost");});
;
(function(root,factory){root.CxxExperienceHost=factory();})(globalThis,function(){throw Error("Unassembled module: CxxExperienceHost");});





/* One lazy worker and a bounded cache of derived text; native chat remains authoritative. */
(function(root,factory){root.Cxx249HistoryRuntime=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx249HistoryRuntime");});

const CXX249_HISTORY_WORKER_SOURCE="";
const parser249=CxxGalParser;const history249=Cxx249HistoryRuntime.create({workerSource:CXX249_HISTORY_WORKER_SOURCE,run:(kind,payload)=>kind==='parse'?parser249.parseMessage(payload.raw,{cache:false}):CxxStorySummaries.row(payload.message,payload.floor,parser249)});parent.Cxx233Runtime.register('Cxx249History',history249,()=>{history249.destroy();parser249.setCacheEnabled(true);});parser249.clearCache();parser249.setCacheEnabled(false);
const newsService=CxxExperienceHost.create();own(publish('Cxx233News',newsService,()=>newsService.destroy()));newsService.start();
})().catch(error=>{__cxxStageError("[新闻与论坛]",error);parent.toastr?.error(error.message,"新闻与论坛");});

})().catch(e=>{console.error('[剧情与玩法核心]',e);parent.toastr?.error(e.message);});
