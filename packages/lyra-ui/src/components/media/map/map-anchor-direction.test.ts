import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

it('settles an open closable anchor after inherited direction changes', async () => {
  const observer = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
  const context = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
  const originalContext = HTMLCanvasElement.prototype.getContext;
  const originalDirection = document.documentElement.getAttribute('dir');
  let element: LyraMap | undefined;
  let restoreUpdate: (() => void) | undefined;
  try {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
      },
    });
    document.documentElement.setAttribute('dir', 'ltr');
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const map = document.createElement('lr-map') as LyraMap;
    element = map;
    map.engine = 'maplibre'; map.mapStyle = LYRA_MAP_EMPTY_STYLE;
    map.controls = { attribution: false };
    map.style.cssText = 'width:480px;height:320px';
    (map as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMapEngine });
    wrapper.append(map);
    await waitUntil(() => map.map !== undefined);
    await map.updateComplete;
    const peer = map.map as unknown as ControlMapEngine;
    peer.ready = true; peer.fire('load');
    await map.whenStyleReady();
    const content = document.createElement('div');
    content.slot = 'anchor'; content.textContent = 'Place details';
    content.style.cssText = 'width:160px;height:80px';
    map.append(content); map.anchorClosable = true; map.anchorLngLat = [0, 0];
    const panel = (): HTMLElement => map.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
    await waitUntil(() => !panel().hidden && panel().style.left !== '' && getComputedStyle(panel()).visibility !== 'hidden', 'initial anchor placement', { timeout: 4000 });
    const requestUpdate = map.requestUpdate;
    const updateDescriptor = Object.getOwnPropertyDescriptor(map, 'requestUpdate');
    restoreUpdate = () => {
      if (updateDescriptor) Object.defineProperty(map, 'requestUpdate', updateDescriptor);
      else Reflect.deleteProperty(map, 'requestUpdate');
    };
    let updates = 0;
    // Retire a runaway fixture before its microtasks can starve the runner's timeout.
    map.requestUpdate = (...args: Parameters<LyraMap['requestUpdate']>) => {
      updates++;
      if (updates > 32) { map.remove(); return; }
      requestUpdate.apply(map, args);
    };
    for (const direction of ['rtl', 'ltr']) {
      updates = 0;
      document.documentElement.setAttribute('dir', direction);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      await nextFrame();
      expect(updates, 'inherited direction updates must settle').to.be.lessThan(32);
      expect(map.isConnected).to.equal(true);
      await waitUntil(() => !panel().hidden && getComputedStyle(panel()).visibility !== 'hidden', 'anchor placement after direction change', { timeout: 4000 });
      expect(getComputedStyle(panel()).direction).to.equal(direction);
      const settledUpdates = updates;
      wrapper.style.padding = direction === 'rtl' ? '1px' : '2px';
      await nextFrame();
      expect(updates, 'an unrelated ancestor style change must not replay direction updates').to.equal(settledUpdates);
    }
    expect(map.closeAnchor()).to.equal(true);
    expect(map.anchorLngLat).to.equal(null);
  } finally {
    element?.remove(); restoreUpdate?.(); fixtureCleanup();
    if (originalDirection === null) document.documentElement.removeAttribute('dir');
    else document.documentElement.setAttribute('dir', originalDirection);
    if (observer) Object.defineProperty(window, 'IntersectionObserver', observer);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
    if (context) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', context);
  }
});
