'use strict';
let key = 'preview-A', busy = false, change, replyTimer;
const draft = document.querySelector('#draft');
const query = new URLSearchParams(location.search);
const backgroundAssets = await fetch('/media-inventory.json').then(response => response.json());
const standingAssets = await fetch('/standing-media.json').then(response => response.json());
const castCount = ['1', '2', '3', '5', '10'].includes(query.get('cast')) ? Number(query.get('cast')) : 1;
const cast = [
  { name: '丰川祥子', outfit: '黑色外套', thought: '等候答复' },
  { name: '千早爱音', outfit: '银白外套', thought: '看着雨幕' },
  { name: '高松灯', outfit: '银色外套', thought: '握紧口袋里的纸条' },
  ...CxxGalSprites.characters.filter(person => !['Saki', 'Anon', 'Tomorin'].includes(person.id)).map(person => ({ name: person.name, outfit: '外套', thought: '' })),
].slice(0, castCount);
const previewRegion = ({ imperial: '皇核', underpool: '暗池', lowtown: '荒川下城', neonring: '山手霓环', redflower: '红花街', ring: 'RiNG社区' })[query.get('region')] || 'RiNG社区';
const sceneTag = '<ztl>' + JSON.stringify({ date: '2051-10-03', time: query.get('day') === '1' ? '09:00' : '22:17', location: previewRegion, characters: cast }) + '</ztl>';
const lines = ['几个人停在' + previewRegion + '的路口，确认下一段路线。', '祥子：你也听见那段广播了吗？',
  '街边的投影轮流亮起，广播声从头顶的扬声器里传来。',
  ...(castCount > 1 ? ['爱音：外面的路灯又熄了一排。我们要一起走吗？'] : []),
  ...(castCount > 2 ? ['灯：如果是一起的话……我也想去。'] : []),
  ...(castCount > 3 ? [
    '素世：先把路线记下来吧，免得出去以后又走散。',
    '立希：到了门口再确认一次通讯。',
  ] : []),
  ...(castCount > 5 ? [
    '乐奈：想吃抹茶。',
    '初华轻声说：“我会在下一个路口等你们。如果看不到我，就往亮着红灯的那间店走。”',
    '睦：我知道。',
    '海铃：电池还有余量，通讯也已经检查过了。',
    '喵梦：既然人都到齐了，我就把刚才收到的消息讲清楚。北面的路口正在施工，南面还能通行。到了桥下以后先别急着往前走，等我确认镜头里没有跟着的人，我们再一起穿过去。',
  ] : []),
  '祥子：大家说的我都记下了。我们沿着南边走，到路口再确认下一段路线。你想先检查哪一项？',
  '讨论告一段落。门外的雨声渐渐盖过了街上的广播。'];
const dialogueLines = query.get('expressions') === '1' ? [
  '丰川祥子【smile】：「收到，这里先演示微笑差分。」',
  '千早爱音【blush】：「接下来是害羞差分。」',
  '高松灯【sadness】：「这一句对应难过差分。」',
  '丰川祥子【serious】：「认真确认一下路线。」',
  '千早爱音【shocked】：「这是惊讶差分。」',
  '丰川祥子：「没有标记的一句恢复普通立绘。」',
  '演示结束。',
] : lines;
const messages = [{ name: '祥子', mes: dialogueLines.join('\n\n') + '\n\n' + sceneTag + '\n<xuan>\n1. 询问路线\n2. 查看终端\n3. 留在原地\n4. 回应祥子\n5. 暂时沉默\n</xuan>' }];
const drawNative = () => { document.querySelector('#body').textContent = messages.map(m => m.mes).join('\n\n─────\n\n'); };
const terminalBridge = CxxGalTerminal.create({ document, onClose: () => runtime.focusTerminal() });
const statusBridge = CxxGalStatusBridge.create({ document, onClose: () => runtime.focusStatus() });
if (query.get('status') === '1') document.querySelector('#chat iframe').src = '/hud-fixture.html';
const adapter = {
  read: () => ({ key, busy, draft: draft.value, messages,
    opening: query.get('opening') === '1', openingMessage: query.get('opening') === '1' ? messages[0] : null }),
  readHud(options) {
    const demo = query.get('status') === '1';
    const result = CxxGalHud.read({ ...options, getVariables: demo ? ({ message_id }) => message_id === 0 ? {
      stat_data: { '丰川祥子': { '好感度': 120 }, '千早爱音': { '好感度': 80 }, '高松灯': { '好感度': 60 },
        terminal: { wallet: { yen: 1200 }, quests: { preview: { state: '进行中' } } } },
    } : {} : undefined });
    if (demo) result.scope = '演示数据 · ' + result.scope;
    return result;
  },
  background: scene => CxxGalBackgrounds.select(scene, { assets: backgroundAssets.files, baseUrl: 'https://cyber2051.top' }),
  openWorkshop() { throw Error('此页是独立预览；创意工坊入口请在真实酒馆内测试。'); },
  setDraft: text => { draft.value = text; change('draft'); },
  send() { if (draft.value.trim().startsWith('/')) throw Error('此页是独立预览，不执行酒馆指令');
    messages.push({ name: '你', is_user: true, mes: draft.value }); draft.value = ''; busy = true; drawNative(); change('sent');
    replyTimer = setTimeout(() => { messages.push({ name: '祥子', mes: '祥子：收到。这是预览里的固定回复。\n\n你可以返回原生视图，检查真实草稿与记录仍在。\n\n' + sceneTag }); busy = false; drawNative(); change('ended'); }, 800); },
  stop() { clearTimeout(replyTimer); busy = false; change('ended'); },
  cover(active) { if (!active) { terminalBridge.close(); statusBridge.close(); } document.querySelector('#native').hidden = active; },
  openTerminal() { statusBridge.close(); terminalBridge.open({ messageId: 0 }); },
  openStatus() { terminalBridge.close(); statusBridge.open({ messageId: 0 }); },
  focusNative() { draft.focus(); }, notify: text => { document.querySelector('#body').textContent = text + '\n\n' + document.querySelector('#body').textContent; },
  subscribe: fn => { change = fn; return () => { change = () => {}; }; },
  sprite: (id, expression, options) => query.get('sprite-failure') === '1' && expression === 'smile'
    ? '/assets/missing-expression.png' : CxxGalSprites.sprite(id, query.get('remote-sprites') === '1' ? 'https://cyber2051.top' : '', expression, standingAssets, options),
};
const runtime = CxxGalController.create({ adapter, parser: CxxGalParser, mount: options => CxxGalUI.mount({ document, parent: document.body, ...options }) });
document.querySelector('#open').onclick = runtime.open;
document.querySelector('#switch').onclick = () => { key = key === 'preview-A' ? 'preview-B' : 'preview-A'; draft.value = ''; change('chat'); };
drawNative();
if (query.get('open') === '1') runtime.open();
