import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { syncMapControlRows } from './map-control-chrome.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
void LyraMap;

class ChromeMap extends ControlMapEngine {
  constructor(options: Record<string, unknown>) {
    super(options);
    const container = options['container'] as HTMLElement;
    const chrome = document.createElement('div');
    chrome.className = 'maplibregl-control-container';
    chrome.innerHTML = `
      <div class="maplibregl-ctrl-top-left"></div><div class="maplibregl-ctrl-top-right"></div>
      <div class="maplibregl-ctrl-bottom-left"><div class="maplibregl-ctrl maplibregl-ctrl-scale" style="width:51px">10 km</div></div>
      <div class="maplibregl-ctrl-bottom-right">
        <div class="maplibregl-ctrl maplibregl-ctrl-group">
          <button class="maplibregl-ctrl-zoom-in"><span class="maplibregl-ctrl-icon"></span></button>
          <button class="maplibregl-ctrl-zoom-out"><span class="maplibregl-ctrl-icon"></span></button>
          <button class="maplibregl-ctrl-compass"><span class="maplibregl-ctrl-icon" style="transform:rotate(-37deg)"></span></button>
        </div>
        <div class="maplibregl-ctrl maplibregl-ctrl-group"><button class="maplibregl-ctrl-geolocate"><span class="maplibregl-ctrl-icon"></span></button></div>
        <details class="maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact maplibregl-compact-show" open>
          <summary class="maplibregl-ctrl-attrib-button"></summary>
          <div class="maplibregl-ctrl-attrib-inner"><a href="https://example.com/credits">Survey contributors</a> | <a href="https://example.com/license">Map licence</a></div>
        </details>
      </div>`;
    container.append(this.canvas, chrome);
  }
}
const originalContext = HTMLCanvasElement.prototype.getContext;
const originalObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');

