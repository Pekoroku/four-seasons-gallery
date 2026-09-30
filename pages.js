'use strict';
(() => {
  const aboutPage = document.body.classList.contains('about-page');
  const header = document.querySelector('.site-header');
  let language = 'zh';
  const dictionary = {
    zh:{close:'关闭 ×',zoom:'放大细节',fit:'恢复全幅',previous:'上一幅',next:'下一幅',loading:'正在载入…',error:'图片暂时无法载入，请稍后重新打开。',editorial:'题签为画面描述，并非作品原名。',archive:'照片与资料',photoNote:'展览、收藏与创作记录。',works:'作品'},
    en:{close:'Close ×',zoom:'Zoom in',fit:'Fit to view',previous:'Previous',next:'Next',loading:'Loading…',error:'This image could not be loaded. Please try again.',editorial:'Descriptive captions, not official artwork titles.',archive:'PHOTOGRAPHS & ARCHIVE',photoNote:'Exhibitions, collections and studio life.',works:'Work'}
  };
  function setLanguage(next, remember=true) {
    language = next === 'en' ? 'en' : 'zh';
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-zh][data-en]').forEach(el => el.textContent = el.dataset[language]);
    document.querySelectorAll('[data-zh-alt]').forEach(el => el.alt = el.dataset[language === 'en' ? 'enAlt' : 'zhAlt']);
    document.querySelectorAll('[data-archive]').forEach(link => {
      const item = window.ART_ARCHIVE.find(row => row.id === link.dataset.archive);
      if(item) { link.setAttribute('aria-label',language==='en'?`View: ${item.titleEn}`:`查看：${item.title}`); const image=link.querySelector('img'); if(image) image.alt=language==='en'?item.altEn:item.alt; }
    });
    document.querySelector('.wordmark').setAttribute('aria-label',language==='en'?'Jiang Qiao Yan, return to the homepage':'Jiang Qiao Yan，回到首页');
    document.querySelector('nav').setAttribute('aria-label',language==='en'?'Main navigation':'主要导航');
    document.querySelectorAll('[data-language]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.language === language)));
    document.title = language === 'en' ? 'About Qiaoyan Jiang · Between the Seasons' : '关于蒋巧艳 · 四时之间';
    if (remember) { try { localStorage.setItem('qiaoyan-about-language',language); } catch (_) {} }
    document.dispatchEvent(new CustomEvent('gallery-language'));
  }
  if (aboutPage) {
    let initial = 'zh';
    try { initial = new URLSearchParams(location.search).get('lang') || localStorage.getItem('qiaoyan-about-language') || 'zh'; } catch (_) {}
    setLanguage(initial,false);
    document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
  }
  let scrollQueued=false;
  function updatePage() {
    scrollQueued=false;
    header.classList.toggle('scrolled',scrollY>40);
    if(aboutPage) {
      const paper=[...document.querySelectorAll('.paper-section')].some(el=>{const r=el.getBoundingClientRect();return r.top<45&&r.bottom>45;});
      header.classList.toggle('paper',paper);
    }
    const sections=[...document.querySelectorAll('.catalog-section')];
    if(sections.length) {
      let selected=sections[0].id;
      const scrollPadding=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;
      sections.forEach(el=>{
        const anchorOffset=scrollPadding+(parseFloat(getComputedStyle(el).scrollMarginTop)||0);
        if(el.getBoundingClientRect().top<=anchorOffset+2)selected=el.id;
      });
      document.querySelectorAll('[data-category]').forEach(el=>{
        const active=el.dataset.category===selected;
        el.classList.toggle('current',active);
        if(active)el.setAttribute('aria-current','location');else el.removeAttribute('aria-current');
      });
    }
  }
  addEventListener('scroll',()=>{if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updatePage);}}, {passive:true});
  updatePage();

  const dialog=document.getElementById('detail-dialog');
  const picture=document.getElementById('detail-image');
  const viewport=document.getElementById('detail-canvas');
  const zoomButton=document.getElementById('detail-zoom');
  const closeButton=document.getElementById('detail-close');
  const status=document.getElementById('detail-status');
  let items=[],index=0,isArchive=false,zoomed=false,lastTrigger=null,oldOverflow='',drag=null;

  function applyLabels() {
    const t=dictionary[language];
    closeButton.textContent=t.close;
    closeButton.setAttribute('aria-label',language==='en'?'Close image':'关闭大图');
    zoomButton.textContent=zoomed?t.fit:t.zoom;
    zoomButton.setAttribute('aria-pressed',String(zoomed));
    document.getElementById('detail-prev').setAttribute('aria-label',t.previous);
    document.getElementById('detail-next').setAttribute('aria-label',t.next);
  }
  function resetZoom() {
    zoomed=false;viewport.classList.remove('zoomed','dragging');picture.style.width='';picture.style.height='';viewport.scrollLeft=0;viewport.scrollTop=0;applyLabels();
  }
  function updateQuery(id) {
    try {const url=new URL(location.href);if(id)url.searchParams.set('work',id);else url.searchParams.delete('work');history.replaceState(null,'',url);}catch(_){}
  }
  function render(indexValue) {
    index=(indexValue+items.length)%items.length;
    const item=items[index],t=dictionary[language];
    resetZoom();
    document.getElementById('detail-title').textContent=language==='en'&&item.titleEn?item.titleEn:item.title;
    document.getElementById('detail-description').textContent=language==='en'&&item.altEn?item.altEn:item.alt;
    document.getElementById('detail-category').textContent=isArchive?t.archive:`${item.categoryLabel} / ${item.medium}`;
    document.getElementById('detail-editorial').textContent=isArchive?t.photoNote:t.editorial;
    document.getElementById('detail-count').textContent=`${String(index+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;
    picture.alt=language==='en'&&item.altEn?item.altEn:item.alt;
    picture.width=item.width;picture.height=item.height;
    viewport.classList.add('loading');status.textContent=t.loading;
    picture.src=item.src;
    if(picture.complete&&picture.naturalWidth){viewport.classList.remove('loading');status.textContent='';}
    updateQuery(item.id);
  }
  function openWork(id,archive,trigger) {
    const source=archive?window.ART_ARCHIVE:window.ART_CATALOG;
    const item=source.find(row=>row.id===id);if(!item)return;
    isArchive=archive;items=archive?source:source.filter(row=>row.category===item.category);
    lastTrigger=trigger;
    render(items.findIndex(row=>row.id===id));
    oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    dialog.showModal();closeButton.focus();
  }
  document.querySelectorAll('[data-catalog],[data-archive]').forEach(link=>link.addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();openWork(link.dataset.catalog||link.dataset.archive,Boolean(link.dataset.archive),link);
  }));
  picture.addEventListener('load',()=>{viewport.classList.remove('loading');status.textContent='';});
  picture.addEventListener('error',()=>{viewport.classList.remove('loading');status.textContent=dictionary[language].error;});
  closeButton.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.body.style.overflow=oldOverflow;resetZoom();updateQuery(null);lastTrigger?.focus({preventScroll:true});});
  document.getElementById('detail-prev').addEventListener('click',()=>render(index-1));
  document.getElementById('detail-next').addEventListener('click',()=>render(index+1));
  zoomButton.addEventListener('click',()=>{
    if(zoomed){resetZoom();return;}
    if(!picture.naturalWidth)return;
    const fit=Math.min((viewport.clientWidth-48)/picture.naturalWidth,(viewport.clientHeight-48)/picture.naturalHeight,1);
    const factor=Math.min(fit*2.2,1.5);
    zoomed=true;viewport.classList.add('zoomed');
    picture.style.width=`${Math.round(picture.naturalWidth*factor)}px`;picture.style.height=`${Math.round(picture.naturalHeight*factor)}px`;
    viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)/2;viewport.scrollTop=(viewport.scrollHeight-viewport.clientHeight)/2;applyLabels();
  });
  viewport.addEventListener('pointerdown',event=>{
    if(!zoomed||event.pointerType==='touch'||event.button!==0)return;
    drag={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(event.pointerId);viewport.classList.add('dragging');event.preventDefault();
  });
  viewport.addEventListener('pointermove',event=>{if(!drag)return;viewport.scrollLeft=drag.left+drag.x-event.clientX;viewport.scrollTop=drag.top+drag.y-event.clientY;});
  const endDrag=()=>{drag=null;viewport.classList.remove('dragging');};
  viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',endDrag);
  dialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'&&!zoomed){event.preventDefault();render(index-1);}
    if(event.key==='ArrowRight'&&!zoomed){event.preventDefault();render(index+1);}
    if(event.key==='+'||event.key==='='||event.key==='-'){event.preventDefault();zoomButton.click();}
  });
  addEventListener('resize',()=>{if(zoomed)resetZoom();updatePage();});
  document.addEventListener('gallery-language',()=>{applyLabels();if(dialog.open)render(index);});
  applyLabels();
  const requested=new URLSearchParams(location.search).get('work');
  if(requested){const archive=requested.startsWith('about-');openWork(requested,archive,null);}
})();
