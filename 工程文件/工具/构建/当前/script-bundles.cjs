'use strict';
const {inlineSource} = require('../../lib/inline-source.cjs');
const Theme = require('../../lib/ui-theme.cjs');
function phoneCode(card, read, profiles) {
  const source = read;
  const style = file => Theme.sheet(source, file);
  return inlineSource(source('共享/ui-layers.js') + ';\n' + 'globalThis.CxxMirrorSetupStyle=' +
    JSON.stringify(style('通讯/mirror-setup.css')) +
    ';globalThis.CxxMirrorGuideStyle=' +
    JSON.stringify(style('通讯/mirror-guide.css')) +
    ';\n' +
    source('通讯/mirror-guide.js') +
    ';\n' +
    'globalThis.CxxReadingStyle=' +
    JSON.stringify(style('通讯/reading.css')) +
    ';globalThis.CxxPhoneStyle=' +
    JSON.stringify(style('通讯/phone.css')) +
    ';\n' +
    [
    'voice-player',
    'phone-core',
    'mirror-setup',
    'jingyi-bridge',
    'phone-host',
    'reading-projection',
    'reading-service',
    'phone-ui'
  ].map(n => source('通讯/' + n + '.js')).join('\n;\n') +
    '\nconst CXX_PHONE_PROFILES=' +
    JSON.stringify(profiles(card, source)) +
    ';\n' +
    source('通讯/entry.js'));
}
function prefixModules(text, changes, s, {source, version, chipNightEnabled}) {
  const style = file => Theme.sheet(source, file);
  const modules = new Set(changes.map(change => change.name));
  const prepend = (code, separator = '\n;\n') => { text = inlineSource(code) + separator + text; };
  if (modules.has('CxxTalentUI') || modules.has('CxxPlayerUI'))
    prepend(source('运行时/growth-feedback.js'));
  if (modules.has('CxxUpdateHost'))
    prepend(source('运行时/character-comparison.js')+';\n'+source('运行时/chat-save-guard.js'), ";\n");
  if (modules.has('CxxPlayerHost'))
    prepend(['player-reader', 'player-save', 'player-refresh', 'quest-host'].map(name => source('运行时/' + name + '.js')).join(';\n'), ";\n");
  if (modules.has('CxxUpdateBackup'))
    prepend(source('通讯/phone-core.js'));
  if (modules.has('CxxDisplayGuard235'))
    prepend('globalThis.CxxDisplayGuardStyle=' +
      JSON.stringify(Theme.scopedSheet(source, '正文/display-guard.css',
        '#chat .mes_text :is(.cxx-growth-receipt,.cxx-dialogue-mode,.custom-cxx-dialogue-mode,.cxx-update-diagnostic,.cxx-source-status,.custom-cxx-source-status)')) +
      ';');
  if (modules.has('CxxTacticalUI'))
    prepend('globalThis.CxxTacticalStyle=' + JSON.stringify(source('运行时/tactical-ui.css')) + ';');
  if (modules.has('CxxBattleSurface'))
    prepend('globalThis.CxxBattleSurfaceStyle=' +
      JSON.stringify(Theme.scopedSheet(source, '运行时/battle-surface.css', '.cxx-battle-strip,.cxx-battle-dialog,.cxx-battle-dialog::backdrop')) +
      ';');
  if (modules.has('CxxAtlasToolFactory'))
    prepend('globalThis.CxxAtlasToolStyle=' + JSON.stringify(source('地图/tool.css')) + ';');
  if (modules.has('CxxCombatView'))
    prepend('globalThis.CxxCombatViewStyle=' + JSON.stringify(style('运行时/combat-view.css')) + ';');
  if (modules.has('CxxUpdatePanel'))
    prepend('globalThis.CxxUpdatePanelStyle=' +
      JSON.stringify(Theme.scopedSheet(source, '运行时/update-panel.css', '[data-cxx-update-panel]')) +
      ';');
  if (modules.has('CxxMailboxFactory'))
    prepend('globalThis.CxxMailboxStyle=' + JSON.stringify(style('运行时/mailbox.css')) + ';');
  if (modules.has('CxxRadioFactory'))
    prepend('globalThis.CxxRadioStyle=' + JSON.stringify(style('共享/radio.css')) + ';');
  if (modules.has('Cxx236Preferences'))
    prepend('globalThis.CxxPreferenceStyle=' + JSON.stringify(style('MVU/preferences.css')) + ';');
  if (modules.has('CxxGameplayHost'))
    prepend('globalThis.CxxGameplayPanelStyle=' + JSON.stringify(style('运行时/gameplay-panel.css')) + ';');
  if (modules.has('CxxTalentUI'))
    prepend('globalThis.CxxTalentStyle=' + JSON.stringify(source('运行时/talent-ui.css')) +
      ';globalThis.CxxTalentFullscreenStyle=' +
      JSON.stringify(source('运行时/talent-fullscreen.css')) +
      ';');
  if (modules.has('CxxStoryLibrary'))
    prepend(source('运行时/entry-experience.js') + ';\n' + source('运行时/operations.js') + ';\n' +
      'globalThis.CxxHubArt=' +
      source('运行时/hub-assets.json') +
      ';if(globalThis.parent)globalThis.parent.CxxHubArt=globalThis.CxxHubArt;globalThis.CxxHubStyle=' +
      JSON.stringify(source('运行时/hub-ui.css')) +
      ';\n' +
      source('运行时/hub-ui.js') +
      ';\n' +
      source('共享/ui-layers.js') +
      ';\n' +
      'globalThis.CxxGameMenuVersion=' +
      JSON.stringify(version) +
      ';globalThis.CxxGameMenuStyle=' +
      JSON.stringify(style('运行时/game-menu.css')) +
      ';\n' +
      'globalThis.CxxSettingsStyle=' +
      JSON.stringify(style('运行时/settings-ui.css')) +
      ';' +
      source('运行时/settings-ui.js') +
      ';\n' +
      source('运行时/game-menu.js') +
      ';\n' +
      'globalThis.CxxStoryAssets=' +
      JSON.stringify(JSON.parse(source('运行时/story-covers.json')).covers) +
      ';\nglobalThis.CxxStoryStyle=' +
      JSON.stringify(style('运行时/story-ui.css')) +
      ';\n' +
      source('运行时/story-ui.js'));
  if (s.id === 'cxx-business-core-241')
    prepend('globalThis.CxxChapterData=' +
      (chipNightEnabled ? source('剧情/盗芯之夜.json') : JSON.stringify({ enabled: false })) +
      ';\n' +
      source('运行时/chapter.js') +
      ';globalThis.parent.CxxChapter=globalThis.CxxChapter;\n' +
      source('运行时/operations.js') +
      ';\n' +
      'globalThis.CxxHubArt=' +
      source('运行时/hub-assets.json') +
      ';globalThis.CxxPlayerProfileStyle=' +
      JSON.stringify(source('运行时/player-profile.css')) +
      ';\n' +
      source('运行时/player-profile-ui.js') +
      ';\n' +
      source('运行时/quests.js'), ";\n");
  if (s.id === 'cxx-business-core-241')
    prepend('globalThis.CxxMenuArt=' + source('运行时/menu-assets.json') +
      ';globalThis.parent.CxxMenuArt=globalThis.CxxMenuArt;globalThis.CxxOpeningGroups=' +
      source('开场/groups.json') +
      ';\n' +
      source('运行时/appearance.js') +
      ';\n' +
      source('运行时/story-profile.js') +
      ';\n' +
      'globalThis.CxxCreatorStyle=' +
      JSON.stringify(style('运行时/creator-ui.css')) +
      ';\n' +
      source('运行时/creator-ui.js'), ";\n");
  if (modules.has('CxxIdentity'))
    prepend('globalThis.CxxIdentityStyle=' + JSON.stringify(source('运行时/identity.css')) + ';');
  if (changes.some(c => ['CxxTalentUI', 'CxxTacticalUI', 'CxxPlayerUI'].includes(c.name)))
    prepend('globalThis.CxxThemeCSS=' + JSON.stringify(source('主题/tokens.css')) + ';globalThis.CxxPlayerStyle=' +
      JSON.stringify(style('运行时/player-ui.css')) +
      ';globalThis.CxxEnsembleStyle=' +
      JSON.stringify(style('运行时/ensemble-ui.css')) +
      ';globalThis.CxxLoadoutSetupStyle=' +
      JSON.stringify(style('运行时/loadout-setup.css')) +
      ';');
  if(s.id==='cxx-business-core-241')prepend('globalThis.CxxCityData='+JSON.stringify(require('../../../卡片源码/地图/place-build.cjs').load(source))+';globalThis.CxxPoliceRules='+source('运行时/police-rules.json')+';globalThis.CxxCivicStyle='+JSON.stringify(style('运行时/civic-ui.css'))+';\n'+['city','police','civic','civic-ui'].map(name=>source('运行时/'+name+'.js')).join(';\n'));
  if(s.id==='cxx-business-core-241'||s.id==='cxx-native-ui-231'||modules.has('CxxGalUI')||modules.has('CxxStoryLibrary'))prepend(require('../../lib/reading-ui-build.cjs').runtime(source,version));
  return text;
}
function bootstrap({scripts, source, version, resourcePack}) {
  const style = file => Theme.sheet(source, file);
  return {
    type: 'script',
    id: 'cxx-runtime-bootstrap',
    name: '2051 资源与运行诊断',
    enabled: true,
    content: inlineSource(require('../../lib/reading-ui-build.cjs').runtime(source,version)+';'+source('运行时/startup-state.js') + ';CxxStartupState.install(parent||globalThis);' +
      source('主题/runtime.js') + ';CxxThemeRuntime.install(parent||globalThis,globalThis,' +
      JSON.stringify(Theme.runtimeSheet(source)) + ');' +
      source('运行时/startup-help.js') +
      ';' + source('运行时/plugin-check.js') + ';CxxPluginCheck.install(parent||globalThis,globalThis);' +
      ';CxxStartupHelp.install(parent||globalThis,globalThis,' +
      JSON.stringify(scripts.map(s => ({
      id: s.id,
      name: s.name
    }))) +
      ',' +
      JSON.stringify(version) +
      ');' +
      require('../../lib/crypto-compat.cjs').source() +
      ';' +
      source('共享/draft-exit.js') +
      ';' +
      source('运行时/network-diagnostics.js') +
      ';parent.CxxNetworkDiagnostics=globalThis.CxxNetworkDiagnostics;' +
      source('运行时/component-catalog.js') +
      ';' +
      'globalThis.CxxDiagnosticStyle=' +
      JSON.stringify(style('运行时/diagnostics.css')) +
      ';' +
      source('运行时/diagnostics.js') +
      ';CxxDiagnosticRuntime.install(parent||globalThis,globalThis,' +
      JSON.stringify(scripts.map(s => ({
      id: s.id,
      name: s.name
    }))) +
      ',' +
      JSON.stringify({
      version,
      components: require('./module-sources.json').components
    }) +
      ');\n' +
      require('../../lib/crypto-compat.cjs').source(source) + ';' +
      source('运行时/preset-repair.js') +
      ';void Promise.resolve().then(()=>CxxPresetRepair.repair({api:globalThis,sha256:async value=>Array.from(new Uint8Array(await CxxCrypto.digest(new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,"0")).join("")})).then(result=>{parent.CxxPresetRepairStatus=result;}).catch(error=>parent.CxxDiagnostics?.report({module:"预设候选修复",stage:"预设检查",message:error.message}));\n' +
      source('运行时/resources.js')) +
      ';CxxResourceRuntime.install(parent||globalThis,' +
      JSON.stringify({
      ...resourcePack.manifest,
      cardVersion: version,
      cardBuild: '__CXX_CARD_BUILD__'
    }) +
      ',' +
      JSON.stringify(Theme.scopedSheet(source, '运行时/resources-ui.css', '.cxx-resources-panel,.cxx-resources-dialog')) +
      ',' +
      JSON.stringify(Theme.scopedSheet(source, '运行时/resources-alert.css', '.cxx-resource-alert')) +
      ');' +
      inlineSource(source('Live2D/runtime.js') + ';CxxLive2DRuntime.install(parent||globalThis,' +
      source('Live2D/manifest.json') +
      ',' +
      JSON.stringify(require('../../lib/live2d-build.cjs').player(source)) +
      ',' +
      JSON.stringify(style('Live2D/panel.css')) +
      ');'),
    info: 'V' + version + ' 本地资源缓存与运行诊断。',
    button: {
      enabled: false,
      buttons: []
    },
    data: {},
    export_with: {
      data: false,
      button: true
    }
  };
}
function scriptRuntime(script, source) {
  const name = JSON.stringify(script.name);
  const id = JSON.stringify(script.id);
  const mount = ";(()=>{const w=parent||globalThis;const start=()=>w.CxxResources?.mount(document);" +
    "if(w.CxxResources)start();else w.addEventListener('cxx-resources-ready',start,{once:true});})();\n";
  const capture = [
    ';(()=>{const top=parent||globalThis;',
    `top.CxxStartup?.mark(${ id },${ name },'脚本已载入');`,
    'const send=fn=>top.CxxDiagnostics?fn(top.CxxDiagnostics):(top.__cxxDiagnosticQueue||=[]).push(fn);',
    `const error=e=>send(s=>s.report({module:${ name },stage:'脚本运行',`,
    'message:e.message||e.reason?.message||String(e.reason),',
    "detail:e.error?.stack||e.reason?.stack||''}));",
    "addEventListener('error',error);addEventListener('unhandledrejection',error);",
    "send(s=>{removeEventListener('error',error);removeEventListener('unhandledrejection',error);",
    `s.capture(globalThis,${ name });s.module(${ name },'脚本已载入');});})();\n`
  ].join('');
  const marker = script.id === require('../../../卡片源码/运行时/release.js').UPDATER ? '\n/* CXX_UPDATER_MODULES */\n' : '';
  const instrument = require('../../lib/startup-instrument.cjs');
  return mount + capture + marker +
    require('../../lib/runtime-prelude.cjs').prepend(instrument(script.content, script), source);
}
module.exports = {
  phoneCode,
  prefixModules,
  bootstrap,
  scriptRuntime
};
