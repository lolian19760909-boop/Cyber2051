"""Package independent original glyphs; never crop the low-res reference board."""
from pathlib import Path
from PIL import Image
import base64, hashlib, json

root = Path(__file__).resolve().parents[3]
ref = root / '资料/参考/2077菜单人物-20261011'
out = ref / 'prepared'
out.mkdir(exist_ok=True)
original=ref/'raw/official'
files={'body':'929b2686672efae2.png','reflexes':'afff5f6403ae9b69.png',
       'intelligence':'88c338cdb7f3fac5.png','technical':'3cc9d8ebb34ec0f1.png','cool':'1bf26d235ab8e6de.png'}
official=json.loads((original/'manifest.json').read_text(encoding='utf-8'))
entries, records = {}, []
for name in ['characters','city','operations','network','archive']:
    file=out/(name+'-original.png');data=file.read_bytes()
    entries[name]='data:image/png;base64,'+base64.b64encode(data).decode()
    records.append({'id':name,'file':str(file.relative_to(root)),'size':[128,128],'cssPixels':36,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'source':'原作者图标板-3840.png','author':'Vladimír Vilimovský / CD PROJEKT RED','change':'single original glyph, transparent background, cyan tint; exact crop recorded separately'})
for name, filename in files.items():
    f=original/filename
    vector=f.suffix=='.svg'
    data=f.read_text(encoding='utf-8').replace('currentColor','#f5717f').encode() if vector else f.read_bytes()
    (out/(name+f.suffix)).write_bytes(data)
    entries[name]='data:image/'+('svg+xml' if vector else 'png')+';base64,'+base64.b64encode(data).decode()
    records.append({'id':name,'file':str(f.relative_to(root)),'size':'vector 24x24' if vector else Image.open(f).size,'cssPixels':28 if vector else 24,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'source':('https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/'+filename) if vector else next(a['url'] for a in official['assets'] if a['id']==f.stem),'author':'Lucide / ISC' if vector else 'CD PROJEKT RED / official build planner','change':'stroke color only' if vector else 'original bytes, displayed at half native size'})
font=(root/'资料/参考/2077任务界面-20261011/r02/assets/rajdhani-medium-latin.woff2').read_bytes()
menu=json.loads((root/'卡片源码/运行时/menu-assets.json').read_text(encoding='utf-8'))
def data_uri(file,mime):return 'data:'+mime+';base64,'+base64.b64encode((out/file).read_bytes()).decode()
payload={'schema':3,'icons':entries,'font':'data:font/woff2;base64,'+base64.b64encode(font).decode(),'wordmark':menu['entries']['wordmark']['fallback'],'background':data_uri('hub-background.webp','image/webp'),'fallback':data_uri('hub-background-fallback.webp','image/webp'),'menuFrame':data_uri('menu-frame.png','image/png'),'menuPlate':data_uri('menu-plate.webp','image/webp'),'dossierFrame':data_uri('dossier-frame.png','image/png')}
payload['dossiers']={key:{'fallback':data_uri(key+'-fallback.webp','image/webp')} for key in ['reputation','bonds','story']}
payload['statusArt']={key:data_uri(file,mime) for key,file,mime in [('load','load-original.png','image/png'),('money','money-original.png','image/png'),('level','level-light.webp','image/webp'),('cred','cred-light.webp','image/webp')]}
cloud=ref/'云端素材清单.json'
if cloud.exists():
    manifest=json.loads(cloud.read_text(encoding='utf-8'))
    for record in manifest['files']:
        if record['id']=='hub-background':payload['backgroundURL']=record['url']
        else:payload['dossiers'][record['id']]['url']=record['url']
(root/'.cache/ui-revision/hub-assets.json').write_text(json.dumps(payload,ensure_ascii=False),encoding='utf-8')
(ref/'入卡素材清单.json').write_text(json.dumps({'schema':3,'rejected':'600px board crops and generic Lucide replacement rejected. Using the verified 3840px original sheet and official independent attribute images.','assets':records},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'glyphs':len(entries),'bytes':sum(r['bytes'] for r in records),'fontBytes':len(font)}))
