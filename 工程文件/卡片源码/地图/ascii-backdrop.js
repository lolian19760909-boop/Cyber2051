/* ASCII backdrop behind the map loading log (DESIGN.md 10.14). Decoration only: it draws an
   ASCII Magic piece on a canvas in the theme's line, muted, structure and interactive colours,
   at 12 frames a second while visible, and holds one frame when motion is reduced. */
window.CxxAsciiBackdrop=window.CxxAsciiBackdrop||(()=>{
 'use strict';
 const luma=hex=>{const n=parseInt(hex.slice(1),16);return .2126*(n>>16&255)/255+.7152*(n>>8&255)/255+.0722*(n&255)/255;};
 function mount(host,{piece='wireframe-city',still=false}={}){
  const source=window.CxxAsciiMagic?.pieces[piece],doc=host?.ownerDocument,win=doc?.defaultView;
  if(!source||!win)return {stop(){}};
  const canvas=doc.createElement('canvas');canvas.className='cxx-ascii-backdrop';canvas.setAttribute('aria-hidden','true');host.prepend(canvas);
  const css=win.getComputedStyle(canvas),tone=name=>css.getPropertyValue(name).trim();
  // Four brightness tiers; the two dark ones stay faint so the log reads on top.
  const tiers=[[tone('--cxx-line'),.45],[tone('--cxx-muted'),.5],[tone('--cxx-structure'),.85],[tone('--cxx-interactive'),1]];
  const colour={};for(const [key,hex] of Object.entries(source.meta.palette)){const l=luma(hex);colour[key]=l<.045?null:l<.16?tiers[0]:l<.36?tiers[1]:l<.62?tiers[2]:tiers[3];}
  const draw=source.create(),{cols,rows}=source.meta,g=canvas.getContext('2d');
  let width=0,height=0,cell=0,ox=0,oy=0,raf=0,last=0,stopped=false;const start=win.performance.now();
  function size(){
   const w=canvas.clientWidth,h=canvas.clientHeight;if(w===width&&h===height)return;width=w;height=h;canvas.width=w;canvas.height=h;
   // Monospace cells are 0.6 as wide as tall: cover the frame at that ratio and crop evenly.
   cell=Math.max(h/rows,w/(cols*.6));ox=(w-cols*cell*.6)/2;oy=(h-rows*cell)/2;g.font=Math.round(cell)+'px Consolas,"Cascadia Mono",monospace';g.textBaseline='top';
  }
  function paint(t){
   size();if(!width||!height)return;const frame=draw(t),text=frame.text.split('\n'),keys=frame.color.split('\n'),groups=new Map();g.clearRect(0,0,width,height);
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const ch=text[y][x];if(ch===' ')continue;const tier=keys[y][x]===' '?tiers[1]:colour[keys[y][x]];if(!tier)continue;if(!groups.has(tier))groups.set(tier,[]);groups.get(tier).push(ch,x,y);}
   for(const [[fill,alpha],list] of groups){g.fillStyle=fill;g.globalAlpha=alpha;for(let i=0;i<list.length;i+=3)g.fillText(list[i],ox+list[i+1]*cell*.6,oy+list[i+2]*cell);}g.globalAlpha=1;
  }
  paint(2);
  if(!still){const loop=now=>{if(stopped||!canvas.isConnected)return;raf=win.requestAnimationFrame(loop);if(doc.hidden||now-last<83)return;last=now;paint(2+(now-start)/1000);};raf=win.requestAnimationFrame(loop);}
  return {stop(){if(stopped)return;stopped=true;win.cancelAnimationFrame(raf);canvas.remove();}};
 }
 return Object.freeze({mount});
})();
