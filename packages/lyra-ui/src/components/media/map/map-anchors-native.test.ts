import { expect, fixture, fixtureCleanup, html, oneEvent, waitUntil } from '@open-wc/testing';
import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import './map-anchor.js';
import type { LyraMapAnchor } from './map-anchor.js';
void LyraMap;

const localStyle = () => ({ ...LYRA_MAP_EMPTY_STYLE, layers: [{ id: 'plain-background', type: 'background', paint: { 'background-color': '#ffffff' } }] });

function panel(anchor: LyraMapAnchor): HTMLElement { return anchor.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!; }
function shown(anchor: LyraMapAnchor): boolean {
  const surface = anchor.shadowRoot?.querySelector<HTMLElement>('[part~="base"]');
  return !!surface && !surface.hidden && surface.style.left !== '' && getComputedStyle(surface).visibility !== 'hidden' && surface.getBoundingClientRect().width > 0;
}

describe('lr-map-anchor with the real modular engine', function () {
  this.timeout(45000);
  let previousWorkerUrl: string;
  // A real engine needs WebGL2, which some headless browsers do not provide.
  before(function () { if (!document.createElement('canvas').getContext('webgl2')) this.skip(); });
  beforeEach(() => { previousWorkerUrl = getWorkerUrl(); setWorkerUrl(new URL('/__lyra-map-worker__/worker.mjs', location.origin).href); });
  afterEach(() => { try { fixtureCleanup(); } finally { setWorkerUrl(previousWorkerUrl); } });

  it('places two RTL anchors inside real boundaries, follows the camera and closes the focused one on Escape with focus returned', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div dir="rtl" style="inline-size:480px;position:relative"><button type="button">Outside map</button></div>`);
    const outside = wrapper.querySelector('button')!;
    const map = document.createElement('lr-map') as LyraMap;
    map.style.cssText = 'inline-size:480px;block-size:360px'; map.engine = 'modular';
    map.mapStyle = localStyle(); map.center = [0, 0]; map.zoom = 3;
    const loaded = oneEvent(map, 'lr-map-load'); wrapper.append(map); await loaded;
    await map.updateComplete; await map.whenIdle();
    const box = map.getBoundingClientRect(), wrapperBox = wrapper.getBoundingClientRect(), boundary = document.createElement('div');
    boundary.style.cssText = `position:absolute;left:${box.left - wrapperBox.left + 12}px;top:${box.top - wrapperBox.top + 12}px;width:${box.width - 24}px;height:${box.height - 24}px;pointer-events:none`;
    wrapper.append(boundary);
    map.anchorBoundary = boundary; map.anchorSafeArea = { inlineStart: 80, inlineEnd: 12, blockStart: 12, blockEnd: 12 };
    const make = (lngLat: readonly [number, number], label: string): LyraMapAnchor => {
      const anchor = document.createElement('lr-map-anchor'), action = document.createElement('button');
      action.textContent = `${label} action`; action.style.cssText = 'inline-size:150px;block-size:44px';
      anchor.lngLat = lngLat; anchor.closable = true; anchor.label = label; anchor.append(action); map.append(anchor);
      return anchor;
    };
    await focusByKeyboard(outside);
    const first = make([8, 0], 'First'), second = make([-8, 4], 'Second');
    first.open = true; second.open = true;
    await waitUntil(() => shown(first) && shown(second), 'Real projected anchors are placed', { timeout: 8000 });
    expect(document.activeElement === outside).to.equal(true);
    const clip = boundary.getBoundingClientRect(), before = panel(first).getBoundingClientRect();
    for (const anchor of [first, second]) {
      const rect = panel(anchor).getBoundingClientRect();
      expect(rect.left).to.be.at.least(clip.left - 1); expect(rect.right).to.be.at.most(clip.right + 1);
      expect(rect.top).to.be.at.least(clip.top - 1); expect(rect.bottom).to.be.at.most(clip.bottom + 1);
      expect(rect.right).to.be.at.most(box.right - 80 - 7);
    }
    expect(map.jumpTo({ center: [6, 0] })).to.equal(true); await map.whenIdle();
    await waitUntil(() => Math.abs(panel(first).getBoundingClientRect().left - before.left) > 10, 'Anchor follows native projection');
    expect(first.focusContent()).to.equal(true); expect(document.activeElement === first.querySelector('button')).to.equal(true);
    let closes = 0; first.addEventListener('lr-close', () => { closes += 1; });
    const closed = oneEvent(first, 'lr-close'); await sendKeys({ press: 'Escape' });
    expect((await closed).detail.reason).to.equal('escape'); await first.updateComplete;
    expect(panel(first).hidden).to.equal(true); expect(first.open).to.equal(false);
    expect(document.activeElement === outside).to.equal(true);
    expect(shown(second)).to.equal(true); expect(first.close()).to.equal(false); expect(closes).to.equal(1);
  });
});
