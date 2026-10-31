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
(()=>{
let seen=null,ended=false;
const pending=setTimeout(()=>{if(!seen&&!ended)parent.toastr?.error('核心与卡更新脚本未就绪，请查看助手脚本错误后重新加载。');},10000);
function start(){
  const ownerRuntime=parent.Cxx233Runtime;
  if(ended||!ownerRuntime?.alive||seen===ownerRuntime)return;
  seen=ownerRuntime;clearTimeout(pending);
  const cxxRunCurrent=()=>!ended&&ownerRuntime.alive&&parent.Cxx233Runtime===ownerRuntime;
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
/* M18 isolated opening settings. No generation, sending, worldbook or direct MVU writes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxOpeningLink = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const identities = Object.freeze([['corpo', '公司狗'], ['street', '街头小子'], ['student', '中产学生'], ['custom', '自定义']].map(([id, label]) => Object.freeze({ id, label })));
  const timelines = Object.freeze([['2050-12', '2050 年 12 月前后 · Mujica 起点'], ['2051-04', '2051 年 4 月前后 · MyGO 起点']].map(([id, label]) => Object.freeze({ id, label })));
  let sequence = 0;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function fail(code, reason) { const error = new Error(reason); error.code = code; throw error; }
  function record(value, keys, label) {
    const proto = value && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
    const plain = proto === null || proto && own(proto, 'constructor') && typeof proto.constructor === 'function'
      && Function.prototype.toString.call(proto.constructor) === Function.prototype.toString.call(Object);
    if (!value || typeof value !== 'object' || Array.isArray(value) || !plain) fail('invalid', label + '须为普通对象。');
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail('invalid', label + '不支持字段：' + key);
    return value;
  }
  function text(value, label, limit, required = true) {
    if (typeof value !== 'string' || value.length > limit || required && !value.trim()) fail('invalid', label + '须为文本，且不超过 ' + limit + ' 字。');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|\x3c[%]|\x3c\s*\/?\s*(script|iframe|style)\b|javascript\s*:/i.test(value)) fail('invalid', label + '只接受静态文本。');
    return value;
  }
  function id(value, label) {
    text(value, label, 128);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value) || ['__proto__', 'prototype', 'constructor'].includes(value)) fail('invalid', label + '无效。');
    return value;
  }
  function initialState(value, era) {
    if (value == null) return null;
    record(value, ['story'], '初始状态');
    const story = record(value.story, ['date', 'time', 'location', 'phase'], '初始剧情状态');
    const date = text(story.date, '初始日期', 10);
    if (date !== era) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), parsed = match && new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
      if (!match || date.slice(0, 7) !== era || parsed.getUTCFullYear() !== +match[1] || parsed.getUTCMonth() + 1 !== +match[2] || parsed.getUTCDate() !== +match[3]) fail('invalid', '初始日期须符合所选时间，且是有效日期。');
    }
    const result = { date };
    for (const field of ['time', 'location', 'phase']) if (own(story, field)) {
      const item = story[field];
      if (item === null) result[field] = null;
      else if (field === 'phase' && Number.isSafeInteger(item) && item >= 0) result[field] = item;
      else result[field] = text(item, '初始' + field, field === 'location' ? 512 : 128, false);
    }
    return { story: result };
  }
  function events(entry) {
    if (!own(entry, 'timelineTaskIds') && !own(entry, 'timelineEvents')) return null;
    let taskIds = null;
    if (own(entry, 'timelineTaskIds')) {
      if (!Array.isArray(entry.timelineTaskIds) || entry.timelineTaskIds.length > 128) fail('invalid', '前置任务清单须为数组，最多128项。');
      taskIds = Array.from(entry.timelineTaskIds, item => id(item, '前置任务ID'));
      if (new Set(taskIds).size !== taskIds.length) fail('invalid', '前置任务ID重复。');
    }
    let result = [];
    if (own(entry, 'timelineEvents')) {
      if (!Array.isArray(entry.timelineEvents) || entry.timelineEvents.length > 128) fail('invalid', '时间线事件须为数组，最多128项。');
      result = Array.from(entry.timelineEvents, item => {
        record(item, ['taskId', 'state', 'outcome'], '时间线事件');
        const value = { taskId: id(item.taskId, '事件任务ID'), state: item.state };
        if (!['occurred', 'skipped'].includes(value.state)) fail('invalid', '时间线事件只能标记occurred或skipped，不能写完成或奖励。');
        if (own(item, 'outcome')) value.outcome = text(item.outcome, '作者指定事件结果', 2000, false);
        return value;
      });
      if (new Set(result.map(item => item.taskId)).size !== result.length) fail('invalid', '时间线事件ID重复。');
    }
    if (taskIds && (taskIds.length !== result.length || taskIds.some(taskId => !result.some(item => item.taskId === taskId)))) fail('invalid', '非空任务清单须逐项提供作者指定事件状态。');
    return result;
  }
  function manifest(value) {
    if (value == null) fail('missing-manifest', '身份开场与双时间初始资料待作者提供。');
    record(value, ['version', 'identities', 'timelines'], '作者开局资料');
    const version = text(value.version, '作者资料版本', 128);
    const lists = {};
    for (const [field, known, keys] of [['identities', identities, ['id', 'label', 'body']], ['timelines', timelines, ['id', 'label', 'initialState', 'timelineTaskIds', 'timelineEvents']]]) {
      if (!Array.isArray(value[field]) || value[field].length > known.length) fail('invalid', field + '须为明确的有限列表。');
      lists[field] = value[field].map(item => {
        record(item, keys, field); const entry = { id: id(item.id, field + '编号'), label: text(item.label, field + '名称', 60) };
        if (!known.some(option => option.id === entry.id)) fail('invalid', '未找到对应的身份或时间编号：' + entry.id);
        if (field === 'identities') entry.body = item.body == null || item.body === '' ? '' : text(item.body, '作者通用开场', 4000);
        else { entry.initialState = initialState(item.initialState, entry.id); entry.timelineEvents = events(item); }
        return entry;
      });
      if (new Set(lists[field].map(item => item.id)).size !== lists[field].length) fail('invalid', field + '编号重复。');
    }
    return { version, ...lists };
  }
  function selection(value) {
    record(value, ['identityId', 'timelineId', 'customDescription'], '开局选择');
    const result = { identityId: value.identityId ?? null, timelineId: value.timelineId ?? null, customDescription: text(value.customDescription ?? '', '玩家补充说明', 4000, false) };
    if (result.identityId !== null && !identities.some(item => item.id === result.identityId)) fail('invalid', '未知身份。');
    if (result.timelineId !== null && !timelines.some(item => item.id === result.timelineId)) fail('invalid', '未知起始时间。');
    if (result.identityId !== 'custom' && result.customDescription) fail('invalid', '玩家补充说明只用于自定义身份。');
    return result;
  }
  function context(value) {
    if (!value || typeof value !== 'object' || typeof value.hasStarted !== 'boolean') fail('context-unavailable', '宿主没有提供明确的聊天状态。');
    const scope = text(value.scope, '聊天标识', 512);
    if (!Number.isSafeInteger(value.floor) || value.floor < 0 || !(typeof value.branch === 'string' || Number.isSafeInteger(value.branch))) fail('context-unavailable', '宿主楼层或分支标识无效。');
    return { scope, floor: value.floor, branch: value.branch, hasStarted: value.hasStarted, busy: value.busy === true, openingToken: typeof value.openingToken === 'string' ? value.openingToken : null };
  }
  const sameContext = (a, b) => a.scope === b.scope && a.floor === b.floor && a.branch === b.branch;
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function validateTransaction(value) {
    record(value, ['token', 'expectedContext', 'manifestVersion', 'opening', 'initialState', 'timelineEvents'], '开局事务');
    const token = text(value.token, '开局提交标识', 160), manifestVersion = text(value.manifestVersion, '作者资料版本', 128);
    const expected = record(value.expectedContext, ['scope', 'floor', 'branch'], '预期聊天状态');
    const scope = text(expected.scope, '聊天标识', 512);
    if (expected.floor !== 0) fail('invalid', '开局事务只能指向尚未开始的新聊天首层。');
    const branch = typeof expected.branch === 'string' ? text(expected.branch, '聊天分支标识', 1024) : expected.branch;
    if (typeof branch !== 'string' && !Number.isSafeInteger(branch)) fail('invalid', '聊天分支标识无效。');
    const source = record(value.opening, ['title', 'body', 'identityId', 'identityLabel', 'timelineId', 'timelineLabel', 'customDescription'], '开局正文资料');
    const chosen = selection({ identityId: source.identityId, timelineId: source.timelineId, customDescription: source.customDescription });
    if (!chosen.identityId || !chosen.timelineId) fail('invalid', '开局事务须明确身份与起始时间。');
    const opening = { title: text(source.title, '开局标题', 60), body: text(source.body, '作者通用开场', 4000),
      identityId: chosen.identityId, identityLabel: text(source.identityLabel, '身份名称', 60), timelineId: chosen.timelineId,
      timelineLabel: text(source.timelineLabel, '起始时间名称', 60), customDescription: chosen.customDescription };
    const initial = initialState(value.initialState, opening.timelineId);
    if (!initial) fail('invalid', '开局事务须提供作者初始剧情状态。');
    if (!Array.isArray(value.timelineEvents)) fail('invalid', '开局事务须明确时间线事件数组；无事件时使用空数组。');
    const timelineEvents = events({ timelineEvents: value.timelineEvents });
    return freeze({ token, expectedContext: { scope, floor: 0, branch }, manifestVersion, opening, initialState: initial, timelineEvents });
  }
  function create({ manifest: authored, readContext, commitOpening }) {
    if (typeof readContext !== 'function' || typeof commitOpening !== 'function') throw Error('开局服务尚未就绪，请刷新当前故事。');
    let pending = null, lastAttempt = null, lastInspection = {}, disposed = false, state = { phase: 'idle', reason: '' };
    async function evaluate(rawSelection) {
      const model = { canStart: false, code: '', reason: '', opening: null };
      try {
        if (disposed) fail('destroyed', '开局协调器已关闭。');
        const source = manifest(authored), chosen = selection(rawSelection);
        const identity = source.identities.find(item => item.id === chosen.identityId), timeline = source.timelines.find(item => item.id === chosen.timelineId);
        if (!chosen.identityId) fail('missing-identity', '请选择身份。');
        if (!identity?.body) fail('missing-body', '这个身份的通用开场待作者定稿。');
        model.opening = { title: identity.label, body: identity.body, identityId: identity.id, identityLabel: identity.label,
          timelineId: chosen.timelineId, timelineLabel: timeline?.label || '', customDescription: chosen.customDescription };
        if (!chosen.timelineId) fail('missing-timeline', '请选择起始时间。');
        if (!timeline?.initialState) fail('missing-state', '这个起始时间的初始状态待作者提供。');
        if (timeline.timelineEvents === null) fail('missing-events', '作者须明确前置事件清单；确实没有时可提供空数组。');
        Object.assign(model, { manifestVersion: source.version, initialState: timeline.initialState, timelineEvents: timeline.timelineEvents });
        const current = context(await readContext()); model.expectedContext = current;
        if (disposed) fail('destroyed', '开局协调器已关闭，未提交设置。');
        model.signature = JSON.stringify([source.version, model.opening, model.initialState, model.timelineEvents]);
        if (current.busy) fail('busy', '宿主正在处理其他操作，请稍后确认。');
        if (current.hasStarted) {
          if (lastAttempt && sameContext(current, lastAttempt.expectedContext) && current.openingToken === lastAttempt.token && model.signature === lastAttempt.signature) { model.code = 'confirmed'; model.token = lastAttempt.token; model.reason = '这份开局设置已确认；没有发送消息或生成剧情。'; return model; }
          fail('old-chat', '这个聊天已有开局或游戏记录，不能覆盖初始化。');
        }
        if (current.floor !== 0) fail('old-chat', '只有尚未开始的新聊天首层可以确认开局设置。');
        model.canStart = true; model.code = 'ready'; model.reason = '可以确认开局设置；本操作不发送消息或生成剧情。';
      } catch (error) { model.code = error.code || 'context-unavailable'; model.reason = error.message || '开局资料暂不可用。'; }
      return model;
    }
    function inspect(chosen) {
      if (disposed) return Promise.resolve({ canStart: false, code: 'destroyed', reason: '开局协调器已关闭。' });
      if (pending) return Promise.resolve({ ...lastInspection, canStart: false, code: 'busy', reason: '正在确认开局设置，请勿重复提交。' });
      return evaluate(chosen).then(model => { lastInspection = model; return model; });
    }
    function start(chosen) {
      if (pending) return pending;
      state = { phase: 'busy', reason: '正在确认开局设置。' };
      pending = (async () => {
        const model = await evaluate(chosen); lastInspection = model;
        if (model.code === 'confirmed') return { ok: true, recovered: true, token: model.token, opening: model.opening, reason: model.reason };
        if (!model.canStart) return { ok: false, code: model.code, reason: model.reason };
        const current = context(await readContext());
        if (disposed) return { ok: false, code: 'destroyed', reason: '开局协调器已关闭，未提交设置。' };
        if (!sameContext(current, model.expectedContext)) return { ok: false, code: 'context-changed', reason: '聊天、楼层或分支已变化，未提交开局设置。' };
        if (current.hasStarted || current.busy) return { ok: false, code: current.busy ? 'busy' : 'old-chat', reason: '宿主状态已变化，未提交开局设置。' };
        const token = 'm18-opening-' + Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2);
        const transaction = validateTransaction({ token, expectedContext: { scope: current.scope, floor: current.floor, branch: current.branch }, manifestVersion: model.manifestVersion,
          opening: model.opening, initialState: model.initialState, timelineEvents: model.timelineEvents });
        lastAttempt = { ...transaction, signature: model.signature };
        let commitError = null;
        try { await commitOpening(transaction); } catch (error) { commitError = error; }
        const readback = context(await readContext());
        if (!sameContext(readback, current)) return { ok: false, code: 'context-changed', reason: '提交期间聊天、楼层或分支发生变化，请核对原聊天的设置。' };
        if (readback.hasStarted && readback.openingToken === token) return { ok: true, token, opening: transaction.opening, recovered: Boolean(commitError), reason: '开局设置已确认；没有发送消息或生成剧情。' };
        return { ok: false, code: commitError ? 'commit-failed' : 'unconfirmed', reason: commitError ? '开局设置未确认，请保留选择后重试。' : '重读未确认这次提交，未将界面标记为成功。' };
      })().catch(error => ({ ok: false, code: error.code || 'context-unavailable', reason: error.message || '宿主状态暂不可读取，请稍后重试。' })).then(result => {
        state = { phase: disposed ? 'closed' : result.ok ? 'confirmed' : 'error', ...result }; return result;
      }).finally(() => { pending = null; });
      return pending;
    }
    return { inspect, start, status: () => Object.freeze({ ...state }), destroy() { disposed = true; state = { phase: 'closed', reason: '开局协调器已关闭。' }; } };
  }
  function mount({ root, manifest: authored, getContext, commit }) {
    if (!root?.ownerDocument) throw Error('需要独立开局容器。');
    const doc = root.ownerDocument, coordinator = create({ manifest: authored, readContext: getContext, commitOpening: commit });
    let destroyed = false, revision = 0, displayedOutcome = null;
    function node(tag, className, value) { const element = doc.createElement(tag); element.className = className; if (value !== undefined) element.textContent = value; return element; }
    const panel = node('section', 'cxx-opening-link'); panel.setAttribute('aria-label', '确认身份与起始时间'); panel.style.minWidth = '0';
    const identity = node('select', 'cxx-opening-link-identity'), era = node('select', 'cxx-opening-link-timeline');
    for (const [select, options, label] of [[identity, identities, '选择身份'], [era, timelines, '选择起始时间']]) {
      const placeholder = node('option', '', label); placeholder.value = ''; select.append(placeholder);
      for (const entry of options) { const option = node('option', '', entry.label); option.value = entry.id; select.append(option); }
      select.value = ''; select.style.maxWidth = '100%'; select.style.minHeight = '44px';
    }
    const identityLabel = node('label', '', '玩家身份 '), eraLabel = node('label', '', '起始时间 '); identityLabel.append(identity); eraLabel.append(era);
    const customLabel = node('label', 'cxx-opening-link-custom', '自定义身份补充说明（不会替换作者正文）');
    const custom = node('textarea', 'cxx-opening-link-description'); custom.maxLength = 4000; custom.rows = 3; custom.style.width = '100%'; custom.style.boxSizing = 'border-box'; customLabel.append(custom); customLabel.hidden = true;
    const title = node('h3', '', '作者通用开场'), preview = node('pre', 'cxx-opening-link-preview', '作者正文待提供。');
    preview.style.whiteSpace = 'pre-wrap'; preview.style.overflowWrap = 'anywhere'; preview.style.margin = '0';
    const note = node('p', 'cxx-opening-link-note'); note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
    const button = node('button', 'cxx-opening-link-start', '确认开局设置'); button.type = 'button'; button.disabled = true; button.style.minHeight = '44px';
    panel.append(identityLabel, eraLabel, customLabel, title, preview, note, button); root.append(panel);
    const getSelection = () => ({ identityId: identity.value || null, timelineId: era.value || null, customDescription: identity.value === 'custom' ? custom.value || '' : '' });
    async function refresh() {
      const turn = ++revision, model = await coordinator.inspect(getSelection());
      if (destroyed || turn !== revision) return model;
      const current = coordinator.status(), busy = current.phase === 'busy';
      identity.disabled = era.disabled = custom.disabled = busy; customLabel.hidden = identity.value !== 'custom';
      title.textContent = model.opening?.title || '作者通用开场'; preview.textContent = model.opening?.body || '作者正文待提供。';
      note.textContent = current.phase === 'confirmed' ? current.reason : displayedOutcome?.ok === false ? displayedOutcome.reason : model.reason;
      button.disabled = busy || !model.canStart || current.phase === 'confirmed'; panel.setAttribute('aria-busy', String(busy));
      return model;
    }
    async function confirm() { if (destroyed) return { ok: false, code: 'destroyed', reason: '开局容器已关闭。' }; displayedOutcome = null; const result = coordinator.start(getSelection()); await refresh(); const outcome = await result; displayedOutcome = outcome; await refresh(); return outcome; }
    const change = () => { displayedOutcome = null; refresh(); }, click = () => { confirm(); };
    identity.addEventListener('change', change); era.addEventListener('change', change); custom.addEventListener('input', change); button.addEventListener('click', click);
    const ready = refresh();
    return { ready, refresh, getSelection, start: confirm, inspect: () => coordinator.inspect(getSelection()), status: coordinator.status,
      destroy() { destroyed = true; revision++; coordinator.destroy(); identity.removeEventListener('change', change); era.removeEventListener('change', change); custom.removeEventListener('input', change); button.removeEventListener('click', click); panel.remove(); } };
  }
  return Object.freeze({ identities, timelines, validateTransaction, create, mount });
});

// Explicit message-floor adapter for the isolated candidate. No whole-table replacement.
// Explicit message-floor adapter for the isolated candidate. No whole-table replacement.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxTerminalHost=api;})(globalThis,function(){
 'use strict';
 const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
 function create(deps){
  let epoch=0,serial=0;const branches=new WeakMap(),changed=()=>{epoch++;};
  const branchOf=m=>{let old=branches.get(m);if(!old||old.raw!==m.mes||old.swipe!==(m.swipe_id||0)||old.user!==m.is_user||old.hidden!==m.is_system){old={raw:m.mes,swipe:m.swipe_id||0,user:m.is_user,hidden:m.is_system,id:++serial};branches.set(m,old);}return old.id;};
  function context(){try{return deps.getContext?.()||null;}catch{return null;}}
  const initialContext=context(),owner=initialContext?.characters?.[initialContext.characterId]?.avatar;
  function readState(){
   const c=context(),chatId=c?.getCurrentChatId?.(),avatar=c?.characters?.[c.characterId]?.avatar;
   const eligible=c?avatar===owner&&!c.groupId:owner===undefined;
   const scope=eligible&&chatId&&avatar?JSON.stringify([avatar,'',chatId]):null;
   let floor=-1,sourceFloor=-1,statData=null;
   try{floor=deps.getLastMessageId?.()??-1;if(eligible)for(let i=floor;i>=0;i--){if(c?.chat?.[i]&&!c.chat[i].variables?.[c.chat[i].swipe_id||0]?.stat_data)continue;const v=deps.getVariables({type:'message',message_id:i});if(v?.stat_data&&typeof v.stat_data==='object'){statData=v.stat_data;sourceFloor=i;break;}}}catch{statData=null;sourceFloor=-1;}
   // Local fingerprints only. Message text and private variables never enter the news prompt.
   const branch=c?.chat?epoch+':'+c.chat.map(branchOf).join(':'):null;
   const {net,...terminal}=statData?.terminal||{};
   const revision=(deps.revision?.()||'')+':'+hash(JSON.stringify({...statData,terminal}));
   const opening=statData?.terminal?.opening;
   const hasStarted=Boolean(!eligible||c?.chat?.some(m=>m.is_user)||c?.chat?.length>1||opening?.token);
   return {scope,floor,sourceFloor,branch,statData,revision,hasStarted,openingToken:opening?.token||null};
  }
  function read(){const state=readState();return {...state,quests:deps.definitions?.(state.statData)||[]};}
  function same(expected,current){return expected.scope===current.scope&&expected.floor===current.floor&&expected.branch===current.branch;}
  function mutate(guard,update){
   const before=read();if(deps.busy?.() || !before.statData || !before.scope||before.floor<0||!guard(before)||typeof deps.updateVariablesWith!=='function')return false;
   // A synchronous updater prevents helper's async updater from writing after a chat/swipe switch.
   deps.updateVariablesWith(v=>{if(deps.busy?.() || !same(before,read())||!guard(read()))throw Error('聊天、消息或数值处理状态已变化，请重新操作。');v.stat_data=v.stat_data||structuredClone(before.statData||{});const t=v.stat_data.terminal=v.stat_data.terminal||{};const prior=structuredClone(before.statData);update(t,before);const protection=globalThis.parent?.Cxx236VariableGuard;if(!protection)throw Error('变量校验尚未就绪，请等待本卡脚本加载。');protection.validateProgram(prior,v.stat_data);return v;},{type:'message',message_id:before.floor});
   const settled=same(before,read());
   // 写进消息变量之后立刻让数据库镜像跟上，避免「变量有新值、表还是旧的」。
   if(settled)try{globalThis.parent?.CxxDataSyncRun?.();}catch(error){}
   return settled;
  }
  function writeNews(dyn,guard){
   try{return mutate(guard,(t,before)=>{t.net={...t.net,schemaVersion:1,updatedAt:'最近',scopeHash:hash(before.scope),sourceFloor:before.sourceFloor,
    news:dyn.news.slice(0,3).map(n=>((n.outlet||'都营新闻')+'：'+n.title).slice(0,240)),threads:dyn.threads.slice(0,3).map(n=>('帖子：'+n.title).slice(0,240))};});}catch{return false;}
  }
  function updateLedger(update){
   if(typeof update!=='function')return false;
   try{return mutate(()=>true,(t,before)=>{t.quests=t.quests||{};update(t,before.floor);});}catch{return false;}
  }
  function commitOpening(tx){
   try{
    if(typeof deps.validateOpening!=='function')return {ok:false,reason:'开局校验器不可用，未写入设置。'};
    tx=deps.validateOpening(tx);
    if(!same(tx.expectedContext,read()))return {ok:false,reason:'聊天或消息已变化，请重新选择。'};
    if(read().openingToken===tx.token)return {ok:true,token:tx.token};
    const ok=mutate(c=>same(tx.expectedContext,c)&&!c.hasStarted,(t,c)=>{t.opening={schemaVersion:1,token:tx.token,scopeHash:hash(c.scope),manifestVersion:tx.manifestVersion,...structuredClone(tx.opening),initialState:structuredClone(tx.initialState),timelineEvents:structuredClone(tx.timelineEvents),confirmedFloor:c.floor};});
    return {ok:ok&&read().openingToken===tx.token,token:tx.token,reason:ok?'':'当前聊天已开始或宿主不支持安全写入。'};
   }catch(e){return {ok:false,reason:e.message};}
  }
  return Object.freeze({read,readState,updateLedger,writeNews,commitOpening,changed,hash});
 }
 return Object.freeze({create,hash});
});

/* Gal names and host capabilities around the frozen M18 opening transaction. */


/* Pure opening drafts. Selection never writes a message, worldbook or game state. */


/* Opening drafts stay local; an optional session owns the guarded settings transaction. */
/* Opening drafts stay local; an optional session owns the guarded settings transaction. */
/* Opening drafts stay local; an optional session owns the guarded settings transaction. */
/* Both readers attach the same live opening surface. */
(function(root,factory){root.CxxGalOpeningView=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGalOpeningView");});


/* Display the maintained opening iframe in place; never replay its business actions. */
/* Display the maintained opening iframe in place; never replay its business actions. */
(function(root,factory){root.CxxGalOpeningBridge=factory();})(globalThis,function(){throw Error("Unassembled module: CxxGalOpeningBridge");});

own(publish('Cxx233Opening',{CxxOpeningLink,CxxTerminalHost,CxxGalOpeningView,CxxGalOpeningBridge}));

})().catch(error=>{__cxxStageError("[身份与开局]",error);parent.toastr?.error(error.message,"身份与开局");});

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
const documents=[];
 /* Public, immutable atlas files. This store never contains chat or player data. */
(function(root,factory){root.CxxAtlasResourcesFactory=factory();})(globalThis,function(){throw Error("Unassembled module: CxxAtlasResourcesFactory");});
(function(root,factory){root.CxxAtlasDocumentStyle=factory();})(globalThis,function(){throw Error("Unassembled module: CxxAtlasDocumentStyle");});

 let resourceClient;
 function prepare(html){throw Error("Unassembled map document styles");}
 function install(window){throw Error("Unassembled map shell");}
 function mount(window){install(window);}
 if(typeof own==='function')own(()=>resourceClient?.destroy());
 
 
 
(function(root,factory){root.CxxContent=factory();})(globalThis,function(){throw Error("Unassembled module: CxxContent");});

/* Chat-owned map tool. Never writes gameplay, location or message state. */
/* Chat-owned map tool. Never writes gameplay, location or message state. */
/* Chat-owned map tool. Never writes gameplay, location or message state. */
/* Chat-owned map tool. Never writes gameplay, location or message state. */
(function(root,factory){root.CxxAtlasToolFactory=factory();})(globalThis,function(){throw Error("Unassembled module: CxxAtlasToolFactory");});




 const maps={documents,install,mount,prepare};own(publish('Cxx233Maps',maps));
/* One audio owner per chat. Views subscribe; closing a view never stops music. */
(function(root,factory){root.CxxRadioFactory=factory();})(globalThis,function(){throw Error("Unassembled module: CxxRadioFactory");});

const radio=CxxRadioFactory.create({window:parent,runtime,channels:[{"id":"ch1","freq":"88.3","name":"迷子ラジオ","blurb":"深夜轮播那支从废墟里站起来的乐队——不用问是哪支，红灯亮起时你自然会懂。","sourceFile":"012.txt","tracks":[{"name":"迷星叫","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/mxj.mp3"},{"name":"壱雫空","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/ynk.mp3"},{"name":"詩超絆","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/scb.mp3"},{"name":"Subtitle","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/Subtitle.mp3"},{"name":"ノンブレス・オブリージュ","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/gzyw.mp3"},{"name":"だれかの心臓になれたなら","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/xinzang.mp3"},{"name":"少女レイ","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/rei.mp3"},{"name":"パメラ","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/pml.mp3"},{"name":"猛独が襲う","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/mdqx.mp3"},{"name":"Henceforth","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/Henceforth.mp3"},{"name":"君の神様になりたい","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/kamisama.mp3"},{"name":"二息歩行","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/erxbx.mp3"},{"name":"碧天伴走","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/btbz.mp3"},{"name":"影色舞・オブリージュ","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/ysw.mp3"},{"name":"聿日箋秋","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/yrqq.mp3"},{"name":"ないばいたりてぃ","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/hwhl.mp3"},{"name":"キリトリセン","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/jqx.mp3"},{"name":"栞","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/sor.mp3"}]},{"id":"ch2","freq":"96.0","name":"仮面チャンネル","blurb":"面具之下没有偶像，只有更完美的声音。本频道由不愿露脸的赞助商冠名。","sourceFile":"013.txt","tracks":[{"name":"Ave Mujica","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/AveMujica.mp3"},{"name":"KiLLKiSS","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/KiLLKiSS.mp3"},{"name":"Good Night","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/GoodNight.mp3"},{"name":"ノンブレス・オブリージュ","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/gzyw2.mp3"},{"name":"美しい鰭","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/mldq.mp3"},{"name":"颜","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/y.mp3"},{"name":"八芒星ダンス","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/bmx.mp3"},{"name":"Crucifix X","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/CrucifixX.mp3"},{"name":"天球のMúsica","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/tq.mp3"},{"name":"Georgette Me, Georgette You","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/GeorgetteMeGeorgetteYou.mp3"}]},{"id":"ch3","freq":"102.7","name":"都営ジュークボックス","blurb":"都营点唱机，观众点播，星海不眠——今晚想听谁的心跳？","sourceFile":"014.txt","tracks":[{"name":"反方向的钟 - 睦","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/ffxdz.mp3"},{"name":"最后一页 - 睦","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/zhyy.mp3"},{"name":"半点心 - 初华","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/bdx.mp3"},{"name":"处处吻 - 初华","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/ccw.mp3"},{"name":"月半小夜曲 - 初华","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/ybxyq.mp3"},{"name":"谁家 - 灯","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/sheijia.mp3"},{"name":"不说 - 灯","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/bushuo.mp3"},{"name":"童话镇 - 灯","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/thz.mp3"},{"name":"我看过 - 祥子","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/wkg.mp3"},{"name":"年轮 - 爱音","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/nl.mp3"},{"name":"第57次取消发送 - 爱音","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/57.mp3"},{"name":"夏天的风 - 爱音","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/xtdf.mp3"},{"name":"说爱你 - 爱音","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/shuoaini.mp3"},{"name":"泪桥 - 爱音","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/leiqiao.mp3"},{"name":"爱你 - 爱音","url":"https://pub-b4030ee323854568a2884b469b1c0d5f.r2.dev/aini.mp3"}]},{"id":"ch4","freq":"106.5","name":"環状線ミュージック","blurb":"山手线一圈 34.5 公里，足够听完一整张专辑。系好安全带。","sourceFile":"015.txt","tracks":[{"name":"モニタリング - 爱音","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/Monitoring.mp3"},{"name":"恋爱裁判 - 祥子＆爱音","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/Love_Trial.mp3"},{"name":"可愛くなりたい - 爱音","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/hw1.mp3"},{"name":"离去之原 - 初华","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/saritshinohara.mp3"},{"name":"幽灵东京 - 初华","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/Ghost_City_Tokyo.mp3"},{"name":"银色飞行船 - 灯","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/Ginirohikousen.mp3"},{"name":"罗密欧与辛德瑞拉 - 睦","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/doriko1.mp3"},{"name":"乙女解剖 - 喵梦","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/deco2.mp3"},{"name":"妄想税 - 祥子","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/dco1.mp3"},{"name":"秒針を噛む - 爱音","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/mzkm.mp3"},{"name":"チェリーポップ - 爱音","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/deco1.mp3"},{"name":"君の知らない物語 - 爱音","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/ryo1.mp3"},{"name":"ドーナツホール - 爱音","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/hachi1.mp3"},{"name":"シュガーソングとビターステップ - 爱音","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/sugar.mp3"},{"name":"カゲロウデイズ - 希罗","url":"https://gitgud.io/Kurusutenka/ROCA/-/raw/master/kageroudaze.mp3"}]}]});own(publish('CxxRadio',radio,()=>radio.destroy()));

 const mapTool=CxxAtlasToolFactory.create({window:parent,api:globalThis,runtime,maps,content:CxxContent,base:{"quests":[{"id":"q01","title":"巴的采购单","fixer":"秤叔","fixerNote":"红花街·旧当铺「公平秤」的柜台后头","district":"红花街","type":"回收","difficulty":"低","pay":30000,"payNote":"","deadline":"无","brief":"巴的诊所你总该听过——收费实在，手艺好，能扛事。她订了批皮下护甲，卖家临时放了鸽子，货现在蹲在清道夫的抛货点里落灰。你去把它端回来，巴付账，我抽一成。别问货是哪来的，你也没看见，对吧。","goal":"到抛货点清点并取回整批皮下护甲（六套），送到巴的诊所后账。","terms":"护甲别磕碰；巴只认完好件。","risk":"抛货点常有清道夫的人回头翻检——撞上了别硬碰，你是他们清单上没有的人。","bonus":"无损交付：六套护甲完好无损，加成 10%。","unlock":"无","flagship":false,"mapId":"tokyo-central","placeId":"a-yang-clinic"},{"id":"q02","title":"被盯上的壳","fixer":"秤叔","fixerNote":"红花街·旧当铺「公平秤」的柜台后头","district":"红花街","type":"救人","difficulty":"中","pay":80000,"payNote":"","deadline":"两日内","brief":"有个机偶姑娘在红花街西口被人盯上了——清道夫那帮摘器官的把她当成行走的备件库。她弟弟在我的柜台上押了最后一枚旧币换消息，我收下了，也打算把事情办了。把人带去巴的诊所，别让她变成夜市摊上的零件。","goal":"找到她（西口夜市一带），把她完整地送到巴的诊所。","terms":"她是非法机偶，警视厅不管——也别让警视厅看见；她自己可能不配合，多点耐心。","risk":"清道夫双人组轮流盯梢；红花街夜里不好走。","bonus":"不惊动：全程避开清道夫眼线，加成 30%。","unlock":"无","flagship":false,"mapId":"tokyo-central","placeId":"a-yang-clinic"},{"id":"q03","title":"把吉他送过铁丝网","fixer":"玲姐","fixerNote":"RiNG 社区·场务棚，嗓门比灯还亮","district":"RiNG 社区","type":"护送","difficulty":"低","pay":25000,"payNote":"","deadline":"明晚演出前","brief":"河沿那边有支小乐队租了排练房，一把旧世代的贝斯还押在我们仓库。明晚他们要用——但这把琴比在场一半人的年纪都大，磕一下就是事故。你腿脚利索，帮我把它从 RING-Live! 后门送到荒川河沿。都是街坊的事，别让我失望。","goal":"明晚八点前，把贝斯完好送到荒川河沿的排练房，拿回签收条。","terms":"琴不许离手；路上有人借看，一律摇头。","risk":"河沿带夜里治安差，抢器材的和收过路费的都不新鲜。","bonus":"零损伤：琴身无一道新伤，加成 20%。","unlock":"无","flagship":false,"mapId":"tokyo-central","placeId":"ring-live"},{"id":"q04","title":"谁在偷我们的电","fixer":"玲姐","fixerNote":"RiNG 社区·场务棚，嗓门比灯还亮","district":"RiNG 社区","type":"渗透调查","difficulty":"中","pay":60000,"payNote":"","deadline":"无","brief":"RiNG 社区这礼拜跳了三次闸，全楼道的义眼都得重启。电是我管的，账是我平的，跳下去我先倒霉。社区管道图上多出一条不存在的支线——顺着它查，看看是哪路神仙在偷电。查清楚了就行，怎么处理等我发话。","goal":"查明偷电支线的源头与用途，回报玲姐。","terms":"只查不动手；别打草惊蛇，也别把自己搭进去。","risk":"支线那头通向地下室—— RiNG 的地下室不全是空着的。","bonus":"人赃并获：拍到可指认的画面而非只剪了线，加成 25%。","unlock":"无","flagship":false,"mapId":"tokyo-central","placeId":"ring-community"},{"id":"q05","title":"三楼的空办公室","fixer":"教授","fixerNote":"新日本时代广场·二手芯片铺「百科全数」的店主","district":"新日本时代广场","type":"渗透调查","difficulty":"中","pay":90000,"payNote":"","deadline":"无","brief":"中小公司大厦，东翼三楼，挂牌的是家做翻译软件的小公司——工资照发、工位照摆，三个月没人上班。整栋楼的电力曲线却夜里陡增。信息含量，值得你冒这个险。进去看看，拍点东西回来。","goal":"潜入三楼，查明夜间真实活动并取证回报。","terms":"见好就收；你的任务是把信息带回来，不是把门拆下来。","risk":"大楼有外包安保，巡逻表是死的，人是活的。","bonus":"不惊动：未触发任何警报与上报，加成 30%。","unlock":"无","flagship":false},{"id":"q06","title":"被雪藏的试音带","fixer":"教授","fixerNote":"新日本时代广场·二手芯片铺「百科全数」的店主","district":"弦卷集团子公司","type":"偷窃","difficulty":"高","pay":150000,"payNote":"","deadline":"无","brief":"有个嗓子很好的姑娘，两年前签给弦卷旗下的厂牌，试音带录完就被公司压进档案库——理由是「定位不符」。她付不起违约金，只付得起我这单的钱。去档案库，把那份试音带的数据拷出来。这不算偷，这是把人家自己的嗓子还给人家。","goal":"进入子公司档案库，拷出指定试音带数据，原样带回。","terms":"只拷指定文件；库里的别的东西看都别多看一眼。","risk":"企业档案库有智能哨戒与审计日志，痕迹就是罪证。","bonus":"不留痕：日志零异常，加成 40%。","unlock":"无","flagship":false},{"id":"q07","title":"夜半歌声","fixer":"老龟","fixerNote":"平民区·修车行「龟尾」，永远在车底下","district":"平民区","type":"清除","difficulty":"高","pay":120000,"payNote":"","deadline":"无","brief":"我这条街上有间黑超梦作坊，夜夜放素材，声音顺着下水道飘上来——听过的老人现在不敢睡觉，有个孩子至今在做噩梦。作坊背后是谁我不问，我只问街道安宁。把播放点端了。手脚干净点，别在我地盘上放火。","goal":"找到作坊播放点并将其瘫痪，令其无法继续营业。","terms":"不得伤及被扣押的素材演员；不得波及邻栋。","risk":"作坊有常驻看场，背后金主身份不明——惹不起就撤，人在比什么都强。","bonus":"账本到手：带走其收支记录交给老龟，加成 50%。","unlock":"无","flagship":false},{"id":"q08","title":"送一程","fixer":"老龟","fixerNote":"平民区·修车行「龟尾」，永远在车底下","district":"城郊方向","type":"护送离城","difficulty":"中","pay":70000,"payNote":"","deadline":"三日内","brief":"有位客人要出城去赤羽方向，不想留名，也不想被记脸。我的车，你的方向盘。路上别问，别看后视镜太久，准点到。客人的规矩就是我的规矩——这一单的规矩是：当没发生过。","goal":"按约定时间将客人送达赤羽城郊交接点，平安返回。","terms":"不问身份；不接受任何绕路请求；交接点拍照即毁。","risk":"出城关卡与城郊路段各有各的耳朵；被跟踪就立刻回报。","bonus":"无痕：全程未被发现跟踪痕迹，加成 30%。","unlock":"无","flagship":false},{"id":"q09","title":"秤上的老鼠","fixer":"秤叔","fixerNote":"红花街·旧当铺「公平秤」的柜台后头","district":"红花街","type":"回收","difficulty":"低","pay":40000,"payNote":"","deadline":"无","brief":"我柜台上有个伙计，偷了我三件寄卖货跑了——义体件，来路我清清楚楚，他卖不出好价，只能蹲在红花街等下家。人我可以不要，货我要。找他，拿货。告诉他，秤叔的秤，称得出每个人的斤两。","goal":"找到伙计，追回三件寄卖货。","terms":"货为主，人为次——他要是配合，放他一条生路。","risk":"他可能已经把货押给了别人；红花街的规矩，货在谁手里谁有理，别在店里动手。","bonus":"完璧：三件货一件不少且未拆封，加成 20%。","unlock":"无","flagship":false},{"id":"q10","title":"塔里的名单","fixer":"教授","fixerNote":"新日本时代广场·二手芯片铺「百科全数」的店主","district":"月之森周边","type":"渗透调查","difficulty":"高","pay":200000,"payNote":"","deadline":"无","brief":"月之森每年都有毕业生被弦卷的「人才计划」挑走——全额奖学金、直通塔里任职，家里从此只收得到标准化的报平安邮件。有位母亲委托我查她女儿的近况，我把活转给你。别紧张，多数人只是在塔里过得很好，只是不能再联系家里人而已。多数人。","goal":"查明近三年「人才计划」入选者的实际去向，取回可交付的线索。","terms":"委托人只要女儿的下落；其余名单见好就收。","risk":"弦卷的外围安防不养闲人；这份名单本身可能就是诱饵。","bonus":"人证：带回一名入选者的亲笔讯息，加成 50%。","unlock":"无","flagship":false},{"id":"q_heist","title":"借走一段旧歌声（易碎品，勿摇晃）","fixer":"匿名","fixerNote":"仅经委托板传话，问讯报腔","district":"弦卷303酒店顶层","type":"潜入","difficulty":"极高","pay":1000000,"payNote":"基础报酬另加 300% 完工结算奖金；定金已付；保密协议单独签署。","deadline":"解锁后长期有效","brief":"一位不愿透露身份的委托人放的单：潜入指定居所，取回一只手掌大小的封蜡小盒。盒内物品不明，委托方声明无需查看、无需确认——拿到即算完成。安保等级极高。建议夜间行动。","goal":"潜入弦卷303酒店顶层居所，取回封蜡小盒并撤离。","terms":"不得携带重装武器进入建筑本体；不得与居所主人发生任何形式的接触；中间人勿扰；企业狗勿扰；警视厅相关人员勿扰。","risk":"私人安保＋智能哨戒双配置；塔的阴影里有个顶着吉祥物名字的东西，别让它看见你。","bonus":"无痕：未触发任何警报，加成 100%。","unlock":"完成 2 单任意委托，且任一角色好感度达到「熟悉」（350）","flagship":true}],"locationMaps":[{"id":"tokyo-central","places":[{"id":"plaza","name":"新日本时代广场","cat":"地标","group":"imperial","lon":139.7635,"lat":35.6855,"desc":"东京都最大的广场兼交通枢纽，霓虹时代重建计划的中心工程，以『新日本』纪元命名。地面层是巨型换乘枢纽，地铁、磁悬浮与高架步道三层立体交叉；广场中央的全息投影塔昼夜循环播放四大集团广告与政府公报。四大势力大厦分立四角——北为弦卷塔，东为丰川本社，西为太平洋防务总部，南为联邦科技日本区总部。市民因此戏称这里为『公司广场』。普通人心里都清楚，这座广场属于哪些人。"},{"id":"tsurumaki-tower","name":"弦卷塔","cat":"地标","group":"imperial","lon":139.7635,"lat":35.6888,"desc":"矗立于新日本时代广场北缘的东京都第一高塔，三栋通过中层巨型走廊相连的合体建筑——左塔、右塔515米，中塔777米，通体黑晶幕墙，塔尖常年隐没在雾霾与全息广告的辉光里。弦卷集团的总部所在：中塔高层以上权限逐层收紧，顶层是弦卷家族的私人领域，外人无从知晓其真貌。塔内安保由集团私兵与智能哨戒系统双层把守。坊间传言塔的地下藏着集团真正的金库与『不宜见光之物』。"},{"id":"tsukinomori","name":"月之森女子学园","cat":"学校","group":"imperial","lon":139.744,"lat":35.686,"desc":"校风严谨的私立女子学校，受弦卷集团资助。设有小学部、初中部和高中部，在读学生多为富家千金。丰川祥子曾在此就读，2050年因家中变故离校，现为无证黑户；若叶睦原在册，2050年12月底离家出走；高一A班还有已申请在外实习的长崎素世。"},{"id":"hanasakigawa","name":"花咲川女子学院","cat":"学校","group":"imperial","lon":139.7515,"lat":35.7218,"desc":"位于文京区的职业学校，校风严苛，与东京政府的警视厅与法务系统挂钩，承担定向培养任务。注重纪律和体能考核，学生大多出身赤贫或公务员家庭，多数毕业生会报考警务系统或进入地方防务部门做文职。高一B班有椎名立希与八幡海铃，初三A班是要乐奈——立希还在RING-Live!地下三层的吧台兼职。"},{"id":"ring-community","name":"RiNG社区","cat":"街区","group":"underpool","level":"区划","lbl":{"dx":-18,"dy":-6,"anchor":"end"},"lon":139.7297,"lat":35.7295,"dims":[{"k":"治安","v":"2 · 失序","d":"警视厅只在地表外围出入口设防，社区内部由各方按自己的规则管辖"},{"k":"人口","v":"约4万","d":"破产平民、海外滞留人员、底层手工艺人与无合法身份的边缘青年"},{"k":"经济","v":"赤贫～温饱","d":"黑市流通、二手乐器与零工"},{"k":"基建","v":"残缺","d":"市政维护早已停止，私接电缆挂在锈蚀钢架上，网路靠民间中继"},{"k":"势力","v":"四方分治","d":"走私团伙、黑帮、音乐社团与社区义警互不干涉；RING-Live!为中立停火区"}],"desc":"2023年大停电让池袋庞大的地下铁网络与多层商业街区彻底停摆；行政力量撤走之后，这里成了向下生长的城市。社区依托原有的铁路线向下纵深蔓延数层——从顶层尚有微光透入的废弃车站，到底层常年积水阴暗的下水道。在大企业垄断文化娱乐的时代，正规渠道充斥量产的虚拟偶像与廉价音乐，厌烦算法的年轻乐手因此在此聚集；二手实体乐器、老式效果器与民间拼装的音响在这里流通。社区的核心场馆RING-Live!坐落于地下换乘大厅的地表入口。"},{"id":"ring-live","name":"RING-Live!","cat":"场馆","group":"underpool","lbl":{"dx":18,"dy":14,"anchor":"start"},"lon":139.733,"lat":35.7282,"desc":"都筑诗船建立的第三家Live House，负责人真次凛凛子，馆名承自旧日本时期的老牌场馆『旧RiNG』。改造自旧时代建筑，地上三层地下三层共六层，是社区核心的中立停火区——严禁携带重装武器入内。这里既是Live House，也是物资集散地与黑市；一楼乐器店与旧唱片店，二楼咖啡馆，另有录音室与乐器租赁。地下三层是全社区最大的酒吧『Lust？Love？Live！』——椎名立希自2051年4月起就在那间吧台兼职并协助场务。"},{"id":"space-site","name":"SPACE 旧址","cat":"场馆","group":"underpool","lbl":{"dx":-18,"dy":-6,"anchor":"end"},"lon":139.726,"lat":35.732,"desc":"都筑诗船的第一家Live House，『大少女乐团时代』的发源地之一，曾引发女子高中生乐队热潮。2049年年末正式关闭，原址后被公司收购，改建为停车场。关闭时，RiNG社区中人都一片哀嚎。对要乐奈来说，这里是如同家一般的地方——即使关闭至今，她依然会经常在旧址门口逗留。"},{"id":"circle","name":"CiRCLE","cat":"场馆","group":"underpool","lbl":{"dx":18,"dy":-4,"anchor":"start"},"lon":139.738,"lat":35.727,"desc":"都筑诗船在关闭SPACE后开设的第二家Live House，负责人月岛麻里奈，位于RiNG社区外围。场地可容纳约500人——在娱乐财阀连锁场馆遍布东京的今天，这类坚持实体舞台的独立Live House是地下乐队稀缺的演出资源，人气很高，时常爆满。2050年6月初，CRYCHIC唯一一次Live在此举办，要乐奈在观众席听完了《春日影》；同月月底的一个雨夜，祥子也是在这里向CRYCHIC宣告退队。"},{"id":"beni-street","name":"红花街","cat":"街区","group":"underpool","level":"区划","lbl":{"dx":-16,"dy":20,"anchor":"end"},"lon":139.7225,"lat":35.7225,"dims":[{"k":"治安","v":"1 · 极危","d":"不属于任何一方管辖，纠纷靠私了；警视厅不进这条街"},{"k":"人口","v":"常驻极少 · 日流约2万","d":"小商贩、性工作者、黑超梦商人与寻医问药的伤者"},{"k":"经济","v":"温饱","d":"地摊小吃、灰色服务与廉价义体手术"},{"k":"基建","v":"残缺","d":"违章铁皮桥与规格不一的电缆，消防与急救都没有保障"},{"k":"势力","v":"无主导","d":"地头蛇按巷道收清扫费，各方默契不把冲突烧进这条街"}],"desc":"红花街本不该存在——它是在RiNG贫民区与平民区的交界缝隙里自己长出来的三不管地带。多层立体的街道与巷道里，地摊与推车商贩挤满白天，各色霓虹灯牌彻夜不熄；廉价但品控不一的义体医生藏在街巷深处。街道整体的视觉风格，与旧日本时期的歌舞伎町相似。海铃也常去夕暮老街找宇田川巴处理伤口与维护义体，巴的诊所与羽泽咖啡店比邻。"},{"id":"a-yang-clinic","name":"宇田川巴的老街诊所","cat":"店铺","group":"underpool","lbl":{"dx":-18,"dy":6,"anchor":"end"},"lon":139.7232,"lat":35.7238,"desc":"夕暮老街的独立义体与神经内科诊所，由宇田川巴主理，与羽泽咖啡店比邻。海铃经常来这里接受外伤处理与义体维护——委托中左臂挨枪的伤口处理与防弹片更换，就是在这里做的。"},{"id":"haneoka","name":"羽丘女子学园","cat":"学校","group":"underpool","lon":139.728,"lat":35.742,"desc":"校风开朗的平民女子学校，设有初中部和高中部，以丰厚的奖学金机制和免费食堂而闻名。制服颜色随学年变化是其一景——初中部紫色，高中部一年级绿色、二年级蓝色、三年级棕色。高一A班：高松灯与千早爱音（2051年4月入学）。"},{"id":"akabane","name":"赤羽街区","cat":"街区","group":"lowtown","lon":139.7205,"lat":35.776,"desc":"北区北端的旧街区。2051年3月的一个雨夜，丰川祥子拉紧兜帽，穿过霓虹灯下的小巷——夜活归途，全程警戒，她在这片街区的阴影里一步步盘算着向丰川家的复仇。"},{"id":"sakiko-rental","name":"祥子的赤羽出租屋"},{"id":"akabane-clinic","name":"赤羽黑诊所"},{"id":"rana-shifune-home","name":"乐奈与诗船的公寓"},{"id":"ring-instruments","name":"RING-Live! · 乐器店"},{"id":"ring-records","name":"RING-Live! · 旧唱片店"},{"id":"ring-cafe","name":"RING-Live! · 咖啡馆"},{"id":"ring-studio","name":"RING-Live! · 录音与租赁"},{"id":"ring-basement-bar","name":"Lust？Love？Live！"},{"id":"service-imperial-weapon","name":"皇核 · 武器店"},{"id":"service-imperial-implant","name":"皇核 · 义体医生"},{"id":"service-imperial-hospital","name":"皇核 · 医疗点"},{"id":"service-imperial-market","name":"皇核 · 垃圾商店"},{"id":"service-imperial-transit","name":"皇核 · 交通设施"},{"id":"service-underpool-weapon","name":"暗池 · 武器店"},{"id":"service-underpool-implant","name":"暗池 · 义体医生"},{"id":"service-underpool-hospital","name":"暗池 · 医疗点"},{"id":"service-underpool-market","name":"暗池 · 垃圾商店"},{"id":"service-underpool-transit","name":"暗池 · 交通设施"},{"id":"service-lowtown-weapon","name":"荒川下城 · 武器店"},{"id":"service-lowtown-implant","name":"荒川下城 · 义体医生"},{"id":"service-lowtown-hospital","name":"荒川下城 · 医疗点"},{"id":"service-lowtown-market","name":"荒川下城 · 垃圾商店"},{"id":"service-lowtown-transit","name":"荒川下城 · 交通设施"},{"id":"service-neonring-weapon","name":"山手霓环 · 武器店"},{"id":"service-neonring-implant","name":"山手霓环 · 义体医生"},{"id":"service-neonring-hospital","name":"山手霓环 · 医疗点"},{"id":"service-neonring-market","name":"山手霓环 · 垃圾商店"},{"id":"service-neonring-transit","name":"山手霓环 · 交通设施"},{"id":"service-tsurumaki-weapon","name":"弦卷台 · 武器店"},{"id":"service-tsurumaki-implant","name":"弦卷台 · 义体医生"},{"id":"service-tsurumaki-hospital","name":"弦卷台 · 医疗点"},{"id":"service-tsurumaki-market","name":"弦卷台 · 垃圾商店"},{"id":"service-tsurumaki-transit","name":"弦卷台 · 交通设施"},{"id":"service-keihin-weapon","name":"京滨方舟 · 武器店"},{"id":"service-keihin-implant","name":"京滨方舟 · 义体医生"},{"id":"service-keihin-hospital","name":"京滨方舟 · 医疗点"},{"id":"service-keihin-market","name":"京滨方舟 · 垃圾商店"},{"id":"service-keihin-transit","name":"京滨方舟 · 交通设施"},{"id":"service-west-weapon","name":"西郊净土 · 武器店"},{"id":"service-west-implant","name":"西郊净土 · 义体医生"},{"id":"service-west-hospital","name":"西郊净土 · 医疗点"},{"id":"service-west-market","name":"西郊净土 · 垃圾商店"},{"id":"service-west-transit","name":"西郊净土 · 交通设施"},{"id":"service-saitama-weapon","name":"埼玉 · 武器店"},{"id":"service-saitama-implant","name":"埼玉 · 义体医生"},{"id":"service-saitama-hospital","name":"埼玉 · 医疗点"},{"id":"service-saitama-market","name":"埼玉 · 垃圾商店"},{"id":"service-saitama-transit","name":"埼玉 · 交通设施"},{"id":"service-hokuen-weapon","name":"所泽 · 武器店"},{"id":"service-hokuen-implant","name":"所泽 · 义体医生"},{"id":"service-hokuen-hospital","name":"所泽 · 医疗点"},{"id":"service-hokuen-market","name":"所泽 · 垃圾商店"},{"id":"service-hokuen-transit","name":"所泽 · 交通设施"},{"id":"service-kai-weapon","name":"奥多摩 · 武器店"},{"id":"service-kai-implant","name":"奥多摩 · 义体医生"},{"id":"service-kai-hospital","name":"奥多摩 · 医疗点"},{"id":"service-kai-market","name":"奥多摩 · 垃圾商店"},{"id":"service-kai-transit","name":"奥多摩 · 交通设施"},{"id":"service-fuji-transit","name":"丹泽 · 交通设施"},{"id":"service-fuji-hospital","name":"丹泽 · 医疗点"},{"id":"service-sagami-weapon","name":"川崎 · 武器店"},{"id":"service-sagami-implant","name":"川崎 · 义体医生"},{"id":"service-sagami-hospital","name":"川崎 · 医疗点"},{"id":"service-sagami-market","name":"川崎 · 垃圾商店"},{"id":"service-sagami-transit","name":"川崎 · 交通设施"},{"id":"service-chiba-weapon","name":"千叶 · 武器店"},{"id":"service-chiba-implant","name":"千叶 · 义体医生"},{"id":"service-chiba-hospital","name":"千叶 · 医疗点"},{"id":"service-chiba-market","name":"千叶 · 垃圾商店"},{"id":"service-chiba-transit","name":"千叶 · 交通设施"},{"id":"service-docks-weapon","name":"木更津 · 武器店"},{"id":"service-docks-implant","name":"木更津 · 义体医生"},{"id":"service-docks-hospital","name":"木更津 · 医疗点"},{"id":"service-docks-market","name":"木更津 · 垃圾商店"},{"id":"service-docks-transit","name":"木更津 · 交通设施"},{"id":"west-terminal","name":"湾西货运港"},{"id":"bay-terminal","name":"湾岸客运码头"},{"id":"east-terminal","name":"木更津发射中心"},{"id":"sunken-market","name":"暗池层叠市场"},{"id":"arakawa-hospital","name":"荒川综合医院"},{"id":"neon-forum","name":"霓环中央演艺场"},{"id":"hill-estate","name":"弦卷台庭园会馆"},{"id":"ark-logistics","name":"方舟联运总站"},{"id":"west-market","name":"武藏野农产市场"},{"id":"saitama-housing","name":"埼玉连廊住区"},{"id":"tokorozawa-assembly","name":"所泽机造总装厂"},{"id":"valley-terraces","name":"多摩山前阶庭"},{"id":"fuji-observatory","name":"丹泽边境观测站"},{"id":"kawasaki-refinery","name":"川崎能源联合厂"},{"id":"chiba-waterhall","name":"千叶滨水会展馆"},{"id":"dock-ruins","name":"木更津旧港遗构"},{"id":"catalog-tsurumaki-apartment","name":"栈桥公寓"},{"id":"catalog-saitama-apartment","name":"朝班公寓"},{"id":"catalog-keihin-drop","name":"九号交接棚"},{"id":"catalog-docks-drop","name":"潮窗交货柜"},{"id":"catalog-neonring-clothing","name":"反光线改衣台"},{"id":"catalog-chiba-clothing","name":"千叶 · 服装"},{"id":"catalog-underpool-netrunner","name":"回声线缆台"},{"id":"catalog-kai-netrunner","name":"奥多摩 · 网络黑客"},{"id":"catalog-underpool-melee","name":"暗池 · 近战武器商贩"},{"id":"catalog-lowtown-melee","name":"荒川下城 · 近战武器商贩"},{"id":"catalog-west-food","name":"雨棚青菜饭"},{"id":"catalog-lowtown-food","name":"河闸食堂"},{"id":"catalog-neonring-bar","name":"山手霓环 · 酒吧"},{"id":"catalog-underpool-bar","name":"暗池 · 酒吧"},{"id":"catalog-neonring-joytoy","name":"山手霓环 · 性偶"},{"id":"catalog-underpool-fixer","name":"暗池转单台"},{"id":"catalog-keihin-fixer","name":"京滨夜班调度"},{"id":"catalog-imperial-client","name":"皇核资产事务窗口"},{"id":"catalog-chiba-client","name":"千叶试音室联络台"},{"id":"catalog-lowtown-police","name":"退水线上的白漆"},{"id":"catalog-underpool-assault","name":"走廊里的第二把锁"},{"id":"catalog-sagami-assault","name":"下班口的欠薪单"},{"id":"catalog-docks-organized","name":"空箱也要过秤"},{"id":"catalog-saitama-reported","name":"不在名册上的房间"},{"id":"catalog-hokuen-cyberpsycho","name":"别把警报当成病历"},{"id":"catalog-kai-tarot","name":"奥多摩 · 塔罗牌"},{"id":"catalog-west-tarot","name":"西郊净土 · 塔罗牌"},{"id":"catalog-chiba-sidejob","name":"给海风留一个麦克风"},{"id":"catalog-saitama-sidejob","name":"末班车前的灯"},{"id":"catalog-lowtown-recovery","name":"一只饭盒的重量"},{"id":"catalog-underpool-theft","name":"借条背面"},{"id":"catalog-keihin-escort","name":"冷链不等人"},{"id":"catalog-tsurumaki-escort","name":"体面地搬出去"},{"id":"catalog-sagami-hitman","name":"请把收据留下"},{"id":"catalog-hokuen-sabotage","name":"请勿恢复出厂"},{"id":"catalog-fuji-sos","name":"山路上的第三张床"},{"id":"catalog-docks-sos","name":"潮汐表没有名字"},{"id":"bay-mid-bridge","name":"中湾跨海大桥"},{"id":"bay-lower-bridge","name":"下湾跨海大桥"},{"id":"tokyo-skytree","name":"东京天空塔"},{"id":"m8-site-ryomo","name":"两毛制造联合厂"},{"id":"m8-site-north-gateway","name":"北门户综合站城"},{"id":"m8-site-mito-oarai","name":"水户大洗港城中心"},{"id":"m8-site-saitama-north","name":"北埼玉轨道生活组团"},{"id":"m8-site-tsukuba-north","name":"筑波研究园"},{"id":"m8-site-tone-south","name":"利根南岸换装场"},{"id":"m8-site-kashima-kamisu","name":"鹿岛港后炼化厂"},{"id":"m8-site-narita-hokuso","name":"北总航空物流组团"},{"id":"m8-site-chiba-extension","name":"千叶东部复合站城"},{"id":"m8-site-choshi","name":"銚子河港市场"},{"id":"m8-site-kujukuri","name":"九十九里滨海加工场"},{"id":"m8-site-okutama","name":"奥多摩谷口站城"},{"id":"m8-site-tanzawa","name":"丹泽山前院落中心"},{"id":"m8-site-yokohama-miura","name":"横滨湾岸复合中心"},{"id":"m8-site-boso-kisarazu","name":"木更津港城生活组团"},{"id":"m8-site-boso-kimitsu","name":"君津重件总装厂"},{"id":"m8-site-boso-futtsu","name":"富津渔港换装场"},{"id":"m8-site-boso-interior","name":"房总谷地水源园"},{"id":"m8-site-boso-pacific","name":"外房航天勤务中心"}]},{"id":"west-expansion","places":[{"id":"west-kofu-civic","name":"甲府城下综合诊疗院"},{"id":"west-katsunuma-depot","name":"胜沼农产交易所"},{"id":"west-lake-waterworks","name":"河口湖水源维护站"},{"id":"west-yoshida-textile","name":"富士吉田织物工坊"},{"id":"west-gotemba-logistics","name":"御殿场山麓物流院"},{"id":"west-fuji-peak","name":"富士山"},{"id":"west-lake-motosu","name":"本栖湖"},{"id":"west-lake-shoji","name":"精进湖"},{"id":"west-lake-saiko","name":"西湖"},{"id":"west-lake-kawaguchi","name":"河口湖"},{"id":"west-lake-yamanaka","name":"山中湖"},{"id":"west-service-kai","name":"甲斐·韮崎 · 饮食"},{"id":"west-service-kofu","name":"甲府城下 · 医疗点"},{"id":"west-service-katsunuma","name":"笛吹·胜沼 · 交货点"},{"id":"west-service-otsuki","name":"大月谷口 · 垃圾商店"},{"id":"west-service-kawaguchi","name":"河口湖南岸 · 义体医生"},{"id":"west-service-yoshida","name":"富士吉田 · 酒吧"},{"id":"west-service-narusawa","name":"鸣泽林缘 · 武器店"},{"id":"west-service-gotemba","name":"御殿场下城 · 网络黑客"}]}],"nodes":[{"id":"plaza","name":"新日本时代广场"},{"id":"tsurumaki-tower","name":"弦卷塔"},{"id":"tsukinomori","name":"月之森女子学园"},{"id":"hanasakigawa","name":"花咲川女子学院"},{"id":"ring-community","name":"RiNG社区"},{"id":"ring-live","name":"RING-Live!"},{"id":"space-site","name":"SPACE 旧址"},{"id":"circle","name":"CiRCLE"},{"id":"beni-street","name":"红花街"},{"id":"a-yang-clinic","name":"宇田川巴的老街诊所"},{"id":"haneoka","name":"羽丘女子学园"},{"id":"akabane","name":"赤羽街区"},{"id":"sakiko-rental","name":"祥子的赤羽出租屋"},{"id":"akabane-clinic","name":"赤羽黑诊所"},{"id":"rana-shifune-home","name":"乐奈与诗船的公寓"},{"id":"ring-instruments","name":"RING-Live! · 乐器店"},{"id":"ring-records","name":"RING-Live! · 旧唱片店"},{"id":"ring-cafe","name":"RING-Live! · 咖啡馆"},{"id":"ring-studio","name":"RING-Live! · 录音与租赁"},{"id":"ring-basement-bar","name":"Lust？Love？Live！"},{"id":"service-imperial-weapon","name":"皇核 · 武器店"},{"id":"service-imperial-implant","name":"皇核 · 义体医生"},{"id":"service-imperial-hospital","name":"皇核 · 医疗点"},{"id":"service-imperial-market","name":"皇核 · 垃圾商店"},{"id":"service-imperial-transit","name":"皇核 · 交通设施"},{"id":"service-underpool-weapon","name":"暗池 · 武器店"},{"id":"service-underpool-implant","name":"暗池 · 义体医生"},{"id":"service-underpool-hospital","name":"暗池 · 医疗点"},{"id":"service-underpool-market","name":"暗池 · 垃圾商店"},{"id":"service-underpool-transit","name":"暗池 · 交通设施"},{"id":"service-lowtown-weapon","name":"荒川下城 · 武器店"},{"id":"service-lowtown-implant","name":"荒川下城 · 义体医生"},{"id":"service-lowtown-hospital","name":"荒川下城 · 医疗点"},{"id":"service-lowtown-market","name":"荒川下城 · 垃圾商店"},{"id":"service-lowtown-transit","name":"荒川下城 · 交通设施"},{"id":"service-neonring-weapon","name":"山手霓环 · 武器店"},{"id":"service-neonring-implant","name":"山手霓环 · 义体医生"},{"id":"service-neonring-hospital","name":"山手霓环 · 医疗点"},{"id":"service-neonring-market","name":"山手霓环 · 垃圾商店"},{"id":"service-neonring-transit","name":"山手霓环 · 交通设施"},{"id":"service-tsurumaki-weapon","name":"弦卷台 · 武器店"},{"id":"service-tsurumaki-implant","name":"弦卷台 · 义体医生"},{"id":"service-tsurumaki-hospital","name":"弦卷台 · 医疗点"},{"id":"service-tsurumaki-market","name":"弦卷台 · 垃圾商店"},{"id":"service-tsurumaki-transit","name":"弦卷台 · 交通设施"},{"id":"service-keihin-weapon","name":"京滨方舟 · 武器店"},{"id":"service-keihin-implant","name":"京滨方舟 · 义体医生"},{"id":"service-keihin-hospital","name":"京滨方舟 · 医疗点"},{"id":"service-keihin-market","name":"京滨方舟 · 垃圾商店"},{"id":"service-keihin-transit","name":"京滨方舟 · 交通设施"},{"id":"service-west-weapon","name":"西郊净土 · 武器店"},{"id":"service-west-implant","name":"西郊净土 · 义体医生"},{"id":"service-west-hospital","name":"西郊净土 · 医疗点"},{"id":"service-west-market","name":"西郊净土 · 垃圾商店"},{"id":"service-west-transit","name":"西郊净土 · 交通设施"},{"id":"service-saitama-weapon","name":"埼玉 · 武器店"},{"id":"service-saitama-implant","name":"埼玉 · 义体医生"},{"id":"service-saitama-hospital","name":"埼玉 · 医疗点"},{"id":"service-saitama-market","name":"埼玉 · 垃圾商店"},{"id":"service-saitama-transit","name":"埼玉 · 交通设施"},{"id":"service-hokuen-weapon","name":"所泽 · 武器店"},{"id":"service-hokuen-implant","name":"所泽 · 义体医生"},{"id":"service-hokuen-hospital","name":"所泽 · 医疗点"},{"id":"service-hokuen-market","name":"所泽 · 垃圾商店"},{"id":"service-hokuen-transit","name":"所泽 · 交通设施"},{"id":"service-kai-weapon","name":"奥多摩 · 武器店"},{"id":"service-kai-implant","name":"奥多摩 · 义体医生"},{"id":"service-kai-hospital","name":"奥多摩 · 医疗点"},{"id":"service-kai-market","name":"奥多摩 · 垃圾商店"},{"id":"service-kai-transit","name":"奥多摩 · 交通设施"},{"id":"service-fuji-transit","name":"丹泽 · 交通设施"},{"id":"service-fuji-hospital","name":"丹泽 · 医疗点"},{"id":"service-sagami-weapon","name":"川崎 · 武器店"},{"id":"service-sagami-implant","name":"川崎 · 义体医生"},{"id":"service-sagami-hospital","name":"川崎 · 医疗点"},{"id":"service-sagami-market","name":"川崎 · 垃圾商店"},{"id":"service-sagami-transit","name":"川崎 · 交通设施"},{"id":"service-chiba-weapon","name":"千叶 · 武器店"},{"id":"service-chiba-implant","name":"千叶 · 义体医生"},{"id":"service-chiba-hospital","name":"千叶 · 医疗点"},{"id":"service-chiba-market","name":"千叶 · 垃圾商店"},{"id":"service-chiba-transit","name":"千叶 · 交通设施"},{"id":"service-docks-weapon","name":"木更津 · 武器店"},{"id":"service-docks-implant","name":"木更津 · 义体医生"},{"id":"service-docks-hospital","name":"木更津 · 医疗点"},{"id":"service-docks-market","name":"木更津 · 垃圾商店"},{"id":"service-docks-transit","name":"木更津 · 交通设施"},{"id":"west-terminal","name":"湾西货运港"},{"id":"bay-terminal","name":"湾岸客运码头"},{"id":"east-terminal","name":"木更津发射中心"},{"id":"sunken-market","name":"暗池层叠市场"},{"id":"arakawa-hospital","name":"荒川综合医院"},{"id":"neon-forum","name":"霓环中央演艺场"},{"id":"hill-estate","name":"弦卷台庭园会馆"},{"id":"ark-logistics","name":"方舟联运总站"},{"id":"west-market","name":"武藏野农产市场"},{"id":"saitama-housing","name":"埼玉连廊住区"},{"id":"tokorozawa-assembly","name":"所泽机造总装厂"},{"id":"valley-terraces","name":"多摩山前阶庭"},{"id":"fuji-observatory","name":"丹泽边境观测站"},{"id":"kawasaki-refinery","name":"川崎能源联合厂"},{"id":"chiba-waterhall","name":"千叶滨水会展馆"},{"id":"dock-ruins","name":"木更津旧港遗构"},{"id":"catalog-tsurumaki-apartment","name":"栈桥公寓"},{"id":"catalog-saitama-apartment","name":"朝班公寓"},{"id":"catalog-keihin-drop","name":"九号交接棚"},{"id":"catalog-docks-drop","name":"潮窗交货柜"},{"id":"catalog-neonring-clothing","name":"反光线改衣台"},{"id":"catalog-chiba-clothing","name":"千叶 · 服装"},{"id":"catalog-underpool-netrunner","name":"回声线缆台"},{"id":"catalog-kai-netrunner","name":"奥多摩 · 网络黑客"},{"id":"catalog-underpool-melee","name":"暗池 · 近战武器商贩"},{"id":"catalog-lowtown-melee","name":"荒川下城 · 近战武器商贩"},{"id":"catalog-west-food","name":"雨棚青菜饭"},{"id":"catalog-lowtown-food","name":"河闸食堂"},{"id":"catalog-neonring-bar","name":"山手霓环 · 酒吧"},{"id":"catalog-underpool-bar","name":"暗池 · 酒吧"},{"id":"catalog-neonring-joytoy","name":"山手霓环 · 性偶"},{"id":"catalog-underpool-fixer","name":"暗池转单台"},{"id":"catalog-keihin-fixer","name":"京滨夜班调度"},{"id":"catalog-imperial-client","name":"皇核资产事务窗口"},{"id":"catalog-chiba-client","name":"千叶试音室联络台"},{"id":"catalog-lowtown-police","name":"退水线上的白漆"},{"id":"catalog-underpool-assault","name":"走廊里的第二把锁"},{"id":"catalog-sagami-assault","name":"下班口的欠薪单"},{"id":"catalog-docks-organized","name":"空箱也要过秤"},{"id":"catalog-saitama-reported","name":"不在名册上的房间"},{"id":"catalog-hokuen-cyberpsycho","name":"别把警报当成病历"},{"id":"catalog-kai-tarot","name":"奥多摩 · 塔罗牌"},{"id":"catalog-west-tarot","name":"西郊净土 · 塔罗牌"},{"id":"catalog-chiba-sidejob","name":"给海风留一个麦克风"},{"id":"catalog-saitama-sidejob","name":"末班车前的灯"},{"id":"catalog-lowtown-recovery","name":"一只饭盒的重量"},{"id":"catalog-underpool-theft","name":"借条背面"},{"id":"catalog-keihin-escort","name":"冷链不等人"},{"id":"catalog-tsurumaki-escort","name":"体面地搬出去"},{"id":"catalog-sagami-hitman","name":"请把收据留下"},{"id":"catalog-hokuen-sabotage","name":"请勿恢复出厂"},{"id":"catalog-fuji-sos","name":"山路上的第三张床"},{"id":"catalog-docks-sos","name":"潮汐表没有名字"},{"id":"bay-mid-bridge","name":"中湾跨海大桥"},{"id":"bay-lower-bridge","name":"下湾跨海大桥"},{"id":"tokyo-skytree","name":"东京天空塔"},{"id":"m8-site-ryomo","name":"两毛制造联合厂"},{"id":"m8-site-north-gateway","name":"北门户综合站城"},{"id":"m8-site-mito-oarai","name":"水户大洗港城中心"},{"id":"m8-site-saitama-north","name":"北埼玉轨道生活组团"},{"id":"m8-site-tsukuba-north","name":"筑波研究园"},{"id":"m8-site-tone-south","name":"利根南岸换装场"},{"id":"m8-site-kashima-kamisu","name":"鹿岛港后炼化厂"},{"id":"m8-site-narita-hokuso","name":"北总航空物流组团"},{"id":"m8-site-chiba-extension","name":"千叶东部复合站城"},{"id":"m8-site-choshi","name":"銚子河港市场"},{"id":"m8-site-kujukuri","name":"九十九里滨海加工场"},{"id":"m8-site-okutama","name":"奥多摩谷口站城"},{"id":"m8-site-tanzawa","name":"丹泽山前院落中心"},{"id":"m8-site-yokohama-miura","name":"横滨湾岸复合中心"},{"id":"m8-site-boso-kisarazu","name":"木更津港城生活组团"},{"id":"m8-site-boso-kimitsu","name":"君津重件总装厂"},{"id":"m8-site-boso-futtsu","name":"富津渔港换装场"},{"id":"m8-site-boso-interior","name":"房总谷地水源园"},{"id":"m8-site-boso-pacific","name":"外房航天勤务中心"}],"characterNames":["高松灯","千早爱音","长崎素世","椎名立希","要乐奈","丰川祥子","三角初华","若叶睦","八幡海铃","祐天寺若麦"],"gallery":{"characters":[]}},styles:{"shell":"","reading":""}});
 own(publish('CxxAtlasTool',mapTool,()=>mapTool.destroy()));mapTool.start();
 })().catch(error=>{__cxxStageError("[地图装载]",error);parent.toastr?.error(error.message,"地图装载");});

;
(async()=>{
'use strict';
let ended=false,cleanups=[];
const own=fn=>{if(ended)fn();else cleanups.push(fn);};
const stop=()=>{if(ended)return;ended=true;cleanups.splice(0).reverse().forEach(fn=>{try{fn();}catch(e){console.error('[233 cleanup]',e);}});window.removeEventListener('pagehide',stop);};
window.addEventListener('pagehide',stop,{once:true});
for(const name of ["Cxx233Runtime","Cxx233Shared","Cxx233Maps"]){let deadline;try{await Promise.race([waitGlobalInitialized(name),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('依赖 '+name+' 未就绪，请查看助手脚本错误并重新加载。')),10000);own(()=>clearTimeout(deadline));})]);}finally{clearTimeout(deadline);}if(ended||!cxxRunCurrent())return;}
const runtime=Cxx233Runtime;if(!runtime.alive)return;
Object.assign(globalThis,Cxx233Shared);

