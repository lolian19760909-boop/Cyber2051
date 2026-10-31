from pathlib import Path
import importlib.util,copy,os,argparse
from datetime import datetime,timezone
root=Path('工程文件').resolve()
parser=argparse.ArgumentParser(description='将明确指定的成卡同步到交付与组件；拒绝覆盖未合并修改。')
parser.add_argument('--candidate',type=Path,default=root/'.cache/build/赛博小祥2051-V2.3.0.json')
parser.add_argument('--receipt',type=Path,default=root/'.cache/mirror220/component-sync.json')
args=parser.parse_args()
spec=importlib.util.spec_from_file_location('cw',root/'工具/组件/card_workspace.py');cw=importlib.util.module_from_spec(spec);spec.loader.exec_module(cw)
w=root/'卡片源码/字段快照';manifest=cw.parse((w/'manifest.json').read_bytes())
previous=w/manifest['source']['path']
if not previous.exists():
    matches=[p for p in (root/'交付/当前').glob('*.json') if p.stat().st_size==manifest['source']['bytes'] and cw.sha(p.read_bytes())==manifest['source']['sha256']]
    assert len(matches)==1,'Previous component source missing or ambiguous'
    previous=matches[0]
previous_card=cw.parse(previous.read_bytes())
assert cw.canonical(cw.compose(w))==cw.canonical(previous_card), 'Unmerged component edits exist'
candidate=args.candidate.resolve();source=root/'交付'/'当前'/candidate.name
assert candidate.is_relative_to(root/'.cache'), 'Candidate must be a checked build in .cache'
assert args.receipt.resolve().is_relative_to(root/'.cache'), 'Receipt must stay in .cache'
raw=candidate.read_bytes();card=cw.parse(raw)
if source.exists() and source.read_bytes()!=raw:
    assert manifest['source']['file']==source.name and cw.sha(source.read_bytes())==manifest['source']['sha256'],'Do not replace an unknown delivered file'
source.write_bytes(raw)
entries=card['data']['character_book']['entries']
previous_entries=previous_card['data']['character_book']['entries']
for part in manifest['parts']:
    if part['kind']=='worldbook_entry':
        part['id']=previous_entries[int(part['pointers'][0].rsplit('/',1)[1])]['id']
existing={p['id']:p for p in manifest['parts'] if p['kind']=='worldbook_entry'}
assert len(existing)==sum(p['kind']=='worldbook_entry' for p in manifest['parts']), 'Duplicate component lore ID'
removed=set(existing)-{e['id'] for e in entries}
deferred={e['id'] for e in cw.parse((root/'卡片源码/世界书/entries.json').read_bytes()).get('deferredEntries',[])}
assert removed.issubset(deferred), 'Existing lore ID removed without an explicit deferred source'
# Keep the retired component files and frozen delivery; only the active field
# map follows the author's explicitly deferred lore list.
manifest['parts']=[p for p in manifest['parts'] if not (p['kind']=='worldbook_entry' and p['id'] in removed)]
existing={i:p for i,p in existing.items() if i not in removed}
used_files={p['file'] for p in manifest['parts']}
anchor=max(i for i,p in enumerate(manifest['parts']) if p['kind']=='worldbook_entry')
for index,entry in enumerate(entries):
    if entry['id'] in existing:
        existing[entry['id']]['pointers']=[f"/data/character_book/entries/{index}"]
        existing[entry['id']]['label']=entry['comment']
        continue
    anchor+=1
    stem=f"components/worldbook/{index:03d}"
    if stem+'.json' in used_files:stem=f"components/worldbook/uid-{entry['id']:03d}"
    assert stem+'.json' not in used_files, 'Component filename conflict'
    used_files.add(stem+'.json')
    manifest['parts'].insert(anchor,{"kind":"worldbook_entry","pointers":[f"/data/character_book/entries/{index}"],"id":entry['id'],"label":entry['comment'],"file":stem+'.json',"contentField":"content","contentFile":stem+'.txt'})
