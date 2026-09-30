/* Plan chapter stops without listening for, consuming, or initiating gestures. */
(function (global) {
  'use strict';
  function create(options) {
    options = options || {};
    const doc = global.document;
    const tolerance = 2;
    const bottomSpace = 90;
    const boundarySpace = 24;
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
        story:opening.bottom - stageHeight,
        // The entire flower/landscape exhibition is one chapter. Its internal
        // grids never create destinations, in either scrolling direction.
        bloom:collection && heading ? {
          start:Math.max(0, heading.top - inset), boundary:collection.bottom,
          end:Math.max(landscapes?.bottom || 0, ending?.bottom || 0) || collection.bottom
        } : null,
        dusk:dusk && duskHeading ? {
          start:Math.max(0, duskHeading.top - inset), boundary:dusk.bottom,
          end:Math.max(duskArt?.bottom || 0, duskQuote?.bottom || 0) || dusk.bottom
        } : null,
        human:human ? Math.max(0, human.top - inset) : null
      };
    }
    function tail(section, viewport) {
      // Wait until the final caption/quote has been read and the background
      // boundary has entered the viewport. Keep this eligible beyond the seam.
      return Math.max(section.start, section.end - viewport + bottomSpace,
        section.boundary - viewport + boundarySpace);
    }
    function stop(id, value, readPosition) {
      return {
        id,
        duration:950,
        position() {
          const next = readPosition(layout());
          if (Number.isFinite(next)) value = Math.max(0, next);
          return value;
        }
      };
    }
    return {
      destination(direction, y) {
        if (!Number.isFinite(y) || !Number.isFinite(direction) || !direction) return null;
        const view = layout();
        if (!view) return null;
        const {story, bloom, dusk, human, viewport} = view;
        if (direction > 0) {
          // Start only after the burn finishes, including its trailing blank space.
          if (bloom && story < bloom.start && y >= story - tolerance && y < bloom.start - tolerance) {
            return stop('bloom', bloom.start, next => next?.bloom?.start);
          }
          // Only real chapter boundaries auto-complete a transition.
          if (bloom && dusk && y >= tail(bloom, viewport) - tolerance && y < dusk.start - tolerance) {
            return stop('dusk', dusk.start, next => next?.dusk?.start);
          }
          if (dusk && human !== null && y >= tail(dusk, viewport) - tolerance && y < human - tolerance) {
            return stop('human', human, next => next?.human);
          }
          return null;
        }
        // At an actual chapter's landing, return to the preceding chapter tail.
        // Internal painting groups always retain ordinary upward reading.
        if (bloom && story < bloom.start && Math.abs(y - bloom.start) <= tolerance + 1) {
          return stop('autumn-story', story, next => next?.story);
        }
        if (bloom && dusk && Math.abs(y - dusk.start) <= tolerance + 1) {
          return stop('bloom-tail', tail(bloom, viewport), next => next?.bloom ? tail(next.bloom, next.viewport) : null);
        }
        if (dusk && human !== null && Math.abs(y - human) <= tolerance + 1) {
          return stop('dusk-tail', tail(dusk, viewport), next => next?.dusk ? tail(next.dusk, next.viewport) : null);
        }
        return null;
      }
    };
  }
  global.ChapterStops = {create};
})(window);
