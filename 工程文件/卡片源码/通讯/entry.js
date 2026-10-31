/* Packed after the maintained modules and generated CXX_PHONE_PROFILES constant. */
(()=>{
  'use strict';let owner=null,dispose=null,ended=false;
  function start(){
    const runtime=parent.Cxx233Runtime,parser=parent.Cxx233Shared?.CxxGalParser;if(ended||!runtime?.alive||!parser||runtime===owner)return;dispose?.();owner=runtime;
    const enabled=()=>getVariables({type:'chat'}).__cxx_ui_preferences?.mirror!==false;
    const setup=CxxMirrorSetup.create({top:parent,enabled,enable:async()=>{const prefs=parent.Cxx236Preferences;if(!prefs)throw Error('故事设置正在加载。');await prefs.save({...prefs.read(),mirror:true});}}),bridge=CxxJingyiBridge.create(parent,{enabled});let phone;
    parent.CxxVoice?.destroy();const voice=CxxVoiceRuntime.create(parent);parent.CxxVoice=voice;parent.CxxMirrorSetupService=setup;parent.CxxMirrorGuideStyle=globalThis.CxxMirrorGuideStyle;
    const reader=CxxReadingService.create({top:parent,api:globalThis,runtime,parser,bridge,core:CxxPhoneCore,setup,enabled,settings:()=>phone?.read().settings||{},configure:patch=>phone.configure(patch),inCall:()=>!!phone?.read().call});
    phone=CxxPhoneHost.create({api:globalThis,top:parent,runtime,parser,bridge,profiles:CXX_PHONE_PROFILES,reader});
    const ui=CxxPhoneUI.mount({top:parent,service:phone,reader,setup});phone.open=ui.open;
    let lastEnabled=enabled();const preferenceChanged=()=>{const value=enabled();if(value===lastEnabled)return;lastEnabled=value;reader.refresh();if(!value){setup.dismiss();void phone.hangup().catch(e=>parent.console.warn('[镜译开关]',e.message)).finally(()=>phone.capabilities().catch(()=>{}));}else void phone.capabilities().catch(()=>{});};
    let welcomeTimer=null,welcomeFlight=false;
    const welcome=()=>{const vars=getVariables({type:'chat'});if(welcomeTimer!==null||welcomeFlight||!enabled()||!vars.__cxx_ui_preferences?.mirrorGuidePending||!vars.__cxx_identity?.setupToken)return;const key=runtime.key();welcomeTimer=parent.setTimeout(async()=>{welcomeTimer=null;if(runtime.key()!==key||!enabled()||parent.Cxx236OpeningHost?.hasUnconfirmed?.())return;const prefs=parent.Cxx236Preferences;if(!prefs||!getVariables({type:'chat'}).__cxx_ui_preferences?.mirrorGuidePending)return;welcomeFlight=true;try{await prefs.save({...prefs.read(),mirrorGuidePending:false});if(runtime.key()===key&&enabled())setup.open();}catch(e){parent.CxxDiagnostics?.report({module:'镜译引导',stage:'首次进入',message:e.message});}finally{welcomeFlight=false;}},300);};
    const stopScope=runtime.watchMessages(batch=>{if(batch.reasons?.includes('scope')){setup.dismiss();preferenceChanged();}welcome();});
    parent.addEventListener('cxx-ui-preferences-changed',preferenceChanged);parent.addEventListener('cxx-opening-completed',welcome);welcome();
    let removed=false;const stop=()=>{if(removed)return;removed=true;stopScope();parent.clearTimeout(welcomeTimer);parent.removeEventListener('cxx-ui-preferences-changed',preferenceChanged);parent.removeEventListener('cxx-opening-completed',welcome);eventRemoveListener(getButtonEvent('手机'),ui.open);ui.destroy();reader.destroy();voice.destroy();if(parent.CxxVoice===voice)delete parent.CxxVoice;setup.destroy();if(parent.CxxMirrorSetupService===setup)delete parent.CxxMirrorSetupService;phone.destroy();};
    const unregisterPhone=runtime.register('CxxPhone',phone,stop);
    const unregisterReader=runtime.register('CxxReading',reader,()=>reader.destroy(),['CxxPhone']);
    eventOn(getButtonEvent('手机'),ui.open);phone.start();reader.start();
    dispose=()=>{unregisterPhone();unregisterReader();};
    parent.dispatchEvent(new parent.CustomEvent('cxx-phone-ready'));
  }
  const boot=()=>{try{start();}catch(e){parent.console.error('[2051 通讯器]',e);parent.toastr?.error(e.message,'通讯器未能启动');}};
  eventOn('global_Cxx233Runtime_initialized',boot);eventOn('global_Cxx233Shared_initialized',boot);boot();
  window.addEventListener('pagehide',()=>{ended=true;eventRemoveListener('global_Cxx233Runtime_initialized',boot);eventRemoveListener('global_Cxx233Shared_initialized',boot);dispose?.();},{once:true});
})();
