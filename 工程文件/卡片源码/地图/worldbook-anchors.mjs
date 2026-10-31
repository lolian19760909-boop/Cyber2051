// Read-only canon excerpts. Component filenames are ordinals, never entry IDs.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const engineeringRoot=fileURLToPath(new URL("../..",import.meta.url));
const defaultWorldbookDir=path.join(engineeringRoot,"卡片源码/字段快照/components/worldbook");
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const scope='RiNG社区及既有边界地点';
const groupingNote='地图group仅用于地点检索，不表示行政辖区、治安管辖或整区贫富归属。';
const fact=(title,text,entryId)=>({title,text,entryId});
const definitions=[
  {id:'ring-community',facts:[
    fact('地理与形态','RiNG社区：位于丰岛区（池袋）、依托废弃地下铁向下纵深蔓延的立体棚户区，核心为新场馆"RING-Live!"',3),
    fact('地下社区起源','2023年东京大停电及后续的社会动荡，导致池袋庞大的地下铁网络与多层商业街区彻底停摆。',44),
    fact('社区音乐生活','这里流通着大量二手实体乐器、老式效果器与民间拼装的扬声设备。人们在狭窄的巷道和地下隧道内排练、写歌，宣泄压抑的情绪。',44)
  ]},
  {id:'ring-live',facts:[
    fact('六层场馆','如今的场馆由旧时代的建筑改造而成，是一栋地上三层、地下三层的六层综合设施。',37),
    fact('馆内停火规则','场馆的停火协议由各方承认，馆方安保负责执行。重装武器留在场外，内置武装须收起并保持关闭。',37),
    fact('场馆与负责人','都筑诗船建立的第三家Live House，位于东京丰岛区（池袋），负责人是真次凛凛子。',37),
    fact('共通订单','订单系统与CiRCLE共通，可以互相预定设施分流客户。',37),
    fact('乐奈的日常与广场角落','要乐奈常泡在地下二层的乐器店与馆内休息区一带自习吉他，店里所有工作人员和常客都认识她，知道她是老板的外孙女，对她十分照顾，凛凛子还把RiNG广场的一角留给了她。',37),
    fact('地上演出与配套','地上三层是Live House演出区，咖啡馆、录音室与乐器租赁等配套都在这几层。',37),
    fact('B1公共广场','地下一层由旧地铁换乘大厅改建，是连通RiNG社区各处的公共广场。',37),
    fact('B2商店与来生','地下二层集中了各类乐器店、二手唱片行和独立酒吧“来生”，亡者之酒纪念区设在来生店内。',37),
    fact('B3酒吧','地下三层是全社区最大的酒吧"Lust？Love？Live！"。',37)
  ]},
  {id:'beni-street',facts:[
    fact('交界街巷','红花街：位于RiNG贫民区与平民区的交界地带，由多层立体的街道与巷道组成，违章修建的铁皮连接桥与各式规格不一的电缆纵横交错。',44),
    fact('归属与治安','红花街归属暗池，商户雇人维持局部秩序，警方主要驻守外围街口。',44)
  ]},
  {id:'a-yang-clinic',facts:[
    fact('红花街内的义体诊所','阿杨义体诊所：红花街里一家便宜实惠、技术过硬的义体诊所，老板是在日长大的华人，对中国了解并不深。',44),
    fact('既有熟客','海铃经常光顾这家义体诊所。',44)
  ]},
  {id:'circle',facts:[
    fact('社区外围场馆','都筑诗船在关闭SPACE后开设的第二家Live House，位于RiNG社区外围。',38),
    fact('场地规模','场地可容纳约500人',38),
    fact('场馆负责人','负责人是月岛麻里奈',38)
  ]},
  {id:'space-site',facts:[
    fact('关闭后的用途','2049年年末正式关闭，原址后被公司收购，改建为停车场。',21),
    fact('旧址与社区','SPACE就位于今RiNG社区一带',21),
    fact('乐奈与旧址','对要乐奈来说，这里是如同家一般的地方，即使关闭至今，她依然会经常在旧址门口逗留。',21)
  ]}
];
const jsonNames=dir=>fs.readdirSync(dir).filter(name=>/\.json$/i.test(name)).sort();

