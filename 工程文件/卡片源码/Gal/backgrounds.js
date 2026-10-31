/* Location -> region -> generic city. Background selection never reads the cast. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxGalBackgrounds = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const regions = [
    ['core', 'imperial', ['皇核', '核心区', 'imperial']],
    ['darkpool', 'underpool', ['暗池', 'underpool']],
    ['lowtown', 'lowtown', ['荒川下城', '下城']],
    ['neonring', 'neonring', ['山手霓环', '霓环']],
    ['ark', 'ark', ['京滨方舟', '方舟']],
    ['redflower', 'beni-street', ['红花街', 'beni-street']],
    ['ring', 'ring-community', ['RiNG', 'ring社区', 'ring-community', 'ring-live', 'livehouse']],
  ].map(([file, id, aliases]) => ({ file, id, aliases: [file, ...aliases] }));
  const home = names => names.flatMap(name => ['家', '的家', '居住地', '住所', '住处', '宅邸', '公寓'].map(end => name + end));
  const sites = [
    ['mutsumihouse', 'ark', home(['睦', '若叶睦'])],
    ['mujica hideout', 'core', ['mujica据点', 'mujica基地', 'mujica藏身处', 'mujica隐匿处', '颂乐人偶据点']],
    ['soyohouse', 'core', home(['素世', '长崎素世'])],
    ['togawa', 'core', ['户川', '丰川宅邸', '丰川大宅', '丰川本家']],
    ['nyamuhouse', 'darkpool', home(['若麦', '祐天寺若麦', '喵梦'])],
    ['ranahouse', 'darkpool', home(['乐奈', '要乐奈'])],
    ['takihouse', 'darkpool', home(['立希', '椎名立希'])],
    ['sakihouse', 'lowtown', [...home(['祥子', '丰川祥子']), '赤羽廉价出租屋']],
    ['uikahouse', 'neonring', home(['初华', '三角初华'])],
    ['umirihouse', 'neonring', home(['海铃', '八幡海铃'])],
    ['anonhome', '', [...home(['爱音', '千早爱音']), 'anon-home']],
  ].map(([id, region, aliases]) => ({ id, region, aliases: [id, ...aliases] }));
  const details = [
    ['bedroom', ['卧室', '寝室']], ['bathroom', ['浴室', '洗浴间']],
    ['diningroom', ['餐厅', '餐室']], ['missionnary room', ['任务室', '任务大厅', '简报室', 'mission room']],
    ['baseroom', ['基地大厅', '基地房间', '据点大厅']], ['armory', ['军械库', '武器库']],
    ['balcony', ['阳台', '露台']], ['swimpool', ['泳池', '游泳池', 'swimming pool']],
    ['backyard', ['后院']], ['yard', ['庭院', '院子']],
    ['restroom', ['洗手间', '卫生间', '休息室']], ['aisle', ['走廊', '过道']],
    ['entrance', ['入口', '玄关']], ['outside', ['屋外', '门外', '外观', 'out']],
    ['alley', ['小巷', '巷道']], ['restaurant', ['餐馆', '饭店', '餐厅']],
    ['room', ['客厅', '起居室', '房间']],
  ];
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase();
  const compact = value => normalize(value).replace(/[\s_·/→>-]/g, '');
  function has(text, alias) {
    if (!/^[a-z0-9 -]+$/i.test(alias)) return compact(text).includes(compact(alias));
    const words = alias.split(/[ -]+/).join('[\\s_-]*');
    return new RegExp('(?:^|[^a-z0-9])' + words + '(?=$|[^a-z0-9])', 'i').test(text);
  }
  function periodOf(value) {
    const text = normalize(value), clock = text.match(/(?:^|\D)(\d{1,2})[:：](\d{2})(?!\d)/);
    if (clock && +clock[1] < 24 && +clock[2] < 60) return +clock[1] >= 6 && +clock[1] < 18 ? 'morning' : 'midnight';
    if (/凌晨|深夜|午夜|夜晚|晚上|傍晚|黄昏|midnight|night|evening/.test(text)) return 'midnight';
    if (/清晨|黎明|早晨|早上|上午|中午|午后|下午|白天|morning|noon|afternoon|day/.test(text)) return 'morning';
    return '';
  }
  function describe(asset) {
    if (!asset || !/^2051CG_[^/\\]+\.png$/i.test(asset.file) || !/^[a-f0-9]{64}$/.test(asset.sha256 || '')) return null;
    let stem = normalize(asset.file.slice(7, -4));
    const period = stem.match(/_(morning|midnight)\d*$/)?.[1] || '';
    stem = stem.replace(/_(morning|midnight)\d*$/, '');
    if (/^t[1-9]$/.test(stem)) return { asset, period, generic: true };
    const parts = stem.split('_'), region = regions.find(item => item.file === parts[0]);
    if (!region) return stem === 'anonhome' ? { asset, period, site: 'anonhome' } : null;
    const rest = parts.slice(1).join('_').replace(/^togawa /, 'togawa_').split('_').filter(Boolean);
    const site = sites.find(item => item.id === rest[0]);
    let detail = rest[site ? 1 : 0] || '';
    if (detail === 'out') detail = 'outside';
    return { asset, period, region: region.file, site: site?.id || '', detail };
  }
  function select(scene, { assets = [], baseUrl = 'https://cyber2051.top' } = {}) {
    let base;
    try { base = new URL(baseUrl); } catch (_) { return null; }
    if (base.username || base.password || !(base.origin === 'https://cyber2051.top' ||
      (base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)))) return null;
    const location = normalize(scene?.location), period = periodOf(scene?.time);
    let matchedRegions = regions.filter(item => item.aliases.some(alias => has(location, alias)));
    // A named neighborhood inside a district is more specific than the district.
    if (matchedRegions.some(item => ['redflower', 'ring'].includes(item.file))) matchedRegions = matchedRegions.filter(item => ['redflower', 'ring'].includes(item.file));
    const matchedSites = sites.filter(item => item.aliases.some(alias => has(location, alias)));
    const site = matchedSites.length === 1 ? matchedSites[0] : null;
    const region = matchedRegions.length === 1 ? matchedRegions[0] : matchedRegions.length ? null : regions.find(item => item.file === site?.region);
    const matchingDetails = details.filter(([id, aliases]) => [id, ...aliases].some(alias => has(location, alias))).map(([id]) => id);
    const catalog = (Array.isArray(assets) ? assets : []).map(describe).filter(Boolean);
    const compatible = item => !period || !item.period || item.period === period;
    const tiers = [
      catalog.filter(item => compatible(item) && !item.generic && (site && matchedRegions.length <= 1 && (!region || site.region === region.file)
        ? item.site === site.id && (!item.detail || matchingDetails.includes(item.detail))
        : region && !item.site && item.detail && matchingDetails.includes(item.detail) && item.region === region.file)),
      catalog.filter(item => compatible(item) && region && item.region === region.file && !item.site && !item.detail),
      catalog.filter(item => compatible(item) && item.generic),
    ];
    let hash = 2166136261;
    for (const char of compact(location) + '|' + period) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    const ordered = [], seen = new Set();
    for (const [tierIndex,tier] of tiers.entries()) {
      // Same-tier variants stay stable across refreshes; detailed rooms precede site defaults.
      const score = item => (item.detail ? 4 : 0) + (item.period === period ? 2 : item.period ? 0 : 1);
      for (const rank of [...new Set(tier.map(score))].sort((a, b) => b - a)) {
        const group = tier.filter(item => score(item) === rank).sort((a, b) => a.asset.file.localeCompare(b.asset.file, 'en'));
        const offset = hash % group.length;
        for (const item of group.slice(offset).concat(group.slice(0, offset))) {
          if (seen.has(item.asset.file)) continue;
          seen.add(item.asset.file);
          const filename = item.asset.file;
          ordered.push({ tier:tierIndex, region: item.generic ? 'generic' : regions.find(r => r.file === item.region)?.id || item.site,
            filename, url: new URL('/img/galgame/backgrounds/' + item.asset.sha256.slice(0, 16) + '/' + encodeURIComponent(filename), base).href });
        }
      }
    }
    return ordered.length ? { ...ordered[0], fallbacks: ordered.slice(1) } : null;
  }
  function catalog({assets = [], baseUrl = 'https://cyber2051.top'} = {}) {
    let base; try { base = new URL(baseUrl); } catch { return []; }
    if (base.username || base.password || !(base.origin === 'https://cyber2051.top' || base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname))) return [];
    const labels = {core:'皇核',darkpool:'暗池',lowtown:'荒川下城',neonring:'霓环',ark:'京滨方舟',redflower:'红花街',ring:'RiNG',generic:'通用城市'};
    return assets.map(describe).filter(Boolean).map(item => {
      const region = labels[item.region] || labels.generic, site = sites.find(s => s.id === item.site), detail = details.find(d => d[0] === item.detail);
      const label = [region,site?.aliases.find(s=>/[\u4e00-\u9fff]/.test(s)) || item.site,detail?.[1]?.[0],item.period==='morning'?'白天':item.period==='midnight'?'夜晚':'',item.asset.file].filter(Boolean).join(' · ');
      return {filename:item.asset.file,label,region,url:new URL('/img/galgame/backgrounds/'+item.asset.sha256.slice(0,16)+'/'+encodeURIComponent(item.asset.file),base).href};
    }).sort((a,b)=>a.label.localeCompare(b.label,'zh-CN'));
  }
  function sourceKey({floor,swipe=0,raw='',scene}) {
    if(!Number.isInteger(floor)||floor<0)return '';
    let hash=2166136261;for(const ch of String(raw))hash=Math.imul(hash^ch.charCodeAt(0),16777619);
    return JSON.stringify([floor,swipe,(hash>>>0).toString(16),scene?.location||'',scene?.date||'',scene?.time||'']);
  }
  function overrides({storage,...options}) {
    const choices=catalog(options),byName=new Map(choices.map(c=>[c.filename,c]));
    const load=scope=>{try{const value=JSON.parse(storage.getItem('cxx-gal-background-v1:'+scope)||'{}');return value?.schema===1&&value.selections&&typeof value.selections==='object'?value:{schema:1,selections:{}};}catch{return {schema:1,selections:{}};}};
    function read(scope,source){const token=sourceKey(source),filename=scope&&token?load(scope).selections[token]:'';return {key:token,manual:byName.has(filename),value:byName.get(filename)||select(source.scene,options),choices};}
    function set(scope,source,filename){const token=sourceKey(source);if(!scope||!token)throw Error('当前楼层尚未就绪。');if(filename&&!byName.has(filename))throw Error('背景图片不在当前资源清单中。');const saved=load(scope);if(filename)saved.selections[token]=filename;else delete saved.selections[token];storage.setItem('cxx-gal-background-v1:'+scope,JSON.stringify(saved));return read(scope,source);}
    return {read,set};
  }
  return Object.freeze({ select, catalog, sourceKey, overrides });
});
