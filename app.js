'use strict';
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const opening = document.querySelector('.opening');
  const stage = document.querySelector('.opening-stage');
  const heroImage = document.getElementById('hero-image');
  const art = document.getElementById('hero-art');
  const artButton = art.querySelector('button');
  const heroCopy = document.querySelector('.hero-copy');
  const story = document.querySelector('.hero-story');
  const header = document.getElementById('site-header');
  const rail = document.querySelector('.chapter-rail');
  const canvas = document.getElementById('paper-cover');
  const skip = document.getElementById('skip-paper');
  const replay = document.getElementById('replay-intro');
  const cue = document.getElementById('opening-cue');
  const chapters = ['opening', 'collection', 'dusk', 'human'].map(id => document.getElementById(id));
  const chapterLinks = Array.from(rail.querySelectorAll('a'));
  const paperSections = [chapters[1], chapters[3]];
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  const mix = (a, b, p) => a + (b - a) * p;
  let queued = false;
  let dimensions;
  let renderer = null;
  let imageReady = false;
  let imageFailed = false;
  let activeMotion = false;
  let gesture = null;

  root.classList.add('js');
  function syncMode() {
    activeMotion = !imageFailed && !reduced.matches;
    if (!activeMotion) gesture?.cancel();
    root.classList.toggle('motion-ready', !reduced.matches);
    root.classList.toggle('paper-scroll-ready', activeMotion);
    root.classList.toggle('paper-image-error', imageFailed);
    canvas.hidden = !activeMotion;
    measure();
  }
  function measure() {
    const wasAtStory = activeMotion && dimensions && Math.abs(window.scrollY - dimensions.top - dimensions.distance) < 3;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const ratio = 4070 / 3214;
    const small = w <= 700;
    const endH = small ? Math.min(w * .84 / ratio, h * .35) : Math.min(w * .58 / ratio, h * (h <= 500 ? .55 : .64));
    const endW = endH * ratio;
    dimensions = {
      w, h, endW, endH,
      endX: small ? (w - endW) / 2 : w * .946 - endW,
      endY: small ? Math.max(h * .48, Math.min(285, h * .48)) : h * .175,
      distance: Math.max(1, opening.offsetHeight - h),
      top: opening.offsetTop
    };
    renderer?.resize(w, h);
    if (gesture?.running) gesture.resize();
    else if (wasAtStory) window.scrollTo({top:dimensions.top + dimensions.distance, behavior:'instant'});
    updateScroll();
  }
  function updateScroll() {
    queued = false;
    if (!dimensions) return;
    const {w, h, endW, endH, endX, endY, distance, top} = dimensions;
    const p = activeMotion ? clamp((window.scrollY - top) / distance) : 1;
    const reveal = imageReady ? smooth((p - .015) / .61) : 0;
    const frame = activeMotion ? smooth((p - .69) / .25) : 1;
    const copy = activeMotion ? 1 - smooth((p - .045) / .20) : 1;
    const storyIn = activeMotion ? smooth((p - .81) / .13) : 0;
    stage.style.setProperty('--paper-copy-opacity', copy.toFixed(4));
    stage.style.setProperty('--paper-copy-y', `${-18 * (1 - copy)}px`);
    stage.style.setProperty('--paper-story-opacity', storyIn.toFixed(4));
    stage.style.setProperty('--paper-story-y', `${16 * (1 - storyIn)}px`);
    stage.style.setProperty('--paper-caption-opacity', frame.toFixed(4));
    stage.style.setProperty('--paper-frame-shadow', (frame * .17).toFixed(4));
    art.style.left = `${mix(0, endX, frame)}px`;
    art.style.top = `${mix(0, endY, frame)}px`;
    art.style.width = `${mix(w, endW, frame)}px`;
    art.style.height = `${mix(h, endH, frame)}px`;
    heroCopy.setAttribute('aria-hidden', String(copy < .05));
    story.setAttribute('aria-hidden', String(storyIn < .05));
    // The covered painting must not receive invisible keyboard focus.
    const artAvailable = !activeMotion || (reveal > .98 && frame > .98);
    artButton.inert = !artAvailable;
    artButton.tabIndex = artAvailable ? 0 : -1;
    artButton.setAttribute('aria-hidden', String(!artAvailable));
    if (renderer && activeMotion) renderer.setProgress(reveal);
    else canvas.style.opacity = String(1 - reveal);
    replay.hidden = !activeMotion || p < .93;
    skip.hidden = !activeMotion || p >= .93;
    cue.textContent = gesture?.running ? '秋色，正在展开' : activeMotion && p < .65 ? '轻滚一下，揭开秋色' : '沿着秋色，往下走';
    const overPainting = activeMotion && p > .26 && p < .83 && window.scrollY < top + distance + h * .1;
    stage.classList.toggle('over-painting', overPainting);
    header.classList.toggle('over-painting', overPainting);
    header.classList.toggle('scrolled', window.scrollY > 50);
    const inPaper = paperSections.some(el => {
      const r = el.getBoundingClientRect();
      return r.top < header.offsetHeight * .65 && r.bottom > header.offsetHeight * .65;
    });
    header.classList.toggle('paper', !overPainting && (window.scrollY < top + distance + h || inPaper));
    rail.classList.toggle('paper', !overPainting && (window.scrollY < top + distance + h || paperSections.some(el => {
      const r = el.getBoundingClientRect(); return r.top < innerHeight / 2 && r.bottom > innerHeight / 2;
    })));
    let active = 0;
    chapters.forEach((el, i) => { if (el.getBoundingClientRect().top < innerHeight * .45) active = i; });
    chapterLinks.forEach((el, i) => {
      el.classList.toggle('current', active === i);
      if (active === i) el.setAttribute('aria-current', 'location');
      else el.removeAttribute('aria-current');
    });
  }
  function queueScroll() {
    if (!queued) { queued = true; requestAnimationFrame(updateScroll); }
  }
  // Each gesture completes at most one transition; tall artwork groups remain scrollable.
  window.addEventListener('scroll', queueScroll, {passive:true});
  window.addEventListener('resize', measure);
  window.addEventListener('pageshow', measure);
  reduced.addEventListener('change', syncMode);
  skip.addEventListener('click', () => {
    gesture?.cancel();
    window.scrollTo({top:dimensions.top + dimensions.distance, behavior:'instant'});
    updateScroll();
    artButton.focus({preventScroll:true});
  });
  replay.addEventListener('click', () => {
    gesture?.cancel();
    window.scrollTo({top:0, behavior:'instant'});
    updateScroll();
    skip.focus({preventScroll:true});
  });
  const paintNodes = document.querySelectorAll('.painting, .reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
      });
    }, {threshold:.08, rootMargin:'0px 0px -25px 0px'});
    paintNodes.forEach(el => observer.observe(el));
  } else paintNodes.forEach(el => el.classList.add('in-view'));
  try { renderer = window.PaperReveal?.create(canvas, {textureUrl:'assets/aged-paper.webp'}); } catch (_) { /* A translucent paper fallback still permits scrolling. */ }
  function imageLoaded() { imageReady = true; imageFailed = false; syncMode(); gesture?.imageReady(); }
  heroImage.addEventListener('load', imageLoaded, {once:true});
  heroImage.addEventListener('error', () => { imageFailed = true; syncMode(); }, {once:true});
  if (heroImage.complete && heroImage.naturalWidth) imageReady = true;
  syncMode();
  const chapterStops = window.ChapterStops?.create({header,opening,stage});
  gesture = window.OpeningGesture?.create({
    enabled: () => activeMotion,
    ready: () => imageReady,
    bounds: () => ({start:dimensions.top, end:dimensions.top + dimensions.distance}),
    update: updateScroll,
    destination: (direction, y) => chapterStops?.destination(direction, y),
    onState: queueScroll
  });

  // A native dialog keeps keyboard focus within the artwork viewer.
  const artworks = [
    ['秋色入画', '金黄色枝叶与湖面倒影，两只小舟及通向树林的石拱桥。', 4070, 3214],
    ['窗前花信', '深色几何窗框前，粉白繁花与枝干相互交织。', 1214, 957],
    ['荷间清夏', '粉白荷花、大片绿荷叶与水面上的鸭子，远处是低山和天空。', 798, 986],
    ['花野漫游', '橙红色花田、细高树木与红顶建筑，背景是蓝天白云。', 3244, 2595],
    ['林深水静', '树林中的临水木屋与水面倒影，近处有岩石和粉色花朵。', 4949, 3968],
    ['帆影与暮光', '灰紫色天空与橙金色地平线之下，一艘帆船停留在水面。', 1673, 1096],
    ['毕业舞会', '画中记录了女儿在邮轮上参加毕业舞会的时刻，身着长裙的人物与水面相映。', 3091, 2326],
    ['扇底静时', '穿花鸟纹上衣与浅绿长裙的人物手持圆扇，赤足站在木质家具前。', 2263, 4604],
    ['城市余光', '城市高楼间的黑色轿车与黄色出租车，湿亮街面映出彩色光线。', 3629, 4876]
  ];
  const dialog = document.getElementById('art-dialog');
  const viewerImage = document.getElementById('viewer-image');
  const viewerWrap = document.querySelector('.viewer-image-wrap');
  const viewerStatus = document.getElementById('viewer-status');
  let currentArt = 0;
  let bodyOverflow = '';
  let lastTrigger;
  function showArt(index) {
    currentArt = (index + artworks.length) % artworks.length;
    const [title, alt, width, height] = artworks[currentArt];
    document.getElementById('viewer-title').textContent = title;
    document.getElementById('viewer-count').textContent = `作品 ${String(currentArt + 1).padStart(2, '0')} / 09`;
    document.querySelector('.viewer-note').textContent = currentArt === 6 ? '女儿在邮轮上的毕业舞会' : '题签为观画文字';
    viewerImage.alt = alt;
    viewerImage.width = width;
    viewerImage.height = height;
    viewerWrap.classList.add('loading');
    viewerStatus.textContent = '正在载入画作…';
    viewerImage.src = `assets/work-${currentArt + 1}.webp`;
    if (viewerImage.complete && viewerImage.naturalWidth > 0) {
      viewerWrap.classList.remove('loading');
      viewerStatus.textContent = '';
    }
  }
  viewerImage.addEventListener('load', () => { viewerWrap.classList.remove('loading'); viewerStatus.textContent = ''; });
  viewerImage.addEventListener('error', () => { viewerWrap.classList.remove('loading'); viewerStatus.textContent = '这幅画暂时无法载入，请稍后重新打开。'; });
  document.querySelectorAll('[data-art]').forEach(button => button.addEventListener('click', () => {
    lastTrigger = button;
    showArt(Number(button.dataset.art) - 1);
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    document.getElementById('viewer-close').focus();
  }));
  document.getElementById('viewer-close').addEventListener('click', () => dialog.close());
  document.getElementById('viewer-prev').addEventListener('click', () => showArt(currentArt - 1));
  document.getElementById('viewer-next').addEventListener('click', () => showArt(currentArt + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showArt(currentArt - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showArt(currentArt + 1); }
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = bodyOverflow;
    lastTrigger?.focus({ preventScroll: true });
  });
  document.querySelectorAll('.art-button img').forEach(img => img.addEventListener('error', () => img.parentElement.classList.add('image-error')));
})();
