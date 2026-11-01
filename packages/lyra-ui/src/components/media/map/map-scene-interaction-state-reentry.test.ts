import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { sceneMarker } from '../../../../test/map-scene-admission-fixtures.js';

const pending: (() => void)[] = [];

async function mount() {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false };
  element.style.cssText = 'display:block;inline-size:320px;block-size:480px';
  const library = new Promise<null>(resolve => pending.push(() => resolve(null)));
  Object.defineProperty(element, 'loadLibrary', { configurable: true, value: () => library });
  element.scene = { objects: [sceneMarker('initial')] };
  wrapper.append(element);
  await element.updateComplete;
  return { element, wrapper };
}

function sceneButtons(element: LyraMap): HTMLButtonElement[] {
  return [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="scene-panel"] button')];
}

describe('lr-map scene interaction state during queued rendering', () => {
  afterEach(async () => {
    fixtureCleanup();
    for (const finish of pending.splice(0)) finish();
    await Promise.resolve();
  });

  for (const blockedBy of ['disabled', 'inert'] as const) {
    it(`does not retain a transient ${blockedBy} state rendered before attribute observation`, async () => {
      const { element, wrapper } = await mount();
      expect(sceneButtons(element).map(button => button.disabled)).to.deep.equal([false, false]);
      const blocker = blockedBy === 'disabled' ? element : wrapper;
      element.scene = { objects: [sceneMarker('replacement')] };
      queueMicrotask(() => blocker.removeAttribute(blockedBy));
      blocker.setAttribute(blockedBy, '');
      await Promise.resolve();
      await element.updateComplete;
      expect(blocker.hasAttribute(blockedBy)).to.equal(false);
      expect(element.shadowRoot!.querySelector('[part="scene-list"]')!.textContent).to.include('replacement');
      expect(sceneButtons(element).map(button => button.disabled)).to.deep.equal([false, false]);
      expect(element.map === undefined).to.equal(true);
    });
  }
});
