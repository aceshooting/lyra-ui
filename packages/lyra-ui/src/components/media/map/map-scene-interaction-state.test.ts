import { expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { sceneMarker } from '../../../../test/map-scene-admission-fixtures.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';

type BlockingAttribute = 'disabled' | 'inert';
const pending: (() => void)[] = [];

async function mount(blockedBy: BlockingAttribute, initiallyBlocked = false) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const parent = document.createElement('div');
  wrapper.append(parent);
  const element = document.createElement('lr-map') as LyraMap;
  element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  element.controls = { attribution: false };
  element.style.cssText = 'display:block;inline-size:320px;block-size:480px';
  const library = new Promise<null>(resolve => pending.push(() => resolve(null)));
  Object.defineProperty(element, 'loadLibrary', { configurable: true, value: () => library });
  element.scene = { objects: Array.from({ length: 101 }, (_, index) => sceneMarker(`item-${index}`)) };
  const blocker = blockedBy === 'disabled' ? element : parent;
  // The interaction policy reads disabled without declaring a reactive public property.
  if (initiallyBlocked && blockedBy === 'disabled') expectDevWarning('lyra-unknown-attribute:lr-map:disabled');
  if (initiallyBlocked) blocker.setAttribute(blockedBy, '');
  parent.append(element);
  await element.updateComplete;
  return { element, wrapper, parent, blocker };
}

async function settleAttributes(element: LyraMap) {
  // Allow attribute observers to request their render without requesting one from the test.
  await Promise.resolve();
  await element.updateComplete;
}

function disabledState(element: LyraMap): boolean[] {
  const toggle = element.shadowRoot?.querySelector<HTMLButtonElement>('[part="scene-toggle"]');
  const rows = [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="scene-list"] button')];
  const pages = [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="scene-pagination"] button')];
  expect(rows.length).to.equal(100);
  expect(pages.length).to.equal(2);
  if (!toggle) throw new Error('Expected scene toggle');
  expect(rows.every(row => row.disabled === rows[0]!.disabled)).to.equal(true);
  return [toggle.disabled, rows[0]!.disabled, pages[0]!.disabled, pages[1]!.disabled];
}

describe('lr-map scene native control availability before map loading', () => {
  afterEach(async () => {
    fixtureCleanup();
    for (const finish of pending.splice(0)) finish();
    await Promise.resolve();
  });

  for (const blockedBy of ['disabled', 'inert'] as const) {
    it(`disables scene controls when ${blockedBy} changes before a canvas exists`, async () => {
      const { element, blocker } = await mount(blockedBy);
      expect(disabledState(element)).to.deep.equal([false, false, true, false]);
      blocker.setAttribute(blockedBy, '');
      await settleAttributes(element);
      expect(disabledState(element)).to.deep.equal([true, true, true, true]);
      expect(element.map === undefined).to.equal(true);
    });

    it(`re-enables scene controls when initial ${blockedBy} is removed before a canvas exists`, async () => {
      const { element, blocker } = await mount(blockedBy, true);
      expect(disabledState(element)).to.deep.equal([true, true, true, true]);
      blocker.removeAttribute(blockedBy);
      await settleAttributes(element);
      expect(disabledState(element)).to.deep.equal([false, false, true, false]);
      expect(element.map === undefined).to.equal(true);
    });

    it(`tracks ${blockedBy} changes after reconnecting under a different parent`, async () => {
      const { element, wrapper, parent } = await mount(blockedBy);
      const destination = document.createElement('div');
      wrapper.append(destination);
      element.remove();
      destination.append(element);
      await element.updateComplete;
      expect(disabledState(element)).to.deep.equal([false, false, true, false]);
      if (blockedBy === 'inert') {
        parent.setAttribute('inert', '');
        await settleAttributes(element);
        expect(disabledState(element)).to.deep.equal([false, false, true, false]);
      }
      const blocker = blockedBy === 'disabled' ? element : destination;
      blocker.setAttribute(blockedBy, '');
      await settleAttributes(element);
      expect(disabledState(element)).to.deep.equal([true, true, true, true]);
      blocker.removeAttribute(blockedBy);
      await settleAttributes(element);
      expect(disabledState(element)).to.deep.equal([false, false, true, false]);
      expect(element.map === undefined).to.equal(true);
    });
  }
});
