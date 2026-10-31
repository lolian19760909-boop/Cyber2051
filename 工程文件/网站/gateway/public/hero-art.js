/* Local cover manifest: only the first pair is critical. No account/i18n dependency. */
(() => {
  'use strict';
  const root = '/workshop/assets/hero-20261005/';
  const choices = Object.freeze([
    { id:'Saki', scene:'neonring_midnight2', names:['丰川祥子','Sakiko Togawa','豊川祥子'] },
    { id:'Anon', scene:'RING_midnight', names:['千早爱音','Anon Chihaya','千早愛音'] },
    { id:'Tomorin', scene:'lowtown_midnight2', names:['高松灯','Tomori Takamatsu','高松燈'] },
    { id:'Rana', scene:'RING_midnight', names:['要乐奈','Rana Kaname','要楽奈'] },
    { id:'Soyo', scene:'core_soyohouse_outside_midnight', names:['长崎素世','Soyo Nagasaki','長崎そよ'] },
    { id:'Taki', scene:'lowtown_midnight', names:['椎名立希','Taki Shiina','椎名立希'] },
    { id:'Uika', scene:'core_midnight', names:['三角初华','Uika Misumi','三角初華'] },
    { id:'Mutsumi', scene:'core_mujica_hideout_balcony', names:['若叶睦','Mutsumi Wakaba','若葉睦'] },
    { id:'Umiri', scene:'redflower_midnight', names:['八幡海铃','Umiri Yahata','八幡海鈴'] },
    { id:'Nyamu', scene:'darkpool_midnight', names:['祐天寺若麦','Nyamu Yutenji','祐天寺にゃむ'] },
  ]);
  const scenes = Object.freeze([{"id":"neonring_midnight2","names":["霓虹环带 · 夜景 02","Neon ring · Night 02","ネオン環状帯 · 夜 02"]},{"id":"neonring_midnight","names":["霓虹环带 · 夜景 01","Neon ring · Night 01","ネオン環状帯 · 夜 01"]},{"id":"neonring_morning","names":["霓虹环带 · 晨景 01","Neon ring · Morning 01","ネオン環状帯 · 朝 01"]},{"id":"neonring_morning2","names":["霓虹环带 · 晨景 02","Neon ring · Morning 02","ネオン環状帯 · 朝 02"]},{"id":"RING_midnight","names":["RiNG · 夜景","RiNG · Night","RiNG · 夜"]},{"id":"RING_morning","names":["RiNG · 晨景","RiNG · Morning","RiNG · 朝"]},{"id":"lowtown_midnight2","names":["低城 · 夜景 02","Lowtown · Night 02","下町 · 夜 02"]},{"id":"lowtown_midnight","names":["低城 · 夜景 01","Lowtown · Night 01","下町 · 夜 01"]},{"id":"lowtown_morning","names":["低城 · 晨景 01","Lowtown · Morning 01","下町 · 朝 01"]},{"id":"lowtown_morning2","names":["低城 · 晨景 02","Lowtown · Morning 02","下町 · 朝 02"]},{"id":"core_midnight","names":["核心区 · 夜景","Core district · Night","中心街 · 夜"]},{"id":"core_morning","names":["核心区 · 晨景","Core district · Morning","中心街 · 朝"]},{"id":"core_mujica_hideout_balcony","names":["核心区 · 阳台","Core district · Balcony","中心街 · バルコニー"]},{"id":"core_soyohouse_outside_midnight","names":["核心区 · 住宅外景","Core district · Residence","中心街 · 住宅外観"]},{"id":"core_soyohouse_swimpool_midnight","names":["核心区 · 泳池夜景","Core district · Pool","中心街 · プール"]},{"id":"core_Togawa_restroom_morning","names":["核心区 · 庭院晨景","Core district · Courtyard morning","中心街 · 庭の朝"]},{"id":"darkpool_midnight","names":["暗池 · 夜景","Darkpool · Night","ダークプール · 夜"]},{"id":"darkpool_morning","names":["暗池 · 晨景","Darkpool · Morning","ダークプール · 朝"]},{"id":"darkpool_backyard_midnight","names":["暗池 · 后院","Darkpool · Backyard","ダークプール · 裏庭"]},{"id":"darkpool_nyamuhouse_outside_midnight","names":["暗池 · 住宅外景","Darkpool · Residence","ダークプール · 住宅外観"]},{"id":"redflower_midnight","names":["红花街 · 夜景","Redflower · Night","紅花街 · 夜"]},{"id":"redflower_morning","names":["红花街 · 晨景","Redflower · Morning","紅花街 · 朝"]}]);
  const urls = choice => ({ person:root+'portraits/'+choice.id+'.webp', personMobile:root+'portraits/'+choice.id+'-mobile.webp', city:root+'backgrounds/'+choice.scene+'.webp', cityMobile:root+'backgrounds/'+choice.scene+'-mobile.webp' });
  const first = urls(choices[0]);
  for (const [desktop,mobile] of [[first.person,first.personMobile],[first.city,first.cityMobile]]) {
    for (const [href,media] of [[mobile,'(max-width:600px)'],[desktop,'(min-width:600.01px)']]) {
      const link=document.createElement('link'); link.rel='preload'; link.as='image'; link.href=href; link.media=media; link.fetchPriority='high';
      if(href.includes('/portraits/'))link.crossOrigin='anonymous';
      document.head.append(link);
    }
  }
  let mounted=false, current=choices[0];
  function show(choice, images=urls(choice), state='ready') {
    const hero=document.querySelector('.hero'); if(!hero)return; current=choice;
    const person=hero.querySelector('.hero-person'),city=hero.querySelector('.hero-city');
    person.closest('picture').querySelector('source').srcset=images.personMobile; person.src=images.person;
    city.closest('picture').querySelector('source').srcset=images.cityMobile; city.src=images.city;
    hero.querySelector('.hero-figure')?.style.setProperty('--portrait-mask',`url("${matchMedia('(max-width:600px)').matches?images.personMobile:images.person}")`);
    const caption=hero.querySelector('.hero-caption');
    const titles=[choice.names[1].toUpperCase()+' / '+choice.names[0],choice.names[1].toUpperCase(),choice.names[1].toUpperCase()+' / '+choice.names[2]];
    const alt=[choice.names[0]+'，项目现有赛博风格立绘',choice.names[1]+" in the project's existing cyberpunk artwork",'プロジェクト既存のサイバーパンク風の'+choice.names[2]+'の立ち絵'];
    ['zh','en','ja'].forEach((lang,i)=>{person.setAttribute('data-ui-alt-'+lang,alt[i]);caption.setAttribute('data-ui-'+lang,titles[i]);});
    const language=window.CXXI18N?.current()||document.documentElement.lang,index=language==='ja'?2:language==='en'?1:0;
    person.alt=alt[index]; caption.textContent=titles[index]; caption.hidden=false;
    hero.dataset.artCharacter=choice.id; hero.dataset.artBackground=choice.scene; hero.dataset.artState=state;
    const character=hero.querySelector('#poster-character'),background=hero.querySelector('#poster-scene');
    if(character)character.value=choice.id;if(background)background.value=choice.scene;
    document.dispatchEvent(new CustomEvent('cxx-poster-changed'));
  }
  function mount() {
    if(mounted||!document.querySelector('.hero'))return; mounted=true;
    const hero=document.querySelector('.hero'),person=hero.querySelector('.hero-person'),city=hero.querySelector('.hero-city');
    function recover(event) {
      if(!event.target.complete||event.target.naturalWidth||hero.dataset.artState==='unavailable')return;
      if(hero.dataset.artState==='fallback') {
        [person,city].forEach(image=>{image.closest('picture').querySelector('source').removeAttribute('srcset');image.removeAttribute('src');});
        hero.querySelector('.hero-caption').hidden=true; hero.dataset.artState='unavailable'; document.dispatchEvent(new CustomEvent('cxx-poster-changed')); return;
      }
      show(choices[0],{person:'/workshop/assets/site-20261005/sakiko.webp',personMobile:'/workshop/assets/site-20261005/sakiko-mobile.webp',city:'/workshop/assets/site-20261005/city-night.webp',cityMobile:'/workshop/assets/site-20261005/city-night-mobile.webp'},'fallback');
    }
    person.addEventListener('error',recover);city.addEventListener('error',recover);
    person.addEventListener('load',()=>hero.querySelector('.hero-figure')?.style.setProperty('--portrait-mask',`url("${person.currentSrc||person.src}")`));
    const logo=hero.querySelector('.hero-wordmark');
    function logoFallback(){logo.hidden=true;hero.querySelector('.wordmark-fallback').hidden=false;}
    logo.addEventListener('error',logoFallback);
    if(logo.complete&&!logo.naturalWidth)logoFallback();
    show(choices[0]);
    for(const image of [person,city])if(image.complete&&!image.naturalWidth)recover({target:image});
  }
  window.CXXHeroArt=Object.freeze({mount,choices,scenes,urls,show,current:()=>current});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
