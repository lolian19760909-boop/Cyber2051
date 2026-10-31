// Loaded on the first explicit scene selection; no framework or editor runtime.
const root = '/workshop/assets/site-20261016/';
const scenes = {
  plaza: { number:'01', name:['城市广场','City plaza','街の広場'], alt:['项目现有的夜间城市广场场景','An existing nighttime city plaza illustration from the project','プロジェクト既存の夜の街の広場のイラスト'] },
  ring: { number:'02', name:['RiNG','RiNG','RiNG'], alt:['项目现有的 RiNG 夜间场景','An existing nighttime RiNG illustration from the project','プロジェクト既存の夜のRiNGのイラスト'] },
  neon: { number:'03', name:['夜间街区','Night streets','夜の街並み'], alt:['项目现有的霓虹街区夜景','An existing neon street illustration from the project','プロジェクト既存のネオン街の夜景イラスト'] },
};
let revision = 0;
let animation;
const t = values => window.CXXUI.t(...values);
function localized(node, prefix, values) {
  ['zh','en','ja'].forEach((language,index) => node.setAttribute(prefix+language,values[index]));
}
export async function selectScene(choice) {
  const scene = scenes[choice.dataset.scene];
  if (!scene) return;
  const current = ++revision;
  const figure = document.querySelector('#city-view');
  const feedback = figure.querySelector('.scene-feedback');
  const stage = figure.querySelector('.scene-stage');
  const image = figure.querySelector('#scene-image');
  const key = choice.dataset.scene;
  if (choice.getAttribute('aria-current') === 'true') {
    stage.removeAttribute('aria-busy'); feedback.textContent = ''; return;
  }
  stage.setAttribute('aria-busy','true');
  feedback.textContent = t(['正在读取这处取景…','Loading this view…','この風景を読み込んでいます…']);
  const desktop = root+key+'.webp', mobile = root+key+'-mobile.webp';
  const pending = new Image();
  pending.decoding = 'async';
  pending.src = matchMedia('(max-width:600px)').matches ? mobile : desktop;
  try {
    await pending.decode();
    if (current !== revision) return;
    animation?.cancel();
    image.closest('picture').querySelector('source').srcset = mobile;
    image.src = desktop;
    localized(image,'data-ui-alt-',scene.alt); image.alt = t(scene.alt);
    const name = figure.querySelector('.scene-name');
    localized(name,'data-ui-',scene.name); name.textContent = t(scene.name);
    figure.querySelector('.scene-number').textContent = scene.number;
    figure.querySelectorAll('[data-scene]').forEach(node => {
      if (node === choice) node.setAttribute('aria-current','true'); else node.removeAttribute('aria-current');
    });
    stage.removeAttribute('aria-busy');
    feedback.textContent = t(['当前取景：','Current view: ','現在の風景：']) + t(scene.name);
    // Keep the old image until decode finishes. Effects are a local, finite fade.
    if (document.documentElement.dataset.motion === 'on' && document.documentElement.dataset.input !== 'keyboard' && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
      animation = image.animate([{opacity:.65},{opacity:1}],{duration:240,easing:'ease-out'});
    }
  } catch {
    if (current !== revision) return;
    stage.removeAttribute('aria-busy');
    feedback.textContent = t(['这处取景暂时无法读取，已保留原画面。可再次选择重试。','This view is unavailable. The previous image is still shown; choose again to retry.','この風景を読み込めませんでした。元の画像を表示しています。再度選択してお試しください。']);
  }
}
