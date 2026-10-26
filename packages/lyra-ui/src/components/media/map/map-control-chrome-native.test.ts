import { expect, fixture, fixtureCleanup, html, oneEvent, waitUntil } from '@open-wc/testing';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
void LyraMap;

function part<T extends Element = HTMLElement>(element: LyraMap, name: string): T {
  const node = element.shadowRoot!.querySelector<T>(`[part~="${name}"]`);
  if (!node) throw new Error(`Missing native ${name}`);
  return node;
}

describe('lr-map native peer chrome hooks', function () {
  this.timeout(30000);
  let workerUrl: string;
  before(function () { if (!document.createElement('canvas').getContext('webgl2')) this.skip(); });
  beforeEach(() => {
    workerUrl = getWorkerUrl();
    setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href);
  });
  afterEach(() => { fixtureCleanup(); setWorkerUrl(workerUrl); });

  for (const engine of ['modular', 'maplibre'] as const) {
    it(`keeps ${engine} compass rotation, keyboard disclosure and replacement controls behind public parts`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<section style="inline-size:390px"></section>`);
      const element = document.createElement('lr-map') as LyraMap;
      element.engine = engine; element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
      element.style.cssText = 'inline-size:100%;block-size:400px';
      element.controls = {
        navigation: { position: 'bottom-right' }, scale: { position: 'bottom-left' },
        geolocate: { position: 'bottom-right' },
        attribution: { position: 'bottom-right', compact: true, customAttribution: { label: 'Map contributors', url: 'https://example.com/credits' } },
      };
      const loaded = oneEvent(element, 'lr-map-load');
      wrapper.append(element); await loaded; await element.whenIdle();
      await waitUntil(() => !!element.shadowRoot!.querySelector('[part~="compass-icon"]'));
      const compass = part(element, 'compass-icon');
      expect(element.jumpTo({ bearing: 37 })).to.equal(true);
      await waitUntil(() => compass.style.transform.includes('-37deg'), 'native compass rotation reaches exposed span');
      expect(getComputedStyle(compass, '::before').maskImage).to.contain('data:image/svg+xml');
      expect(part(element, 'controls').contains(part(element, 'controls-bottom-right'))).to.equal(true);
      expect(part(element, 'geolocate-icon').parentElement === part(element, 'geolocate')).to.equal(true);

      const attribution = part<HTMLDetailsElement>(element, 'attribution');
      const toggle = part(element, 'attribution-toggle');
      await focusByKeyboard(toggle);
      const initial = attribution.open;
      await sendKeys({ press: 'Enter' });
      await waitUntil(() => attribution.open !== initial && toggle.part.contains('attribution-expanded') === attribution.open);
      if (!attribution.open) {
        await sendKeys({ press: 'Enter' });
        await waitUntil(() => attribution.open && toggle.part.contains('attribution-expanded'));
      }
      const link = part<HTMLAnchorElement>(element, 'attribution-link');
      expect(link.href).to.equal('https://example.com/credits');
      expect(link.getBoundingClientRect().height).to.be.at.least(24);
      expect(part(element, 'attribution-content').part.contains('attribution-expanded')).to.equal(true);
      await sendKeys({ press: 'Tab' });
      expect(element.shadowRoot!.activeElement === link).to.equal(true);

      element.controls = { attribution: false };
      await waitUntil(() => !compass.isConnected, 'retired native controls removed');
      element.controls = { navigation: true, attribution: false };
      await waitUntil(() => !!element.shadowRoot!.querySelector('[part~="compass-icon"]'), 'replacement native control projected');
      const replacement = part(element, 'compass-icon');
      expect(replacement === compass).to.equal(false);
      expect(replacement.style.transform).to.contain('-37deg');
    });
  }
});
