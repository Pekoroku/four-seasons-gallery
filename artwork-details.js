'use strict';
(() => {
  const paths = {
    '↗': 'M5 19 19 5M5 5h14v14',
    '←': 'M20 12H4m6-6-6 6 6 6',
    '→': 'M4 12h16m-6-6 6 6-6 6',
    '↑': 'M12 20V4m-6 6 6-6 6 6',
    '↓': 'M12 4v16m-6-6 6 6 6-6',
    '↺': 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
    '×': 'm6 6 12 12M18 6 6 18'
  };
  function icon(symbol) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ui-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', paths[symbol]);
    svg.append(path);
    return svg;
  }
  function setControlText(element, text) {
    element.replaceChildren();
    for (const part of text.split(/([↗←→↑↓↺×])/)) {
      if (part) element.append(paths[part] ? icon(part) : document.createTextNode(part));
    }
  }
  function render(container, item, language = 'zh') {
    container.replaceChildren();
    if (!item) { container.hidden = true; return; }
    const english = language === 'en';
    const rows = [
      [english ? 'Dimensions' : '尺寸', item.dimensions],
      [english ? 'Medium' : '媒介', item.medium],
      [english ? 'Year' : '创作年份', item.year ? `${item.year}${english ? '' : '年'}` : null],
      [english ? 'Location' : '创作地点', item.location]
    ].filter(([, value]) => value);
    if (rows.length) {
      const list = document.createElement('dl');
      list.className = 'artwork-facts';
      for (const [label, value] of rows) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = label;
        detail.textContent = value;
        row.append(term, detail);
        list.append(row);
      }
      container.append(list);
    }
    if (item.background) {
      const section = document.createElement('section');
      section.className = 'artwork-background';
      const heading = document.createElement('h3');
      const copy = document.createElement('p');
      heading.textContent = english ? 'Background' : '创作背景';
      copy.textContent = english && item.backgroundEn ? item.backgroundEn : item.background;
      section.append(heading, copy);
      container.append(section);
    }
    container.hidden = !container.childElementCount;
  }
  // Programmatic dialog focus should not look like a selected button after a tap.
  // Keyboard navigation still receives the site's existing visible focus ring.
  document.documentElement.dataset.inputMode = 'pointer';
  document.addEventListener('pointerdown', () => {
    document.documentElement.dataset.inputMode = 'pointer';
  }, {capture: true, passive: true});
  document.addEventListener('keydown', event => {
    if (['Tab', 'Enter', ' '].includes(event.key)) {
      document.documentElement.dataset.inputMode = 'keyboard';
    }
  }, true);
  window.ArtworkDetails = {render, setControlText};
})();