function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing fixture ${selector}`);
  return element;
}
async function mount(width = 390, direction: 'ltr' | 'rtl' = 'ltr') {
  const wrapper = await fixture<HTMLElement>(html`<section></section>`);
  wrapper.style.inlineSize = `${width}px`;
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'inline-size:100%;block-size:400px;--lr-transition-fast:0ms';
  element.dir = direction; element.locale = 'en'; element.engine = 'maplibre';
  element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ChromeMap });
  wrapper.append(element);
  await waitUntil(() => element.map !== undefined);
  await element.updateComplete;
  await waitUntil(() => !!element.shadowRoot?.querySelector('[part~="navigation"]'));
  return { element, wrapper, root: element.shadowRoot! };
}
async function mutations(): Promise<void> { await new Promise<void>(resolve => setTimeout(resolve, 0)); }

describe('lr-map public native control chrome', () => {
  beforeEach(async () => {
    ChromeMap.initialReady = true;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
    } as typeof originalContext;
    await resetMouse();
  });
  afterEach(() => {
    fixtureCleanup(); HTMLCanvasElement.prototype.getContext = originalContext;
    if (originalObserver) Object.defineProperty(window, 'IntersectionObserver', originalObserver);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
  });

  it('exposes every native corner and the actual rotating SVG-mask icon nodes', async () => {
    const { root } = await mount();
    expect(query(root, '.maplibregl-control-container').part.contains('controls')).to.equal(true);
    for (const position of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      expect(query(root, `.maplibregl-ctrl-${position}`).part.contains(`controls-${position}`)).to.equal(true);
    }
    for (const name of ['zoom-in', 'zoom-out', 'compass', 'geolocate']) {
      const icon = query(root, `.maplibregl-ctrl-${name} .maplibregl-ctrl-icon`);
      expect(icon.part.contains(`${name}-icon`), name).to.equal(true);
      expect(getComputedStyle(icon, '::before').maskImage, name).to.contain('data:image/svg+xml');
      expect(getComputedStyle(icon, '::before').content, 'no font-dependent glyph').to.equal('""');
      expect(icon.getAttribute('aria-hidden')).to.equal('true');
    }
    const compass = query(root, '.maplibregl-ctrl-compass .maplibregl-ctrl-icon');
    expect(compass.getAttribute('style')).to.contain('rotate(-37deg)');
    expect(getComputedStyle(compass).transform).not.to.equal('none');
    expect(getComputedStyle(compass, '::after').maskImage).to.contain('data:image/svg+xml');
    expect(getComputedStyle(compass, '::after').opacity).not.to.equal(getComputedStyle(compass, '::before').opacity);
  });

  it('projects live geolocation state tokens without discarding author parts', async () => {
    const { root } = await mount();
    const button = query(root, '.maplibregl-ctrl-geolocate');
    button.part.add('custom');
    for (const [classes, expected] of [
      ['waiting', ['waiting']], ['active', ['active']], ['background', ['background']],
      ['active-error waiting', ['error', 'waiting']], ['background-error', ['error']], ['', []],
    ] as const) {
      button.className = `maplibregl-ctrl-geolocate ${classes.split(' ').filter(Boolean).map(name => `maplibregl-ctrl-geolocate-${name}`).join(' ')}`;
      await mutations();
      expect([...button.part].filter(part => part.startsWith('geolocate-')).sort()).to.deep.equal(expected.map(name => `geolocate-${name}`).sort());
      expect(button.part.contains('geolocate') && button.part.contains('custom')).to.equal(true);
    }
  });

  it('projects disclosure state on its root, toggle and content, including replacement credits', async () => {
    const { root } = await mount();
    const attribution = query<HTMLDetailsElement>(root, '.maplibregl-ctrl-attrib');
    const toggle = query(attribution, '.maplibregl-ctrl-attrib-button');
    const content = query(attribution, '.maplibregl-ctrl-attrib-inner');
    for (const expanded of [true, false, true]) {
      attribution.open = expanded;
      attribution.classList.toggle('maplibregl-compact-show', expanded);
      await mutations();
      for (const node of [attribution, toggle, content]) expect(node.part.contains('attribution-expanded')).to.equal(expanded);
    }
    const replacement = document.createElement('a'); replacement.href = 'https://example.com/revised'; replacement.textContent = 'Revised credits';
    content.replaceChildren(replacement);
    await mutations();
    expect(replacement.part.contains('attribution-link')).to.equal(true);
    expect(replacement.getBoundingClientRect().width).to.be.at.least(24);
    expect(replacement.getBoundingClientRect().height).to.be.at.least(24);
  });

  it('lets consumer parts style corners, icons, credits and an open toggle without losing rotation', async () => {
    const { element, root, wrapper } = await mount();
    const style = document.createElement('style');
    style.textContent = `lr-map::part(controls-bottom-right){gap:11px} lr-map::part(compass-icon){color:rgb(70,80,90);inline-size:25px} lr-map::part(attribution-link){padding-inline:7px} lr-map::part(attribution-toggle){background:transparent}`;
    wrapper.prepend(style);
    const corner = query(root, '.maplibregl-ctrl-bottom-right');
    const icon = query(root, '.maplibregl-ctrl-compass .maplibregl-ctrl-icon');
    expect(getComputedStyle(corner).gap).to.equal('11px');
    expect(getComputedStyle(icon).color).to.equal('rgb(70, 80, 90)');
    expect(getComputedStyle(icon, '::before').backgroundColor).to.equal('rgb(70, 80, 90)');
    expect(getComputedStyle(icon).width).to.equal('25px');
    expect(getComputedStyle(icon).transform).not.to.equal('none');
    expect(getComputedStyle(query(root, '.maplibregl-ctrl-attrib a')).paddingInlineStart).to.equal('7px');
    expect(getComputedStyle(query(root, '.maplibregl-ctrl-attrib-button')).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    const scale = query(root, '.maplibregl-ctrl-scale');
    expect(getComputedStyle(scale, '::after').display).not.to.equal('none');
    element.style.setProperty('--lr-map-scale-bar-display', 'none');
    expect(getComputedStyle(scale, '::after').display).to.equal('none');
    expect(scale.textContent).to.equal('10 km');
  });

  it('exposes aggregate expanded-attribution state for container and corner CSS reflow', async () => {
    const { root, wrapper } = await mount();
    const controls = query(root, '.maplibregl-control-container');
    controls.part.add('custom-controls');
    const corners = [...controls.querySelectorAll('.maplibregl-ctrl-top-left, .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right')];
    const rows = [...controls.querySelectorAll('[part~="controls-top"], [part~="controls-bottom"]')];
    expect(rows.length).to.equal(2);
    const attribution = query<HTMLDetailsElement>(root, '.maplibregl-ctrl-attrib');
    const style = document.createElement('style');
    style.textContent = `lr-map::part(controls controls-attribution-expanded){display:flex} lr-map::part(controls-bottom-left controls-attribution-expanded){margin-block-end:73px} lr-map::part(controls-bottom controls-attribution-expanded){display:contents}`;
    wrapper.prepend(style);
    const assertExpanded = (expanded: boolean) => {
      for (const node of [controls, ...rows, ...corners]) expect(node.part.contains('controls-attribution-expanded')).to.equal(expanded);
      expect(getComputedStyle(controls).display).to.equal(expanded ? 'flex' : 'grid');
      expect(getComputedStyle(query(controls, '[part~="controls-bottom"]')).display).to.equal(expanded ? 'contents' : 'grid');
      expect(getComputedStyle(query(root, '.maplibregl-ctrl-bottom-left')).marginBlockEnd).to.equal(expanded ? '73px' : '0px');
      expect(controls.part.contains('custom-controls')).to.equal(true);
    };
    assertExpanded(true);
    const second = attribution.cloneNode(true) as HTMLDetailsElement;
    attribution.parentElement!.append(second);
    await mutations();
    attribution.open = false;
    attribution.classList.remove('maplibregl-compact-show');
    await mutations();
    assertExpanded(true);
    second.remove(); await mutations();
    assertExpanded(false);
    attribution.open = true; attribution.classList.add('maplibregl-compact-show');
    await mutations(); assertExpanded(true);
    attribution.remove(); await mutations(); assertExpanded(false);
    attribution.open = false; attribution.open = true;
    await mutations(); assertExpanded(false);
  });

  it('lets a corner part paint above a sibling overlay inside the map allocation', async () => {
    const { element, root, wrapper } = await mount();
    wrapper.style.position = 'relative';
    const target = query<HTMLButtonElement>(root, '[part~="geolocate"]');
    const corner = query(root, '[part~="controls-bottom-right"]');
    const bounds = target.getBoundingClientRect();
    const allocation = element.getBoundingClientRect();
    const origin = wrapper.getBoundingClientRect();
    const overlay = document.createElement('button');
    overlay.textContent = 'Application overlay';
    const overlayLevel = Number(getComputedStyle(corner).zIndex) + 1;
    overlay.style.cssText = `position:absolute;left:${bounds.left - origin.left}px;top:${bounds.top - origin.top}px;width:${bounds.width}px;height:${bounds.height}px;z-index:${overlayLevel}`;
    wrapper.append(overlay);
    const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
    expect(bounds.left >= allocation.left && bounds.right <= allocation.right && bounds.top >= allocation.top && bounds.bottom <= allocation.bottom).to.equal(true);
    expect(document.elementFromPoint(x, y) === overlay, 'the sibling initially covers the native button').to.equal(true);
    const style = document.createElement('style');
    style.textContent = `lr-map::part(controls-bottom-right){z-index:${overlayLevel + 1}}`;
    wrapper.prepend(style);
    await waitUntil(() => document.elementFromPoint(x, y) === element, 'the raised corner is above the sibling');
    expect(target.contains(root.elementFromPoint(x, y)), 'native control remains the hit target').to.equal(true);
  });

  it('keeps navigation and geolocation on one default group surface recipe', async () => {
    const { root } = await mount();
    const navigation = getComputedStyle(query(root, '[part~="navigation"]'));
    const geolocate = getComputedStyle(query(root, '[part~="geolocate-control"]'));
    for (const property of ['background-color', 'border-top-color', 'border-top-width', 'border-radius', 'box-shadow']) {
      expect(geolocate.getPropertyValue(property), property).to.equal(navigation.getPropertyValue(property));
    }
  });

  for (const occupiedOpposites of [false, true]) {
    it(`allocates top and bottom widths independently with ${occupiedOpposites ? 'four' : 'diagonal'} occupied corners`, async () => {
      const { root } = await mount(320);
      const topLeft = query(root, '.maplibregl-ctrl-top-left');
      const topRight = query(root, '.maplibregl-ctrl-top-right');
      const bottomRight = query(root, '.maplibregl-ctrl-bottom-right');
      const attribution = query(root, '.maplibregl-ctrl-attrib');
      topLeft.append(attribution.cloneNode(true));
      const navigation = query(root, '[part~="navigation"]');
      if (occupiedOpposites) topRight.append(navigation);
      else { navigation.remove(); query(root, '.maplibregl-ctrl-scale').remove(); }
      await mutations();
      for (const corner of [topLeft, bottomRight]) {
        expect(corner.getBoundingClientRect().width, corner.className).to.be.greaterThan(170);
      }
      const top = topLeft.getBoundingClientRect(), bottom = bottomRight.getBoundingClientRect();
      expect(top.bottom).to.be.at.most(bottom.top);
    });
  }

  for (const width of [320, 390]) for (const direction of ['ltr', 'rtl'] as const) {
    it(`allocates remaining corner space at ${width}px/${direction} without overlap`, async () => {
      const { root } = await mount(width, direction);
      const left = query(root, '.maplibregl-ctrl-bottom-left');
      const right = query(root, '.maplibregl-ctrl-bottom-right');
      const container = query(root, '[part="container"]').getBoundingClientRect();
      const leftRect = left.getBoundingClientRect(), rightRect = right.getBoundingClientRect();
      expect(rightRect.width, 'attribution can use space beyond an arbitrary half').to.be.greaterThan(width / 2 + 10);
      expect(direction === 'ltr' ? leftRect.right <= rightRect.left + 1 : rightRect.right <= leftRect.left + 1).to.equal(true);
      for (const control of root.querySelectorAll('.maplibregl-ctrl')) {
        const rect = control.getBoundingClientRect();
        expect(rect.left).to.be.at.least(container.left - 1);
        expect(rect.right).to.be.at.most(container.right + 1);
        expect(getComputedStyle(control).pointerEvents).to.equal('auto');
      }
      expect(getComputedStyle(query(root, '.maplibregl-control-container')).pointerEvents).to.equal('none');
    });
  }

  for (const fallback of [false, true]) {
    it(`preserves focused native corner identity and idempotent rows with ${fallback ? 'fallback' : 'native'} moves`, async () => {
      const container = await fixture<HTMLElement>(html`<div><div class="maplibregl-control-container">
        <div class="maplibregl-ctrl-top-left"><button>Zoom</button></div><div class="maplibregl-ctrl-top-right"></div>
        <div class="maplibregl-ctrl-bottom-left"></div><div class="maplibregl-ctrl-bottom-right"></div>
      </div></div>`);
      const controls = query(container, '.maplibregl-control-container');
      const corners = [...controls.children];
      const button = query<HTMLButtonElement>(controls, 'button');
      await focusByKeyboard(button);
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'moveBefore');
      if (fallback) Object.defineProperty(Element.prototype, 'moveBefore', { configurable: true, writable: true, value: undefined });
      try {
        syncMapControlRows(container, () => container.isConnected);
        expect(document.activeElement === button).to.equal(true);
        const rows = [...controls.children];
        expect(rows.length).to.equal(2);
        expect(rows[0]!.part.contains('controls-top') && rows[1]!.part.contains('controls-bottom')).to.equal(true);
        expect([...rows[0]!.children, ...rows[1]!.children].every((corner, index) => corner === corners[index])).to.equal(true);
        let childChanges = 0;
        const observer = new MutationObserver(records => { childChanges += records.length; });
        observer.observe(controls, { childList: true, subtree: true });
        try {
          syncMapControlRows(container, () => true); syncMapControlRows(container, () => true);
          await mutations();
          expect(childChanges).to.equal(0);
          expect(document.activeElement === button).to.equal(true);
        } finally { observer.disconnect(); }
      } finally {
        if (fallback) {
          if (descriptor) Object.defineProperty(Element.prototype, 'moveBefore', descriptor);
          else Reflect.deleteProperty(Element.prototype, 'moveBefore');
        }
      }
    });
  }

  it('honors focus transferred by a blur handler during fallback row initialization', async () => {
    const container = await fixture<HTMLElement>(html`<div><button id="outside">Outside controls</button><div class="maplibregl-control-container"><div class="maplibregl-ctrl-top-left"><button id="inside">Zoom</button></div></div></div>`);
    const inside = query<HTMLButtonElement>(container, '#inside');
    const outside = query<HTMLButtonElement>(container, '#outside');
    await focusByKeyboard(inside);
    let transfers = 0;
    inside.addEventListener('blur', () => { transfers++; outside.focus(); }, { once: true });
    const row = document.createElement('div');
    row.className = 'map-control-row map-control-row-top';
    row.part.add('controls-top');
    query(container, '.maplibregl-control-container').append(row);
    const insertBefore = row.insertBefore;
    row.insertBefore = function <T extends Node>(node: T, before: Node | null): T {
      // DOM removal need not emit blur; invoke the real focus reaction before the move.
      inside.blur();
      return insertBefore.call(this, node, before) as T;
    };
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'moveBefore');
    Object.defineProperty(Element.prototype, 'moveBefore', { configurable: true, writable: true, value: undefined });
    try {
      syncMapControlRows(container, () => container.isConnected);
      expect(transfers).to.equal(1);
      expect(row.contains(inside)).to.equal(true);
      expect(document.activeElement === outside).to.equal(true);
    } finally {
      row.insertBefore = insertBefore;
      if (descriptor) Object.defineProperty(Element.prototype, 'moveBefore', descriptor);
      else Reflect.deleteProperty(Element.prototype, 'moveBefore');
    }
  });

  it('ignores removed chrome mutations and projects fresh nodes after reconnect', async () => {
    const { element, root, wrapper } = await mount();
    const stale = query(root, '.maplibregl-ctrl-geolocate');
    stale.remove(); stale.classList.add('maplibregl-ctrl-geolocate-active');
    await mutations();
    expect(stale.part.contains('geolocate-active')).to.equal(false);
    const oldMap = element.map;
    element.remove(); wrapper.append(element);
    await waitUntil(() => element.map !== undefined && element.map !== oldMap);
    await element.updateComplete;
    const fresh = query(element.shadowRoot!, '.maplibregl-ctrl-geolocate');
    fresh.classList.add('maplibregl-ctrl-geolocate-waiting');
    await mutations();
    expect(fresh.part.contains('geolocate-waiting')).to.equal(true);
    expect(stale.part.contains('geolocate-active')).to.equal(false);
  });
});
