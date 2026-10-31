/* Build-only Canvas command recorder. The original art functions remain the source of shapes. */
(()=>{
 'use strict';
 const NativePath=window.Path2D;
 class RecordedPath extends NativePath{
  constructor(value){super(value);this.commands=value instanceof RecordedPath?value.commands.slice():typeof value==='string'?[['svg',value]]:[];}
 }
 for(const key of ['moveTo','lineTo','closePath','rect','arc','ellipse','quadraticCurveTo','bezierCurveTo'])RecordedPath.prototype[key]=function(...args){this.commands.push([key,...args]);return NativePath.prototype[key].apply(this,args);};
 window.Path2D=RecordedPath;
 const identity=()=>[1,0,0,1,0,0];
 const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 window.CxxMapRecorder=class{
  constructor(){this.commands=[];this.paths=[];this.pathIds=new WeakMap();this.clips=[];this.stack=[];this.matrix=identity();this.globalAlpha=1;this.fillStyle='#000';this.strokeStyle='#000';this.lineWidth=1;this.lineCap='butt';this.lineJoin='miter';this.dash=[];this.path=new RecordedPath();}
  save(){this.stack.push({matrix:this.matrix.slice(),globalAlpha:this.globalAlpha,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,lineCap:this.lineCap,lineJoin:this.lineJoin,dash:this.dash.slice(),clips:this.clips.slice(),routeCode:this.routeCode});}
  restore(){Object.assign(this,this.stack.pop()||{});}
  setTransform(...a){this.matrix=a;}
  resetTransform(){this.matrix=identity();}
  translate(x,y){this.matrix=multiply(this.matrix,[1,0,0,1,x,y]);}
  rotate(a){this.matrix=multiply(this.matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);}
  scale(x,y){this.matrix=multiply(this.matrix,[x,0,0,y,0,0]);}
  setLineDash(a){this.dash=a;}
  beginPath(){this.path=new RecordedPath();}
  ref(path){if(!this.pathIds.has(path)){this.pathIds.set(path,this.paths.length);this.paths.push(path.commands);}return this.pathIds.get(path);}
  clip(path,rule){if(!(path instanceof RecordedPath)){rule=path;path=this.path;}this.clips.push({path:this.ref(path),matrix:this.matrix.slice(),rule:rule||'nonzero'});}
  add(kind,path,rule){if(!(path instanceof RecordedPath)){rule=path;path=this.path;}this.commands.push({kind,path:this.ref(path),matrix:this.matrix.slice(),clips:this.clips.slice(),color:kind==='fill'?this.fillStyle:this.strokeStyle,alpha:this.globalAlpha,width:this.lineWidth,cap:this.lineCap,join:this.lineJoin,dash:this.dash.slice(),rule:rule||'nonzero',pixelRect:path.pixelRect,pixelStroke:this.pixelStroke,route:this.routeCode||0,shadow:this.shadowBlur?{blur:this.shadowBlur,color:this.shadowColor}:null});}
  fill(p,r){this.add('fill',p,r);}
  stroke(p){this.add('stroke',p);}
  fillRect(x,y,w,h){const p=new RecordedPath();p.rect(x,y,w,h);if(w<=3&&h<=3&&this.matrix[0]===1&&this.matrix[3]===1)p.pixelRect=[x+w/2,y+h/2];this.fill(p);}
  strokeRect(x,y,w,h){const p=new RecordedPath();p.rect(x,y,w,h);this.stroke(p);}
  clearRect(){}
  export(){return {paths:this.paths,commands:this.commands};}
 };
 for(const name of ['moveTo','lineTo','closePath','rect','arc','ellipse','quadraticCurveTo','bezierCurveTo'])window.CxxMapRecorder.prototype[name]=function(...a){this.path[name](...a);};
})();
