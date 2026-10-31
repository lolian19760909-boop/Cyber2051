"""Author-approved extraction from the actual 3840px reference, with a review sheet."""
from pathlib import Path
from PIL import Image, ImageChops
import json, hashlib

root=Path(__file__).resolve().parents[3]
ref=root/'资料/参考/2077菜单人物-20261011'
out=ref/'prepared'
sheet=Image.open(ref/'raw/原作者图标板-3840.png').convert('RGB')
# Coordinates were reviewed against the original. Each rectangle contains ONE glyph.
boxes={'characters':(676,328,730,385),'city':(610,329,667,386),
       'operations':(550,332,599,382),'network':(644,482,699,536),
       'archive':(472,560,526,614)}
records=[]
for key,box in boxes.items():
    sourcebox=tuple(round(x*3840/2048) for x in box)
    part=sheet.crop(sourcebox)
    red,green,blue=part.split()
    signal=ImageChops.subtract(red,ImageChops.lighter(green,blue))
    highest=signal.getextrema()[1]
    alpha=signal.point(lambda n:round(n*255/highest) if highest else 0)
    bounds=alpha.getbbox()
    if not bounds:raise ValueError(key+' has no visible pixels')
    # Blank margins only; do not enlarge source pixels.
    rgba=Image.new('RGBA',part.size,(89,230,239,0));rgba.putalpha(alpha)
    rgba=rgba.crop(bounds);rgba.thumbnail((104,104),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',(128,128));tile.alpha_composite(rgba,((128-rgba.width)//2,(128-rgba.height)//2))
    file=out/(key+'-original.png');tile.save(file,optimize=True)
    records.append({'id':key,'crop':sourcebox,'alphaBounds':bounds,'nativeGlyphSize':rgba.size,'canvas':[128,128],'displayCSS':36,'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
hub=Image.open(ref/'raw/原作者总菜单-3840.png').convert('RGB')
# The status glyphs and light strips are independent pixels, never baked values.
for key,box,color in [('load',(1618,41,1648,70),(255,74,85)),('money',(1840,40,1879,68),(251,154,43))]:
    part=hub.crop(tuple(round(v*3840/2048) for v in box));r,g,b=part.split()
    signal=ImageChops.subtract(r,b);peak=signal.getextrema()[1]
    alpha=signal.point(lambda v:round(255*v/peak) if v>10 else 0)
    rgba=Image.new('RGBA',part.size,color+(0,));rgba.putalpha(alpha);rgba=rgba.crop(alpha.getbbox())
    rgba.save(out/(key+'-original.png'),optimize=True)
for key,box in [('level-light',(126,70,254,104)),('cred-light',(306,70,434,104))]:
    hub.crop(tuple(round(v*3840/2048) for v in box)).save(out/(key+'.webp'),quality=94,method=6)
hub.crop(tuple(round(n*3840/2048) for n in (134,566,479,658))).save(out/'menu-frame.png',optimize=True)
hub.crop(tuple(round(n*3840/2048) for n in (709,96,892,354))).save(out/'dossier-frame.png',optimize=True)
background=Image.open(ref/'raw/菜单底图-GPT保留微文字.png').convert('RGB')
background.save(out/'hub-background.webp',quality=88,method=6)
background.thumbnail((960,960),Image.Resampling.LANCZOS)
background.save(out/'hub-background-fallback.webp',quality=76,method=6)
sheet=Image.open(ref/'raw/名望羁绊故事-GPT插画.png').convert('RGBA')
for index,key in enumerate(['reputation','bonds','story']):
    part=sheet.crop((round(index*sheet.width/3),0,round((index+1)*sheet.width/3),sheet.height))
    part=part.crop(part.getchannel('A').getbbox())
    part.thumbnail((600,840),Image.Resampling.LANCZOS)
    part.save(out/(key+'.webp'),quality=90,method=6)
    part.thumbnail((256,360),Image.Resampling.LANCZOS)
    part.save(out/(key+'-fallback.webp'),quality=82,method=6)
plate=Image.open(ref/'raw/按钮底板-GPT去字.png');plate.crop((0,75,plate.width,640)).resize((1085,283),Image.Resampling.LANCZOS).save(out/'menu-plate.webp',quality=92)
(ref/'高清素材处理记录.json').write_text(json.dumps({'schema':1,'source':'https://www.behance.net/gallery/133185623/Cyberpunk-2077User-Interface-%28Part-2%29','original':'https://mir-s3-cdn-cf.behance.net/project_modules/max_3840_still/c31148133185623.61ba3b88b2ea6.png','classification':'Original artist concept sheet; not claimed to be exact shipping screenshots.','icons':records,'frameUsage':'menu uses a full GPT-cleaned original bitmap plate; dossier uses cropped border-image only; reference labels are never rendered','background':'GPT image edit removes foreground UI from the reference; original generation and prompt archived separately'},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'glyphs':len(records),'backgroundBytes':(out/'hub-background.webp').stat().st_size,'fallbackBytes':(out/'hub-background-fallback.webp').stat().st_size}))
