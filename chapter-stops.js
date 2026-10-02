/* Plan chapter stops without listening for, consuming, or initiating gestures. */
(function (global) {
  'use strict';
  function create(options) {
    options = options || {};
    const doc = global.document;
    const tolerance = 2;
    const bottomSpace = 90;
    const headerSpace = 28;

    function height(node) {
      if (!node || node.isConnected === false) return null;
      const value = Number(node.offsetHeight);
      return Number.isFinite(value) && value > 0 ? value : null;
    }
    function top(node) {
      if (!node || node.isConnected === false) return null;
      let value = 0;
      // Layout offsets deliberately exclude the reveal elements' translateY.
      for (let current = node; current; current = current.offsetParent) {
        if (!Number.isFinite(Number(current.offsetTop))) return null;
        value += Number(current.offsetTop);
      }
      return value;
    }
    function box(node) {
      const y = top(node), h = height(node);
      return y === null || h === null ? null : {top:y, bottom:y + h};
    }
    function layout() {
      const opening = box(options.opening);
      const stageHeight = height(options.stage);
      const headerHeight = height(options.header);
      const viewport = Number(global.innerHeight) || Number(doc.documentElement?.clientHeight);
      if (!opening || !stageHeight || !headerHeight || !Number.isFinite(viewport) || viewport <= 0) return null;
      const scrollHeight = Number((doc.scrollingElement || doc.documentElement)?.scrollHeight);
      const inset = headerHeight + headerSpace;
      const collectionNode = doc.querySelector('#collection');
      const collection = box(collectionNode);
      const heading = box(collectionNode?.querySelector('.section-heading'));
      const landscapes = box(collectionNode?.querySelector('.landscape-grid'));
      const ending = box(collectionNode?.querySelector('.section-end'));
      const duskNode = doc.querySelector('#dusk');
      const dusk = box(duskNode);
      const duskHeading = box(duskNode?.querySelector('.dusk-heading') || duskNode);
      const duskArt = box(duskNode?.querySelector('.dusk-art'));
      const duskQuote = box(duskNode?.querySelector('.dusk-english'));
      const humanNode = doc.querySelector('#human');
      const human = box(humanNode?.querySelector('.section-heading') || humanNode);
      return {
        viewport,
        maxScroll:Number.isFinite(scrollHeight) ? Math.max(0, scrollHeight - viewport) : Infinity,
        story:opening.bottom - stageHeight,
        // The entire flower/landscape exhibition is one chapter. Its internal
        // grids never create destinations, in either scrolling direction.
        bloom:collection && heading ? {
          start:Math.max(0, heading.top - inset),
          end:Math.max(landscapes?.bottom || 0, ending?.bottom || 0) || collection.bottom
        } : null,
        dusk:dusk && duskHeading ? {
          start:Math.max(0, duskHeading.top - inset),
          end:Math.max(duskArt?.bottom || 0, duskQuote?.bottom || 0) || dusk.bottom
        } : null,
        human:human ? Math.max(0, human.top - inset) : null
      };
    }
    function tail(section, viewport) {
      // The final caption/quote defines the reading boundary. Decorative
      // section padding must not add an invisible extra scroll before handoff.
      return Math.max(section.start, section.end - viewport + bottomSpace);
    }
    function clampPosition(value, view) {
      return Math.max(0, Math.min(value, view.maxScroll));
    }
    function stop(id, value, readPosition) {
      return {
        id,
        duration:950,
        position() {
          const view = layout();
          const next = readPosition(view);
          if (Number.isFinite(next)) value = clampPosition(next, view);
          return value;
        }
      };
    }
    return {
      destination(direction, y, projectedY = y) {
        if (!Number.isFinite(y) || !Number.isFinite(direction) || !direction) return null;
        const view = layout();
        if (!view) return null;
        const {story, bloom, dusk, human, viewport} = view;
        const transitions = [];
        if (bloom) transitions.push({
          from:story, to:bloom.start, forward:'bloom', backward:'autumn-story',
          readFrom:next => next?.story, readTo:next => next?.bloom?.start
        });
        if (bloom && dusk) transitions.push({
          from:tail(bloom, viewport), to:dusk.start, forward:'dusk', backward:'bloom-tail',
          readFrom:next => next?.bloom ? tail(next.bloom, next.viewport) : null,
          readTo:next => next?.dusk?.start
        });
        if (dusk && human !== null) transitions.push({
          from:tail(dusk, viewport), to:human, forward:'human', backward:'dusk-tail',
          readFrom:next => next?.dusk ? tail(next.dusk, next.viewport) : null,
          readTo:next => next?.human
        });
        // A wheel step may cross a boundary without ever landing on its exact
        // pixel. Catch the nearest corridor in either direction, while the
        // interiors of tall chapters remain ordinary reading space.
        const projected = Number.isFinite(projectedY) ? projectedY : y;
        const reach = direction > 0 ? Math.max(y, projected) : Math.min(y, projected);
        if (direction < 0) transitions.reverse();
        for (const transition of transitions) {
          const from = clampPosition(transition.from, view);
          const to = clampPosition(transition.to, view);
          if (to <= from + tolerance) continue;
          if (direction > 0 && y < to - tolerance && reach >= from - tolerance) {
            return stop(transition.forward, to, transition.readTo);
          }
          if (direction < 0 && y > from + tolerance && reach <= to + tolerance) {
            return stop(transition.backward, from, transition.readFrom);
          }
        }
        return null;
      }
    };
  }
  global.ChapterStops = {create};
})(window);
