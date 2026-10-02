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
    let observedScroll = global.scrollY;
    let writingScroll = false;
    let wheelOrigin = null;
    let wheelOriginExpiry = 0;
    let correctionFrame = 0;
    const clamp = n => Math.max(0, Math.min(1, n));
    const duration = 2600;
    const modalOpen = () => Boolean(doc.querySelector('dialog[open]'));
    const ignoredTarget = target => Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"]'));
    const available = () => options.enabled() && !modalOpen();
    function bounds() { return options.bounds(); }
    function destinationAt(direction, y, projectedY = y) {
      if (!available()) return null;
      const b = bounds();
      if (!b) return null;
      if (y >= b.start - 2 && y <= b.end + 2) {
        if (direction > 0 && y < b.end - 2) return 1;
        if (direction < 0 && y > b.start + 2) return 0;
      }
      return options.destination?.(direction, y, projectedY) || null;
    }
    function destination(direction, distance = 0) {
      return destinationAt(direction, global.scrollY, global.scrollY + distance);
    }
    function forgetWheelOrigin() {
      global.clearTimeout(wheelOriginExpiry);
      global.cancelAnimationFrame(correctionFrame);
      correctionFrame = 0;
      wheelOrigin = null;
      observedScroll = global.scrollY;
    }
    function renewWheelOrigin() {
      global.clearTimeout(wheelOriginExpiry);
      wheelOriginExpiry = global.setTimeout(() => {
        if (running || waiting !== null) { renewWheelOrigin(); return; }
        forgetWheelOrigin();
      }, 500);
    }
    function rememberWheel(direction) {
      if (!wheelOrigin || (!running && waiting === null &&
          (wheelOrigin.direction !== direction || (wheelOrigin.claimed && !wheelTail)))) {
        wheelOrigin = {direction, claimed:false, target:null};
        observedScroll = global.scrollY;
      }
      renewWheelOrigin();
    }
    function writeScroll(position) {
      writingScroll = true;
      try { global.scrollTo({top:position, behavior:'instant'}); }
      finally { writingScroll = false; observedScroll = global.scrollY; }
    }
    function targetPosition(target) {
      return typeof target === 'number' ? bounds()[target ? 'end' : 'start'] : target.position();
    }
    function holdWheelLanding() {
      if (correctionFrame) return;
      const origin = wheelOrigin;
      correctionFrame = global.requestAnimationFrame(() => {
        correctionFrame = 0;
        if (!origin?.claimed || wheelOrigin !== origin || running || !available()) return;
        expectedScroll = waiting !== null ? expectedScroll : targetPosition(origin.target);
        writeScroll(expectedScroll);
        options.update();
      });
    }
    function claimWheel(target) {
      // If native scrolling already passed the opening's endpoint, settle at
      // that endpoint first instead of skipping a chapter or treating it as 0 travel.
      if (typeof target === 'number') {
        const edge = target ? 'end' : 'start';
        const position = bounds()[edge];
        if ((target && global.scrollY > position + 2) || (!target && global.scrollY < position - 2)) {
          target = {id:'opening-' + edge, duration:950, waitForImage:true, position:() => bounds()[edge]};
        }
      }
      wheelOrigin.claimed = true;
      wheelOrigin.target = target;
      wheelTail = true;
      wheelDirection = wheelOrigin.direction;
      start(target);
      releaseWheelAfterQuiet();
      renewWheelOrigin();
    }
    function releaseWheelAfterQuiet() {
      global.clearTimeout(wheelQuiet);
      wheelQuiet = global.setTimeout(() => {
        wheelTail = false;
        wheelDirection = 0;
      }, 220);
    }
    function cancel() {
      forgetWheelOrigin();
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
      if ((openingTransition || target.waitForImage) && !options.ready()) {
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
      // Stop any native smooth scroll already queued before we claimed this
      // wheel. Later compositor frames are handled by scroll(), not cancelled.
      if (wheelOrigin?.claimed) writeScroll(fromScroll);
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
        writeScroll(expectedScroll);
        options.update();
        if (t < 1) animation = global.requestAnimationFrame(tick);
        else {
          running = false;
          motion = null;
          options.onState?.(false);
          // Wheel-tail expiry belongs to actual input. Do not add another
          // quiet period after an animation whose initiating input is over.
          if (wheelOrigin?.claimed) renewWheelOrigin();
          touchTail = Boolean(touch);
        }
      }
      animation = global.requestAnimationFrame(tick);
    }
    function wheel(event) {
      if (event.defaultPrevented) { forgetWheelOrigin(); return; }
      if (event.ctrlKey || event.metaKey || ignoredTarget(event.target) || !available()) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || !event.deltaY) return;
      const direction = Math.sign(event.deltaY);
      rememberWheel(direction);
      if (running || waiting !== null || (wheelTail && direction === wheelDirection)) {
        if (event.cancelable !== false) event.preventDefault();
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
      // An uncancelable event still establishes provenance. Its actual scroll
      // can cross a whole corridor; the scroll handler will claim it afterward.
      if (event.cancelable === false) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? global.innerHeight : 1;
      const target = destination(direction, event.deltaY * unit);
      if (target === null) return;
      event.preventDefault();
      if (event.defaultPrevented) claimWheel(target);
    }
    function touchStart(event) {
      cancel();
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
      if (event.key === 'Tab') { cancel(); return; }
      if (event.ctrlKey || event.metaKey || event.altKey || ignoredTarget(event.target) || event.target?.closest?.('button,a') || !available()) return;
      const direction = ['ArrowDown','PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey) ? 1 : ['ArrowUp','PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 0;
      if (!direction) return;
      forgetWheelOrigin();
      if (heldKey === event.key) { event.preventDefault(); return; }
      if (running || waiting !== null) { heldKey = event.key; event.preventDefault(); return; }
      const distance = direction * (event.key.startsWith('Arrow') ? 40 : global.innerHeight * .85);
      const target = destination(direction, distance);
      if (target !== null) { heldKey = event.key; event.preventDefault(); start(target); }
    }
    function scroll() {
      const actual = global.scrollY;
      const previous = observedScroll;
      observedScroll = actual;
      if (writingScroll) return;
      if (running || waiting !== null) {
        if (Math.abs(actual - expectedScroll) > 3) {
          if (wheelOrigin?.claimed && available()) {
            // Native/compositor motion from the wheel we just claimed is not
            // an external navigation. The next animation frame restores ownership.
            renewWheelOrigin();
            if (waiting !== null) holdWheelLanding();
          } else cancel();
        }
        return;
      }
      const moved = actual - previous;
      if (!wheelOrigin || !available() || Math.abs(moved) < 1) return;
      if (Math.sign(moved) !== wheelOrigin.direction) { forgetWheelOrigin(); return; }
      renewWheelOrigin();
      if (wheelOrigin.claimed) {
        // A last native frame can arrive after our final RAF. Keep this same
        // gesture at its landing, without starting the following chapter.
        wheelTail = true;
        wheelDirection = wheelOrigin.direction;
        releaseWheelAfterQuiet();
        holdWheelLanding();
        return;
      }
      const target = destinationAt(wheelOrigin.direction, previous, actual);
      if (target !== null) claimWheel(target);
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
    global.addEventListener('popstate',cancel);
    global.addEventListener('pageshow',cancel);
    global.addEventListener('pointerdown',cancel,{capture:true});
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
        writeScroll(expectedScroll);
      },
      imageReady() { if (waiting !== null && available()) start(waiting); },
      get running() { return running || waiting !== null; }
    };
  }
  global.OpeningGesture = {create};
})(window);
