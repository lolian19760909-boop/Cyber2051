// 已对照参考站实际图例；不包含传送点。hook 仅是未来机制的接线名称。
const definitions=[
 ['apartment','公寓','生活服务','20201209104108724',['tsurumaki','saitama']],
 ['drop','交货点','生活服务','20201209104137336',['keihin','docks']],
 ['clothing','服装','生活服务','20201209104042449',['neonring','chiba']],
 ['implant','义体医生','生活服务','20201209105032225',[]],
 ['netrunner','网络黑客','生活服务','20201209104607433',['underpool','kai']],
 ['weapon','武器店','生活服务','20201209104736857',[]],
 ['melee','近战武器商贩','生活服务','20201209104217125',['underpool','lowtown']],
 ['hospital','医疗点','生活服务','20201209104941737',[]],
 ['food','饮食','生活服务','20201209105129739',['west','lowtown']],
 ['bar','酒吧','生活服务','20201209104242563',['neonring','underpool']],
 ['joytoy','性偶','生活服务','20201209104859704',['neonring']],
 ['market','垃圾商店','生活服务','20201209104308191',[]],
 ['fixer','中间人','人物联系','20201209105747660',['underpool','keihin']],
 ['client','客户','人物联系','20201209105428697',['imperial','chiba']],
 ['police','警用频道案件','治安事件','20201209105341991',['lowtown']],
 ['assault','发生袭击案件','治安事件','20201209105135838',['underpool','sagami']],
 ['organized','有组织犯罪活动嫌疑','治安事件','20201209105700896',['docks']],
 ['reported','犯罪举报','治安事件','20201209105246569',['saitama']],
 ['cyberpsycho','目击赛博精神病','治安事件','20201209105527210',['hokuen']],
 ['tarot','塔罗牌','探索','20201209105604521',['kai','west']],
 ['sidejob','支线任务','委托','2020120931114502',['chiba','saitama']],
 ['recovery','物归原主','委托','20201209104650256',['lowtown']],
 ['theft','偷盗','委托','20201209104625978',['underpool']],
 ['escort','护卫','委托','20201209104607116',['keihin','tsurumaki']],
 ['hitman','雇佣杀手','委托','20201209104510444',['sagami']],
 ['sabotage','暗中破坏','委托','20201209104451958',['hokuen']],
 ['sos','SOS：急需佣兵','委托','20201209104332437',['fuji','docks']]
];
export const catalog=definitions.map(([id,name,group,asset,regions])=>({id,name,group,regions,url:'https://img1.ali213.net/glpic/2020/12/09/'+asset+'.png',color:group==='治安事件'||id==='tarot'?'#00d8e5':group==='委托'?'#f1d45b':'#f2f1ec',hook:group==='治安事件'?'encounter.'+id:group==='委托'?'mission.'+id:null}));
export const serviceTypes=[...catalog.map(({url,regions,...type})=>type),{id:'transit',name:'交通设施',group:'都市设施',color:'#81b7c9'},{id:'spaceport',name:'发射中心',group:'都市设施',color:'#6ecbd0'},{id:'landmark',name:'城市地标',group:'都市设施',color:'#6ecbd0'},{id:'explore',name:'城市遗构',group:'探索',color:'#6ecbd0'}];
