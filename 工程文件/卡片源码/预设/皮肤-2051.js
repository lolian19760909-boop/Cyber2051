/* ===== 赛博小祥2051 皮肤覆写 BEGIN（cp2051 · 整段删除即可完全还原） =====
   零侵入原则：不修改泉此方悬浮窗引擎的任何原有字节；本段追加在脚本末尾，
   运行时对引擎注入的 <style id="izumi-floating-window-v1-style"> 文本做四步重皮：
   ① iz/wf 变量重定义为 2051 令牌（日/夜两套定义统一为终端色）
   ② 属性感知色彩扫描：按声明角色（背景/文字/边线/阴影）把剩余散色映射进红黑色板
   ③ 方角归一：border-radius ≥3px → 2px（保留 50% 圆形与 999px 药丸开关）
   ④ 精修层：面板/标题/页签/按钮/开关/输入框/滚动条对齐 theme/status.css 语义
   色值来源：工程文件/二创工作版/theme/status.css（红=强调，青=交互，琥珀=提示） */
(function () {
  'use strict';
  var STYLE_ID = 'izumi-floating-window-v1-style';
  var MARK = '/*cp2051*/';

  var VARS = {
    '--iz-ink': '#d2d5d4', '--iz-muted': '#a4a8aa', '--iz-line': '#59262a',
    '--iz-soft': '#1d1013', '--iz-pink-white': '#120a0d',
    '--iz-blue': '#6ecbd0', '--iz-green': '#66b499', '--iz-purple': '#ae4545',
    '--iz-neutral-line': '#59262a', '--iz-neutral-soft': '#170b0f',
    '--wf-bg': '#0d0a0c', '--wf-card': '#150b0f', '--wf-line': '#59262a',
    '--wf-ink': '#d2d5d4', '--wf-muted': '#a4a8aa'
  };

  // 色相家族锚点：hi=亮强调 mid=主色 lo=暗线 bgHi=浅底→暗底 bgLo=更暗底
  var FAM = {
    pink:   { hi: '#f08278', mid: '#dc5c59', lo: '#ae4545', bgHi: '#291116', bgLo: '#271016' },
    amber:  { hi: '#e9ba59', mid: '#d8a748', lo: '#8a6a1f', bgHi: '#2b2110', bgLo: '#241c0e' },
    green:  { hi: '#75b69f', mid: '#66b499', lo: '#286c56', bgHi: '#12352a', bgLo: '#0e241d' },
    cyan:   { hi: '#8fd9dd', mid: '#6ecbd0', lo: '#2e6a70', bgHi: '#173238', bgLo: '#10262b' },
    purple: { hi: '#d98bb0', mid: '#c56f98', lo: '#815269', bgHi: '#2b1a20', bgLo: '#1d1013' }
  };

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length === 8) h = h.slice(0, 6);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2;
    var chroma = mx - mn; // 0-1，近白区比 HSL S 稳健
    if (mx !== mn) {
      s = l > 0.5 ? chroma / (2 - mx - mn) : chroma / (mx + mn);
      if (mx === r) h = ((g - b) / chroma + (g < b ? 6 : 0)) * 60;
      else if (mx === g) h = ((b - r) / chroma + 2) * 60;
      else h = ((r - g) / chroma + 4) * 60;
    }
    return { h: h, s: s * 100, l: l * 100, c: chroma * 100 };
  }
  function famOf(h) {
    if (h >= 300 || h < 15) return 'pink';
    if (h < 45) return 'pink';
    if (h < 90) return 'amber';
    if (h < 170) return 'green';
    if (h < 200) return 'cyan';
    if (h < 260) return 'cyan';
    return 'purple';
  }
  function parse(tok) {
    if (tok[0] === '#') {
      var rgb = hexToRgb(tok);
      var a = null;
      var body = tok.replace('#', '');
      if (body.length === 8) a = parseInt(body.slice(6), 16) / 255;
      return { a: a, rgb: rgb, hsl: rgbToHsl(rgb[0], rgb[1], rgb[2]) };
    }
    var m = tok.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.%]+))?\)/i);
    if (!m) return null;
    var r = +m[1], g = +m[2], b = +m[3];
    var a2 = m[4] != null ? (m[4].indexOf('%') >= 0 ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1;
    return { a: a2, rgb: [r, g, b], hsl: rgbToHsl(r, g, b), isRgba: true };
  }
  function toCss(rgb, a) {
    var hex = '#' + rgb.slice(0, 3).map(function (v) { v = Math.round(Math.max(0, Math.min(255, v))); return ('0' + v.toString(16)).slice(-2); }).join('');
    if (a != null && a < 1) {
      var base = hexToRgb(hex);
      return 'rgba(' + base[0] + ',' + base[1] + ',' + base[2] + ',' + (+a).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + ')';
    }
    return hex;
  }
  function mix(hex1, hex2, t) {
    var a = hexToRgb(hex1), b = hexToRgb(hex2);
    return toCss([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], null);
  }

  function mapToken(role, tok) {
    var c = parse(tok);
    if (!c) return tok;
    var hsl = c.hsl, f = FAM[famOf(hsl.h)], neutral = hsl.c < 12;
    if (role === 'shadow') {
      if (neutral) return tok;
      return c.isRgba || c.a != null ? toCss([0, 0, 0], c.a != null ? c.a : 0.3) : 'rgba(0,0,0,0.3)';
    }
    if (role === 'bg') {
      if (neutral) {
        if (hsl.l >= 94) return '#120a0d';
        if (hsl.l >= 86) return '#1d1013';
        if (hsl.l >= 60) return '#211015';
        if (hsl.l >= 25) return '#170b0f';
        return tok;
      }
      if (hsl.l >= 85) return f.bgHi;
      if (hsl.l >= 55) return hsl.s >= 35 ? f.mid : f.bgHi;   // 高饱和中亮=选中态→主色
      if (hsl.l >= 22) return f.bgLo;
      return (hsl.s < 45) ? '#0d0a0c' : f.bgLo;               // 近黑背景并入墨黑
    }
    if (role === 'line') {
      if (neutral) return '#59262a';
      return f.lo;
    }
    // fg / other：文字与数据
    if (neutral) {
      if (hsl.l >= 96 && tok.toLowerCase() === '#fff') return '#fff';
      if (hsl.l >= 82) return '#d2d5d4';
      if (hsl.l >= 45) return '#a4a8aa';
      return '#d2d5d4';
    }
    // 夜主题的"带色味近白"（如 #e5edf5）按中性浅字处理，避免整体发青
    if (hsl.l >= 82 && hsl.s < 35) return '#d2d5d4';
    if (hsl.l >= 55 && hsl.s < 35) return '#a4a8aa';
    if (hsl.l >= 68) return f.hi;
    return mix(f.mid, f.hi, 0.35);
  }

  var KEEP_PROPS = /^(background|background-color|background-image|color|border|border-[a-z-]+|outline|outline-[a-z-]+|box-shadow|text-shadow|filter|caret-color|fill|stroke|column-rule[a-z-]*|text-decoration[a-z-]*|font|font-family)$/;

  function restyle2051(css) {
    if (css.indexOf(MARK) >= 0) return css;
    // ① 变量重定义（日/夜两套统一为终端令牌）
    css = css.replace(/(--(?:iz|wf)-[a-z-]+)\s*:\s*([^;}]+)/g, function (m, v) {
      return VARS[v] ? (v + ':' + VARS[v]) : m;
    });
    // ② 属性感知散色扫描
    css = css.replace(/([a-zA-Z-]+)\s*:\s*([^;{}]+)/g, function (m, prop, val) {
      if (!KEEP_PROPS.test(prop) || /url\(/.test(val)) return m;
      if (!/(#[0-9a-fA-F]{3,8}\b|rgba?\()/.test(val)) return m;
      var role = /shadow/.test(prop) ? 'shadow'
        : /^background/.test(prop) ? 'bg'
        : /^(border|outline|column-rule|text-decoration|caret)/.test(prop) ? 'line'
        : (prop === 'font' || prop === 'font-family') ? 'font'
        : 'fg';
      if (role === 'font') {
        return /system-ui|Segoe|BlinkMac/.test(val) ? (prop + ":'Bahnschrift','Arial Narrow','Noto Sans SC',sans-serif") : m;
      }
      var nv = val.replace(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[^)]+\)/g, function (tok) {
        var pc = parse(tok);
        if (!pc) return tok;
        // 低透明度中性叠加层（夜间主题的白色薄雾等）保持原样，避免压平层次
        if (pc.isRgba && pc.a != null && pc.a < 0.2 && pc.hsl.s < 12) return tok;
        return mapToken(role, tok);
      });
      return nv === val ? m : (prop + ':' + nv);
    });
    // ③ 方角归一（≥3px → 2px；保留 %、999px 药丸与已小圆角）
    css = css.replace(/border-radius:([^;}]+)/g, function (m, v) {
      if (/%|999px/.test(v)) return m;
      return 'border-radius:' + v.replace(/(\d+(?:\.\d+)?)px/g, function (mm, n) {
        return parseFloat(n) >= 3 ? '2px' : mm;
      });
    });
    // ④ 表单控件深色化
    css = css.replace(/color-scheme:\s*light/g, 'color-scheme:dark');
    // ⑤ 精修层（选择器里的真实 id 从样式文本中提取）
    var pm = css.match(/#([a-zA-Z0-9-]+-panel)[,{]/), qm = css.match(/#([a-zA-Z0-9-]+-quick)[,{]/), im = css.match(/#([a-zA-Z0-9-]+)(?!-panel|-quick|-toast|-style)[,{]/);
    var P = pm ? '#' + pm[1] : "#izumi-floating-window-v1-panel";
    var Q = qm ? '#' + qm[1] : "#izumi-floating-window-v1-quick";
    var I = im ? '#' + im[1] : "#izumi-floating-window-v1";
    css += [
      MARK + ' 2051 精修层',
      P + '{background:#0d0a0c;color:#d2d5d4;border:1px solid #59262a;box-shadow:0 18px 46px rgba(0,0,0,.5)}',
      P + ' header.panel-header{background:linear-gradient(90deg,#291116,#170b0f);border-bottom:1px solid #59262a}',
      P + ' .header-title h2{color:#fff}',
      P + ' .kicker{color:#6ecbd0;font-family:Consolas,\'Noto Sans SC\',monospace;letter-spacing:2px}',
      P + ' .icon-btn{background:#1d1013;border:1px solid #59262a;color:#6ecbd0}',
      P + ' .icon-btn:hover{border-color:#6ecbd0}',
      P + ' .icon-btn.danger{color:#f08278}',
      P + ' .help-btn{background:#1d1013;border:1px solid #59262a;color:#d2d5d4}',
      P + ' .advice-toggle{background:#1d1013;border:1px solid #59262a;color:#a4a8aa}',
      P + ' .advice-toggle i{background:#59262a}',
      P + ' .advice-toggle i:after{background:#d2d5d4}',
      P + ' .advice-toggle[aria-checked="true"] i,' + P + ' .advice-toggle[aria-pressed="true"] i,' + Q + ' .advice-toggle[aria-checked="true"] i,' + Q + ' .advice-toggle[aria-pressed="true"] i{background:#dc5c59}',
      P + ' .advice-toggle[aria-checked="true"],' + P + ' .advice-toggle[aria-pressed="true"]{color:#f08278;border-color:#ae4545}',
      P + ' .command{background:#1d1013;border:1px solid #59262a;color:#d2d5d4}',
      P + ' .command:hover{border-color:#6ecbd0}',
      P + ' .command.primary{background:linear-gradient(90deg,#ae4545,#dc5c59 55%,#f08278);border:1px solid transparent;color:#fff}',
      P + ' .tab{color:#a4a8aa}',
      P + ' .tab[aria-selected="true"]{color:#f08278}',
      P + ' .item-row{background:#150b0f;border-color:#59262a;color:#d2d5d4}',
      P + ' .item-row:hover{background:#1d1013;border-color:#6ecbd0}',
      P + ' input,' + P + ' select,' + P + ' textarea{background:#0a0709;border:1px solid #59262a;color:#d2d5d4}',
      P + ' .workspace-card,' + P + ' .plans,' + P + ' .overview-card,' + P + ' .api-box,' + P + ' .editor-dialog{background:#120a0d;border-color:#59262a;color:#d2d5d4}',
      P + ' .plan-banner{background:#120a0d;border-bottom:1px solid #59262a}',
      P + ' .banner-big{background:#150b0f;border-color:#59262a;color:#d2d5d4}',
      P + ' .banner-big:hover{border-color:#6ecbd0}',
      P + ' .banner-kicker{color:#a4a8aa}',
      P + ' h3,' + P + ' .section-head h3{color:#f08278}',
      P + ' ::-webkit-scrollbar{width:8px;height:8px}',
      P + ' ::-webkit-scrollbar-track{background:#0a0709}',
      P + ' ::-webkit-scrollbar-thumb{background:#3a1a20;border-radius:0}',
      P + ' ::-webkit-scrollbar-thumb:hover{background:#ae4545}',
      P + '.night,' + P + '.night header.panel-header{background:#0d0a0c;color:#d2d5d4;border-color:#59262a}',
      I + '{background:#120a0d;border-color:#59262a}',
      Q + '{background:#0d0a0c;border-color:#59262a;color:#d2d5d4}'
    ].join('\n') + '\n' + MARK + ' 2051 精修层结束\n';
    return css;
  }

  function pdoc() {
    try { return (window.parent && window.parent.document) ? window.parent.document : document; } catch (e) { return document; }
  }
  function apply() {
    var d = pdoc();
    clampFloat();
    var st = d.getElementById(STYLE_ID);
    if (!st || !st.textContent || st.textContent.indexOf(MARK) >= 0) return;
    try { st.textContent = restyle2051(st.textContent); } catch (e) { /* 皮肤失败不得影响引擎 */ }
  }
  function clampFloat() {
    var d=pdoc(),w=d.defaultView,n=d.getElementById('izumi-floating-window-v1');if(!n)return;
    var r=n.getBoundingClientRect(),v=w.visualViewport,left=(v?v.offsetLeft:0)+8,top=(v?v.offsetTop:0)+8,width=v?v.width:w.innerWidth,height=v?v.height:w.innerHeight;
    if(!r.width||!r.height)return;
    var x=Math.max(left,Math.min(r.left,left+width-r.width-16)),y=Math.max(top,Math.min(r.top,top+height-r.height-16));
    if(Math.abs(x-r.left)>.5){n.style.left=x+'px';n.style.right='auto';}
    if(Math.abs(y-r.top)>.5){n.style.top=y+'px';n.style.bottom='auto';}
  }
  function boot() {
    apply();
    try {
      var d = pdoc();
      var mo = new MutationObserver(function () { apply(); });
      mo.observe(d.head || d.documentElement, { childList: true, subtree: true, characterData: true });
    } catch (e) { /* 观察失败则仅靠轮询 */ }
    setTimeout(apply, 300); setTimeout(apply, 1500); setTimeout(apply, 5000);
    var w=pdoc().defaultView;w.addEventListener('resize',clampFloat);w.addEventListener('pointerup',clampFloat);w.visualViewport?.addEventListener('resize',clampFloat);
    window.addEventListener('pagehide',function(){w.removeEventListener('resize',clampFloat);w.removeEventListener('pointerup',clampFloat);w.visualViewport?.removeEventListener('resize',clampFloat);},{once:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
/* ===== 赛博小祥2051 皮肤覆写 END ===== */