const publish=(name,value,dispose)=>runtime.register(name,value,dispose,["Cxx233Shared","Cxx233Maps"]);
(function(root,factory){root.Cxx233TerminalFactory=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx233TerminalFactory");});



const terminal=Cxx233TerminalFactory.create({window:parent,api:globalThis,runtime,html:""});own(publish('Cxx233Terminal',terminal,()=>terminal.destroy()));
})().catch(error=>{__cxxStageError("[共享终端]",error);parent.toastr?.error(error.message,"共享终端");});

;
(async()=>{
'use strict';
let ended=false,cleanups=[];
const own=fn=>{if(ended)fn();else cleanups.push(fn);};
const stop=()=>{if(ended)return;ended=true;cleanups.splice(0).reverse().forEach(fn=>{try{fn();}catch(e){console.error('[233 cleanup]',e);}});window.removeEventListener('pagehide',stop);};
window.addEventListener('pagehide',stop,{once:true});
for(const name of ["Cxx233Runtime","Cxx233Shared","Cxx233Terminal"]){let deadline;try{await Promise.race([waitGlobalInitialized(name),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('依赖 '+name+' 未就绪，请查看助手脚本错误并重新加载。')),10000);own(()=>clearTimeout(deadline));})]);}finally{clearTimeout(deadline);}if(ended||!cxxRunCurrent())return;}
const runtime=Cxx233Runtime;if(!runtime.alive)return;
Object.assign(globalThis,Cxx233Shared);

