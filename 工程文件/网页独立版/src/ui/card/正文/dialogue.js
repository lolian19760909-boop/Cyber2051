/* Derived from 卡片源码/正文/dialogue.js; source SHA256 56d6cf29eacdd577f7c737308364af9ac2f56af26205c72b0e92c673fe02c4ce. Rebuild with tools/p3a-adapt-views.mjs. */
/* One dialogue reader for Gal, native bubbles and outbound assistant history.
 * Transforms copies only. CSS classes remain compatible with the preset skin.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.Cxx238Dialogue=api;
})(globalThis,function(){
  'use strict';
  const names=/* CXX238_NAMES */{"户山香澄":"户山香澄","花园多惠":"花园多惠","牛込里美":"牛込里美","山吹沙绫":"山吹沙绫","市谷有咲":"市谷有咲","美竹兰":"美竹兰","青叶摩卡":"青叶摩卡","上原绯玛丽":"上原绯玛丽","宇田川巴":"宇田川巴","羽泽鸫":"羽泽鸫","丸山彩":"丸山彩","冰川日菜":"冰川日菜","白鹭千圣":"白鹭千圣","大和麻弥":"大和麻弥","若宫伊芙":"若宫伊芙","凑友希那":"凑友希那","冰川纱夜":"冰川纱夜","今井莉莎":"今井莉莎","宇田川亚子":"宇田川亚子","白金燐子":"白金燐子","弦卷心":"弦卷心","濑田薰":"濑田薰","北泽育美":"北泽育美","松原花音":"松原花音","奥泽美咲":"奥泽美咲","米歇尔":"米歇尔","仓田真白":"仓田真白","桐谷透子":"桐谷透子","广町七深":"广町七深","二叶筑紫":"二叶筑紫","八潮瑠唯":"八潮瑠唯","LAYER":"LAYER","LOCK":"LOCK","MASKING":"MASKING","PAREO":"PAREO","CHU²":"CHU²","高松灯":"高松灯","千早爱音":"千早爱音","要乐奈":"要乐奈","长崎素世":"长崎素世","椎名立希":"椎名立希","三角初华":"三角初华","若叶睦":"若叶睦","八幡海铃":"八幡海铃","祐天寺若麦":"祐天寺若麦","丰川祥子":"丰川祥子","仲町阿拉蕾":"仲町阿拉蕾","宫永野乃花":"宫永野乃花","峰月律":"峰月律","藤都子":"藤都子","千石由乃":"千石由乃","汐见萤":"汐见萤","伊泽枣":"伊泽枣","琴平凪":"琴平凪","滨崎茉幌":"滨崎茉幌","和泉朋花":"和泉朋花","须贺蕾叶":"须贺蕾叶","马桥心玖":"马桥心玖","矢仓蓬咲":"矢仓蓬咲","梅里千樱梨":"梅里千樱梨","四宫宁月":"四宫宁月","波奇":"波奇","虹夏":"虹夏","凉":"凉","喜多":"喜多","伊地知星歌":"伊地知星歌","PA小姐":"PA小姐","广井菊里":"广井菊里","清水伊莱莎":"清水伊莱莎","岩下志麻":"岩下志麻","大槻悠悠子":"大槻悠悠子","长谷川困":"长谷川困","本城枫子":"本城枫子","内田幽幽":"内田幽幽","后藤直树":"后藤直树","后藤美智代":"后藤美智代","后藤二里":"后藤二里","吉田银次郎":"吉田银次郎","Poison Yami":"Poison Yami","司马都":"司马都","结束乐队粉丝1号（长发）":"结束乐队粉丝1号（长发）","结束乐队粉丝2号（短发）":"结束乐队粉丝2号（短发）","大山猫猫":"大山猫猫","日向惠恋奈":"日向惠恋奈","山田恭一":"山田恭一","山田京香":"山田京香","喜多久留代":"喜多久留代","喜多实":"喜多实","仁菜":"仁菜","桃香":"桃香","安和昴":"安和昴","智":"智","Rupa":"Rupa","雏":"雏","ナナ（GBC）":"ナナ（GBC）","リン（GBC）":"リン（GBC）","アイ（GBC）":"アイ（GBC）","井芹宗男":"井芹宗男","井芹靖惠":"井芹靖惠","井芹凉音":"井芹凉音","安和天童":"安和天童","キョーコ（智的母亲）":"キョーコ（智的母亲）","ミネ（GBC）":"ミネ（GBC）","三浦潮美":"三浦潮美","林（GBC）":"林（GBC）","纯田真奈":"纯田真奈","薇欧拉":"薇欧拉","花園たえ":"花园多惠","牛込りみ":"牛込里美","市ヶ谷有咲":"市谷有咲","青葉モカ":"青叶摩卡","上原ひまり":"上原绯玛丽","羽沢つぐみ":"羽泽鸫","若宮イヴ":"若宫伊芙","今井リサ":"今井莉莎","宇田川あこ":"宇田川亚子","弦巻こころ":"弦卷心","北沢はぐみ":"北泽育美","ミッシェル":"米歇尔","倉田ましろ":"仓田真白","桐ヶ谷透子":"桐谷透子","二葉つくし":"二叶筑紫","和奏瑞依":"LAYER","朝日六花":"LOCK","佐藤益木":"MASKING","鳰原令王那":"PAREO","CHU2":"CHU²","珠手知由":"CHU²","高松燈":"高松灯","長崎そよ":"长崎素世","Doloris":"三角初华","Mortis":"若叶睦","Timoris":"八幡海铃","祐天寺にゃむ":"祐天寺若麦","Amoris":"祐天寺若麦","Oblivionis":"丰川祥子","仲町あられ":"仲町阿拉蕾","宮永野乃花":"宫永野乃花","宮永ののか":"宫永野乃花","千石ユノ":"千石由乃","汐見螢":"汐见萤","汐見蛍":"汐见萤","伊澤棗":"伊泽枣","伊沢なつめ":"伊泽枣","濱崎茉幌":"滨崎茉幌","浜崎まほろ":"滨崎茉幌","須賀蕾葉":"须贺蕾叶","須賀蕾叶":"须贺蕾叶","馬橋心玖":"马桥心玖","矢倉蓬咲":"矢仓蓬咲","梅里千櫻梨":"梅里千樱梨","梅里ちえり":"梅里千樱梨","四宮寧月":"四宫宁月","后藤一里":"波奇","後藤ひとり":"波奇","伊地知虹夏":"虹夏","山田凉":"凉","山田涼":"凉","山田リョウ":"凉","喜多郁代":"喜多","PAさん":"PA小姐","後藤直樹":"后藤直树","後藤美智代":"后藤美智代","後藤ふたり":"后藤二里","吉田銀次郎":"吉田银次郎","ぽいずん♡やみ":"Poison Yami","司馬都":"司马都","大山猫々":"大山猫猫","日向恵恋奈":"日向惠恋奈","喜多実":"喜多实","廣井菊里":"广井菊里","廣井きくり":"广井菊里","清水イライザ":"清水伊莱莎","大槻ヨヨコ":"大槻悠悠子","長谷川あくび":"长谷川困","本城楓子":"本城枫子","内田幽々":"内田幽幽","井芹仁菜":"仁菜","河原木桃香":"桃香","安和すばる":"安和昴","海老塚智":"智","鲁帕":"Rupa","ルパ":"Rupa","ヒナ（GBC）":"雏","井芹靖恵":"井芹靖惠","井芹涼音":"井芹凉音","薇歐拉":"薇欧拉","ビオラ":"薇欧拉","Viola":"薇欧拉","V姐":"薇欧拉","灯":"高松灯","爱音":"千早爱音","素世":"长崎素世","立希":"椎名立希","乐奈":"要乐奈","祥子":"丰川祥子","初华":"三角初华","睦":"若叶睦","海铃":"八幡海铃","若麦":"祐天寺若麦","喵梦":"祐天寺若麦"};
  const roles=/* CXX238_ROLES */{"kasumi":"户山香澄","tae":"花园多惠","rimi":"牛込里美","saaya":"山吹沙绫","arisa":"市谷有咲","ran":"美竹兰","moca":"青叶摩卡","himari":"上原绯玛丽","tomoe":"宇田川巴","tsugumi":"羽泽鸫","aya":"丸山彩","hina":"冰川日菜","chisato":"白鹭千圣","maya":"大和麻弥","eve":"若宫伊芙","yukina":"凑友希那","sayo":"冰川纱夜","lisa":"今井莉莎","ako":"宇田川亚子","rinko":"白金燐子","kokoro":"弦卷心","kaoru":"濑田薰","hagumi":"北泽育美","kanon":"松原花音","misaki":"奥泽美咲","michelle":"米歇尔","mashiro":"仓田真白","touko":"桐谷透子","nanami":"广町七深","tsukushi":"二叶筑紫","rui":"八潮瑠唯","layer":"LAYER","lock":"LOCK","masking":"MASKING","pareo":"PAREO","chu2":"CHU²","tomori":"高松灯","anon":"千早爱音","rana":"要乐奈","soyo":"长崎素世","taki":"椎名立希","uika":"三角初华","mutsumi":"若叶睦","umiri":"八幡海铃","nyamu":"祐天寺若麦","sakiko":"丰川祥子","arale":"仲町阿拉蕾","nonoka":"宫永野乃花","ritsu":"峰月律","miyako":"藤都子","yuno":"千石由乃","hotaru":"汐见萤","natsume":"伊泽枣","nagi":"琴平凪","mahoro":"滨崎茉幌","houka":"和泉朋花","raika":"须贺蕾叶","miku":"马桥心玖","yomogi":"矢仓蓬咲","chieri":"梅里千樱梨","shizuku":"四宫宁月","btr_hitori":"波奇","btr_nijika":"虹夏","btr_ryo":"凉","btr_ikuyo":"喜多","btr_seika":"伊地知星歌","btr_pa":"PA小姐","btr_kikuri":"广井菊里","btr_eliza":"清水伊莱莎","btr_shima":"岩下志麻","btr_yoyoko":"大槻悠悠子","btr_akubi":"长谷川困","btr_fuko":"本城枫子","btr_yuyu":"内田幽幽","btr_naoki":"后藤直树","btr_michiyo":"后藤美智代","btr_futari":"后藤二里","btr_ginjiro":"吉田银次郎","btr_poison":"Poison Yami","btr_miyako":"司马都","btr_fan1":"结束乐队粉丝1号（长发）","btr_fan2":"结束乐队粉丝2号（短发）","btr_nene":"大山猫猫","btr_erena":"日向惠恋奈","btr_kyoichi":"山田恭一","btr_kyoka":"山田京香","btr_kuruyo":"喜多久留代","btr_minoru":"喜多实","gbc_nina":"仁菜","gbc_momoka":"桃香","gbc_subaru":"安和昴","gbc_tomo":"智","gbc_rupa":"Rupa","gbc_hina":"雏","gbc_nana":"ナナ（GBC）","gbc_rin":"リン（GBC）","gbc_ai":"アイ（GBC）","gbc_muneo":"井芹宗男","gbc_yasue":"井芹靖惠","gbc_suzune":"井芹凉音","gbc_tendo":"安和天童","gbc_kyoko":"キョーコ（智的母亲）","gbc_mine":"ミネ（GBC）","gbc_shiomi":"三浦潮美","gbc_hayashi":"林（GBC）","mana":"纯田真奈","viola":"薇欧拉","raana":"要乐奈","user":"用户"};
  // Portrait identities are shared by dialogue, Gal, the history worker and phone profiles.
  // Stable IDs remain independent of the official filename prefix.
  const portraits=Object.freeze([
    Object.freeze({"id":"Tomorin","name":"高松灯","aliases":["灯","Tomori","Tomorin","高松燈","燈"],"filePrefix":"Tomori","worldbookUid":4,"anchorX":0.55,"heightCm":155}),
    Object.freeze({"id":"Anon","name":"千早爱音","aliases":["爱音","Anon","千早愛音","愛音"],"filePrefix":"Anon","worldbookUid":6,"anchorX":0.53,"heightCm":160}),
    Object.freeze({"id":"Soyo","name":"长崎素世","aliases":["素世","Soyo","長崎そよ","長崎素世","そよ","爽世"],"filePrefix":"Soyo","worldbookUid":7,"anchorX":0.57,"heightCm":162}),
    Object.freeze({"id":"Taki","name":"椎名立希","aliases":["立希","Taki"],"filePrefix":"Taki","worldbookUid":8,"anchorX":0.48,"heightCm":156}),
    Object.freeze({"id":"Rana","name":"要乐奈","aliases":["乐奈","Rana","要楽奈","要樂奈","楽奈","樂奈","Raana"],"filePrefix":"Rana","worldbookUid":9,"anchorX":0.54,"heightCm":150}),
    Object.freeze({"id":"Saki","name":"丰川祥子","aliases":["祥子","Sakiko","Saki","豊川祥子","豐川祥子","小祥","Oblivionis"],"filePrefix":"Sakiko","worldbookUid":10,"anchorX":0.6,"heightCm":155}),
    Object.freeze({"id":"Mutsumi","name":"若叶睦","aliases":["睦","Mutsumi","若葉睦","Mortis"],"filePrefix":"Mutsumi","worldbookUid":11,"anchorX":0.52,"heightCm":153}),
    Object.freeze({"id":"Uika","name":"三角初华","aliases":["初华","Uika","三角初華","初華","Doloris"],"filePrefix":"Uika","worldbookUid":12,"anchorX":0.49,"heightCm":160}),
    Object.freeze({"id":"Nyamu","name":"祐天寺若麦","aliases":["若麦","Nyamu","喵梦","喵夢","祐天寺にゃむ","祐天寺若麥","にゃむ","若麥","Amoris"],"filePrefix":"Nyamu","worldbookUid":13,"anchorX":0.51,"heightCm":164}),
    Object.freeze({"id":"Umiri","name":"八幡海铃","aliases":["海铃","Umiri","八幡海鈴","海鈴","Timoris"],"filePrefix":"Umiri","worldbookUid":14,"anchorX":0.5,"heightCm":158}),
    Object.freeze({"id":"Mana","name":"纯田真奈","aliases":["真奈","Mana"],"filePrefix":"Mana","worldbookUid":18,"anchorX":0.5,"heightCm":160}),
    Object.freeze({"id":"Miku","name":"马桥心玖","aliases":["心玖","Miku","馬橋心玖"],"filePrefix":"Miku","worldbookUid":88,"anchorX":0.5,"heightCm":158}),
    Object.freeze({"id":"Raika","name":"须贺蕾叶","aliases":["蕾叶","Raika","須賀蕾葉","蕾葉"],"filePrefix":"Raika","worldbookUid":89,"anchorX":0.5,"heightCm":163}),
    Object.freeze({"id":"Kanata","name":"泽海奏多","aliases":["奏多","Kanata","Kanade"],"filePrefix":"Kanata","worldbookUid":106,"anchorX":0.5,"heightCm":161}),
    Object.freeze({"id":"Hotaru","name":"汐见萤","aliases":["萤","Hotaru"],"filePrefix":"Hotaru","worldbookUid":107,"anchorX":0.5,"heightCm":155}),
    Object.freeze({"id":"Natsume","name":"伊泽枣","aliases":["枣","Natsume"],"filePrefix":"Natsume","worldbookUid":108,"anchorX":0.5,"heightCm":161}),
    Object.freeze({"id":"Nagi","name":"琴平凪","aliases":["凪","Nagi"],"filePrefix":"Nagi","worldbookUid":109,"anchorX":0.5,"heightCm":163}),
    Object.freeze({"id":"Mahoro","name":"滨崎茉幌","aliases":["茉幌","Mahoro"],"filePrefix":"Mahoro","worldbookUid":110,"anchorX":0.5,"heightCm":158}),
    Object.freeze({"id":"Houka","name":"和泉朋花","aliases":["朋花","Houka","Hooka"],"filePrefix":"Houka","worldbookUid":111,"anchorX":0.5,"heightCm":157}),
    Object.freeze({"id":"Yomogi","name":"矢仓蓬咲","aliases":["蓬咲","Yomogi"],"filePrefix":"Yomogi","worldbookUid":112,"anchorX":0.5,"heightCm":160}),
    Object.freeze({"id":"Chieri","name":"梅里千樱梨","aliases":["千樱梨","Chieri"],"filePrefix":"Chieri","worldbookUid":113,"anchorX":0.5,"heightCm":156}),
    Object.freeze({"id":"Shizuku","name":"四宫宁月","aliases":["宁月","Shizuku"],"filePrefix":"Shizuku","worldbookUid":114,"anchorX":0.5,"heightCm":145}),
    Object.freeze({"id":"Viola","name":"薇欧拉","aliases":["Viola"],"filePrefix":"Viola","worldbookUid":115,"anchorX":0.5,"heightCm":157}),
    Object.freeze({"id":"Kasumi","name":"户山香澄","aliases":["香澄","Kasumi","ksm"],"filePrefix":"Kasumi","worldbookUid":116,"anchorX":0.5,"heightCm":156}),
    Object.freeze({"id":"Tae","name":"花园多惠","aliases":["多惠","Tae","おたえ"],"filePrefix":"Tae","worldbookUid":117,"anchorX":0.5,"heightCm":164}),
    Object.freeze({"id":"Rimi","name":"牛込里美","aliases":["里美","Rimi","りみりん"],"filePrefix":"Rimi","worldbookUid":118,"anchorX":0.5,"heightCm":150}),
    Object.freeze({"id":"Saya","name":"山吹沙绫","aliases":["沙绫","Saya","Saaya"],"filePrefix":"Saya","worldbookUid":119,"anchorX":0.5,"heightCm":157}),
    Object.freeze({"id":"Arisa","name":"市谷有咲","aliases":["有咲","Arisa","ありさ"],"filePrefix":"Arisa","worldbookUid":120,"anchorX":0.5,"heightCm":152}),
    Object.freeze({"id":"Ran","name":"美竹兰","aliases":["兰","Ran"],"filePrefix":"Ran","worldbookUid":121,"anchorX":0.5,"heightCm":157}),
    Object.freeze({"id":"Moka","name":"青叶摩卡","aliases":["摩卡","Moca","Moka","摩卡酱"],"filePrefix":"Moca","worldbookUid":122,"anchorX":0.5,"heightCm":158}),
    Object.freeze({"id":"Himari","name":"上原绯玛丽","aliases":["绯玛丽","Himari"],"filePrefix":"Himari","worldbookUid":123,"anchorX":0.5,"heightCm":155}),
    Object.freeze({"id":"Tomoe","name":"宇田川巴","aliases":["巴","Tomoe","巴医生"],"filePrefix":"Tomoe","worldbookUid":124,"anchorX":0.5,"heightCm":168}),
    Object.freeze({"id":"Tsugumi","name":"羽泽鸫","aliases":["鸫","Tsugumi","鸫鸫"],"filePrefix":"Tsugumi","worldbookUid":125,"anchorX":0.5,"heightCm":156}),
    Object.freeze({"id":"Kokoro","name":"弦卷心","aliases":["心","Kokoro"],"filePrefix":"Kokoro","worldbookUid":126,"anchorX":0.5,"heightCm":155}),
    Object.freeze({"id":"Kaoru","name":"濑田薰","aliases":["薰","Kaoru"],"filePrefix":"Kaoru","worldbookUid":127,"anchorX":0.5,"heightCm":170}),
    Object.freeze({"id":"Hagumi","name":"北泽育美","aliases":["育美","Hagumi"],"filePrefix":"Hagumi","worldbookUid":128,"anchorX":0.5,"heightCm":152}),
    Object.freeze({"id":"Kanon","name":"松原花音","aliases":["花音","Kanon"],"filePrefix":"Kanon","worldbookUid":129,"anchorX":0.5,"heightCm":156}),
    Object.freeze({"id":"Misaki","name":"奥泽美咲","aliases":["美咲","Misaki","米歇尔","ミッシェル","Michelle"],"filePrefix":"Misaki","worldbookUid":130,"anchorX":0.5,"heightCm":157}),
    Object.freeze({"id":"Aya","name":"丸山彩","aliases":["彩","Aya","彩医生"],"filePrefix":"Aya","worldbookUid":131,"anchorX":0.5,"heightCm":156}),
    Object.freeze({"id":"Hina","name":"冰川日菜","aliases":["日菜","Hina"],"filePrefix":"Hina","worldbookUid":132,"anchorX":0.5,"heightCm":156}),
    Object.freeze({"id":"Chisato","name":"白鹭千圣","aliases":["千圣","Chisato"],"filePrefix":"Chisato","worldbookUid":133,"anchorX":0.5,"heightCm":152}),
    Object.freeze({"id":"Maya","name":"大和麻弥","aliases":["麻弥","Maya"],"filePrefix":"Maya","worldbookUid":134,"anchorX":0.5,"heightCm":161}),
    Object.freeze({"id":"Eve","name":"若宫伊芙","aliases":["伊芙","Eve"],"filePrefix":"Eve","worldbookUid":135,"anchorX":0.5,"heightCm":163}),
    Object.freeze({"id":"Yukina","name":"凑友希那","aliases":["友希那","Yukina"],"filePrefix":"Yukina","worldbookUid":136,"anchorX":0.5,"heightCm":155}),
    Object.freeze({"id":"Sayo","name":"冰川纱夜","aliases":["纱夜","Sayo"],"filePrefix":"Sayo","worldbookUid":137,"anchorX":0.5,"heightCm":161}),
    Object.freeze({"id":"Lisa","name":"今井莉莎","aliases":["莉莎","Lisa"],"filePrefix":"Lisa","worldbookUid":138,"anchorX":0.5,"heightCm":158}),
    Object.freeze({"id":"Ako","name":"宇田川亚子","aliases":["亚子","Ako"],"filePrefix":"Ako","worldbookUid":139,"anchorX":0.5,"heightCm":148}),
    Object.freeze({"id":"Rinko","name":"白金燐子","aliases":["燐子","Rinko","燐燐"],"filePrefix":"Rinko","worldbookUid":140,"anchorX":0.5,"heightCm":157}),
    Object.freeze({"id":"Mashiro","name":"仓田真白","aliases":["真白","Mashiro","小白"],"filePrefix":"Mashiro","worldbookUid":141,"anchorX":0.5,"heightCm":154}),
    Object.freeze({"id":"Touko","name":"桐谷透子","aliases":["透子","Toko","Touko"],"filePrefix":"Toko","worldbookUid":142,"anchorX":0.5,"heightCm":164}),
    Object.freeze({"id":"Nanami","name":"广町七深","aliases":["七深","Nanami"],"filePrefix":"Nanami","worldbookUid":143,"anchorX":0.5,"heightCm":157}),
    Object.freeze({"id":"Tsukushi","name":"二叶筑紫","aliases":["筑紫","Tsukushi","二助"],"filePrefix":"Tsukushi","worldbookUid":144,"anchorX":0.5,"heightCm":150}),
    Object.freeze({"id":"Rui","name":"八潮瑠唯","aliases":["瑠唯","Rui"],"filePrefix":"Rui","worldbookUid":145,"anchorX":0.5,"heightCm":169}),
    Object.freeze({"id":"Rei","name":"和奏瑞依","aliases":["瑞依","Rei","Layer","LAYER"],"filePrefix":"Rei","worldbookUid":146,"anchorX":0.5,"heightCm":172}),
    Object.freeze({"id":"Rokka","name":"朝日六花","aliases":["六花","Rokka","Lock","LOCK"],"filePrefix":"Rokka","worldbookUid":147,"anchorX":0.5,"heightCm":155}),
    Object.freeze({"id":"Masuki","name":"佐藤益木","aliases":["益木","Masuki","Masking","狂犬","MASKING"],"filePrefix":"Masuki","worldbookUid":148,"anchorX":0.5,"heightCm":170}),
    Object.freeze({"id":"Reona","name":"鳰原令王那","aliases":["令王那","Reona","Pareo","帕蕾欧","PAREO"],"filePrefix":"Reona","worldbookUid":149,"anchorX":0.5,"heightCm":162}),
    Object.freeze({"id":"Chiyu","name":"珠手知由","aliases":["知由","Chiyu","Chuchu","CHU2","CHU²"],"filePrefix":"Chiyu","worldbookUid":150,"anchorX":0.5,"heightCm":140}),
    Object.freeze({"id":"Morikawa","name":"森川柚枼","aliases":["森川柚枼","柚枼","Morikawa"],"filePrefix":"Morikawa","worldbookUid":215,"anchorX":0.5,"heightCm":160}),
    Object.freeze({"id":"LinXingye","name":"琳星夜","aliases":["琳星夜","星夜","常夜灯","LinXingye"],"filePrefix":"LinXingye","worldbookUid":216,"anchorX":0.5,"heightCm":183}),
    Object.freeze({"id":"Vesper","name":"Vesper","aliases":["Vesper","I:P","Masquerena"],"filePrefix":"Vesper","worldbookUid":217,"anchorX":0.5,"heightCm":null}),
  ]);
  for(const p of portraits){
    for(const [alias,target] of Object.entries(names))if(target===p.name||p.aliases.includes(target))names[alias]=p.name;
    for(const alias of [p.name,...p.aliases]){names[alias]=p.name;names[alias.toLowerCase()]=p.name;}
  }
  const faces=Object.freeze(["normal","smile","blush","serious","sadness","regret","shocked","constricted_pupils","cyberpsychosis"]);
  const faceAliases={default:'normal',idle:'normal',idle01:'normal',smile01:'smile',angry:'serious',angry01:'serious',cry:'sadness',cry01:'sadness',
    neutral:'normal',calm:'normal',happy:'smile',smiling:'smile',shy:'blush',embarrassed:'blush',
    sad:'sadness',crying:'sadness',panic:'shocked',panicked:'shocked',surprised:'shocked',scared:'shocked',
    rage:'constricted_pupils',furious:'constricted_pupils',disappointed:'regret',sigh:'regret',
    '默认':'normal','普通':'normal','平静':'normal','正常':'normal',
    '微笑':'smile','开心':'smile','高兴':'smile','笑':'smile',
    '脸红':'blush','害羞':'blush','羞涩':'blush','羞耻':'blush',
    '严肃':'serious','认真':'serious','生气':'serious','愤怒':'serious',
    '难过':'sadness','伤心':'sadness','悲伤':'sadness','哭泣':'sadness','哭':'sadness','委屈':'sadness',
    '遗憾':'regret','后悔':'regret','自责':'regret','懊恼':'regret','无奈':'regret','叹气':'regret','允悲':'regret','轻微悲伤':'regret',
    '惊讶':'shocked','震惊':'shocked','吃惊':'shocked','慌乱':'shocked','惊慌':'shocked','慌张':'shocked',
    '缩瞳':'constricted_pupils','瞳孔收缩':'constricted_pupils','恍惚':'constricted_pupils','失神':'constricted_pupils',
    '失神落魄':'constricted_pupils','精神冲击':'constricted_pupils','震撼':'constricted_pupils','暴怒':'constricted_pupils','精神崩溃':'constricted_pupils',
    // Old labels included ordinary breakdown: they cannot establish a cyberpsychosis episode.
    yandere_trance:'constricted_pupils','赛博精神病':'cyberpsychosis','赛博精神病发作':'cyberpsychosis'};
  const expression=value=>{const id=String(value||'normal').trim().toLowerCase().replace(/\s+/g,'_');return faces.includes(faceAliases[id]||id)?faceAliases[id]||id:'normal';};
  const battle=value=>value===true||value==='true'?true:value===false||value==='false'?false:undefined;
  const decode=text=>String(text).replace(/&(?:lt|gt|amp|quot|apos|#39|#34|#60|#62);/gi,m=>({'&lt;':'<','&gt;':'>','&amp;':'&','&quot;':'"','&apos;':"'",'&#39;':"'",'&#34;':'"','&#60;':'<','&#62;':'>'}[m.toLowerCase()]));
  const escape=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function attributes(source){
    const out=Object.create(null);
    for(const m of source.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g))out[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]);
    return out;
  }
  const attribute=(attrs,keys)=>keys.map(key=>attrs[key]?.trim()).find(Boolean);
  function mask(text,protect){
    const result=protect?new Uint8Array(protect(text).all):new Uint8Array(text.length);
    // Auxiliary sections and literal examples never become dialogue.
    const hidden=/<(think|thinking|konatan_planning~|tucao|advice|summary_format|current_event|progress|konatan_chat|disclaimer|guifan|danmu|options|htmlcontent|details|pre|code|blockquote|ztl|xuan|UpdateVariable|CityPublicContext)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi;
    for(const m of text.matchAll(hidden))result.fill(1,m.index,m.index+m[0].length);
    for(const m of text.matchAll(/^(?: {4}|\t)[^\r\n]*/gm))result.fill(1,m.index,m.index+m[0].length);
    if(!protect){
      for(const m of text.matchAll(/^ {0,3}(`{3,}|~{3,})[^\r\n]*(?:\r?\n|$)[\s\S]*?(?:^ {0,3}\1[^\r\n]*(?:\r?\n|$)|(?![\s\S]))/gm))result.fill(1,m.index,m.index+m[0].length);
      for(const m of text.matchAll(/^(?: {4}|\t| {0,3}>)[^\r\n]*/gm))result.fill(1,m.index,m.index+m[0].length);
    }
    return result;
  }
  function prepare(text,protect){
    const protectedRanges=mask(text,protect);
    // Decode only dialogue markup, not general HTML entities in the story.
    return text.replace(/&lt;(\/?(?:cxx-say|span)\b[\s\S]*?)&gt;/gi,(whole,body,offset)=>protectedRanges[offset]?whole:'<'+decode(body)+'>');
  }
  function inlineText(text,protect){
    // Flatten only familiar emphasis markup in reading copies. Never execute
    // model HTML, rewrite saved messages, or consume literal/variable examples.
    const tag=/\\?<\/?(?:em|strong|b|i|u|s|del|mark|small|sub|sup|br)(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'"<>])*>|&lt;\/?(?:em|strong|b|i|u|s|del|mark|small|sub|sup|br)(?=[\s/&])[^<>\r\n]*?&gt;/gi;
    if(!tag.test(text))return text;
    tag.lastIndex=0;
    const protectedRanges=mask(text,protect);
    for(const m of text.matchAll(/(`+)[\s\S]*?\1/g))protectedRanges.fill(1,m.index,m.index+m[0].length);
    return text.replace(tag,(whole,offset)=>protectedRanges[offset]?whole:/^<\/?br(?=[\s/>])/i.test(decode(whole.replace(/^\\/,'')))?'\n':'');
  }
  function plain(body){
    return decode(inlineText(body).replace(/\\?<\/?span\b[^>]*>/gi,'')).trim();
  }
  function thoughtBody(body){
    const raw=decode(body.trim()),html=/^\\?<(em|i)\b[^>]*>([\s\S]*?)\\?<\/\1\s*>$/i.exec(raw);
    if(html)return {text:html[2],thought:true};
    const markdown=/^([*_])(?!\1|\s)([\s\S]*?\S)\1$/.exec(raw);
    return markdown&&!markdown[2].endsWith(markdown[1])?{text:markdown[2],thought:true}:{text:body,thought:false};
  }
  function thoughtLabel(text){
    const m=/^([^<>\r\n：:]{1,40}?)(?:[（(【](?:心声|心里话|内心)[）)】])?\s*[：:]\s*([\s\S]*)$/.exec(text);
    return m&&(Object.hasOwn(names,m[1].trim())||/[（(【](?:心声|心里话|内心)[）)】]\s*[：:]/.test(m[0]))
      ?{speaker:names[m[1].trim()]||m[1].trim(),text:m[2]}:null;
  }
  function partialTag(text){
    const start=text.lastIndexOf('<');if(start<0)return null;
    const at=start>0&&text[start-1]==='\\'?start-1:start;
    const tail=text.slice(at);if(tail.includes('>'))return null;
    const match=/^\\?<\/?([a-z-]*)(?:\s[\s\S]*)?$/i.exec(tail);
    if(match&&!match[1]&&!/^\\?<\/?$/.test(tail))return null;
    return match&&['cxx-say','cxx-story','span'].some(name=>name.startsWith(match[1].toLowerCase()))?{index:at}:null;
  }
  function bareThoughts(text,protect,protectedRanges,segments){
    // A fallback for the explicitly labelled history format. Only narrative
    // envelopes qualify; never guess from a name and colon in ordinary prose.
    const literal=protect?protect(text).all:protectedRanges,ranges=[];
    const tags=/<(\/?)(cxx-story|ztl|xuan|UpdateVariable|CityPublicContext|m18-terminal|current_event|progress|advice)\b[^>]*>/gi;
    let start=null;
    for(const m of text.matchAll(tags)){
      if(literal[m.index])continue;
      if(start!==null){ranges.push([start,m.index]);start=null;}
      if(m[2].toLowerCase()==='cxx-story'&&!m[1]&&/^<cxx-story\s*>$/i.test(m[0]))start=m.index+m[0].length;
    }
    if(start!==null)ranges.push([start,text.length]);
    const line=/^ {0,3}([^<>\r\n：:【】「」『』“”‘’"'`*_[\]{}=\\]{1,40}?)【心声(?:[，,]未说出口)?】(?:【([a-z_]+)】)?[ \t]*[：:][ \t]*([^\r\n]*)/gmi;
    const found=[];
    for(const [from,to]of ranges)for(const m of text.slice(from,to).matchAll(line)){
      const at=from+m.index,end=at+m[0].length,bodyStart=end-m[3].length,name=m[1].trim(),face=(m[2]||'normal').toLowerCase();
      if(!name||!m[3].trim()||!faces.includes(face)||/[<>]/.test(m[3]))continue;
      if(/^(?:[-+•#>]|\d+[.)、．）])/.test(name)||!Object.hasOwn(names,name)&&! /^[\p{L}\p{N}·・][\p{L}\p{N}·・ .-]{0,39}$/u.test(name))continue;
      if(protectedRanges.subarray(at,bodyStart).some(Boolean)||segments.some(s=>at<s.end&&end>s.start))continue;
      found.push({start:at,end,text:plain(m[3]),speaker:names[name]||name,expression:face,kind:'thought',partial:false});
    }
    return found;
  }
  function scan(source,protect){
    const text=prepare(String(source),protect),protectedRanges=mask(text,protect),segments=[];
    const tags=/\\?<\/?(?:cxx-say|span)\b[^<>]*(?:>|$)/gi;
    let m;
    while((m=tags.exec(text))){
      if(protectedRanges[m.index]||/^\\?<\//.test(m[0]))continue;
      const opening=/^\\?<([\w-]+)\b([\s\S]*?)(>?)$/.exec(m[0]);
      if(!opening)continue;
      const kind=opening[1].toLowerCase(),attrs=attributes(opening[2]);
      const classes=(attrs.class||'').split(/\s+/).map(t=>t.replace(/^custom-/,''));
      const bubble=kind==='span'&&classes.includes('bdc');
      if(kind!=='cxx-say'&&!bubble)continue;
      if(!m[0].endsWith('>')){segments.push({start:m.index,end:text.length,text:'',speaker:null,expression:'normal',partial:true});break;}
      const bodyStart=tags.lastIndex;
      const next=/\\?<\/?(?:cxx-say|span|cxx-story|ztl|xuan|UpdateVariable|CityPublicContext|m18-terminal)\b[^<>]*(?:>|$)/gi;
      next.lastIndex=bodyStart;
      let depth=1,closeStart=text.length,end=text.length,n,complete=false;
      while((n=next.exec(text))){
        if(protectedRanges[n.index])continue;
        const part=/^\\?<(\/?)([\w-]+)/.exec(n[0]),name=part[2].toLowerCase();
        if(name!==kind){
          if(['cxx-story','ztl','xuan','updatevariable','citypubliccontext','m18-terminal'].includes(name)){closeStart=end=n.index;break;}
          continue;
        }
        if(!part[1]){
          // A fresh utterance closes an unfinished previous one.
          if(kind==='cxx-say'||depth===1&&/\bclass\s*=\s*["'][^"']*\bbdc\b/i.test(n[0])){closeStart=end=n.index;break;}
          depth++;
        }else if(--depth===0){closeStart=n.index;end=next.lastIndex;complete=true;break;}
      }
      let body=text.slice(bodyStart,closeStart);const pendingTag=partialTag(body);if(pendingTag)body=body.slice(0,pendingTag.index);
      const role=classes.find(x=>x.startsWith('bdc-')&&!['bdc-cxx','bdc-thought'].includes(x))?.slice(4);
      const label=/<span\b[^>]*class\s*=\s*["'][^"']*\b(?:custom-)?bda-speaker\b[^"']*["'][^>]*>([\s\S]*?)<\/span\s*>/i.exec(body);
      let speaker=kind==='cxx-say'?attribute(attrs,['speaker','name','who','ch']):(label?plain(label[1]).replace(/[：:]\s*$/,''):roles[role]||role||null);
      if(label)body=body.replace(label[0],'');
      body=body.replace(/<span\b[^>]*class\s*=\s*["'][^"']*\bcxx-dialogue-mode\b[^"']*["'][^>]*>[\s\S]*?<\/span\s*>/gi,'');
      speaker=speaker?(names[speaker]||names[speaker.toLowerCase()]||speaker).trim():null;
      const rawFace=kind==='cxx-say'?attribute(attrs,['expression','face','emotion','emote']):classes.find(x=>x.startsWith('bde-'))?.slice(4);
      // Flatten accidental nested decoration inside a semantic utterance.
      if(kind==='cxx-say')body=body.replace(/\\?<\/?cxx-say\b[^>]*>/gi,'');
      const thought=thoughtBody(body),isThought=attrs.kind==='thought'||classes.includes('bdc-thought')||thought.thought;
      segments.push({start:m.index,end,text:plain(thought.text),speaker,expression:expression(rawFace),partial:!complete,...(isThought?{kind:'thought'}:{}),...(complete&&battle(attrs.battle)!==undefined?{battle:battle(attrs.battle)}:{})});
      tags.lastIndex=Math.max(end,bodyStart);
    }
    segments.push(...bareThoughts(text,protect,protectedRanges,segments));
    // Izumi 0.5 uses italics for inner speech. Only explicit labels identify a
    // character; never borrow the previous speaker or infer thoughts from prose.
    const occupied=new Uint8Array(protectedRanges);
    for(const item of segments)occupied.fill(1,item.start,item.end);
    const thoughts=/\\?<(em|i)\b[^>]*>([\s\S]*?)\\?<\/\1\s*>|&lt;(em|i)\b[^<>]*?&gt;([\s\S]*?)&lt;\/\3\s*&gt;|\*(?![\s*])([^*\r\n]*?\S)\*(?!\*)|_(?![\s_])([^_\r\n]*?\S)_(?!\w|_)/gi;
    for(const item of text.matchAll(thoughts)){
      if((item[5]!==undefined||item[6]!==undefined)&&/[\w*_\\]/.test(text[item.index-1]||''))continue;
      const end=item.index+item[0].length;
      if(occupied[item.index]||occupied.subarray(item.index,end).some(Boolean)&&/<\/?(?:cxx-say|span|cxx-story|ztl|xuan|UpdateVariable)\b/i.test(item[0]))continue;
      let start=item.index,body=plain(item[2]??item[4]??item[5]??item[6]),label=thoughtLabel(body);
      if(!label){
        const line=Math.max(text.lastIndexOf('\n',start-1),text.lastIndexOf('>',start-1))+1,prefix=text.slice(line,start),found=thoughtLabel(prefix);
        if(found&&!found.text.trim()&&!occupied.subarray(line,start).some(Boolean)){start=line;label={...found,text:body};}
      }
      segments.push({start,end,text:label?label.text:body,speaker:label?.speaker||null,expression:'normal',kind:'thought',partial:false});
      occupied.fill(1,start,end);
    }
    // Suppress only the unfinished prefix of a known dialogue tag during streaming.
    const tail=partialTag(text);
    if(tail&&!protectedRanges[tail.index]&&!segments.some(x=>tail.index>=x.start&&tail.index<x.end))segments.push({start:tail.index,end:text.length,text:'',speaker:null,expression:'normal',partial:true});
    return {text,segments:segments.sort((a,b)=>a.start-b.start)};
  }
  function transform(source,render,protect){
    const result=scan(source,protect);let text=result.text;
    for(const item of result.segments.slice().reverse())text=text.slice(0,item.start)+render(item)+text.slice(item.end);
    return inlineText(text,protect);
  }
  function normalize(source,protect){
    let text=transform(source,item=>item.text?'<cxx-say speaker="'+escape(item.speaker||'')+'" expression="'+item.expression+'"'+(item.kind==='thought'?' kind="thought"':'')+(typeof item.battle==='boolean'?' battle="'+item.battle+'"':'')+'>'+escape(item.text)+'</cxx-say>':'',protect);
    // Complete only the narrative envelope in the reading copy; action tags are untouched.
    const ranges=mask(text,protect);const inserts=[];const rx=/<cxx-story\s*>/gi;let m;
    while((m=rx.exec(text))){if(ranges[m.index])continue;const rest=text.slice(rx.lastIndex);const boundary=/<\/?cxx-story\b|<(?:ztl|xuan|UpdateVariable|CityPublicContext|m18-terminal)\b/i.exec(rest);if(!boundary||!/^<\/cxx-story/i.test(boundary[0]))inserts.push(rx.lastIndex+(boundary?boundary.index:rest.length));}
    for(const at of inserts.reverse())text=text.slice(0,at)+'</cxx-story>'+text.slice(at);
    return text;
  }
  function native(source,save,protect){
    return transform(source,item=>{
      if(!item.text)return '';
      const thought=item.kind==='thought',badge=thought?'<span class="cxx-dialogue-mode">心声</span>':'';
      const name=item.speaker||(thought?'未署名':null),label=name?'<span class="bda-speaker">'+escape(name)+'：</span>':'';
      const html='<span class="bdc bdc-cxx bde-'+item.expression+(thought?' bdc-thought':'')+'">'+label+badge+escape(item.text).replace(/\r?\n/g,'<br>')+'</span>';
      return save?save(html):html;
    },protect);
  }
  function history(source,protect){
    // Outgoing history uses the same semantic tags required of new replies.
    // kind="thought" keeps inner speech distinct without teaching a second format.
    return normalize(source,protect);
  }
  return Object.freeze({scan,transform,normalize,native,history,expression,expressions:faces,portraits,battle,attributes});
});
