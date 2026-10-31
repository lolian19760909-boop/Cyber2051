/*! 东京都2051 · 本地校验层（Cxx236Zod / zod-lite）
 *  作用：卡内不再依赖远端 MVU bundle 里那份 Zod。这里只实现 `MVU/schema.js` 实际用到的调用面
 *        （object/looseObject/string/number/boolean/enum/literal/array/record/unknown/preprocess
 *        + regex/max/min/int/optional/nullable/passthrough/catchall/superRefine/safeParse/parse），
 *        零依赖、无 eval、无网络，产物是「规整后的副本」而不是就地改动入参。
 *  边界：不是 Zod 的完整替代品。没有 union、transform、异步 refine、错误码枚举；
 *        issue 形状固定为 { path:[...], message }，与 schema.js 的 path.join('.') 拼接约定一致。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cxx236Zod = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 'zod-lite/1';
  const MAX_DEPTH = 64;

  const isPlain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function issue(path, message) {
    return { path: path.slice(), message: message };
  }

  function fail(path, message) {
    return { success: false, error: { issues: [issue(path, message)] } };
  }

  /** 校验结果统一入口：spec 描述一次校验，issues 累积到同一数组里。 */
  function run(spec, value, path, issues, depth) {
    // 允许调用方直接把 schema 对象（而不是内部 def）当作规则传进来。
    if (spec && spec._def) spec = spec._def;
    if (depth > MAX_DEPTH) {
      issues.push(issue(path, '嵌套层级过深'));
      return undefined;
    }
    const next = depth + 1;

    switch (spec.kind) {
      case 'optional':
        return value === undefined ? undefined : run(spec.inner, value, path, issues, next);

      case 'default':
        return value === undefined ? spec.value : run(spec.inner, value, path, issues, next);

      case 'nullable':
        return value === null ? null : run(spec.inner, value, path, issues, next);

      case 'preprocess': {
        let shaped;
        try {
          shaped = spec.fn(value);
        } catch (error) {
          issues.push(issue(path, '无法转换：' + (error && error.message ? error.message : String(error))));
          return undefined;
        }
        return run(spec.inner, shaped, path, issues, next);
      }

      case 'unknown':
        return value;

      case 'literal':
        if (!Object.is(value, spec.value)) {
          issues.push(issue(path, '只接受 ' + JSON.stringify(spec.value)));
          return undefined;
        }
        return value;

      case 'enum':
        if (!spec.options.some(option => Object.is(option, value))) {
          issues.push(issue(path, '只接受 ' + spec.options.join('、')));
          return undefined;
        }
        return value;

      case 'string': {
        if (typeof value !== 'string') {
          issues.push(issue(path, '需要文本'));
          return undefined;
        }
        for (const check of spec.checks) {
          const message = check(value, path);
          if (message) {
            issues.push(issue(path, message));
            return undefined;
          }
        }
        return value;
      }

      case 'number': {
        if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
          issues.push(issue(path, '需要数字'));
          return undefined;
        }
        for (const check of spec.checks) {
          const message = check(value, path);
          if (message) {
            issues.push(issue(path, message));
            return undefined;
          }
        }
        return value;
      }

      case 'boolean':
        if (typeof value !== 'boolean') {
          issues.push(issue(path, '需要布尔值'));
          return undefined;
        }
        return value;

      case 'array': {
        if (!Array.isArray(value)) {
          issues.push(issue(path, '需要数组'));
          return undefined;
        }
        const out = new Array(value.length);
        for (let index = 0; index < value.length; index += 1) {
          out[index] = spec.item ? run(spec.item, value[index], path.concat(index), issues, next) : value[index];
        }
        return out;
      }

      case 'record': {
        if (!isPlain(value)) {
          issues.push(issue(path, '需要对象'));
          return undefined;
        }
        const out = {};
        for (const key of Object.keys(value)) {
          if (spec.key) run(spec.key, key, path.concat(key), issues, next);
          out[key] = run(spec.item, value[key], path.concat(key), issues, next);
        }
        return out;
      }

      case 'object': {
        if (!isPlain(value)) {
          issues.push(issue(path, '需要对象'));
          return undefined;
        }
        const out = {};
        const shape = spec.shape;
        for (const key of Object.keys(shape)) {
          const parsed = run(shape[key], value[key], path.concat(key), issues, next);
          if (parsed !== undefined || Object.hasOwn(value, key)) {
            if (parsed !== undefined) out[key] = parsed;
          }
        }
        for (const key of Object.keys(value)) {
          if (Object.hasOwn(shape, key)) continue;
          if (spec.catchall) {
            const parsed = run(spec.catchall, value[key], path.concat(key), issues, next);
            if (parsed !== undefined) out[key] = parsed;
          } else if (spec.passthrough) {
            out[key] = value[key];
          }
        }
        return refinements(spec, out, path, issues, next);
      }

      default:
        issues.push(issue(path, '未知的校验规则'));
        return undefined;
    }
  }

  /** superRefine 在结构调整之后跑，值拿的是校验过的副本；抛出等价于一条 issue。 */
  function refinements(spec, value, path, issues, depth) {
    if (!spec.refines || !spec.refines.length) return value;
    for (const refine of spec.refines) {
      let local = null;
      const ctx = {
        addIssue: payload => {
          const detail = payload || {};
          const extra = Array.isArray(detail.path) ? detail.path : detail.path === undefined ? [] : [detail.path];
          if (!local) local = [];
          local.push(issue(path.concat(extra), detail.message || '取值不符'));
        },
      };
      let replaced;
      try {
        replaced = refine(value, ctx);
      } catch (error) {
        issues.push(issue(path, error && error.message ? error.message : String(error)));
        continue;
      }
      if (local) issues.push(...local);
      if (replaced !== undefined && replaced !== value) value = replaced;
      depth += 1;
    }
    return value;
  }

  function make(spec) {
    const schema = {
      _def: spec,
      safeParse(value) {
        const issues = [];
        const data = run(spec, value, [], issues, 0);
        return issues.length ? { success: false, error: { issues } } : { success: true, data };
      },
      parse(value) {
        const result = schema.safeParse(value);
        if (!result.success) throw new ZodLiteError(result.error.issues);
        return result.data;
      },
    };
    const extend = patch => make(Object.assign({}, spec, patch));
    const check = (kind, fn) => {
      if (spec.kind !== kind) throw new Error('本地校验层：' + kind + ' 规则只能用于 ' + kind + '。');
      return extend({ checks: spec.checks.concat([fn]) });
    };
    schema.optional = () => make({ kind: 'optional', inner: schema });
    schema.nullable = () => make({ kind: 'nullable', inner: schema });
    schema.default = fallback => make({ kind: 'default', value: fallback, inner: schema });
    schema.passthrough = () => extend({ passthrough: true });
    schema.catchall = inner => extend({ catchall: inner, passthrough: true });
    schema.superRefine = refine => extend({ refines: (spec.refines || []).concat([refine]) });
    schema.refine = (refine, message) => extend({ refines: (spec.refines || []).concat([(value, ctx) => { if (!refine(value)) ctx.addIssue({ message: message || '取值不符' }); }]) });
    schema.regex = re => check('string', (value, path) => {
      re.lastIndex = 0;
      return re.test(value) ? null : '格式不符';
    });
    schema.max = limit => spec.kind === 'number'
      ? check('number', (value, path) => (value > limit ? '不能大于 ' + limit : null))
      : check('string', value => (value.length > limit ? '不能超过 ' + limit + ' 字' : null));
    schema.min = limit => spec.kind === 'number'
      ? check('number', (value, path) => (value < limit ? '不能小于 ' + limit : null))
      : check('string', value => (value.length < limit ? '不能少于 ' + limit + ' 字' : null));
    schema.int = () => check('number', value => (Number.isInteger(value) ? null : '需要整数'));
    schema.length = limit => spec.kind === 'array'
      ? extend({ refines: [] })
      : check('string', value => (value.length === limit ? null : '需要 ' + limit + ' 字'));
    return schema;
  }

  class ZodLiteError extends Error {
    constructor(issues) {
      const list = Array.isArray(issues) ? issues : [];
      super(list.map(item => (item.path || []).join('.') + ' ' + item.message).filter(Boolean).slice(0, 4).join('；') || '校验未通过');
      this.name = 'ZodLiteError';
      this.issues = list;
    }
  }

  function preprocess(fn, inner) {
    if (typeof fn !== 'function') throw new Error('本地校验层：preprocess 需要转换函数。');
    if (!inner || typeof inner.safeParse !== 'function') throw new Error('本地校验层：preprocess 需要一个校验规则。');
    return make({ kind: 'preprocess', fn, inner });
  }

  function object(shape) {
    return make({ kind: 'object', shape: shape || {}, checks: [], refines: [], passthrough: false });
  }

  const z = {
    string: () => make({ kind: 'string', checks: [] }),
    number: () => make({ kind: 'number', checks: [] }),
    boolean: () => make({ kind: 'boolean' }),
    unknown: () => make({ kind: 'unknown' }),
    literal: value => make({ kind: 'literal', value }),
    enum: options => {
      const list = Array.isArray(options) ? options.slice() : Object.values(options || {});
      return make({ kind: 'enum', options: list });
    },
    array: item => make({ kind: 'array', item }),
    record: (key, item) => make({ kind: 'record', key, item }),
    object,
    strictObject: object,
    looseObject: shape => make({ kind: 'object', shape: shape || {}, checks: [], refines: [], passthrough: true }),
    preprocess,
  };

  return { z, VERSION, ZodLiteError, describe: schema => (schema && schema._def && schema._def.kind) || '' };
});
