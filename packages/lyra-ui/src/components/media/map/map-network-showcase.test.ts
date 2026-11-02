import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { NetworkMonitoringShowcase } from './map.stories.js';
import type { LyraMap } from './map.class.js';
import type { LyraSequencePlayback } from '../sequence-playback/sequence-playback.class.js';
import './map.js';
import '../sequence-playback/sequence-playback.js';

// The story localizes its own copy only; composed controls keep their English defaults in Arabic.
expectLocaleFallback('ar', ['mapScene', 'mapSceneShow', 'mapSceneHide', 'mapSceneUnavailable', 'mapSceneMarker', 'zoomIn',
  'zoomOut', 'mapResetNorth', 'play', 'pause', 'playbackPosition', 'playbackStepPosition']);
const text = (root: HTMLElement, selector: string): string => root.querySelector(selector)?.textContent?.trim() ?? '';
const button = (root: HTMLElement, selector: string): HTMLButtonElement => {
  const value = root.querySelector<HTMLButtonElement>(selector);
  if (!value) throw new Error(`Missing ${selector}`);
  return value;
};

describe('network monitoring showcase story', function () {
  this.timeout(30000);
  let workerUrl: string;
  before(function () { if (!document.createElement('canvas').getContext('webgl2')) this.skip(); });
  beforeEach(() => { workerUrl = getWorkerUrl(); setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href); });
  afterEach(() => { fixtureCleanup(); setWorkerUrl(workerUrl); });

  async function mount() {
    const wrapper = await fixture<HTMLElement>(html`<div>${NetworkMonitoringShowcase.render!({}, null as never)}</div>`);
    const root = wrapper.querySelector<HTMLElement>('section')!;
    const map = root.querySelector<LyraMap>('lr-map')!;
    const playback = root.querySelector<LyraSequencePlayback>('lr-sequence-playback')!;
    await waitUntil(() => playback.itemCount === 9 && (map.markers?.length ?? 0) > 0, 'synthetic data loaded', { timeout: 5000 });
    await map.whenStyleReady();
    await waitUntil(() => !button(root, '[data-camera="save"]').disabled, 'camera session acquired', { timeout: 5000 });
    return { root, map, playback };
  }

  it('synchronizes playback, map inputs and the detail panel from one clock', async () => {
    const { root, map, playback } = await mount();
    expect(text(root, '[data-time]')).to.contain('1/9');
    playback.goTo(3); await playback.updateComplete;
    await waitUntil(() => text(root, '[data-time]').includes('4/9'));
    expect(root.querySelectorAll('[data-history] li')).to.have.length(9);
    expect(root.querySelectorAll('[data-history] li')[3]!.getAttribute('aria-current')).to.equal('time');
    expect(map.scene?.objects.map(object => object.id)).to.include('relay-1');
    expect(map.dataLayers.map(layer => layer.sourceId)).to.deep.equal(['regions-clear', 'regions-advisory', 'links-available', 'links-unavailable']);
    await expect(root).to.be.accessible();
  });

  it('operates saved views and following from the keyboard', async () => {
    const { root, map } = await mount();
    await focusByKeyboard(button(root, '[data-camera="save"]'));
    await sendKeys({ press: 'Enter' });
    expect(button(root, '[data-camera="restore"]').disabled).to.equal(false);
    map.jumpTo({ center: [10, 40], zoom: 3 });
    await focusByKeyboard(button(root, '[data-camera="restore"]'));
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => Math.abs(map.center[0]! - -0.5) < 1e-3, 'restored view', { timeout: 5000 });
    const select = root.querySelector<HTMLSelectElement>('[data-node]')!;
    select.value = 'station-c'; select.dispatchEvent(new Event('change'));
    button(root, '[data-camera="follow"]').click();
    await waitUntil(() => text(root, '[data-camera-status]').includes('station-c'));
    expect(text(root, '[data-detail-status]')).to.equal('Available');
  });

  it('presents loading, empty and failure states with a retry path', async () => {
    const { root } = await mount();
    const layout = root.querySelector<HTMLElement>('[data-layout]')!;
    button(root, '[data-state="empty"]').click();
    expect(layout.hidden).to.equal(true);
    expect(text(root, '[data-state-text]')).to.equal('No observations in the selected range.');
    button(root, '[data-state="failure"]').click();
    expect(text(root, '[data-state-text]')).to.equal('Observations could not be loaded.');
    expect(button(root, '[data-retry]').hidden).to.equal(false);
    button(root, '[data-retry]').click();
    expect(text(root, '[data-state-text]')).to.equal('Loading synthetic observations…');
    expect(layout.getAttribute('aria-busy')).to.equal('true');
    await waitUntil(() => !layout.hidden, 'ready again', { timeout: 5000 });
    expect(button(root, '[data-state="ready"]').getAttribute('aria-pressed')).to.equal('true');
  });

  it('localizes its own copy and mirrors direction', async () => {
    const { root } = await mount();
    const language = root.querySelector<HTMLSelectElement>('[data-language]')!;
    language.value = 'ar'; language.dispatchEvent(new Event('change'));
    expect(root.dir).to.equal('rtl');
    expect(text(root, '[data-copy="save"]')).to.equal('حفظ العرض');
  });
});
