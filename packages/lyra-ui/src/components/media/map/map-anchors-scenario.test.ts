import { expect, fixtureCleanup, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { composedContains } from '../../../internal/composed-tree.js';
import {
  addAnchor, base, captureCloses, closeButton, deepActive, isPlaced, mountMap, placed, restoreMapEnvironment, stubMapEnvironment,
} from '../../../../test/map-anchors.js';
import type { LyraMapAnchor } from './map-anchor.js';

// Two independently owned feature-detail panels, each a header over 45 scrolling detail rows, the
// shape a map application builds from two modules that each own their own panel.
const RECIPE = `
  lr-map-anchor.details::part(body) { display: flex; flex-direction: column; overflow: hidden; }
  .detail-card { display: flex; flex-direction: column; min-block-size: 0; }
  .detail-card > header { flex: none; font-weight: bold; }
  .detail-card > .rows { min-block-size: 0; overflow: auto; }
`;

function card(title: string): HTMLElement {
  const root = document.createElement('article'), header = document.createElement('header'), rows = document.createElement('div');
  root.className = 'detail-card'; header.textContent = title; rows.className = 'rows';
  for (let index = 1; index <= 45; index++) {
    const row = document.createElement('p'); row.style.margin = '0'; row.textContent = `${title} detail ${index}`; rows.append(row);
  }
  root.append(header, rows);
  return root;
}

/** Live ResizeObservers and what they observe, to prove that removal leaves none on the anchors. */
function trackObservers(): { observing(node: Element): boolean; restore(): void } {
  const Original = window.ResizeObserver, live = new Set<{ targets: Element[] }>();
  class Tracked extends Original {
    readonly targets: Element[] = [];
    constructor(callback: ResizeObserverCallback) { super(callback); live.add(this); }
    override observe(target: Element, options?: ResizeObserverOptions): void { this.targets.push(target); super.observe(target, options); }
    override disconnect(): void { live.delete(this); super.disconnect(); }
  }
  window.ResizeObserver = Tracked;
  return {
    observing: node => [...live].some(observer => observer.targets.some(target => composedContains(node, target))),
    restore: () => { window.ResizeObserver = Original; },
  };
}

describe('lr-map-anchor independent detail panels', () => {
  beforeEach(() => { stubMapEnvironment(); });
  afterEach(() => { fixtureCleanup(); restoreMapEnvironment(); });

  for (const direction of ['ltr', 'rtl'] as const) {
    it(`keeps two ${direction} detail panels open with fixed headers, scrolling rows and an inline-end close action`, async () => {
      const observers = trackObservers();
      try {
        const { map, wrapper } = await mountMap(element => { element.setAttribute('dir', direction); element.style.blockSize = '480px'; });
        const style = document.createElement('style'); style.textContent = RECIPE; wrapper.append(style);
        const poi = addAnchor(map, { lngLat: [-8, 6], closable: true, label: 'Place details', content: card('Place') });
        const power = addAnchor(map, { lngLat: [8, -6], closable: true, label: 'Power line', content: card('Power') });
        for (const anchor of [poi, power]) anchor.classList.add('details');
        const poiLog = captureCloses(poi), powerLog = captureCloses(power);
        await placed(poi, power);
        for (const anchor of [poi, power]) {
          const panel = base(anchor).getBoundingClientRect(), close = closeButton(anchor).getBoundingClientRect();
          expect(panel.top).to.be.at.least(0); expect(panel.bottom).to.be.at.most(window.innerHeight);
          expect(panel.left).to.be.at.least(0); expect(panel.right).to.be.at.most(window.innerWidth);
          if (direction === 'rtl') expect(close.left - panel.left).to.be.at.most(20);
          else expect(panel.right - close.right).to.be.at.most(20);
          const header = anchor.querySelector('header')!, rows = anchor.querySelector<HTMLElement>('.rows')!;
          expect(rows.scrollHeight).to.be.greaterThan(rows.clientHeight);
          const top = header.getBoundingClientRect().top;
          rows.scrollTop = 200; await nextFrame();
          expect(rows.scrollTop).to.be.greaterThan(0);
          expect(Math.abs(header.getBoundingClientRect().top - top)).to.be.below(1);
        }
        await focusByKeyboard(closeButton(poi)); await sendKeys({ press: 'Enter' }); await poi.updateComplete;
        expect(poiLog.order).to.deep.equal(['request:close-button', 'close:close-button']);
        expect(power.open).to.equal(true); await placed(power); expect(isPlaced(power)).to.equal(true); expect(powerLog.order).to.deep.equal([]);
        map.remove(); await nextFrame();
        expect(power.style.getPropertyValue('--lr-overlay-stack-index')).to.equal('');
        await waitUntil(() => !observers.observing(poi) && !observers.observing(power), 'no resize observer is left on the anchors');
      } finally { observers.restore(); }
    });
  }

  it('lets a close listener remove its own focused anchor and returns focus to its previous owner', async () => {
    const { map, wrapper } = await mountMap();
    const outside = document.createElement('button'); outside.textContent = 'Open details';
    wrapper.insertBefore(outside, map); await focusByKeyboard(outside);
    const owned: LyraMapAnchor = addAnchor(map, { closable: true, content: card('Owned') });
    await placed(owned);
    expect(owned.focusContent()).to.equal(true);
    owned.addEventListener('lr-close', () => { owned.remove(); }, { once: true });
    expect(owned.close()).to.equal(true);
    expect(owned.isConnected).to.equal(false); expect(base(owned).hidden).to.equal(true);
    expect(deepActive() === outside).to.equal(true);
  });
});