const publish=(name,value,dispose)=>runtime.register(name,value,dispose,["Cxx233Shared","Cxx233Terminal"]);
const CXX_NATIVE_CSS="";
/* Enhance already-rendered text; never render raw model HTML or rewrite messages. */
(function(root,factory){root.CxxNativeProse=factory();})(globalThis,function(){throw Error("Unassembled module: CxxNativeProse");});

/* Both reading modes use the same chat-owned terminal service. */
(function(root,factory){root.CxxNativeTerminal=factory();})(globalThis,function(){throw Error("Unassembled module: CxxNativeTerminal");});

/* Character-local helper. Owns rendered DOM only; no message or variable setters. */
(function(root,factory){root.CxxNativeHost=factory();})(globalThis,function(){throw Error("Unassembled module: CxxNativeHost");});

(() => {
  'use strict';
  const win=window.parent,slot='__cxx_native_ui_231__';
  win[slot]?.destroy();
  if(typeof SillyTavern==='undefined'||typeof SillyTavern.getContext!=='function'||typeof eventOn!=='function'||typeof eventRemoveListener!=='function')return;
  const notify=message=>{if(win.toastr?.warning)win.toastr.warning(message,'原生游玩');else win.alert(message);};
  const runtime=CxxNativeHost.mount({window:win,context:()=>SillyTavern.getContext(),
    subscribe(type,handler){eventOn(type,handler);return ()=>eventRemoveListener(type,handler);},
    prose:CxxNativeProse,terminalFactory:CxxNativeTerminal,css:CXX_NATIVE_CSS,notify,messageFeed:win.Cxx233Runtime?.watchMessages});
  let ended=false;
  function destroy(){if(ended)return;ended=true;runtime.destroy();window.removeEventListener('pagehide',destroy);if(win[slot]?.destroy===destroy)delete win[slot];}
  win[slot]={destroy,version:'231-native-r2'};
  window.addEventListener('pagehide',destroy,{once:true});
})();

