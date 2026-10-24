import { expect, fixture, fixtureCleanup, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import { admitMapAnchorOptions } from './map-anchor-options.js';

class InputMap extends ControlMapEngine {}
const observerDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const contextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
const originalContext = HTMLCanvasElement.prototype.getContext;

async function mount(pick = false) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.initialization = 'eager';
  element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.controls = { attribution: false };
  element.pickMode = pick;
  element.style.cssText = 'inline-size:400px;block-size:300px';
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: InputMap });
  wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as InputMap;
  peer.fire('load'); await element.whenStyleReady(); await element.updateComplete;
  return { element, peer };
}

function events(element: LyraMap, type: string): unknown[] {
  const details: unknown[] = [];
  element.addEventListener(type, event => { details.push((event as CustomEvent<unknown>).detail); });
  return details;
}

describe('lr-map native input failure boundaries', () => {
  beforeEach(() => {
    InputMap.initialReady = true; InputMap.prepare = undefined;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
      } });
  });
  afterEach(() => {
    fixtureCleanup();
    if (observerDescriptor) Object.defineProperty(window, 'IntersectionObserver', observerDescriptor);
    else Reflect.deleteProperty(window, 'IntersectionObserver');
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', contextDescriptor);
  });

  it('keeps keyboard picking armed after a native center failure and accepts the next valid center', async () => {
    const { element, peer } = await mount(true);
    const picked = events(element, 'lr-map-pick');
    const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-center"]')!;
    await waitUntil(() => !button.disabled);
    await focusByKeyboard(button);
    peer.beforeGetCenter = () => { throw new Error('Native center unavailable'); };
    await sendKeys({ press: 'Enter' }); await element.updateComplete;
    expect(picked.length).to.equal(0);
    expect(element.pickMode).to.equal(true);
    expect(button.disabled).to.equal(false);
    expect(element.shadowRoot!.textContent).not.to.include('Native center unavailable');
    peer.beforeGetCenter = undefined;
    peer.center = { lng: 6, lat: 49 };
    await sendKeys({ press: 'Enter' });
    expect(picked).to.deep.equal([{ lngLat: [6, 49], trigger: 'keyboard' }]);
    expect(element.pickMode).to.equal(true);
  });

  it('withholds invalid native centers without consuming the keyboard picking action', async () => {
    const { element, peer } = await mount(true);
    const picked = events(element, 'lr-map-pick');
    const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="pick-center"]')!;
    await waitUntil(() => !button.disabled);
    await focusByKeyboard(button);
    for (const center of [{ lng: NaN, lat: 2 }, { lng: 2, lat: Infinity }, { lng: 2, lat: 91 }]) {
      peer.center = center;
      await sendKeys({ press: 'Enter' });
      expect(picked.length).to.equal(0);
      expect(element.pickMode).to.equal(true);
    }
    peer.center = { lng: 8, lat: 50 };
    await sendKeys({ press: 'Enter' });
    expect(picked).to.deep.equal([{ lngLat: [8, 50], trigger: 'keyboard' }]);
  });

  it('ignores malformed pointer positions without reading accessors or replacing a queued valid report', async () => {
    const { element, peer } = await mount();
    const moved = events(element, 'lr-map-pointer-move');
    const left = events(element, 'lr-map-pointer-leave');
    let reads = 0;
    const invalid = [
      { point: { x: 1, y: 2 } },
      { lngLat: { lng: 1, lat: 91 }, point: { x: 1, y: 2 } },
      { lngLat: { lng: 1, lat: 2 }, point: { x: NaN, y: 2 } },
      { lngLat: { lng: 1, lat: 2 }, point: { x: 1, y: Infinity } },
      { lngLat: { lng: 1, lat: 2 }, point: { get x() { reads++; return 1; }, y: 2 } },
    ];
    for (const payload of invalid) peer.fire('mousemove', payload);
    await nextFrame(); await nextFrame();
    expect(moved.length).to.equal(0);
    peer.fire('mouseout'); expect(left.length).to.equal(0);
    peer.fire('mousemove', { lngLat: { lng: 3, lat: 4 }, point: { x: 30, y: 40 } });
    for (const payload of invalid) peer.fire('mousemove', payload);
    await nextFrame(); await nextFrame();
    expect(reads).to.equal(0);
    expect(moved).to.deep.equal([{ lngLat: [3, 4], point: [30, 40] }]);
    peer.fire('mouseout'); expect(left).to.deep.equal([null]);
    peer.fire('mousemove', { lngLat: { lng: 5, lat: 6 }, point: { x: 50, y: 60 } });
    await nextFrame(); await nextFrame();
    expect(moved).to.deep.equal([
      { lngLat: [3, 4], point: [30, 40] }, { lngLat: [5, 6], point: [50, 60] },
    ]);
  });
});

it('admits a connected anchor boundary in a document without a browsing context and rejects it after removal', () => {
  const owner = document.implementation.createHTMLDocument('Anchor boundary');
  const boundary = owner.createElement('section');
  owner.body.append(boundary);
  expect(owner.defaultView === null).to.equal(true);
  const admitted = admitMapAnchorOptions({ boundary, safeArea: { blockStart: 12 } }, owner);
  expect(admitted.ok).to.equal(true);
  if (!admitted.ok) throw new Error('Expected the owner document boundary to be admitted');
  expect(admitted.boundaries.length).to.equal(1);
  expect(admitted.boundaries[0] === boundary).to.equal(true);
  expect(admitted.safeArea).to.deep.equal({ blockStart: 12, inlineEnd: 0, blockEnd: 0, inlineStart: 0 });
  expect(admitMapAnchorOptions({ boundary }, document)).to.deep.equal({ ok: false, code: 'invalid-boundary' });
  boundary.remove();
  expect(admitMapAnchorOptions({ boundary }, owner)).to.deep.equal({ ok: false, code: 'invalid-boundary' });
});
