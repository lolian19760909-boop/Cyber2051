// 区域职能决定普通街坊；独立设施只占少数地块，不等于已写入世界书。
export const profiles={
 imperial:{step:28,size:.82,jitter:1,turn:2,height:[12,28],shapes:[0,3,4],single:true,open:.55},
 underpool:{step:29,size:.72,jitter:6,turn:16,height:[2,7],shapes:[0,0,3,2],open:.55},
 lowtown:{step:29,size:.78,jitter:3,turn:6,height:[2,5],shapes:[0,1,3],open:.46},
 neonring:{step:39,size:1.05,jitter:3,turn:8,height:[7,19],shapes:[4,5,3,0],single:true,open:.36},
 tsurumaki:{step:39,size:.7,jitter:3,turn:8,height:[2,5],shapes:[3,4,0],single:true,open:.15},
 keihin:{step:42,size:1,jitter:1,turn:2,height:[3,7],shapes:[1,1,0],single:true,industrial:true,open:.35},
 west:{step:23,size:.57,jitter:4,turn:9,height:[1,3.5],shapes:[0,3],single:true,open:.3},
 minato:{step:30,size:.8,jitter:1,turn:1,height:[3,6],shapes:[1,0],single:true,industrial:true,open:.4},
 saitama:{step:36,size:.9,jitter:1,turn:2,height:[6,12],shapes:[1,4,0],open:.36},
 hokuen:{step:42,size:1,jitter:1,turn:2,height:[3,8],shapes:[1,3],single:true,industrial:true,open:.36},
 kai:{step:42,size:.8,jitter:4,turn:7,height:[3,7],shapes:[3,4,0],single:true,open:.22},
 fuji:{step:59,size:.57,jitter:5,turn:12,height:[1,3],shapes:[0,3],single:true,open:.05},
 sagami:{step:42,size:1,jitter:1,turn:3,height:[3,7],shapes:[1,1,0],single:true,industrial:true,open:.4},
 chiba:{step:39,size:.92,jitter:2,turn:5,height:[5,13],shapes:[4,5,3],single:true,open:.28},
 docks:{step:44,size:.94,jitter:1,turn:1,height:[2,6],shapes:[1,0],single:true,industrial:true,open:.32}
};
// [局部中心x,y,宽,深,高度,旋转角,屋顶种类]，每一组有独立轮廓和留空。
export const complexes=[
 {region:'underpool',id:'sunken-market',name:'暗池层叠市场',type:'market',size:[68,58],desc:'折线商棚围出狭窄内街，三座错层交易楼分据入口；地下通道口留在中庭。',parts:[[-21,-14,18,13,7,-8,0],[2,-18,24,11,11,8,0],[23,-8,12,22,5,-4,0],[-19,13,22,12,4,12,1],[7,15,23,12,6,-9,3],[1,0,9,10,2,0,0]]},
 {region:'lowtown',id:'arakawa-hospital',name:'荒川综合医院',type:'hospital',size:[74,62],desc:'两条病房翼楼由中央医疗街连接，急诊低楼退向南侧，屋顶设救护航空停机坪。',parts:[[-23,-4,14,36,12,0,0],[23,-4,14,36,9,0,0],[0,-7,31,12,5,0,0],[0,19,27,12,3,0,0]]},
 {region:'neonring',id:'neon-forum',name:'霓环中央演艺场',type:'bar',size:[86,72],desc:'不闭合的弧形看台围绕露天舞台，两侧后台体量不同，南侧广场连接商业街。',parts:Array.from({length:9},(_,i)=>{const a=(i*32+15)*Math.PI/180;return [Math.cos(a)*27,Math.sin(a)*21,16,10,8+(i%3)*2,i*32+105,0];}).concat([[0,-3,22,16,3,0,0],[29,-24,14,12,6,0,1]])},
 {region:'tsurumaki',id:'hill-estate',name:'弦卷台庭园会馆',type:'apartment',size:[84,70],desc:'低层主宅、独立客馆与车库隔着庭园展开，宽阔前院留出车道，绿带阻隔街区。',parts:[[-11,-14,31,19,5,0,3],[24,2,14,22,3,-8,0],[-24,18,20,10,2,0,1]]},
 {region:'keihin',id:'ark-logistics',name:'方舟联运总站',type:'drop',size:[86,62],desc:'两列锯齿天窗仓库与高位调度楼夹出装卸轴线，车辆在南侧回转。',parts:[[-21,-5,22,38,5,0,1],[13,-7,24,34,7,0,1],[28,20,12,12,16,0,0],[-22,22,26,8,3,0,1]]},
 {region:'west',id:'west-market',name:'武藏野农产市场',type:'food',size:[70,60],desc:'开放式棚市与独立粮仓围绕空地排列，货车从田间联络道进入。',parts:[[-18,-13,27,10,2,0,1],[15,-14,18,11,3,7,1],[-19,13,17,14,3,-5,0],[16,12,19,12,2,0,0]]},
 {region:'saitama',id:'saitama-housing',name:'埼玉连廊住区',type:'apartment',size:[78,70],desc:'错位板楼分成三个院落，底层连廊接公共服务楼，长条楼身保留通风间距。',parts:[[-22,-9,12,43,13,0,0],[0,7,12,40,9,0,0],[23,-9,12,43,16,0,0],[-8,-25,15,8,3,0,0]]},
 {region:'hokuen',id:'tokorozawa-assembly',name:'所泽机造总装厂',type:'weapon',size:[86,66],desc:'横向总装厅连接三座不同跨度的生产翼，设备塔与货场分开，形成梳状工业轮廓。',parts:[[0,-22,65,11,5,0,1],[-24,3,15,34,8,0,1],[0,1,19,31,10,0,1],[25,5,13,39,6,0,1],[32,-23,7,8,18,0,0]]},
 {region:'kai',id:'valley-terraces',name:'甲斐阶庭中心',type:'netrunner',size:[76,66],desc:'三条退台体量沿山坡错开，谷侧开口保留步行庭院，顶层设备室缩在后缘。',parts:[[-20,-16,25,17,11,0,3],[5,-1,32,18,7,0,3],[17,20,28,12,3,0,0],[-21,16,12,14,4,0,0]]},
 {region:'fuji',id:'fuji-observatory',name:'富士边境观测站',type:'sos',size:[70,60],desc:'一座多边形观测楼和两间低矮服务房散落在隔离场地内，外围保持大片空地。',parts:[[-14,-9,24,24,7,0,5],[23,10,15,12,2,0,0],[-22,20,17,9,2,0,1]]},
 {region:'sagami',id:'kawasaki-refinery',name:'川崎能源联合厂',type:'sabotage',size:[86,64],desc:'圆形储罐、窄长管线楼和高耸分离塔共用一处工业地块；中央检修通道贯穿南北。',parts:[[-26,-15,18,18,6,0,5],[-26,13,18,18,6,0,5],[0,-17,15,16,24,0,0],[20,4,23,37,5,0,1],[0,21,10,10,12,0,0]]},
 {region:'chiba',id:'chiba-waterhall',name:'千叶滨水会展馆',type:'client',size:[86,68],desc:'扇形主馆与两翼展厅形成向水侧展开的轮廓，前庭和台阶保持开放，设备楼位于后侧。',parts:[[0,-7,39,31,9,0,5],[-28,6,15,31,5,-19,0],[28,6,15,31,6,19,0],[0,-25,25,9,4,0,1]]},
 {region:'docks',id:'dock-ruins',name:'木更津旧港遗构',type:'explore',size:[78,66],desc:'停用船坞只剩断开的厂房翼和高低不齐的结构段，开口朝向旧货运通道。',parts:[[-25,-17,16,12,9,0,0],[-7,-20,15,8,4,0,0],[14,-18,18,12,7,0,1],[-26,5,9,22,6,0,0],[-24,24,13,8,2,8,0],[25,4,12,19,11,0,0],[22,24,18,8,3,-12,0]]}
];