/* Trusted card templates only. Message content is passed as data to the original component API. */
(function(root,factory){root.Cxx249Shadow=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx249Shadow");});

/* Shared host-panel accents; the stable updater continues to own every action. */
(function(root,factory){root.Cxx249Panels=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx249Panels");});

const panels249=Cxx249Panels.mount(parent.document);own(()=>panels249.destroy());
/* Chat identity owns components; native slots and Gal are independent consumers. */
(function(root,factory){root.Cxx233Components=factory();})(globalThis,function(){throw Error("Unassembled module: Cxx233Components");});

const components=Cxx233Components.create({window:parent,api:globalThis,runtime,parser:CxxGalParser,templates:({"status0":"","mvu":"","options":"","music12":"","music13":"","music14":"","music15":""}),kinds:["status0","mvu","options","music12","music13","music14","music15"]});const nativeService=parent.__cxx_native_ui_231__;own(publish('Cxx233NativeComponents',components,()=>{components.destroy();nativeService?.destroy();}));
})().catch(error=>{__cxxStageError("[原生阅读与状态组件]",error);parent.toastr?.error(error.message,"原生阅读与状态组件");});

}
eventOn('global_Cxx233Runtime_initialized',start);
window.addEventListener('pagehide',()=>{ended=true;clearTimeout(pending);eventRemoveListener('global_Cxx233Runtime_initialized',start);},{once:true});
start();
})();