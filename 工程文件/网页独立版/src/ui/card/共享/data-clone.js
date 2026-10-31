/* Derived from 卡片源码/共享/data-clone.js; source SHA256 d01ccf1a2c4092427f9fed87d0d52925842de7ca47155b163d5f46c56d3b5fc3. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxDataClone=api;})(globalThis,function(root){
  'use strict';
  // Card state consists of records, arrays and scalar values, including optional undefined fields.
  function copyData(value, seen = new Map()) {
    if (typeof value === 'function' || typeof value === 'symbol') throw new TypeError('Card state cannot contain functions or symbols.');
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const array = Array.isArray(value);
    if (!array && Object.prototype.toString.call(value) !== '[object Object]') throw new TypeError('Card state must contain plain records and arrays.');
    const result = array ? new Array(value.length) : {};
    seen.set(value, result);
    for (const key of Object.keys(value)) Object.defineProperty(result, key, { value: copyData(value[key], seen), enumerable: true, writable: true, configurable: true });
    return result;
  }
  const create = nativeClone => typeof nativeClone === 'function' ? nativeClone.bind(root) : copyData;
  return { create, clone: create(root.structuredClone) };
});
