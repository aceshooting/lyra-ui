import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { LitElement } from 'lit';
import { sendKeys } from '@web/test-runner-commands';
import { captureDevWarnings, expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import {
  addAnchor, AnchorMapEngine, base, captureCloses, content, deepActive, hidden, isPlaced, mountMap, placed,
  restoreMapEnvironment, stubMapEnvironment, zIndex,
} from '../../../../test/map-anchors.js';
import * as anchorRuntime from './map-anchor-controller.js';
import { __setMapFeatureImporterForTesting, loadMapAnchorRuntime } from './map-feature-loader.js';
import { LYRA_MAP_EMPTY_STYLE } from './map.js';
import type { LyraMapAnchor } from './map-anchor.js';

/** Caller-owned live content: a Lit element with internal state and a counted listener. */
class AnchorProbeCard extends LitElement {
  static override properties = { count: { state: true } };
  count = 0;
  override render() { return html`<button type="button" @click=${() => { this.count += 1; }}>Count ${this.count}</button>`; }
}
customElements.define('anchor-probe-card', AnchorProbeCard);

function noEscapeOwner(): Promise<boolean> {
  return new Promise(resolve => {
    const observe = (event: KeyboardEvent): void => { document.removeEventListener('keydown', observe); resolve(!event.defaultPrevented); };
    document.addEventListener('keydown', observe);
    void sendKeys({ press: 'Escape' });
  });
}

describe('lr-map-anchor lifecycle and content identity', () => {
  beforeEach(() => { stubMapEnvironment(); });
  afterEach(async () => {
    await resetMouse(); fixtureCleanup(); restoreMapEnvironment();
    __setMapFeatureImporterForTesting(loadMapAnchorRuntime);
  });

  it('creates its slot for initial and later anchors and removes it after the final assignment leaves', async () => {
    expectDevWarning('lyra-map-anchor-unattached:slot');
    let initial: LyraMapAnchor | undefined;
    const { map, wrapper } = await mountMap(element => { initial = addAnchor(element); });
    const anchor = initial!;
    await placed(anchor);
    expect(anchor.slot).to.equal('anchors');
    expect(map.shadowRoot!.querySelectorAll('slot[name="anchors"]').length).to.equal(1);
    anchor.remove();
    await waitUntil(() => map.shadowRoot!.querySelectorAll('slot[name="anchors"]').length === 0, 'unused anchor slot removed');

    const holder = document.createElement('div'); holder.slot = 'anchors';
    const wrapped = addAnchor(holder); map.append(holder);
    await placed(wrapped);
    holder.slot = 'anchor';
    await hidden(wrapped);
    await waitUntil(() => map.shadowRoot!.querySelectorAll('slot[name="anchors"]').length === 0, 'reassigned wrapper releases the slot');
    holder.slot = 'anchors'; await placed(wrapped);
    holder.remove();
    await waitUntil(() => map.shadowRoot!.querySelectorAll('slot[name="anchors"]').length === 0, 'removed wrapper releases the slot');

    map.remove();
    const reconnected = addAnchor(map);
    wrapper.append(map);
    await waitUntil(() => map.map !== undefined, 'engine rebuilt after anchors were added while disconnected');
    (map.map as unknown as AnchorMapEngine).fire('load'); await map.whenStyleReady(); await placed(reconnected);
    expect(map.shadowRoot!.querySelectorAll('slot[name="anchors"]').length).to.equal(1);
  });

  it('keeps the caller\'s content node, listeners and component state through moves, off-screen, a style swap and a reconnect', async () => {
    const { map, engine, wrapper } = await mountMap();
    const card = new AnchorProbeCard(), anchor = addAnchor(map, { content: card, closable: true });
    let clicks = 0; card.addEventListener('click', () => { clicks += 1; });
    await placed(anchor); await card.updateComplete;
    card.shadowRoot!.querySelector('button')!.click(); await card.updateComplete;
    engine.pan(3); await placed(anchor);
    engine.projected = { x: -40, y: 10 }; engine.fire('move'); await hidden(anchor);
    engine.projected = undefined; engine.fire('move'); await placed(anchor);
    // A same-engine style replacement keeps the anchor placed and focus inside it.
    await focusByKeyboard(card.shadowRoot!.querySelector('button')!);
    engine.synchronousStyle = false;
    map.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; await map.updateComplete; await nextFrame();
    expect(base(anchor).hidden).to.equal(false); expect(deepActive() === card.shadowRoot!.querySelector('button')).to.equal(true);
    engine.ready = true; engine.fire('style.load'); await map.whenStyleReady(); await placed(anchor);
    wrapper.removeChild(map); wrapper.append(map);
    await waitUntil(() => map.map !== undefined && map.map !== engine as unknown, 'a new engine after reconnect');
    (map.map as unknown as AnchorMapEngine).fire('load'); await map.whenStyleReady(); await placed(anchor);
    card.shadowRoot!.querySelector('button')!.click(); await card.updateComplete;
    expect(anchor.firstElementChild === card).to.equal(true); expect(card.isConnected).to.equal(true);
    expect(card.count).to.equal(2); expect(clicks).to.equal(2);
  });

  it('re-places growing and shrinking content, flips when it no longer fits above, and hides an emptied anchor without closing it', async () => {
    const { map } = await mountMap();
    const box = document.createElement('div'); box.style.cssText = 'inline-size: 120px; block-size: 40px';
    const anchor = addAnchor(map, { lngLat: [0, 6], content: box }), log = captureCloses(anchor);
    await placed(anchor);
    const point = map.getBoundingClientRect().top + 100;
    expect(base(anchor).getBoundingClientRect().bottom).to.be.at.most(point);
    // Fits below the point but not above it; oversized content instead shifts across the point.
    box.style.blockSize = '150px';
    await waitUntil(() => base(anchor).getBoundingClientRect().top >= point, 'flipped below the point');
    box.style.blockSize = '40px';
    await waitUntil(() => base(anchor).getBoundingClientRect().bottom <= point, 'returned above the point');
    expect(isPlaced(anchor)).to.equal(true);
    box.remove(); await hidden(anchor);
    expect(anchor.open).to.equal(true); expect(log.order).to.deep.equal([]);
    anchor.append(box); await placed(anchor);
  });

  it('retires placement, Escape ownership and overlay leases on map disconnect without events, and re-places after reconnect', async () => {
    const { map, wrapper } = await mountMap();
    const anchor = addAnchor(map, { closable: true }), log = captureCloses(anchor);
    await placed(anchor);
    expect(anchor.style.getPropertyValue('--lr-overlay-stack-index')).not.to.equal('');
    map.remove();
    expect(anchor.style.getPropertyValue('--lr-overlay-stack-index')).to.equal('');
    expect(document.querySelectorAll('[data-lr-open-overlay-descendant]').length).to.equal(0);
    expect(map.shadowRoot!.querySelectorAll('[data-lr-open-overlay-descendant]').length).to.equal(0);
    expect(await noEscapeOwner()).to.equal(true);
    wrapper.append(map);
    await waitUntil(() => map.map !== undefined, 'engine rebuilt');
    (map.map as unknown as AnchorMapEngine).fire('load'); await map.whenStyleReady(); await placed(anchor);
    expect(log.order).to.deep.equal([]); expect(anchor.open).to.equal(true);
  });

  it('moves with its map into an iframe document and owns Escape there', async () => {
    const iframe = document.createElement('iframe'); iframe.style.cssText = 'inline-size: 600px; block-size: 400px';
    document.body.append(iframe);
    const frameWindow = iframe.contentWindow! as Window & typeof globalThis, frameDocument = iframe.contentDocument!;
    const frameContext = frameWindow.HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(frameWindow, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(frameWindow.HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : frameContext.call(this, id as never, ...(rest as [])); } });
    try {
      const { map } = await mountMap();
      const anchor = addAnchor(map, { closable: true }), log = captureCloses(anchor);
      await placed(anchor);
      frameDocument.body.append(frameDocument.adoptNode(map));
      await waitUntil(() => map.map !== undefined && map.ownerDocument === frameDocument, 'engine rebuilt in the frame');
      (map.map as unknown as AnchorMapEngine).fire('load'); await map.whenStyleReady();
      await waitUntil(() => !base(anchor).hidden && base(anchor).style.left !== '', 'placed in the frame', { timeout: 4000 });
      frameDocument.dispatchEvent(new frameWindow.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await anchor.updateComplete;
      expect(log.order).to.deep.equal(['request:escape', 'close:escape']);
    } finally { iframe.remove(); }
  });

  it('returns focus a removal dropped, retires the removed anchor and places it again in another map', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Return here</button>`); await focusByKeyboard(outside);
    const first = await mountMap(), second = await mountMap();
    const anchor = addAnchor(first.map, { closable: true }), log = captureCloses(anchor);
    await placed(anchor);
    expect(anchor.focusContent()).to.equal(true);
    anchor.remove();
    await waitUntil(() => deepActive() === outside, 'focus returned after removal');
    expect(await noEscapeOwner()).to.equal(true);
    second.map.append(anchor); await placed(anchor);
    expect(log.order).to.deep.equal([]); expect(anchor.slot).to.equal('anchors');
    await waitUntil(() => first.map.shadowRoot!.querySelectorAll('slot[name="anchors"]').length === 0, 'the old map releases its empty anchor slot');
  });

  it('hides every anchor while an ancestor is inert and places them again once unblocked', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Outside</button>`); await focusByKeyboard(outside);
    const { map, wrapper } = await mountMap();
    const west = addAnchor(map, { lngLat: [-8, 0] }), east = addAnchor(map, { lngLat: [8, 0], closable: true });
    await placed(west, east);
    expect(east.focusContent()).to.equal(true);
    wrapper.inert = true;
    await hidden(west, east);
    expect(east.focusContent()).to.equal(false); expect(deepActive() === outside).to.equal(true);
    wrapper.inert = false;
    await placed(west, east);
    expect(deepActive() === outside).to.equal(true);
  });

  it('places 16 open attached anchors without counting a nested authored slot, and admits a later anchor when one closes', async () => {
    const { map } = await mountMap(element => {
      const legacy = content('Slot action'); legacy.slot = 'anchor';
      element.append(legacy); element.anchorLngLat = [0, 0];
    });
    const anchors: LyraMapAnchor[] = [];
    const nested = document.createElement('lr-map-anchor');
    nested.slot = 'anchors'; nested.lngLat = [0, 0]; nested.append(content('Nested action'));
    const warnings = await captureDevWarnings(async () => {
      for (let index = 0; index < 17; index++) anchors.push(addAnchor(map, { lngLat: [(index % 6) * 3 - 8, Math.floor(index / 6) * 4 - 4] }));
      anchors[0]!.append(nested); nested.open = true;
      await placed(...anchors.slice(0, 16));
      await new Promise(resolve => { setTimeout(resolve, 20); });
      expect(base(nested).hidden).to.equal(true); expect(nested.focusContent()).to.equal(false);
    });
    expectDevWarning('lyra-map-anchor-limit'); expectDevWarning('lyra-map-anchor-unattached:nested');
    expect(warnings.filter(message => message.includes('only the first 16')).length).to.equal(1);
    expect(warnings.some(message => message.includes('nested in another anchor'))).to.equal(true);
    expect(base(anchors[16]!).hidden).to.equal(true); expect(anchors[16]!.open).to.equal(true);
    expect(Math.max(...anchors.slice(0, 16).map(zIndex)) - Math.min(...anchors.slice(0, 16).map(zIndex))).to.equal(15);
    const legacy = map.shadowRoot!.querySelector<HTMLElement>('[part="anchor"]')!;
    await waitUntil(() => !legacy.hidden && legacy.style.left !== '', 'slot anchor placed');
    expect(new Set([...anchors.slice(0, 16).map(zIndex), Number.parseInt(getComputedStyle(legacy).zIndex, 10)]).size).to.equal(17);
    anchors[3]!.open = false;
    await placed(anchors[16]!);
    expect(base(anchors[3]!).hidden).to.equal(true);
  });

  it('attaches only through the anchors slot: another slot, a nested anchor and an authored slot stay hidden, a wrapper attaches', async () => {
    const { map } = await mountMap();
    const host = addAnchor(map, { lngLat: [-8, 0] });
    await placed(host);
    const warnings = await captureDevWarnings(async () => {
      const wrongSlot = document.createElement('lr-map-anchor'); wrongSlot.slot = 'anchor'; wrongSlot.append(content()); wrongSlot.lngLat = [0, 0];
      map.append(wrongSlot); wrongSlot.open = true;
      const nested = document.createElement('lr-map-anchor'); nested.append(content()); nested.lngLat = [0, 0];
      host.append(nested); nested.open = true;
      await wrongSlot.updateComplete; await nested.updateComplete;
      await new Promise(resolve => { setTimeout(resolve, 20); });
      expect(wrongSlot.slot).to.equal('anchor');
      expect(base(wrongSlot).hidden).to.equal(true); expect(base(nested).hidden).to.equal(true);
      expect(wrongSlot.focusContent()).to.equal(false); expect(nested.focusContent()).to.equal(false);
    });
    expectDevWarning('lyra-map-anchor-unattached:slot'); expectDevWarning('lyra-map-anchor-unattached:nested');
    expect(warnings.some(message => message.includes('another slot'))).to.equal(true);
    expect(warnings.some(message => message.includes('nested in another anchor'))).to.equal(true);
    const wrapper = document.createElement('div'); wrapper.slot = 'anchors';
    const wrapped = addAnchor(wrapper, { lngLat: [8, 0] }); map.append(wrapper);
    await placed(wrapped);
    expect(wrapped.hasAttribute('slot')).to.equal(false);
  });

  it('imports the shared anchor runtime once for many anchors, keeps them hidden when it fails and retries on a new request', async () => {
    let imports = 0, fail = true;
    __setMapFeatureImporterForTesting(loadMapAnchorRuntime, async () => {
      imports += 1;
      if (fail) throw new Error('Runtime chunk unavailable');
      return anchorRuntime;
    });
    const { map } = await mountMap();
    const west = addAnchor(map, { lngLat: [-8, 0] }), east = addAnchor(map, { lngLat: [8, 0] });
    await waitUntil(() => imports === 1, 'one import attempt'); await nextFrame();
    expect(base(west).hidden).to.equal(true); expect(base(east).hidden).to.equal(true);
    fail = false; west.lngLat = [-7, 0];
    await placed(west, east);
    const third = addAnchor(map, { lngLat: [0, 3] }); await placed(third);
    expect(imports).to.equal(2);
  });

  it('re-places sixteen anchors once per frame however many camera moves arrive', async () => {
    const { map, engine } = await mountMap();
    const anchors: LyraMapAnchor[] = [];
    for (let index = 0; index < 16; index++) anchors.push(addAnchor(map, { lngLat: [(index % 4) * 4 - 6, Math.floor(index / 4) * 3 - 4], closable: true }));
    await placed(...anchors);
    const prototype = anchorRuntime.MapAnchorController.prototype, sync = prototype.sync;
    let syncs = 0;
    prototype.sync = function (this: anchorRuntime.MapAnchorController) { syncs += 1; sync.call(this); };
    try {
      await nextFrame();
      syncs = 0;
      for (let move = 0; move < 20; move++) { engine.center = { lng: move / 10, lat: 0 }; engine.fire('move'); }
      await nextFrame(); await nextFrame();
      expect(syncs).to.equal(16);
    } finally { prototype.sync = sync; }
    await placed(...anchors);
  });

  it('raises an anchor on a press, survives an interrupted press and never lets a drag on it reach the map', async () => {
    const { map, engine } = await mountMap();
    const back = addAnchor(map, { lngLat: [-2, 0] }), front = addAnchor(map, { lngLat: [2, 0] });
    await placed(back, front);
    await waitUntil(() => zIndex(front) > zIndex(back), 'the later anchor is painted in front');
    let canvasPresses = 0;
    map.shadowRoot!.querySelector('[part="container"]')!.addEventListener('pointerdown', () => { canvasPresses += 1; });
    const camera = { ...engine.center }, button = back.querySelector('button')!;
    let clicks = 0; button.addEventListener('click', () => { clicks += 1; });
    const rect = base(back).getBoundingClientRect();
    await sendMouse({ type: 'move', position: [Math.round(rect.left + 6), Math.round(rect.top + 6)] });
    await sendMouse({ type: 'down' });
    await waitUntil(() => zIndex(back) > zIndex(front), 'the pressed anchor came to the front');
    base(back).dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, composed: true }));
    await sendMouse({ type: 'move', position: [Math.round(rect.left + 106), Math.round(rect.top + 46)] });
    await sendMouse({ type: 'up' });
    const target = button.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(target.left + target.width / 2), Math.round(target.top + target.height / 2)] });
    await waitUntil(() => clicks === 1, 'the control still responds');
    expect(canvasPresses).to.equal(0); expect(engine.center).to.deep.equal(camera); expect(isPlaced(back)).to.equal(true);
  });
});
