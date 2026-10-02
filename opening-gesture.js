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
    let wheelDirection = 0;
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
    function destination(direction, distance = 0) {
      if (!available()) return null;
      const b = bounds();
      const y = global.scrollY;
      if (!b) return null;
      if (y >= b.start - 2 && y <= b.end + 2) {
        if (direction > 0 && y < b.end - 2) return 1;
        if (direction < 0 && y > b.start + 2) return 0;
      }
      return options.destination?.(direction, y, y + distance) || null;
    }
    function releaseWheelAfterQuiet() {
      global.clearTimeout(wheelQuiet);
      wheelQuiet = global.setTimeout(() => {
        wheelTail = false;
        wheelDirection = 0;
      }, 220);
    }
    function cancel() {
      global.cancelAnimationFrame(animation);
      global.clearTimeout(wheelQuiet);
      running = false;
      motion = null;
      waiting = null;
      wheelTail = false;
      wheelDirection = 0;
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
          // Wheel-tail expiry belongs to actual input. Do not add another
          // quiet period after an animation whose initiating input is over.
          touchTail = Boolean(touch);
        }
      }
      animation = global.requestAnimationFrame(tick);
    }
    function wheel(event) {
      // Some browsers make later wheel events non-cancelable. Starting our
      // animation then would race native scrolling and immediately cancel it.
      if (event.defaultPrevented || event.cancelable === false) return;
      if (event.ctrlKey || event.metaKey || ignoredTarget(event.target) || !available()) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || !event.deltaY) return;
      const direction = Math.sign(event.deltaY);
      if (running || waiting !== null || (wheelTail && direction === wheelDirection)) {
        event.preventDefault();
        wheelTail = true;
        wheelDirection = direction;
        releaseWheelAfterQuiet();
        return;
      }
      // An explicit reversal after a completed transition is a new intent,
      // even if the previous direction's inertia has not timed out yet.
      if (wheelTail) {
        wheelTail = false;
        global.clearTimeout(wheelQuiet);
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? global.innerHeight : 1;
      const target = destination(direction, event.deltaY * unit);
      if (target === null) return;
      event.preventDefault();
      wheelTail = true;
      wheelDirection = direction;
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
      const distance = direction * (event.key.startsWith('Arrow') ? 40 : global.innerHeight * .85);
      const target = destination(direction, distance);
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
