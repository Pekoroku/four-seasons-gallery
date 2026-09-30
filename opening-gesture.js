/* One deliberate gesture plays one complete chapter transition. */
(function (global) {
  'use strict';
  function create(options) {
    const doc = global.document;
    let animation = 0;
    let running = false;
    let waiting = null;
    let expectedScroll = global.scrollY;
    let wheelTail = false;
    let nativeWheel = false;
    let wheelQuiet = 0;
    let touch = null;
    let touchTail = false;
    let heldKey = null;
    let currentProgress = 0;
    let motion = null;
    const clamp = n => Math.max(0, Math.min(1, n));
    const duration = 2600;
    const modalOpen = () => Boolean(doc.querySelector('dialog[open]'));
    const ignoredTarget = target => Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"]'));
    const available = () => options.enabled() && !modalOpen();
    function bounds() { return options.bounds(); }
    function destination(direction) {
      if (!available()) return null;
      const b = bounds();
      const y = global.scrollY;
      if (!b) return null;
      if (y >= b.start - 2 && y <= b.end + 2) {
        if (direction > 0 && y < b.end - 2) return 1;
        if (direction < 0 && y > b.start + 2) return 0;
      }
      return options.destination?.(direction, y) || null;
    }
    function releaseWheelAfterQuiet() {
      global.clearTimeout(wheelQuiet);
      wheelQuiet = global.setTimeout(() => {
        nativeWheel = false;
        if (!running && waiting === null) wheelTail = false;
      }, 220);
    }
    function cancel() {
      global.cancelAnimationFrame(animation);
      global.clearTimeout(wheelQuiet);
      running = false;
      motion = null;
      waiting = null;
      wheelTail = false;
      nativeWheel = false;
      touchTail = false;
      touch = null;
      heldKey = null;
      options.onState?.(false);
    }
    function start(target) {
      if (!available()) return;
      const openingTransition = typeof target === 'number';
      if (openingTransition && !options.ready()) {
        waiting = target;
        expectedScroll = global.scrollY;
        options.onState?.(true);
        return;
      }
      waiting = null;
      const b = bounds();
      const from = clamp((global.scrollY - b.start) / (b.end - b.start));
      currentProgress = from;
      const fromScroll = global.scrollY;
      const travel = openingTransition ? Math.abs(target - from) : 1;
      if (travel < .001) return;
      if (!openingTransition && Math.abs(target.position() - fromScroll) < 2) return;
      running = true;
      motion = {target, from, fromScroll, phase:0, openingTransition};
      expectedScroll = global.scrollY;
      options.onState?.(true);
      let began;
      // Visual sub-stages already use smooth easing. Keeping this clock linear
      // avoids squeezing the burn and text changes into abrupt double easing.
      function tick(now) {
        if (!running) return;
        if (!available()) { cancel(); return; }
        if (began === undefined) began = now;
        const t = clamp((now - began) / (openingTransition ? Math.max(450, duration * travel) : target.duration || 950));
        motion.phase = t;
        const current = bounds();
        if (openingTransition) {
          const p = from + (target - from) * t;
          currentProgress = p;
          expectedScroll = current.start + (current.end - current.start) * p;
        } else {
          const eased = t * t * (3 - 2 * t);
          expectedScroll = fromScroll + (target.position() - fromScroll) * eased;
        }
        global.scrollTo({top:expectedScroll, behavior:'instant'});
        options.update();
        if (t < 1) animation = global.requestAnimationFrame(tick);
        else {
          running = false;
          motion = null;
          options.onState?.(false);
          // Consume the initiating gesture's tail, but a later fresh gesture
          // resumes ordinary scrolling after this short quiet interval.
          releaseWheelAfterQuiet();
          touchTail = Boolean(touch);
        }
      }
      animation = global.requestAnimationFrame(tick);
    }
    function wheel(event) {
      if (event.ctrlKey || event.metaKey || ignoredTarget(event.target) || !available()) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || !event.deltaY) return;
      if (running || waiting !== null || wheelTail) {
        event.preventDefault();
        wheelTail = true;
        releaseWheelAfterQuiet();
        return;
      }
      // A reading gesture stays native even when its inertia reaches the next
      // chapter boundary. Only a fresh gesture can initiate that transition.
      if (nativeWheel) { releaseWheelAfterQuiet(); return; }
      const target = destination(Math.sign(event.deltaY));
      if (target === null) { nativeWheel = true; releaseWheelAfterQuiet(); return; }
      event.preventDefault();
      wheelTail = true;
      start(target);
      releaseWheelAfterQuiet();
    }
    function touchStart(event) {
      touch = null;
      touchTail = false;
      if (event.touches.length !== 1 || !available() || ignoredTarget(event.target)) return;
      const point = event.touches[0];
      touch = {x:point.clientX, y:point.clientY, triggered:false, native:false};
    }
    function touchMove(event) {
      // Never capture pinch zoom or two-finger interaction.
      if (event.touches.length !== 1 || !touch || !available()) return;
      const point = event.touches[0];
      const dx = point.clientX - touch.x;
      const dy = touch.y - point.clientY;
      if (running || waiting !== null || touch.triggered || touchTail) {
        if (event.cancelable) event.preventDefault();
        return;
      }
      if (touch.native) return;
      if (Math.abs(dy) <= Math.abs(dx)) {
        if (Math.abs(dx) >= 8) touch.native = true;
        return;
      }
      if (!event.cancelable) { touch.native = true; return; }
      const target = destination(Math.sign(dy));
      if (target === null) { touch.native = true; return; }
      // Stop native inertia on the first vertical move, before the threshold
      // commits this swipe to a complete transition.
      if (event.cancelable) event.preventDefault();
      if (Math.abs(dy) < 12) return;
      touch.triggered = true;
      start(target);
    }
    function touchEnd(event) {
      if (event.touches.length) return;
      touch = null;
      touchTail = false;
    }
    function keyDown(event) {
      if (event.key === 'Escape') { cancel(); return; }
      if (event.key === 'Home' || event.key === 'End') { cancel(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey || ignoredTarget(event.target) || event.target?.closest?.('button,a') || !available()) return;
      const direction = ['ArrowDown','PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey) ? 1 : ['ArrowUp','PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 0;
      if (!direction) return;
      if (heldKey === event.key) { event.preventDefault(); return; }
      if (running || waiting !== null) { heldKey = event.key; event.preventDefault(); return; }
      const target = destination(direction);
      if (target !== null) { heldKey = event.key; event.preventDefault(); start(target); }
    }
    function scroll() {
      // Anchor navigation, scrollbar dragging, Home/End, and browser restore
      // may move the page independently; never fight those actions.
      if ((running || waiting !== null) && Math.abs(global.scrollY - expectedScroll) > 3) cancel();
    }
    global.addEventListener('wheel',wheel,{passive:false});
    global.addEventListener('touchstart',touchStart,{passive:true});
    global.addEventListener('touchmove',touchMove,{passive:false});
    global.addEventListener('touchend',touchEnd,{passive:true});
    global.addEventListener('touchcancel',touchEnd,{passive:true});
    global.addEventListener('keydown',keyDown);
    global.addEventListener('keyup', event => { if (heldKey === event.key) heldKey = null; });
    global.addEventListener('blur', () => { heldKey = null; });
    global.addEventListener('scroll',scroll,{passive:true});
    global.addEventListener('pagehide',cancel);
    global.addEventListener('hashchange',cancel);
    doc.addEventListener('click',event => { if (event.target?.closest?.('a,[data-art]')) cancel(); });
    return {
      cancel,
      resize() {
        if (!running || !motion) return;
        if (motion.openingTransition) {
          const b = bounds();
          expectedScroll = b.start + (b.end - b.start) * currentProgress;
        } else {
          const eased = motion.phase * motion.phase * (3 - 2 * motion.phase);
          expectedScroll = motion.fromScroll + (motion.target.position() - motion.fromScroll) * eased;
        }
        global.scrollTo({top:expectedScroll, behavior:'instant'});
      },
      imageReady() { if (waiting !== null && available()) start(waiting); },
      get running() { return running || waiting !== null; }
    };
  }
  global.OpeningGesture = {create};
})(window);
