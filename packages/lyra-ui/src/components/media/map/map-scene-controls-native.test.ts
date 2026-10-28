import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
void LyraMap;

function button(element: LyraMap, kind: string): HTMLButtonElement {
  const node = element.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="${kind}-button"]`);
  if (!node) throw new Error(`Missing ${kind} control`);
  return node;
}
function style() {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const context = canvas.getContext('2d')!; context.fillStyle = 'rgb(1, 134, 160)'; context.fillRect(0, 0, 128, 128);
  return { ...LYRA_MAP_EMPTY_STYLE, projection: { type: 'mercator' }, sources: {
    elevation: { type: 'raster-dem', tiles: [canvas.toDataURL('image/png')], tileSize: 128, maxzoom: 0, encoding: 'mapbox' },
  } };
}
async function mount(engine: 'modular' | 'maplibre') {
  const element = await fixture<LyraMap>(html`<lr-map .engine=${engine} initialization="eager" style="inline-size:320px;block-size:300px"
    .mapStyle=${style()} .controls=${{ globe: true, terrain: { source: 'elevation', exaggeration: 12 }, attribution: false }}></lr-map>`);
  await element.whenStyleReady(); await element.whenControlsReady(); await element.whenIdle(); return element;
}
async function idle(element: LyraMap) { await element.updateComplete; await element.whenIdle(); }

describe('lr-map component-owned scene controls with native engines', function () {
  this.timeout(45000);
  let workerUrl: string;
  before(function () { if (!document.createElement('canvas').getContext('webgl2')) this.skip(); });
  beforeEach(() => { workerUrl = getWorkerUrl(); setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href); });
  afterEach(() => { fixtureCleanup(); setWorkerUrl(workerUrl); });
  for (const engine of ['modular', 'maplibre'] as const) {
    it(`uses keyboard activation with property-first events and preserves the ${engine} map`, async () => {
      const element = await mount(engine), map = element.map;
      const globe = button(element, 'globe'), terrain = button(element, 'terrain');
      const seen: unknown[] = [];
      element.addEventListener('lr-map-projection-change', event => { seen.push((event as CustomEvent).detail); });
      await focusByKeyboard(globe); await sendKeys({ press: 'Enter' });
      await waitUntil(() => element.projection === 'globe'); await idle(element);
      expect(globe.getAttribute('aria-pressed')).to.equal('true');
      await focusByKeyboard(globe); await sendKeys({ press: 'Space' });
      await waitUntil(() => element.projection === 'mercator'); await idle(element);
      expect(seen).to.deep.equal([{ projection: 'globe', source: 'control' }, { projection: 'mercator', source: 'control' }]);
      await focusByKeyboard(terrain); await sendKeys({ press: 'Enter' });
      await waitUntil(() => element.terrain !== undefined); await idle(element);
      expect(element.terrain).to.deep.equal({ source: 'elevation', exaggeration: 12 });
      expect(terrain.getAttribute('aria-pressed')).to.equal('true');
      terrain.click(); await idle(element); expect(element.terrain).to.equal(null);
      expect(element.map === map).to.equal(true);
      expect(globe.getBoundingClientRect().width).to.be.at.least(24);
      expect(globe.getBoundingClientRect().height).to.be.at.least(24);
      await expect(element).to.be.accessible();
    });
    it(`renders themed ${engine} toggles with mirrored corners and reduced motion`, async () => {
      await setReducedMotion('reduce');
      try {
        const element = await mount(engine), globe = button(element, 'globe');
        const initial = globe.getBoundingClientRect(), host = element.getBoundingClientRect();
        expect(initial.left).to.be.greaterThan(host.left + host.width / 2);
        element.dir = 'rtl'; element.strings = { mapGlobe: 'A deliberately long localized globe control name' };
        element.style.setProperty('--lr-color-brand-quiet', 'rgb(12, 34, 56)');
        element.style.setProperty('--lr-color-brand', 'rgb(230, 240, 250)');
        await element.updateComplete;
        await waitUntil(() => globe.getBoundingClientRect().right < host.left + host.width / 2);
        expect(globe.getAttribute('aria-label')).to.equal('A deliberately long localized globe control name');
        globe.click(); await idle(element);
        // Reduced motion retains a tiny transition duration. Native idle can precede the next
        // painted CSS transition value, even after the pressed attribute and tokens are current.
        await waitUntil(() => getComputedStyle(globe).backgroundColor === 'rgb(12, 34, 56)', 'pressed control fill did not finish its reduced-motion transition');
        const appearance = getComputedStyle(globe);
        expect(appearance.backgroundColor, JSON.stringify({ pressed: globe.getAttribute('aria-pressed'), busy: globe.getAttribute('aria-busy'),
          disabled: globe.disabled, hover: globe.matches(':hover'), active: globe.matches(':active'), focus: globe.matches(':focus-visible'),
          fill: appearance.getPropertyValue('--_map-scene-control-fill'), theme: appearance.getPropertyValue('--lr-color-brand-quiet'),
          background: appearance.backgroundColor, color: appearance.color, duration: appearance.transitionDuration,
          reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, projection: element.projection })).to.equal('rgb(12, 34, 56)');
        expect(getComputedStyle(globe).color).to.equal('rgb(230, 240, 250)');
        expect(getComputedStyle(globe).transitionDuration.split(',').every(value => Number.parseFloat(value) <= 0.001)).to.equal(true);
        await focusByKeyboard(globe);
        expect(getComputedStyle(globe).outlineStyle).not.to.equal('none');
        await hoverUntilMatched(globe, 'globe control did not become hovered');
        await waitUntil(() => getComputedStyle(globe).backgroundColor !== 'rgb(12, 34, 56)');
        expect(element.scrollWidth).to.be.at.most(element.clientWidth + 1);
      } finally { await resetMouse(); await setReducedMotion('no-preference'); }
    });
    it(`refreshes retained ${engine} controls after localization and configuration changes`, async () => {
      const element = await mount(engine), globe = button(element, 'globe');
      element.strings = { mapGlobe: 'Planet view', mapTerrain: 'Raised surface' }; element.dir = 'rtl';
      await element.updateComplete;
      expect(button(element, 'globe') === globe).to.equal(true);
      expect(globe.getAttribute('aria-label')).to.equal('Planet view');
      expect(button(element, 'terrain').getAttribute('aria-label')).to.equal('Raised surface');
      element.controls = { globe: true, terrain: { source: 'missing' }, attribution: false };
      await element.updateComplete; await element.whenControlsReady();
      expect(button(element, 'terrain').disabled).to.equal(true);
      expect(element.terrain).to.equal(undefined);
      expect(element.shadowRoot!.querySelector('[part="configuration-error"]')?.textContent).to.contain('A map control could not be loaded');
      element.controls = { globe: true, terrain: { source: 'elevation', exaggeration: 0 }, attribution: false };
      await element.updateComplete; await element.whenControlsReady();
      button(element, 'terrain').click(); await idle(element);
      expect(element.terrain).to.deep.equal({ source: 'elevation', exaggeration: 0 });
      expect(element.shadowRoot!.querySelector('[part="configuration-error"]')).to.equal(null);
    });
  }
});
