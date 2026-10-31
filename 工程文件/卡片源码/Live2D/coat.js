// Additional coat panels follow actual animated belt vertices of the original model.
window.attachCoat=async function(app,model){
 const container=new PIXI.Container();app.stage.addChildAt(container,app.stage.getChildIndex(model));
 const front=new PIXI.Container();app.stage.addChild(front);model.techwearCoatFront=front;
 const internal=model.internalModel,ratio=internal.originalWidth/2000;
 const skirtId='ArtMesh491',rest=internal.getDrawableVertices(skirtId),drawables=internal.coreModel._model.drawables,triangles=drawables.indices[drawables.ids.indexOf(skirtId)];
 function bindSkirt(x,y){x*=ratio;y*=ratio;let best=null,score=Infinity;for(let j=0;j<triangles.length;j+=3){const a=triangles[j]*2,b=triangles[j+1]*2,c=triangles[j+2]*2,den=(rest[b+1]-rest[c+1])*(rest[a]-rest[c])+(rest[c]-rest[b])*(rest[a+1]-rest[c+1]);if(Math.abs(den)<1e-9)continue;const wa=((rest[b+1]-rest[c+1])*(x-rest[c])+(rest[c]-rest[b])*(y-rest[c+1]))/den,wb=((rest[c+1]-rest[a+1])*(x-rest[c])+(rest[a]-rest[c])*(y-rest[c+1]))/den,wc=1-wa-wb,penalty=Math.max(0,-wa)+Math.max(0,-wb)+Math.max(0,-wc);if(penalty<score){score=penalty;best={a,b,c,wa,wb,wc};if(score<1e-6)break;}}if(!best)throw Error('衣摆根部绑定失败');return best;}
 const belt=internal.getDrawableVertices('ArtMesh473');
 function nearest(x,y){let best=0,distance=Infinity;for(let i=0;i<belt.length;i+=2){const d=(belt[i]-x*ratio)**2+(belt[i+1]-y*ratio)**2;if(d<distance){distance=d;best=i;}}return best;}
 const anchorIds=[nearest(865,1240),nearest(1135,1240)];
 const baseLeft={x:belt[anchorIds[0]],y:belt[anchorIds[0]+1]},baseRight={x:belt[anchorIds[1]],y:belt[anchorIds[1]+1]};
 const specs=[['back-left.png',0,270,1130,.83],['back-right.png',1,270,1130,.17],['trim-left.png',0,190,990,.55],['trim-right.png',1,190,990,.45]];
 const panels=[];
 for(const [file,side,width,height,rootX] of specs){const texture=PIXI.Texture.from(window.CxxModelFiles['coat/'+file]);if(!texture.baseTexture.valid)await new Promise((resolve,reject)=>{texture.baseTexture.once('loaded',resolve);texture.baseTexture.once('error',reject);});const isFront=file.startsWith('trim-'),cols=isFront?33:5,rows=isFront?28:14,mesh=new PIXI.SimplePlane(texture,cols,rows),bindings=[];if(isFront)for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const t=row/(rows-1),sourceY=468+t*1068,worldY=sourceY<=605?1277+(sourceY-468)*143/137:sourceY<=855?1420+(sourceY-605)*397/250:1817+(sourceY-855)*.9,scale=1.08-(Math.min(1600,worldY)-1277)/540*.46,worldX=1000+(col/(cols-1)*1024-512)/scale,anchorY=Math.min(worldY,1600);bindings.push({bind:bindSkirt(worldX,anchorY),tail:worldY-anchorY});}(isFront?front:container).addChild(mesh);panels.push({mesh,side,width,height,rootX,isFront,cols,rows,bindings});}
 let sway=0,speed=0,previousX=null;
 function update(){
  container.visible=document.getElementById('coatEnabled').checked&&document.getElementById('outfit').value==='techwear';
  container.position.copyFrom(model.position);container.scale.copyFrom(model.scale);container.pivot.copyFrom(model.pivot);container.rotation=model.rotation;
  front.visible=container.visible;front.position.copyFrom(model.position);front.scale.copyFrom(model.scale);front.pivot.copyFrom(model.pivot);front.rotation=model.rotation;
  if(!container.visible)return;
  const v=internal.getDrawableVertices('ArtMesh473'),left={x:v[anchorIds[0]],y:v[anchorIds[0]+1]},right={x:v[anchorIds[1]],y:v[anchorIds[1]+1]};
  const center=(left.x+right.x)/2,dt=Math.min(app.ticker.deltaMS/1000,.05),movement=previousX===null?0:(center-previousX)/ratio;previousX=center;
  const enabled=document.getElementById('coatSway').checked;
  const target=enabled?Math.sin(performance.now()*.0015)*9-movement*9:0;
  speed+=(target-sway)*dt*25;speed*=Math.exp(-dt*7);sway=Math.max(-65,Math.min(65,sway+speed*dt));
  const length=Number(document.getElementById('coatLength').value),angle=Math.atan2(right.y-left.y,right.x-left.x),c=Math.cos(angle),s=Math.sin(angle);
  for(const p of panels){const a=p.side?right:left,buffer=p.mesh.geometry.getBuffer('aVertexPosition'),positions=buffer.data;
   const currentSkirt=internal.getDrawableVertices(skirtId);for(let row=0;row<p.rows;row++)for(let col=0;col<p.cols;col++){const t=row/(p.rows-1),u=col/(p.cols-1);let px,py;if(p.isFront){const {bind:b,tail}=p.bindings[row*p.cols+col],x=currentSkirt[b.a]*b.wa+currentSkirt[b.b]*b.wb+currentSkirt[b.c]*b.wc,y=currentSkirt[b.a+1]*b.wa+currentSkirt[b.b+1]*b.wb+currentSkirt[b.c+1]*b.wc;px=x-tail*length*ratio*s+sway*t*t*ratio;py=y+tail*length*ratio*c;}else{const x=((u-p.rootX)*p.width+sway*t*t+(p.side?1:-1)*28*t)*ratio,y=(t*p.height*length-8)*ratio;px=a.x+x*c-y*s;py=a.y+x*s+y*c;}const point=internal.localTransform.apply(new PIXI.Point(px,py));const k=(row*p.cols+col)*2;positions[k]=point.x;positions[k+1]=point.y;}buffer.update();
  }
 }
 const originalUpdate=internal.update;internal.update=function(...args){originalUpdate.apply(this,args);update();};update();
 return ()=>{internal.update=originalUpdate;model.techwearCoatFront=null;container.destroy({children:true});front.destroy({children:true});};
};