export function applyWorldbookAnchors(data,{worldbookDir=defaultWorldbookDir,additionalDefinitions=[]}={}){
  assert.equal(data.mapId,'tokyo-central','Worldbook anchors belong to the central map only.');
  const selected=[...definitions,...additionalDefinitions];
  assert.equal(new Set(selected.map(d=>d.id)).size,selected.length,'Duplicate anchor definition.');
  const dir=path.resolve(worldbookDir),names=jsonNames(dir),entries=new Map(),readFiles=new Map();
  const read=filename=>{const bytes=fs.readFileSync(filename);readFiles.set(filename,sha(bytes));return bytes.toString('utf8');};
  for(const filename of names){
    const metaPath=path.join(dir,filename),meta=JSON.parse(read(metaPath));
    assert.ok(Number.isSafeInteger(meta.id)&&meta.id>=0,'Invalid stable worldbook entry ID: '+filename);
    assert.ok(!entries.has(meta.id),'Duplicate stable worldbook entry ID: '+meta.id);
    entries.set(meta.id,{meta,metaPath,bodyPath:path.join(dir,filename.replace(/\.json$/i,'.txt'))});
  }
  const needed=[...new Set(selected.flatMap(p=>p.facts.map(f=>f.entryId)))].sort((a,b)=>a-b),sources=new Map(),bodies=new Map();
  for(const entryId of needed){
    const entry=entries.get(entryId);assert.ok(entry,'Missing stable worldbook entry ID: '+entryId);
    assert.ok(typeof entry.meta.comment==='string'&&entry.meta.comment.trim(),'Missing worldbook comment: '+entryId);
    assert.ok(Array.isArray(entry.meta.keys)&&entry.meta.keys.every(k=>typeof k==='string'),'Invalid worldbook keys: '+entryId);
    assert.equal(typeof entry.meta.enabled,'boolean','Missing worldbook enabled state: '+entryId);
    assert.equal(typeof entry.meta.constant,'boolean','Missing worldbook constant state: '+entryId);
    const body=read(entry.bodyPath);bodies.set(entryId,body);
    sources.set(entryId,{entryId,comment:entry.meta.comment,component:path.relative(engineeringRoot,entry.bodyPath).replaceAll('\\','/'),sha256:readFiles.get(entry.bodyPath),metaSha256:readFiles.get(entry.metaPath),keys:structuredClone(entry.meta.keys),enabled:entry.meta.enabled,constant:entry.meta.constant});
  }
  const pending=selected.map(def=>{
    const nodes=data.nodes.filter(n=>n.id===def.id);assert.equal(nodes.length,1,'Expected one map node: '+def.id);
    for(const f of def.facts)assert.ok(bodies.get(f.entryId).includes(f.text),'Missing canon excerpt: '+def.id+' / entry '+f.entryId+' / '+f.title);
    return {node:nodes[0],anchor:{status:'canon-excerpt',placesScope:additionalDefinitions.includes(def)?'暗池与赤羽的既有地点及设施':scope,mapGroupingNote:groupingNote,
      sources:[...new Set(def.facts.map(f=>f.entryId))].map(id=>structuredClone(sources.get(id))),facts:structuredClone(def.facts)}};
  });
  // Check the same read window before touching map data. A concurrent writer wins.
  assert.deepEqual(jsonNames(dir),names,'Worldbook directory changed while reading; retry after the writer finishes.');
  for(const [filename,digest] of readFiles)assert.equal(sha(fs.readFileSync(filename)),digest,'Worldbook changed while reading: '+path.basename(filename));
  const receipt={status:'canon-excerpt',placesScope:additionalDefinitions.length?'RiNG社区、赤羽及既有边界地点':scope,mapGroupingNote:groupingNote,placeIds:selected.map(p=>p.id),factCount:selected.reduce((n,p)=>n+p.facts.length,0),sources:[...sources.values()].map(s=>structuredClone(s))};
  for(const {node,anchor} of pending)node.worldbookAnchor=anchor;
  return receipt;
}
