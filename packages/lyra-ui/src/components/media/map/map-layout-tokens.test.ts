import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE, type LyraMapLegendPlacement } from '../../lr-map.js';
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
          <button class="maplibregl-ctrl-compass"><span class="maplibregl-ctrl-icon"></span></button>
        </div>
        <div class="maplibregl-ctrl maplibregl-ctrl-group"><button class="maplibregl-ctrl-geolocate"><span class="maplibregl-ctrl-icon"></span></button></div>
        <details class="maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact">
          <summary class="maplibregl-ctrl-attrib-button"></summary>
          <div class="maplibregl-ctrl-attrib-inner"><a href="https://example.com/credits">Credits</a></div>
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
async function mount(direction: 'ltr' | 'rtl' = 'ltr', configure: (element: LyraMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLElement>(html`<section style="inline-size:480px"></section>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'inline-size:100%;block-size:400px;--lr-transition-fast:0ms;--lr-transition-interactive:none';
  element.dataset['lrSurface'] = 'solid';
  element.dir = direction; element.locale = 'en'; element.engine = 'maplibre';
  element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false };
  element.legend = [{ color: '#ff0000', label: 'Alpha', pattern: 'solid' }, { color: '#0000ff', label: 'Beta', pattern: 'solid' }];
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ChromeMap });
  configure(element);
  wrapper.append(element);
  await waitUntil(() => element.map !== undefined);
  await element.updateComplete;
  const root = element.shadowRoot!;
  await waitUntil(() => root.querySelector('[part~="zoom-in"]') !== null && root.querySelector('[part="legend"]') !== null);
  const base = query(root, '[part="base"]');
  await waitUntil(() => base.style.getPropertyValue('--_lr-map-controls-bottom') !== '', 'control rows measured');
  return { element, root, base };
}
const px = (value: string): number => Number.parseFloat(value);
/** Mixed fills compute as `color(srgb …)` in some engines; compare them as 8-bit rgb. */
const rgb = (value: string): string => {
  const match = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(value);
  return match ? `rgb(${match.slice(1, 4).map(channel => Math.round(Number(channel) * 255)).join(', ')})` : value;
};
const frame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => { resolve(); }));

describe('lr-map layout tokens', () => {
  beforeEach(async () => {
    ChromeMap.initialReady = true;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
    } as typeof originalContext;
    await resetMouse();
  });
  afterEach(async () => {
    await resetMouse();
    fixtureCleanup(); HTMLCanvasElement.prototype.getContext = originalContext;
    if (originalObserver) Object.defineProperty(window, 'IntersectionObserver', originalObserver);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
  });

  it('restyles every native control from one host token set and restores the defaults when unset', async () => {
    const { element, root } = await mount();
    const zoomIn = query(root, '[part~="zoom-in"]'), compass = query(root, '[part~="compass"]'), geolocate = query(root, '.maplibregl-ctrl-geolocate');
    const group = query(root, '[part~="navigation"]'), toggle = query(root, '[part~="attribution-toggle"]'), attribution = query(root, '[part~="attribution"]');
    const snapshot = () => [zoomIn, compass, geolocate, toggle].map(node => getComputedStyle(node).blockSize)
      .concat([getComputedStyle(group).borderTopLeftRadius, getComputedStyle(group).boxShadow, getComputedStyle(group).backgroundColor,
        getComputedStyle(group).borderTopColor, getComputedStyle(group).color, getComputedStyle(toggle).borderTopLeftRadius,
        getComputedStyle(attribution).borderTopLeftRadius, getComputedStyle(attribution).borderTopStyle, getComputedStyle(group).marginTop]);
    const defaults = snapshot();
    const tokens: Record<string, string> = {
      '--lr-map-control-size': '44px', '--lr-map-control-radius': '22px', '--lr-map-control-border': '2px solid rgb(9, 8, 7)',
      '--lr-map-control-shadow': 'rgb(1, 1, 1) 0px 0px 3px 0px', '--lr-map-control-bg': 'rgb(10, 20, 30)', '--lr-map-control-color': 'rgb(40, 50, 60)',
      '--lr-map-control-gap': '7px', '--lr-map-attribution-radius': '3px', '--lr-map-attribution-border': '1px dashed rgb(2, 2, 2)',
    };
    for (const [name, value] of Object.entries(tokens)) element.style.setProperty(name, value);
    for (const node of [zoomIn, compass, geolocate, toggle]) expect(getComputedStyle(node).blockSize).to.equal('44px');
    expect(getComputedStyle(zoomIn).inlineSize).to.equal('44px');
    const painted = getComputedStyle(group);
    expect([painted.borderTopLeftRadius, painted.boxShadow, rgb(painted.backgroundColor), painted.borderTopColor, painted.borderTopWidth, painted.color, painted.marginTop])
      .to.deep.equal(['22px', 'rgb(1, 1, 1) 0px 0px 3px 0px', 'rgb(10, 20, 30)', 'rgb(9, 8, 7)', '2px', 'rgb(40, 50, 60)', '7px']);
    expect(getComputedStyle(toggle).borderTopLeftRadius).to.equal('22px');
    expect([getComputedStyle(attribution).borderTopLeftRadius, getComputedStyle(attribution).borderTopStyle]).to.deep.equal(['3px', 'dashed']);
    for (const name of Object.keys(tokens)) element.style.removeProperty(name);
    expect(snapshot()).to.deep.equal(defaults);
  });

  it('applies the control size, shape and color tokens to initialization outlines', async () => {
    const host = await fixture<LyraMap>(html`<lr-map engine="maplibre" initialization="interaction" data-lr-surface="solid" .mapStyle=${LYRA_MAP_EMPTY_STYLE}
      .controls=${{ navigation: true, attribution: false }} style="inline-size:480px;block-size:300px"></lr-map>`);
    await waitUntil(() => host.shadowRoot!.querySelector('[part~="initialization-control"]') !== null);
    const outline = query(host.shadowRoot!, '[part~="initialization-control"]');
    const before = getComputedStyle(outline).blockSize;
    for (const [name, value] of [['--lr-map-control-size', '50px'], ['--lr-map-control-radius', '6px'], ['--lr-map-control-border', '3px solid rgb(5, 5, 5)'],
      ['--lr-map-control-bg', 'rgb(11, 22, 33)'], ['--lr-map-control-shadow', 'rgb(2, 2, 2) 0px 0px 1px 0px'], ['--lr-map-control-color', 'rgb(1, 2, 3)'],
      ['--lr-map-controls-inset-inline-start', '30px']]) host.style.setProperty(name!, value!);
    const style = getComputedStyle(outline);
    expect([style.blockSize, style.inlineSize, style.borderTopLeftRadius, style.borderTopWidth, rgb(style.backgroundColor), style.boxShadow, style.color])
      .to.deep.equal(['50px', '50px', '6px', '3px', 'rgb(11, 22, 33)', 'rgb(2, 2, 2) 0px 0px 1px 0px', 'rgb(1, 2, 3)']);
    expect(getComputedStyle(query(host.shadowRoot!, '[part~="initialization-controls"]')).paddingInlineStart).to.equal('30px');
    host.style.removeProperty('--lr-map-control-size');
    expect(getComputedStyle(outline).blockSize).to.equal(before);
  });

  it('paints hover and pressed fills from the control pointer tokens in every state', async () => {
    const { element, root } = await mount();
    element.style.setProperty('--lr-map-control-hover-bg', 'rgb(1, 2, 3)');
    element.style.setProperty('--lr-map-control-active-bg', 'rgb(4, 5, 6)');
    const zoomIn = query(root, '[part~="zoom-in"]'), compass = query(root, '[part~="compass"]');
    compass.setAttribute('aria-pressed', 'true');
    for (const button of [zoomIn, compass]) {
      await hoverUntilMatched(button, 'control never hovered');
      await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(1, 2, 3)', 'the hover token paints');
      await sendMouse({ type: 'down' });
      try {
        await waitUntil(() => getComputedStyle(button).backgroundColor === 'rgb(4, 5, 6)', 'the pressed token paints');
      } finally { await sendMouse({ type: 'up' }); }
    }
    const toggle = query(root, '[part~="attribution-toggle"]');
    await hoverUntilMatched(toggle, 'attribution toggle never hovered');
    await waitUntil(() => getComputedStyle(toggle).backgroundColor === 'rgb(1, 2, 3)', 'the attribution toggle takes the hover token');
  });

  for (const direction of ['ltr', 'rtl'] as const) {
    it(`reserves authored control insets on the logical edges in ${direction}`, async () => {
      const { element, root, base } = await mount(direction, el => {
        el.legend = Array.from({ length: 40 }, (_, index) => ({ color: '#ff0000', label: `Row ${index}`, pattern: 'solid' as const }));
      });
      const scaleCorner = query(root, '.maplibregl-ctrl-bottom-left'), legend = query(root, '[part="legend"]');
      const hostBox = element.getBoundingClientRect();
      const startGap = (box: DOMRect) => direction === 'ltr' ? box.left - hostBox.left : hostBox.right - box.right;
      const before = { scale: startGap(scaleCorner.getBoundingClientRect()), legend: startGap(legend.getBoundingClientRect()), legendBottom: legend.getBoundingClientRect().bottom,
        legendHeight: legend.getBoundingClientRect().height };
      element.style.setProperty('--lr-map-controls-inset-inline-start', '30px');
      element.style.setProperty('--lr-map-controls-inset-block-end', '24px');
      element.style.setProperty('--lr-map-controls-inset-block-start', '10px');
      expect(startGap(scaleCorner.getBoundingClientRect()) - before.scale).to.be.closeTo(30, 0.5);
      expect(startGap(legend.getBoundingClientRect()) - before.legend).to.be.closeTo(30, 0.5);
      expect(before.legendBottom - legend.getBoundingClientRect().bottom).to.be.closeTo(24, 0.5);
      expect(before.legendHeight - legend.getBoundingClientRect().height, 'a full legend loses both block insets').to.be.closeTo(34, 0.5);
      expect(base.style.getPropertyValue('--_lr-map-controls-bottom')).not.to.equal('');
    });
  }

  for (const direction of ['ltr', 'rtl'] as const) {
    it(`anchors each legend placement to its logical edge in ${direction}`, async () => {
      const { element, root, base } = await mount(direction);
      element.style.setProperty('--lr-map-legend-inset-block', '20px');
      element.style.setProperty('--lr-map-legend-inset-inline', '16px');
      const legend = query(root, '[part="legend"]');
      const bottomRow = px(base.style.getPropertyValue('--_lr-map-controls-bottom'));
      const offsets = (): { start: number; end: number; top: number; bottom: number } => {
        const outer = base.getBoundingClientRect(), box = legend.getBoundingClientRect();
        const left = box.left - outer.left, right = outer.right - box.right;
        return { start: direction === 'ltr' ? left : right, end: direction === 'ltr' ? right : left, top: box.top - outer.top, bottom: outer.bottom - box.bottom };
      };
      const cases: [LyraMapLegendPlacement, (o: ReturnType<typeof offsets>) => void][] = [
        ['bottom-start', o => { expect([o.start, o.bottom - bottomRow]).to.deep.equal([16, 20]); }],
        ['bottom-end', o => { expect([o.end, o.bottom - bottomRow]).to.deep.equal([16, 20]); }],
        ['top-start', o => { expect([o.start, o.top]).to.deep.equal([16, 20]); }],
        ['top-end', o => { expect([o.end, o.top]).to.deep.equal([16, 20]); }],
        ['top', o => { expect(o.top).to.equal(20); expect(Math.abs(o.start - o.end)).to.be.below(1); }],
        ['bottom', o => { expect(o.bottom - bottomRow).to.equal(20); expect(Math.abs(o.start - o.end)).to.be.below(1); }],
        ['start', o => { expect(o.start).to.equal(16); expect(Math.abs(o.top - 20 - (o.bottom - 20 - bottomRow))).to.be.below(1); }],
        ['end', o => { expect(o.end).to.equal(16); expect(Math.abs(o.top - 20 - (o.bottom - 20 - bottomRow))).to.be.below(1); }],
      ];
      for (const [placement, check] of cases) {
        element.legendPlacement = placement;
        await element.updateComplete;
        expect(legend.dataset['placement']).to.equal(placement);
        expect(element.getAttribute('legend-placement'), 'reflects').to.equal(placement);
        const o = offsets();
        check({ start: Math.round(o.start), end: Math.round(o.end), top: Math.round(o.top), bottom: Math.round(o.bottom) });
      }
      element.legendPlacement = 'middle' as LyraMapLegendPlacement;
      await element.updateComplete;
      expect(legend.dataset['placement']).to.equal('bottom-start');
      expect([element.legendPlacement, element.getAttribute('legend-placement')]).to.deep.equal(['bottom-start', 'bottom-start']);
    });
  }

  it('aligns the legend in the reserved grid while pick controls are shown', async () => {
    const { element, root, base } = await mount('ltr', el => { el.pickMode = true; el.legendPlacement = 'top-end'; });
    await waitUntil(() => root.querySelector('[part="pick-controls"]') !== null);
    const legend = query(root, '[part="legend"]');
    const outer = base.getBoundingClientRect(), box = legend.getBoundingClientRect();
    expect(getComputedStyle(legend).position).to.equal('relative');
    expect([getComputedStyle(legend).alignSelf, getComputedStyle(legend).justifySelf]).to.deep.equal(['start', 'end']);
    expect(outer.right - box.right).to.be.below(outer.width / 4);
    for (const [placement, align, justify] of [['start', 'center', 'start'], ['bottom', 'end', 'center']] as const) {
      element.legendPlacement = placement; await element.updateComplete;
      expect([getComputedStyle(legend).alignSelf, getComputedStyle(legend).justifySelf]).to.deep.equal([align, justify]);
    }
  });

  it('reflects the legend typography and surface tokens and stacks slotted cards in the panel', async () => {
    const { element, root } = await mount('ltr', el => {
      for (const [slot, text] of [['legend', 'Second key'], ['legend', 'Third key'], ['legend-start', 'Header key']]) {
        const card = document.createElement('div'); card.slot = slot!; card.textContent = text!; card.style.blockSize = '30px'; el.append(card);
      }
    });
    const tokens: Record<string, string> = {
      '--lr-map-legend-font-size': '17px', '--lr-map-legend-gap': '9px', '--lr-map-legend-padding': '5px 6px', '--lr-map-legend-radius': '4px',
      '--lr-map-legend-bg': 'rgb(3, 4, 5)', '--lr-map-legend-shadow': 'rgb(0, 0, 0) 0px 1px 2px 0px', '--lr-map-legend-color': 'rgb(200, 201, 202)',
      '--lr-map-legend-swatch-size': '15px', '--lr-map-legend-columns': '2', '--lr-map-legend-max-inline-size': '300px', '--lr-map-legend-max-block-size': '250px',
    };
    for (const [name, value] of Object.entries(tokens)) element.style.setProperty(name, value);
    const legend = query(root, '[part="legend"]'), list = query(root, '.legend-list'), swatch = query(root, '[part="legend-swatch"]');
    const style = getComputedStyle(legend);
    expect([style.fontSize, style.rowGap, style.paddingTop, style.paddingLeft, style.borderTopLeftRadius, rgb(style.backgroundColor), style.boxShadow, style.color, style.maxInlineSize, style.maxBlockSize])
      .to.deep.equal(['17px', '9px', '5px', '6px', '4px', 'rgb(3, 4, 5)', 'rgb(0, 0, 0) 0px 1px 2px 0px', 'rgb(200, 201, 202)', '300px', '250px']);
    expect([getComputedStyle(swatch).inlineSize, getComputedStyle(list).rowGap]).to.deep.equal(['15px', '9px']);
    expect(getComputedStyle(list).gridTemplateColumns.split(' ').length).to.equal(2);
    await frame();
    const outer = legend.getBoundingClientRect();
    const cards = [...element.querySelectorAll<HTMLElement>('[slot]')].map(card => card.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    for (const [index, card] of cards.entries()) {
      expect(card.left >= outer.left && card.right <= outer.right, `card ${index} inside the panel`).to.equal(true);
      if (index) expect(card.top - cards[index - 1]!.bottom, `card ${index} stacks below the previous one`).to.be.at.least(9 - 0.5);
    }
  });

  for (const direction of ['ltr', 'rtl'] as const) {
    it(`scrolls a tall slotted anchor card inside anchor-body with the close action visible in ${direction}`, async () => {
      const { element, root } = await mount(direction, el => {
        const card = document.createElement('div'); card.slot = 'anchor';
        card.innerHTML = '<h3 style="margin:0">Header</h3><div style="block-size:900px">Details</div>';
        el.append(card); el.anchorClosable = true; el.anchorLngLat = [0, 0];
      });
      const panel = query(root, '[part="anchor"]'), body = query(root, '[part="anchor-body"]');
      await waitUntil(() => !panel.hidden && panel.style.left !== '' && getComputedStyle(panel).visibility !== 'hidden', 'anchor placed', { timeout: 4000 });
      const close = query(root, '[part="anchor-close"]');
      expect(body.scrollHeight > body.clientHeight, 'the body scrolls').to.equal(true);
      const panelBox = panel.getBoundingClientRect(), closeBox = close.getBoundingClientRect();
      expect(closeBox.bottom <= panelBox.bottom + 0.5 && closeBox.top >= panelBox.top, 'close action stays inside the panel').to.equal(true);
      body.scrollTop = body.scrollHeight;
      expect(close.getBoundingClientRect().top).to.be.closeTo(closeBox.top, 0.5);
      element.style.setProperty('--lr-map-anchor-close-reservation', '40px');
      expect(getComputedStyle(body).paddingInlineEnd).to.equal('40px');
      const header = query(element, 'h3').getBoundingClientRect(), bodyBox = body.getBoundingClientRect();
      const reserved = direction === 'ltr' ? bodyBox.right - header.right : header.left - bodyBox.left;
      expect(reserved).to.be.closeTo(40, 0.5);
    });
  }
});
