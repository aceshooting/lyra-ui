import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import {
  addAnchor, AnchorMapEngine, base, content, deepActive, hidden, isPlaced, mountMap, placed, restoreMapEnvironment, stubMapEnvironment, zIndex,
} from '../../../../test/map-anchors.js';
import { LYRA_MAP_EMPTY_STYLE } from './map.js';
import type { LyraMapAnchor } from './map-anchor.js';

function field(label: string, autofocus = false): HTMLInputElement {
  const input = document.createElement('input');
  input.setAttribute('aria-label', label); input.autofocus = autofocus;
  return input;
}

/** Counts requestUpdate() calls, retiring a runaway element before it can starve the runner. */
function countUpdates(elements: readonly HTMLElement[]): { value: number; restore(): void } {
  const counter = { value: 0, restore: () => undefined as void };
  const restores = elements.map(element => {
    const own = Object.getOwnPropertyDescriptor(element, 'requestUpdate');
    const original = (element as unknown as { requestUpdate: (...args: unknown[]) => void }).requestUpdate;
    (element as unknown as { requestUpdate: (...args: unknown[]) => void }).requestUpdate = (...args: unknown[]) => {
      counter.value += 1;
      if (counter.value > 64) { element.remove(); return; }
      original.apply(element, args);
    };
    return () => { if (own) Object.defineProperty(element, 'requestUpdate', own); else Reflect.deleteProperty(element, 'requestUpdate'); };
  });
  counter.restore = () => { for (const restore of restores) restore(); };
  return counter;
}

