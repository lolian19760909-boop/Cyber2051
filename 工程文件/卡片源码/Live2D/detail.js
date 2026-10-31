// Additional boot geometry is kept outside the original moc3 and follows its feet.
window.attachDetails=async function(app,model){
 const internal=model.internalModel,ratio=internal.originalWidth/2000,container=new PIXI.Container();app.stage.addChild(container);
 const hidden=['ArtMesh456','ArtMesh457','ArtMesh458','ArtMesh459','ArtMesh460','ArtMesh468','ArtMesh469','ArtMesh470','ArtMesh471','ArtMesh472','ArtMesh474','ArtMesh475','ArtMesh477','ArtMesh478','ArtMesh479','ArtMesh480','ArtMesh481','ArtMesh482','ArtMesh484','ArtMesh489','ArtMesh539','ArtMesh540','ArtMesh541','ArtMesh542','ArtMesh546','ArtMesh547','ArtMesh548','ArtMesh549','ArtMesh550','ArtMesh594'];
 const d=internal.coreModel._model.drawables,indices=hidden.map(id=>d.ids.indexOf(id)).filter(i=>i>=0),boots=[];
 function bindPoint(id,x,y){const v=internal.getDrawableVertices(id),triangles=d.indices[d.ids.indexOf(id)];x*=ratio;y*=ratio;
  for(let k=0;k<triangles.length;k+=3){const a=triangles[k]*2,b=triangles[k+1]*2,c=triangles[k+2]*2,den=(v[b+1]-v[c+1])*(v[a]-v[c])+(v[c]-v[b])*(v[a+1]-v[c+1]);if(Math.abs(den)<1e-8)continue;const wa=((v[b+1]-v[c+1])*(x-v[c])+(v[c]-v[b])*(y-v[c+1]))/den,wb=((v[c+1]-v[a+1])*(x-v[c])+(v[a]-v[c])*(y-v[c+1]))/den,wc=1-wa-wb;if(Math.min(wa,wb,wc)>=-1e-5)return ()=>{const p=internal.getDrawableVertices(id);return {x:p[a]*wa+p[b]*wb+p[c]*wc,y:p[a+1]*wa+p[b+1]*wb+p[c+1]*wc};};}
  throw new Error('鞋口绑定点不在腿部网格内：'+id);
 }
 for(const [file,id,cx,leg,lo,hi,sourceLeft,sourceRight,sourceWidth] of [['boot-left.png','ArtMesh540',890,'ArtMesh545',837,927,42,90,121],['boot-right.png','ArtMesh548',1110,'ArtMesh593',1072,1162,27,80,120]]){
  const texture=PIXI.Texture.from(window.CxxModelFiles['detail/'+file]);if(!texture.baseTexture.valid)await new Promise((resolve,reject)=>{texture.baseTexture.once('loaded',resolve);texture.baseTexture.once('error',reject);});
  const mesh=new PIXI.SimplePlane(texture,7,16);
  // Right artwork ends 11 pixels earlier; exclude its extra transparent bottom padding.
  if(file==='boot-right.png'){const uv=mesh.geometry.getBuffer('aTextureCoord');for(let k=1;k<uv.data.length;k+=2)uv.data[k]*=253/264;uv.update();}
  container.addChild(mesh);const v=internal.getDrawableVertices(id);
  function nearest(x,y){let k=0,best=Infinity;for(let n=0;n<v.length;n+=2){const score=(v[n]-x*ratio)**2+(v[n+1]-y*ratio)**2;if(score<best){best=score;k=n;}}return k;}
  const top=nearest(cx,2730),bottom=nearest(cx,2920);boots.push({mesh,id,top,bottom,baseX:v[top],baseY:v[top+1],baseAngle:Math.atan2(v[bottom+1]-v[top+1],v[bottom]-v[top]),cx,leftSeam:bindPoint(leg,lo,2500),rightSeam:bindPoint(leg,hi,2500),sourceLeft:sourceLeft/sourceWidth,sourceRight:sourceRight/sourceWidth});
 }
 const originalUpdate=internal.update;
 const skirtIndex=d.ids.indexOf('ArtMesh491'),hemOffsets=new Float32Array(d.vertexPositions[skirtIndex].length),skirtRest=new Float32Array(internal.getDrawableVertices('ArtMesh491')),canvasInfo=internal.coreModel._model.canvasinfo;
 const hemFolds=[[750,16],[825,0],[905,34],[980,3],[1060,28],[1145,0],[1250,20]];
 internal.update=function(...args){let skirt=d.vertexPositions[skirtIndex];for(let k=1;k<skirt.length;k+=2){skirt[k]-=hemOffsets[k];hemOffsets[k]=0;}originalUpdate.apply(this,args);const active=document.getElementById('outfit').value==='techwear';container.visible=active;if(!active)return;for(const i of indices)d.opacities[i]=0;
  skirt=d.vertexPositions[skirtIndex];for(let k=0;k<skirt.length;k+=2){const x=skirtRest[k]/ratio,y=skirtRest[k+1]/ratio,weight=Math.max(0,Math.min(1,(y-1660)/140));if(!weight)continue;let fold=16;for(let j=1;j<hemFolds.length;j++)if(x<=hemFolds[j][0]){const a=hemFolds[j-1],b=hemFolds[j],t=Math.max(0,(x-a[0])/(b[0]-a[0]));fold=a[1]+t*(b[1]-a[1]);break;}const delta=fold*weight*weight*canvasInfo.CanvasWidth/2000/canvasInfo.PixelsPerUnit;skirt[k+1]+=delta;hemOffsets[k+1]=delta;}
  container.position.copyFrom(model.position);container.scale.copyFrom(model.scale);container.pivot.copyFrom(model.pivot);container.rotation=model.rotation;
  for(const b of boots){const v=internal.getDrawableVertices(b.id),angle=Math.atan2(v[b.bottom+1]-v[b.top+1],v[b.bottom]-v[b.top])-b.baseAngle,c=Math.cos(angle),s=Math.sin(angle),buffer=b.mesh.geometry.getBuffer('aVertexPosition'),left=b.leftSeam(),right=b.rightSeam();
   for(let row=0;row<16;row++)for(let col=0;col<7;col++){const t=row/15,u=col/6,ankle=1-.06*Math.exp(-Math.pow((t-.46)/.18,2)),x=(b.cx+(u-.5)*205*ankle)*ratio-b.baseX,y=(2500+t*470)*ratio-b.baseY,topY=2500*ratio-b.baseY,edgeU=(u-b.sourceLeft)/(b.sourceRight-b.sourceLeft),seamX=left.x+(right.x-left.x)*edgeU,seamY=left.y+(right.y-left.y)*edgeU,weight=Math.pow(1-t,3),px=v[b.top]+x*c-y*s+(seamX-(v[b.top]+x*c-topY*s))*weight,py=v[b.top+1]+x*s+y*c+(seamY-(v[b.top+1]+x*s+topY*c))*weight,p=internal.localTransform.apply(new PIXI.Point(px,py)),k=(row*7+col)*2;buffer.data[k]=p.x;buffer.data[k+1]=p.y;}buffer.update();
  }
 };
 return ()=>{internal.update=originalUpdate;container.destroy({children:true});};
};
