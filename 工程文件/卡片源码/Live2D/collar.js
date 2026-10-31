window.attachCollar=async function(app,model){
 const internal=model.internalModel,ratio=internal.originalWidth/2000,d=internal.coreModel._model.drawables;
 const bodyId='ArtMesh490',neckId='ArtMesh488',neckIndex=d.ids.indexOf(neckId);
 const rests=new Map([bodyId,neckId].map(id=>[id,new Float32Array(internal.getDrawableVertices(id))]));
 const container=new PIXI.Container(),garments=new PIXI.Container();container.addChild(garments);app.stage.addChildAt(container,model.techwearCoatFront?app.stage.getChildIndex(model.techwearCoatFront):app.stage.children.length);
 const panels=[];
 function bind(x,y,id=bodyId){
  const rest=rests.get(id),triangles=d.indices[d.ids.indexOf(id)];x*=ratio;y*=ratio;let best=null,penalty=Infinity;
  for(let k=0;k<triangles.length;k+=3){const a=triangles[k]*2,b=triangles[k+1]*2,c=triangles[k+2]*2,den=(rest[b+1]-rest[c+1])*(rest[a]-rest[c])+(rest[c]-rest[b])*(rest[a+1]-rest[c+1]);if(Math.abs(den)<1e-8)continue;
   const wa=((rest[b+1]-rest[c+1])*(x-rest[c])+(rest[c]-rest[b])*(y-rest[c+1]))/den,wb=((rest[c+1]-rest[a+1])*(x-rest[c])+(rest[a]-rest[c])*(y-rest[c+1]))/den,wc=1-wa-wb;
   const score=Math.max(0,-wa)+Math.max(0,-wb)+Math.max(0,-wc);if(score<penalty){penalty=score;best={id,a,b,c,wa,wb,wc};}if(score===0)break;
  }
  if(!best)throw new Error('Collar has no usable neck triangles');return best;
 }
 async function texture(file){const t=PIXI.Texture.from(window.CxxModelFiles['collar/'+file]);if(!t.baseTexture.valid)await new Promise((resolve,reject)=>{t.baseTexture.once('loaded',resolve);t.baseTexture.once('error',reject);});return t;}
 function sourceY(v){return v<=90?810+(v-48)*40/42:850+(v-90)*351/320;}
 for(const spec of [{file:'collar-left.png',x:375,y:20,w:115,h:180},{file:'collar-right.png',x:534,y:20,w:118,h:180}]){
  const mesh=new PIXI.SimplePlane(await texture(spec.file),7,12),bindings=[];garments.addChild(mesh);
  for(let row=0;row<12;row++)for(let col=0;col<7;col++)bindings.push(bind(1000+(spec.x+col/6*spec.w-512)/1.08,sourceY(spec.y+row/11*spec.h)));
  panels.push({mesh,bindings});
 }
 // Match actual neck cross-sections instead of extending a fixed-width band past skin.
 function neckSpan(y){const v=rests.get(neckId),indices=d.indices[neckIndex],xs=[];y*=ratio;
  for(let k=0;k<indices.length;k+=3)for(let edge=0;edge<3;edge++){const a=indices[k+edge]*2,b=indices[k+(edge+1)%3]*2,dy=v[b+1]-v[a+1];if(Math.abs(dy)<1e-8)continue;const t=(y-v[a+1])/dy;if(t>=0&&t<=1)xs.push((v[a]+(v[b]-v[a])*t)/ratio);}
  if(!xs.length)throw new Error('Choker row outside neck mesh');return [Math.min(...xs)+2,Math.max(...xs)-2];
 }
 const choker=new PIXI.SimplePlane(await texture('choker-hd.png'),13,9),chokerBindings=[];
 for(let row=0;row<9;row++)for(let col=0;col<13;col++){const sy=row/8*724,y=798+(sy-84)*54/550,[left,right]=neckSpan(y),u=(col/12*2172-55)/2062;chokerBindings.push(bind(left+u*(right-left),y,neckId));}
 garments.addChildAt(choker,0);panels.push({mesh:choker,bindings:chokerBindings});
 // These meshes are rendered only offscreen. Their alpha erases NEW clothing, never the face or hands.
 const cutoutScene=new PIXI.Container();
 const maskSize=1024,maskTexture=PIXI.RenderTexture.create({width:maskSize,height:maskSize,resolution:1});
 const maskSprite=new PIXI.Sprite(maskTexture);container.addChild(maskSprite);garments.mask=maskSprite;
 const coatFront=model.techwearCoatFront;if(coatFront)coatFront.mask=maskSprite;
 const frontIds=new Set(['ArtMesh585','ArtMesh313','ArtMesh297','ArtMesh44','ArtMesh43','ArtMesh99','ArtMesh36','ArtMesh35','ArtMesh34']);
 const armParts=new Set(['Part4','Part7','Part12','Part13','Part29','Part30','Part31','Part32','Part49','Part50','Part58','Part60','Part61','Part63','Part69','Part70','Part138','Part139','Part140','Part141','Part142','Part143','Part144','Part145','Part161','Part163','Part164','Part165','Part166','Part167','Part168','Part169','Part170','Part171']);
 const occluders=[];
 for(let i=0;i<d.ids.length;i++){
  const arm=armParts.has(internal.coreModel._model.parts.ids[d.parentPartIndices[i]]);
  if(!frontIds.has(d.ids[i])&&!arm)continue;
  if(d.masks[i].length||Live2DCubismCore.Utils.hasBlendMultiplicativeBit(d.constantFlags[i])||Live2DCubismCore.Utils.hasBlendAdditiveBit(d.constantFlags[i]))continue;
  const uv=new Float32Array(d.vertexUvs[i]);for(let k=1;k<uv.length;k+=2)uv[k]=1-uv[k];
  const mesh=new PIXI.SimpleMesh(model.textures[d.textureIndices[i]],new Float32Array(uv.length),uv,new Uint16Array(d.indices[i]),PIXI.DRAW_MODES.TRIANGLES);mesh.blendMode=PIXI.BLEND_MODES.ERASE;mesh.shader.batchable=false;cutoutScene.addChild(mesh);occluders.push({i,mesh,arm});
 }
 const previousUpdate=internal.update,maskTransform=new PIXI.Matrix();
 function update(){
  container.visible=document.getElementById('outfit').value==='techwear';if(!container.visible)return;
  container.position.copyFrom(model.position);container.scale.copyFrom(model.scale);container.pivot.copyFrom(model.pivot);container.rotation=model.rotation;
  const verticesById=new Map([bodyId,neckId].map(id=>[id,internal.getDrawableVertices(id)])),bounds=[Infinity,Infinity,-Infinity,-Infinity];
  for(const {mesh,bindings} of panels){const buffer=mesh.geometry.getBuffer('aVertexPosition');for(let n=0;n<bindings.length;n++){const b=bindings[n],v=verticesById.get(b.id),p=internal.localTransform.apply(new PIXI.Point(v[b.a]*b.wa+v[b.b]*b.wb+v[b.c]*b.wc,v[b.a+1]*b.wa+v[b.b+1]*b.wb+v[b.c+1]*b.wc));buffer.data[n*2]=p.x;buffer.data[n*2+1]=p.y;bounds[0]=Math.min(bounds[0],p.x);bounds[1]=Math.min(bounds[1],p.y);bounds[2]=Math.max(bounds[2],p.x);bounds[3]=Math.max(bounds[3],p.y);}buffer.update();}
  if(coatFront&&coatFront.visible)for(const mesh of coatFront.children){const v=mesh.geometry.getBuffer('aVertexPosition').data;for(let k=0;k<v.length;k+=2){bounds[0]=Math.min(bounds[0],v[k]);bounds[1]=Math.min(bounds[1],v[k+1]);bounds[2]=Math.max(bounds[2],v[k]);bounds[3]=Math.max(bounds[3],v[k+1]);}}
  bounds[0]-=2;bounds[1]-=2;bounds[2]+=2;bounds[3]+=2;
  for(const {i,mesh,arm} of occluders){mesh.alpha=d.opacities[i];mesh.visible=mesh.alpha>0&&(!arm||d.renderOrders[i]>d.renderOrders[neckIndex]);if(!mesh.visible)continue;
   const vertices=internal.getDrawableVertices(d.ids[i]),buffer=mesh.geometry.getBuffer('aVertexPosition'),extent=[Infinity,Infinity,-Infinity,-Infinity];
   for(let k=0;k<vertices.length;k+=2){const p=internal.localTransform.apply(new PIXI.Point(vertices[k],vertices[k+1]));buffer.data[k]=p.x;buffer.data[k+1]=p.y;extent[0]=Math.min(extent[0],p.x);extent[1]=Math.min(extent[1],p.y);extent[2]=Math.max(extent[2],p.x);extent[3]=Math.max(extent[3],p.y);}
   mesh.visible=extent[0]<=bounds[2]&&extent[2]>=bounds[0]&&extent[1]<=bounds[3]&&extent[3]>=bounds[1];if(mesh.visible)buffer.update();
  }
  const width=bounds[2]-bounds[0],height=bounds[3]-bounds[1];
  maskTransform.set(maskSize/width,0,0,maskSize/height,-bounds[0]*maskSize/width,-bounds[1]*maskSize/height);
  maskSprite.position.set(bounds[0],bounds[1]);maskSprite.width=width;maskSprite.height=height;
 }
 function renderMask(){
  // Render only after the Live2D renderer has returned to PIXI, never inside its update.
  const renderer=app.renderer,target=renderer.renderTexture.current,source=renderer.renderTexture.sourceFrame.clone(),destination=renderer.renderTexture.destinationFrame.clone(),projection=renderer.projection.transform,screen=renderer.renderingToScreen;
  renderer.batch.flush();renderer.texture.reset();renderer.shader.reset();renderer.geometry.reset();renderer.state.reset();
  try{renderer.renderingToScreen=false;renderer.projection.transform=maskTransform;const parent=cutoutScene.enableTempParent();cutoutScene.updateTransform();cutoutScene.disableTempParent(parent);renderer.renderTexture.bind(maskTexture);renderer.renderTexture.clear([1,1,1,1]);cutoutScene.render(renderer);renderer.batch.flush();}
  finally{renderer.projection.transform=projection;renderer.renderingToScreen=screen;renderer.renderTexture.bind(target,source,destination);renderer.batch.reset();renderer.shader.reset();renderer.geometry.reset();renderer.texture.reset();renderer.state.reset();}
 }
 const originalRender=container.render;container.render=function(renderer){if(this.visible)renderMask();originalRender.call(this,renderer);};
 const wrappedUpdate=function(...args){previousUpdate.apply(this,args);update();};internal.update=wrappedUpdate;update();
 return ()=>{if(internal.update===wrappedUpdate)internal.update=previousUpdate;garments.mask=null;if(coatFront)coatFront.mask=null;container.destroy({children:true});cutoutScene.destroy({children:true});maskTexture.destroy(true);};
};
