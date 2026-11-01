import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { sceneMarker } from '../../../../test/map-scene-admission-fixtures.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const pending: (() => void)[] = [];
async function mount(count = 1) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false };
  element.style.cssText = 'display:block;inline-size:320px;block-size:480px';
  const library = new Promise<null>(resolve => pending.push(() => resolve(null)));
  Object.defineProperty(element, 'loadLibrary', { configurable: true, value: () => library });
  const objects = Array.from({ length: count }, (_, index) => sceneMarker(`item-${index}`));
  element.scene = { objects };
  wrapper.append(element);
  await element.updateComplete;
  return { element, wrapper, objects };
}
function part<T extends HTMLElement = HTMLElement>(element: LyraMap, name: string): T {
  const found = element.shadowRoot?.querySelector<T>(`[part~="${name}"]`);
  if (!found) throw new Error(`Expected ${name}`);
  return found;
}
async function expand(element: LyraMap) {
  part<HTMLButtonElement>(element, 'scene-toggle').click();
  await element.updateComplete;
}
function rows(element: LyraMap) {
  return [...part(element, 'scene-list').querySelectorAll<HTMLButtonElement>('button')];
}

describe('lr-map geographic scene lifecycle and interaction', () => {
  afterEach(async () => {
    fixtureCleanup();
    for (const finish of pending.splice(0)) finish();
    await Promise.resolve();
  });

  it('publishes the new connection status when reconnect precedes a queued old status', async () => {
    const { element, wrapper } = await mount();
    const states: unknown[] = [];
    element.addEventListener('lr-map-scene-state', event => states.push(event.detail));
    element.scene = { objects: [sceneMarker('latest', 8)] };
    element.remove();
    wrapper.append(element);
    await element.updateComplete;
    expect(states).to.deep.equal([{ revision: 1, state: 'unavailable', code: 'engine' }]);
    expect(part(element, 'scene-list').textContent).to.include('latest');
  });

  it('restores stable focus when a same-ID row becomes noninteractive', async () => {
    const { element, objects } = await mount();
    await expand(element);
    await focusByKeyboard(rows(element)[0]!);
    element.scene = { objects: [{ ...objects[0]!, interactive: false }] };
    await element.updateComplete;
    expect(rows(element).length).to.equal(0);
    expect(element.shadowRoot!.activeElement === part(element, 'scene-toggle')).to.equal(true);
  });

  it('restores stable focus when a same-ID row moves outside the displayed page', async () => {
    const { element, objects } = await mount(101);
    await expand(element);
    await focusByKeyboard(rows(element)[0]!);
    element.scene = { objects: [...objects.slice(1), objects[0]!] };
    await element.updateComplete;
    expect(rows(element).some(row => row.dataset['sceneId'] === 'item-0')).to.equal(false);
    expect(element.shadowRoot!.activeElement === part(element, 'scene-toggle')).to.equal(true);
  });

  for (const blockedBy of ['disabled', 'inert'] as const) {
    it(`blocks scene activation, toggle and pagination under ${blockedBy} before native loading`, async () => {
      const { element, wrapper } = await mount(101);
      await expand(element);
      const activated: unknown[] = [];
      element.addEventListener('lr-map-scene-activate', event => activated.push(event.detail));
      const toggle = part<HTMLButtonElement>(element, 'scene-toggle');
      const next = part(element, 'scene-pagination').querySelectorAll('button')[1]!;
      (blockedBy === 'disabled' ? element : wrapper).setAttribute(blockedBy, '');
      rows(element)[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await element.updateComplete;
      expect(activated).to.deep.equal([]);
      expect(toggle.getAttribute('aria-expanded')).to.equal('true');
      expect(rows(element)[0]!.dataset['sceneId']).to.equal('item-0');
      expect(element.map === undefined).to.equal(true);
    });
  }
});
