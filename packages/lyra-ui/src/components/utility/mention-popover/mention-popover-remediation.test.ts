import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './mention-popover.js';
import type { LyraMentionPopover } from './mention-popover.js';

async function popover() {
  const root = await fixture<HTMLDivElement>(html`<div><input aria-label="Message"><lr-mention-popover></lr-mention-popover></div>`);
  const input = root.querySelector('input')!;
  const viewer = root.querySelector<LyraMentionPopover>('lr-mention-popover')!;
  viewer.anchor = input;
  viewer.items = [{ suggestionId: 'ada', label: 'Ada' }, { suggestionId: 'grace', label: 'Grace' }];
  viewer.open = true;
  await viewer.updateComplete;
  await waitUntil(() => getComputedStyle(viewer.shadowRoot!.querySelector('[part="listbox"]')!).visibility === 'visible');
  return { viewer, input };
}

it('treats removed query as an empty filter without changing null or explicit empty readback', async () => {
  const { viewer } = await popover();
  viewer.setAttribute('query', 'ada');
  await viewer.updateComplete;
  expect(viewer.filteredItems.length).to.equal(1);
  viewer.removeAttribute('query');
  await viewer.updateComplete;
  expect(viewer.query).to.equal(null);
  expect(viewer.filteredItems.length).to.equal(2);
  viewer.setAttribute('query', '');
  await viewer.updateComplete;
  expect(viewer.query).to.equal('');
  viewer.setAttribute('query', 'grace');
  await viewer.updateComplete;
  expect(viewer.filteredItems.map((item) => item.label)).to.deep.equal(['Grace']);
});

for (const legacy of [false, true]) {
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape']) {
    it(`leaves ${key} with the native editor while ${legacy ? 'legacy keyCode229' : 'isComposing'} is active`, async () => {
      const { viewer, input } = await popover();
      let selections = 0;
      let closes = 0;
      let handled: boolean | undefined;
      viewer.addEventListener('lr-mention-select', () => selections++);
      viewer.addEventListener('lr-mention-close', () => closes++);
      input.addEventListener('keydown', (event) => { handled = viewer.handleKeyDown(event); });
      input.focus();
      const active = viewer.activeDescendantId;
      const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, isComposing: !legacy, keyCode: legacy ? 229 : 0 });
      input.dispatchEvent(event);
      await viewer.updateComplete;
      expect(handled).to.equal(false);
      expect(event.defaultPrevented).to.equal(false);
      expect(viewer.activeDescendantId).to.equal(active);
      expect(viewer.open).to.equal(true);
      expect(selections).to.equal(0);
      expect(closes).to.equal(0);
      const ordinary = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      input.dispatchEvent(ordinary);
      await viewer.updateComplete;
      expect(handled).to.equal(true);
      expect(ordinary.defaultPrevented).to.equal(true);
      expect(selections).to.equal(1);
    });
  }
}
