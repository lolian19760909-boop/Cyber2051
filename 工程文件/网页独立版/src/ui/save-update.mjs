/** 存档热更确认弹窗：复用公告页的 terminal-2x 素材、边框与主题滤镜（issue #28）。
 *  玩家可选「更新并进入」或「暂不更新」；Esc/关闭等同暂不，下次打开旧档会再次询问。 */
const tokenCss=base=>`
@font-face{font-family:CxxBulletinDigits;src:url("${base}BlenderPro-Book.woff2") format("woff2");font-weight:400 500;font-display:swap;}
@font-face{font-family:CxxBulletinDigits;src:url("${base}BlenderPro-Bold.woff2") format("woff2");font-weight:600 800;font-display:swap;}
:host{display:contents}
.cxx-save-update{
 --notice-bg:var(--cxx-canvas);--notice-shell:var(--cxx-ink);--notice-panel:var(--cxx-panel);--notice-raised:var(--cxx-raised);
 --notice-text:var(--cxx-text);--notice-muted:var(--cxx-muted);--notice-line:var(--cxx-line);
 --notice-accent:var(--cxx-structure);--notice-interactive:var(--cxx-interactive);--notice-on-accent:var(--cxx-canvas);
 --notice-heading:var(--cxx-heading);--notice-art-filter:none;
 --art-backdrop:url("${base}backdrop.png");--art-edge-left:url("${base}edge-left.png");--art-edge-right:url("${base}edge-right.png");
 --art-frame:url("${base}frame-action.png");--art-frame-active:url("${base}frame-active.png");--art-texture:url("${base}slot-texture.png");
 box-sizing:border-box;margin:auto;border:0;padding:0;min-width:320px;max-width:min(560px,calc(100vw - 28px));
 color:var(--notice-text);font:15px/1.7 var(--cxx-font-ui);color-scheme:dark;
 overflow:visible;
}
.cxx-save-update::backdrop{background:#07060be6}
.cxx-save-update[open]{display:flex;flex-direction:column;animation:cxx-save-update-enter .26s cubic-bezier(.16,1,.3,1)}
.cxx-save-update::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:var(--art-backdrop) center/100% 100% no-repeat;filter:var(--notice-art-filter)}
.cxx-save-update::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:var(--art-edge-left) left top/13px 100% no-repeat,var(--art-edge-right) right top/15px 100% no-repeat;filter:var(--notice-art-filter)}
:host([data-cxx-theme="night"]) .cxx-save-update{--notice-art-filter:grayscale(1)}
:host([data-cxx-theme="yellow"]) .cxx-save-update{--notice-art-filter:hue-rotate(55deg)}
.cxx-save-update>div{position:relative;z-index:1}
.cxx-save-update-header{display:flex;align-items:center;gap:14px;min-height:64px;padding:10px 22px 10px 26px;border-bottom:1px solid var(--notice-line);background:var(--notice-shell)}
.cxx-save-update-brand{height:30px;width:auto;display:block}
.cxx-save-update-header h1{margin:0;font-family:CxxBulletinDigits,var(--cxx-font-ui);color:var(--notice-heading);font-size:19px;letter-spacing:.1em;font-weight:650}
.cxx-save-update-header .cxx-save-update-icon{margin-left:auto;width:26px;height:26px;fill:none;stroke:var(--notice-accent);stroke-width:1.5;flex-shrink:0}
.cxx-save-update-body{padding:18px 26px 8px;background:color-mix(in srgb,var(--notice-shell) 86%,transparent)}
.cxx-save-update-range{display:flex;align-items:baseline;gap:10px;margin-bottom:14px;font-family:CxxBulletinDigits,var(--cxx-font-ui);letter-spacing:.06em}
.cxx-save-update-range .cxx-from{color:var(--notice-muted);font-size:15px;text-decoration:line-through;text-decoration-color:var(--notice-accent)}
.cxx-save-update-range .cxx-arrow{color:var(--notice-accent);font-size:14px}
.cxx-save-update-range .cxx-to{color:var(--notice-accent);font-size:22px;font-weight:650}
.cxx-save-update-list{margin:0 0 12px;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px}
.cxx-save-update-list li{position:relative;padding:9px 14px;color:var(--notice-text);background:var(--notice-panel)}
.cxx-save-update-list li::before{content:"";position:absolute;inset:0;border:10px solid transparent;border-image:var(--art-frame) 16 stretch;filter:var(--notice-art-filter);pointer-events:none}
.cxx-save-update-list li span{position:relative}
.cxx-save-update-note{margin:0 0 6px;padding:8px 14px;font-size:13px;color:var(--notice-muted);background:color-mix(in srgb,var(--notice-accent) 7%,var(--notice-raised));border-left:2px solid var(--notice-accent)}
.cxx-save-update-footer{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 22px max(14px,env(safe-area-inset-bottom));background:var(--notice-shell)}
.cxx-save-update-footer button{position:relative;min-height:46px;padding:9px 20px;border:0;color:var(--notice-accent);background:var(--notice-panel);font:600 14px/1.4 var(--cxx-font-ui);letter-spacing:.08em;white-space:nowrap;cursor:pointer;transition:color .14s,background .14s}
.cxx-save-update-footer button::before{content:"";position:absolute;inset:0;border:12px solid transparent;border-image:var(--art-frame) 16 stretch;filter:var(--notice-art-filter);pointer-events:none}
.cxx-save-update-footer button.cxx-primary{color:var(--notice-interactive);background:color-mix(in srgb,var(--notice-interactive) 8%,var(--notice-panel))}
.cxx-save-update-footer button.cxx-primary::before{border-image-source:var(--art-frame-active);border-image-slice:20}
.cxx-save-update-footer button:focus-visible{outline:2px solid var(--notice-interactive);outline-offset:3px}
.cxx-save-update-footer .cxx-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
@keyframes cxx-save-update-enter{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.cxx-save-update[open]{animation:none}}
@media (max-width:420px){.cxx-save-update-header{min-height:52px;padding:8px 16px}.cxx-save-update-body{padding:14px 16px 6px}.cxx-save-update-footer{padding:10px 14px max(10px,env(safe-area-inset-bottom))}}
`;
const ICON='<svg class="cxx-save-update-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
export function mountSaveUpdate({win=window,from,to,highlights=[],steps=[],brandUrl,onUpdate,onSkip}={}){
 const doc=win.document,host=doc.createElement('div'),scope=host.attachShadow({mode:'open'});
 host.dataset.cxxTheme=win.CxxTheme?.read?.()||doc.documentElement.dataset.cxxTheme||'red';
 const base=new URL('assets/terminal-2x/',doc.baseURI).href;
 const style=doc.createElement('style');style.textContent=tokenCss(base);
 const dialog=doc.createElement('dialog');dialog.className='cxx-save-update';dialog.setAttribute('aria-labelledby','cxx-save-update-title');
 const shell=doc.createElement('div');
 shell.innerHTML=`
  <div class="cxx-save-update-header"><img class="cxx-save-update-brand" src="" alt="Tokyo 2051"><h1 id="cxx-save-update-title">存档更新</h1>${ICON}</div>
  <div class="cxx-save-update-body">
   <p class="cxx-save-update-range"><span class="cxx-from"></span><span class="cxx-arrow">──▶</span><span class="cxx-to"></span></p>
   <ul class="cxx-save-update-list"></ul>
   <p class="cxx-save-update-note">更新前会自动备份这份存档；也可以暂不更新，直接进入，下次打开旧档会再次询问。</p>
  </div>
  <div class="cxx-save-update-footer">
   <button type="button" class="cxx-secondary" data-skip>暂不更新</button>
   <button type="button" class="cxx-primary" data-update>更新并进入</button>
  </div>`;
 dialog.append(shell);scope.append(style,dialog);doc.body.append(host);
 const brand=scope.querySelector('.cxx-save-update-brand');if(brand)brand.src=brandUrl||'';
 scope.querySelector('.cxx-from').textContent=from;scope.querySelector('.cxx-to').textContent=to;
 const list=scope.querySelector('.cxx-save-update-list');
 const rows=[...highlights.map(text=>({text})),...steps.map(step=>({text:step.detail?step.label+'：'+step.detail:step.label}))];
 for(const row of rows){const li=doc.createElement('li');const span=doc.createElement('span');span.textContent=row.text;li.append(span);list.append(li);}
 if(!rows.length)list.remove();
 let settled=false;
 const finish=action=>{if(settled)return;settled=true;subscription?.();dialog.close?.();host.remove();if(action==='update')onUpdate?.();else if(action==='skip')onSkip?.();};
 scope.querySelector('[data-update]').addEventListener('click',()=>finish('update'));
 scope.querySelector('[data-skip]').addEventListener('click',()=>finish('skip'));
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish('skip');});
 const syncTheme=theme=>{host.dataset.cxxTheme=theme;};
 const subscription=win.CxxTheme?.subscribe?.(syncTheme);
 dialog.showModal();
 scope.querySelector('[data-update]').focus();
 return {close:()=>finish(null)};
}