ordered_lore=iter(sorted((p for p in manifest['parts'] if p['kind']=='worldbook_entry'),key=lambda p:int(p['pointers'][0].rsplit('/',1)[1])))
manifest['parts']=[next(ordered_lore) if p['kind']=='worldbook_entry' else p for p in manifest['parts']]
helpers=card['data']['extensions']['tavern_helper']['scripts']
known={p['id']:p for p in manifest['parts'] if p['kind']=='helper_script'}
for index,helper in enumerate(helpers):
    if helper['id'] in known:
        known[helper['id']]['pointers']=[f'/data/extensions/tavern_helper/scripts/{index}']
        continue
    assert helper['id'] in ['cxx-phone-v1','cxx-runtime-bootstrap']
    stem='runtime-bootstrap' if helper['id']=='cxx-runtime-bootstrap' else f'{index:03d}'
    manifest['parts'].append({'kind':'helper_script','pointers':[f'/data/extensions/tavern_helper/scripts/{index}'],'id':helper['id'],'label':helper['name'],'file':f'components/helper/{stem}.json','contentField':'content','contentFile':f'components/helper/{stem}.txt'})
ordered=iter(sorted((p for p in manifest['parts'] if p['kind']=='helper_script'),key=lambda p:int(p['pointers'][0].rsplit('/',1)[1])))
manifest['parts']=[next(ordered) if p['kind']=='helper_script' else p for p in manifest['parts']]
# Retired openings stay in historical delivery files; the active manifest follows the candidate.
manifest['parts']=[p for p in manifest['parts'] if not any('/alternate_greetings/' in pointer and int(pointer.rsplit('/',1)[1])>=len(card['data']['alternate_greetings']) for pointer in p['pointers'])]
changed=[]
def put_file(file,data):
    target=cw.safe_file(w,file)
    if not target.exists() or target.read_bytes()!=data:target.write_bytes(data);changed.append(file)
    return cw.sha(data)
def get(pointer):
    node=card
    for token in cw.tokens(pointer):node=node[int(token)] if isinstance(node,list) else node[token]
    return node
for part in manifest['parts']:
    value=get(part['pointers'][0])
    assert all(value==get(p) for p in part['pointers'])
    part['sourceSha256']=cw.sha(cw.canonical(value))
    if 'contentField' in part:
        metadata=copy.deepcopy(value);text=metadata[part['contentField']];metadata[part['contentField']]=''
        part['fileSha256']=put_file(part['file'],cw.pretty(metadata));part['contentSha256']=put_file(part['contentFile'],text.encode('utf8'))
    else:part['fileSha256']=put_file(part['file'],value.encode('utf8'))
base=copy.deepcopy(card);base['first_mes']='';base['data']['first_mes']='';base['data']['alternate_greetings']=[];base['data']['character_book']['entries']=[];base['data']['extensions']['regex_scripts']=[];base['data']['extensions']['tavern_helper']['scripts']=[]
manifest['baseFileSha256']=put_file(manifest['baseFile'],cw.pretty(base))
manifest['source'].update(file=source.name,path=os.path.relpath(source,w).replace('\\','/'),bytes=len(raw),sha256=cw.sha(raw),trailingNewline=raw.endswith(b'\n'),modifiedUtc=datetime.fromtimestamp(source.stat().st_mtime,timezone.utc).isoformat())
put_file('manifest.json',cw.pretty(manifest))
assert cw.card_bytes(cw.compose(w),manifest)==raw
receipt={'parts':len(manifest['parts']),'changed':changed,'deferredIds':sorted(removed),'bytes':len(raw),'sha256':cw.sha(raw),'roundtrip':True,'byteEqual':True}
args.receipt.parent.mkdir(parents=True,exist_ok=True)
args.receipt.write_bytes(cw.pretty(receipt))
print(receipt)