describe('lr-map-anchor focus and keyboard', () => {
  beforeEach(() => { stubMapEnvironment(); });
  afterEach(() => { fixtureCleanup(); restoreMapEnvironment(); });

  it('returns focus from an input when a camera command takes its anchor off screen, and does not take it back', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Before the map</button>`); await focusByKeyboard(outside);
    const { map } = await mountMap();
    const input = field('Note'), form = document.createElement('div'); form.append(input);
    const anchor = addAnchor(map, { content: form });
    await placed(anchor);
    expect(deepActive() === outside).to.equal(true);
    expect(anchor.focusContent()).to.equal(true); expect(deepActive() === input).to.equal(true);
    expect(map.easeTo({ center: [40, 0] })).to.equal(true);
    await hidden(anchor);
    await waitUntil(() => deepActive() === outside, 'focus returned to where it came from');
    expect(anchor.open).to.equal(true);
    map.easeTo({ center: [0, 0] }); await placed(anchor); await nextFrame();
    expect(deepActive() === outside).to.equal(true);
  });

  it('focuses [autofocus] content once per opening, not after hiding, a style swap or reconnecting', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Outside</button>`); await focusByKeyboard(outside);
    const { map, engine, wrapper } = await mountMap();
    const search = field('Search', true), form = content(); form.append(search);
    const anchor = addAnchor(map, { content: form });
    await placed(anchor);
    await waitUntil(() => deepActive() === search, 'autofocus on the first placement');
    await focusByKeyboard(outside);
    engine.projected = { x: -50, y: 10 }; engine.fire('move'); await hidden(anchor);
    engine.projected = undefined; engine.fire('move'); await placed(anchor); await nextFrame();
    expect(deepActive() === outside).to.equal(true);
    map.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; await map.updateComplete; await map.whenStyleReady(); await placed(anchor); await nextFrame();
    expect(deepActive() === outside).to.equal(true);
    map.remove(); wrapper.append(map);
    await waitUntil(() => map.map !== undefined && map.map !== engine as unknown, 'engine rebuilt after reconnect');
    (map.map as unknown as AnchorMapEngine).fire('load'); await map.whenStyleReady(); await placed(anchor); await nextFrame();
    expect(deepActive() === outside).to.equal(true);
    anchor.open = false; await anchor.updateComplete;
    anchor.open = true; await placed(anchor);
    await waitUntil(() => deepActive() === search, 'autofocus after reopening');
  });

  it('stacks two anchors at one coordinate by recency, brings the focused one to the front and closes each independently', async () => {
    const { map } = await mountMap();
    const sized = (label: string): HTMLElement => { const node = content(label); node.style.inlineSize = '150px'; return node; };
    const back = addAnchor(map, { closable: true, content: sized('Back action') });
    await placed(back);
    const front = addAnchor(map, { closable: true, content: sized('Next action') });
    await placed(front);
    const backRect = base(back).getBoundingClientRect(), frontRect = base(front).getBoundingClientRect();
    expect(Math.abs(backRect.left - frontRect.left)).to.be.below(1); expect(Math.abs(backRect.top - frontRect.top)).to.be.below(1);
    expect(zIndex(front)).to.be.greaterThan(zIndex(back));
    const point = [Math.round(frontRect.left + frontRect.width / 2), Math.round(frontRect.top + frontRect.height / 2)] as const;
    const hit = (): Element | null => document.elementFromPoint(point[0], point[1]);
    const inside = (anchor: LyraMapAnchor): boolean => { const node = hit(); return !!node && (node === anchor || anchor.contains(node)); };
    expect(inside(front)).to.equal(true);
    const updates = countUpdates([map, back, front]);
    try {
      await focusByKeyboard(back.querySelector('button')!);
      await waitUntil(() => zIndex(back) > zIndex(front), 'the focused anchor came to the front');
      expect(inside(back)).to.equal(true);
      await sendKeys({ press: 'Tab' });
      expect(back.shadowRoot!.activeElement === back.shadowRoot!.querySelector('[part~="close-button"]')).to.equal(true);
      await sendKeys({ press: 'Tab' });
      expect(deepActive() === front.querySelector('button')).to.equal(true);
      await waitUntil(() => zIndex(front) > zIndex(back), 'Tab reached the covered anchor and raised it');
      await nextFrame(); await nextFrame();
      expect(updates.value).to.be.below(24);
    } finally { updates.restore(); }
    expect(back.close()).to.equal(true); expect(front.open).to.equal(true); expect(isPlaced(front)).to.equal(true);
    expect(front.close()).to.equal(true); expect(base(front).hidden).to.equal(true);
  });

  it('refuses focusContent() for an unplaced, empty, off-screen or inert anchor and never queues focus', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Outside</button>`); await focusByKeyboard(outside);
    const { map, engine } = await mountMap();
    const anchor = addAnchor(map);
    expect(anchor.focusContent()).to.equal(false);
    await placed(anchor);
    anchor.replaceChildren(document.createTextNode('Read only details')); await anchor.updateComplete; await placed(anchor);
    expect(anchor.focusContent()).to.equal(false);
    anchor.replaceChildren(content()); await placed(anchor);
    engine.projected = { x: 9999, y: 0 }; engine.fire('move'); await hidden(anchor);
    expect(anchor.focusContent()).to.equal(false);
    engine.projected = undefined; engine.fire('move'); await placed(anchor);
    anchor.inert = true;
    expect(anchor.focusContent()).to.equal(false);
    anchor.inert = false; await nextFrame(); await nextFrame();
    expect(deepActive() === outside).to.equal(true);
    expect(anchor.focusContent()).to.equal(true);
  });

  it('restores the newest anchor paint and Escape order when focus leaves both anchors', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Outside</button>`);
    const { map } = await mountMap();
    const first = addAnchor(map, { closable: true }); await placed(first);
    await focusByKeyboard(first.querySelector('button')!);
    const newest = addAnchor(map, { closable: true }); await placed(newest);
    expect(zIndex(first)).to.be.greaterThan(zIndex(newest));
    await focusByKeyboard(outside);
    await waitUntil(() => zIndex(newest) > zIndex(first), 'the newest anchor comes forward after focus leaves');
    await sendKeys({ press: 'Escape' }); await newest.updateComplete;
    expect(newest.open).to.equal(false); expect(first.open).to.equal(true);
  });

  it('returns focus when the caller removes the focused content and leaves its anchor empty', async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Open details</button>`);
    await focusByKeyboard(outside);
    const { map } = await mountMap();
    const anchor = addAnchor(map, { closable: true }); await placed(anchor);
    expect(anchor.focusContent()).to.equal(true);
    anchor.replaceChildren();
    await hidden(anchor);
    await waitUntil(() => deepActive() === outside, 'focus returned after its content was removed');
    expect(anchor.open).to.equal(true);
  });
});
