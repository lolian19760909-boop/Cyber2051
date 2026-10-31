(()=>{
 'use strict';
 const project=TavernVisualProject,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';project.root.append(canvas);
 let active=true,closed=false,tick=0,last=0,phase=0,theme={interactive:'currentColor',structure:'currentColor'};
 function resize(){canvas.width=Math.max(1,canvas.clientWidth);canvas.height=Math.max(1,canvas.clientHeight);}
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 function frame(now){tick=0;if(closed||!active||document.hidden)return;if(now-last>=160){last=now;phase++;const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle=theme.structure;ctx.globalAlpha=.08;for(let i=0;i<36;i++){const x=(i*139+phase*17)%w,y=(i*71+phase*11)%h;ctx.fillRect(x,y,1+(i%3),1);}ctx.globalAlpha=.12;ctx.fillRect(0,(phase*3)%h,w,1);ctx.globalAlpha=1;}tick=requestAnimationFrame(frame);}
 function run(){cancelAnimationFrame(tick);tick=0;if(active&&!document.hidden&&!closed)tick=requestAnimationFrame(frame);}
 function dispose(){if(closed)return;closed=true;cancelAnimationFrame(tick);observer.disconnect();document.removeEventListener('visibilitychange',run);canvas.remove();}
 document.addEventListener('visibilitychange',run);project.signal.addEventListener('abort',dispose,{once:true});
 project.onCommand((action,args)=>{if(action==='dispose'){dispose();return;}if(action==='setInput'){if(args[0]==='theme')theme=JSON.parse(args[1]);else if(args[0]==='active'){active=args[1];run();}return;}throw Error('不支持的扫描噪点命令：'+action);});project.ready(['setInput']);run();
})();
