(function(){
  'use strict';
  const project=globalThis.TavernVisualProject,canvas=document.createElement('canvas'),context=canvas.getContext('2d');
  canvas.style.cssText='display:block;width:100%;height:100%;pointer-events:none';project.root.append(canvas);
  document.documentElement.style.background='transparent';document.body.style.background='transparent';
  let colors={},from=null,to=null,frame=0,start=0,disposed=false,width=0,height=0;
  function image(bytes){if(!/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(bytes))throw Error('装配图需要卡片提供的图片字节。');const value=new Image();value.src=bytes;return value.decode().then(()=>value);}
  function size(){width=project.root.clientWidth;height=project.root.clientHeight;const scale=Math.min(2,colors.pixelRatio||globalThis.devicePixelRatio||1);canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);context.setTransform(scale,0,0,scale,0,0);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';}
  function pixels(img,amount,incoming){
    const imageWidth=Math.min(width*colors.imageRatio,480),imageHeight=imageWidth*img.naturalHeight/img.naturalWidth,x=(width-imageWidth)/2,y=(height-imageHeight)/2,cell=8;
    const [w,h]=[imageWidth,imageHeight];
    context.globalAlpha=incoming?amount:1-amount;
    for(let py=0;py<h;py+=cell)for(let px=0;px<w;px+=cell){
      const sx=px/w*img.naturalWidth,sy=py/h*img.naturalHeight,sw=Math.min(cell,w-px)/w*img.naturalWidth,sh=Math.min(cell,h-py)/h*img.naturalHeight;
      const scatter=incoming?1-amount:amount,angle=(px*13+py*7)%360/180*Math.PI,distance=scatter*(24+(px*3+py)%60);
      context.drawImage(img,sx,sy,sw,sh,x+px+Math.cos(angle)*distance,y+py+Math.sin(angle)*distance,Math.min(cell,w-px),Math.min(cell,h-py));
      if(scatter>.15&&(px+py)%40===0){context.fillStyle=(px+py)%80===0?colors.interactive:colors.structure;context.globalAlpha=scatter*.35;context.fillRect(x+px+distance,y+py-distance,2,2);context.globalAlpha=incoming?amount:1-amount;}
    }
  }
  function draw(now){
    if(disposed)return;if(!start)start=now;const p=Math.min(1,(now-start)/520);context.clearRect(0,0,canvas.width,canvas.height);
    if(p<.55)pixels(from,Math.min(1,p/.55),false);if(p>.2)pixels(to,Math.min(1,(p-.2)/.8),true);context.globalAlpha=1;
    if(p<1)frame=requestAnimationFrame(draw);else project.emit('complete');
  }
  function dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.remove();}
  const observer=new ResizeObserver(size);observer.observe(project.root);size();project.signal.addEventListener('abort',dispose,{once:true});
  project.onCommand(async(action,args)=>{
    if(action==='dispose'){dispose();return;}
    if(action!=='setInput')throw Error('装配作品不支持命令：'+action);
    if(args[0]==='theme'){colors=JSON.parse(args[1]);document.documentElement.style.colorScheme=colors.colorScheme||'dark';}
    else if(args[0]==='from')from=await image(args[1]);
    else if(args[0]==='to'){to=await image(args[1]);size();if(!disposed)frame=requestAnimationFrame(draw);}
  });
  project.ready(['setInput']);
})();
