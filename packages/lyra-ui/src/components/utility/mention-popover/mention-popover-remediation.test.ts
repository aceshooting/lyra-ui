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

it('keeps the full match list readable while only fifty suggestions can render or commit', async () => {
  const { viewer } = await popover();
  viewer.items = Array.from({ length: 52 }, (_, index) => ({ suggestionId: String(index), label: `Person ${index}` }));
  await viewer.updateComplete;
  const listbox = viewer.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  const options = viewer.shadowRoot!.querySelectorAll('[part="option"]');
  const more = viewer.shadowRoot!.querySelector<HTMLElement>('[part="more-results"]')!;
  expect(viewer.filteredItems.length).to.equal(52);
  expect(options.length).to.equal(50);
  expect(more.textContent?.trim()).to.equal('2 more suggestions');
  expect(more.hasAttribute('role')).to.equal(false);
  expect(listbox.getAttribute('aria-describedby')).to.equal(more.id);
  for (let index = 0; index < 60; index += 1) {
    viewer.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  }
  expect(viewer.activeDescendantId).to.equal(`${viewer.listboxId}-opt-49`);
  let selected: string | undefined;
  viewer.addEventListener('lr-mention-select', (event) => { selected = event.detail.suggestionId; });
  more.click();
  expect(selected).to.equal(undefined);
  viewer.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
  expect(selected).to.equal('49');
});

it('localizes the non-option overflow description and removes it when the query narrows', async () => {
  const { viewer } = await popover();
  viewer.items = Array.from({ length: 51 }, (_, index) => ({ suggestionId: String(index), label: `Person ${index}` }));
  viewer.strings = { mentionMoreResults: { one: '{count} extra match', other: '{count} extra matches' } };
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelector('[part="more-results"]')?.textContent?.trim()).to.equal('1 extra match');
  viewer.query = 'Person 50';
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelector('[part="more-results"]') === null).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('[part="listbox"]')?.hasAttribute('aria-describedby')).to.equal(false);
});

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

for (const textarea of [false, true]) {
  it(`restores authored ${textarea ? 'textarea' : 'input'} semantics when element-reference setters reject writes`, async () => {
    const root = await fixture<HTMLDivElement>(html`
      <div><span id="rejecting-author-active">Author active</span>
        <span id="rejecting-author-controls">Author controls</span>
        <lr-mention-popover></lr-mention-popover></div>
    `);
    const control = document.createElement(textarea ? 'textarea' : 'input');
    control.setAttribute('aria-label', 'Message');
    control.setAttribute('role', 'textbox');
    control.setAttribute('aria-expanded', 'false');
    control.setAttribute('aria-haspopup', 'menu');
    control.setAttribute('aria-controls', textarea ? '' : 'rejecting-author-controls');
    control.setAttribute('aria-activedescendant', textarea ? '' : 'rejecting-author-active');
    const authored = new Map([...control.attributes].map(attribute => [attribute.name, attribute.value]));
    const active = root.querySelector<HTMLElement>('#rejecting-author-active')!;
    const controls = root.querySelector<HTMLElement>('#rejecting-author-controls')!;
    Object.defineProperties(control, {
      ariaActiveDescendantElement: {
        configurable: true,
        get: () => active,
        set: () => { throw new TypeError('element-reference writes unavailable'); },
      },
      ariaControlsElements: {
        configurable: true,
        get: () => [controls],
        set: () => { throw new TypeError('element-reference writes unavailable'); },
      },
    });
    root.prepend(control);
    const viewer = root.querySelector<LyraMentionPopover>('lr-mention-popover')!;
    try {
      viewer.anchor = control;
      viewer.items = [{ suggestionId: 'first', label: 'First' }, { suggestionId: 'second', label: 'Second' }];
      viewer.open = true;
      await viewer.updateComplete;
      expect(viewer.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(2);
      expect(control.hasAttribute('aria-controls')).to.equal(false);
      expect(control.hasAttribute('aria-activedescendant')).to.equal(false);
      expect(viewer.syncActiveDescendant(control)).to.equal(false);
      viewer.open = false;
      await viewer.updateComplete;
      for (const [name, value] of authored) expect(control.getAttribute(name), name).to.equal(value);
    } finally {
      viewer.remove();
      Reflect.deleteProperty(control, 'ariaActiveDescendantElement');
      Reflect.deleteProperty(control, 'ariaControlsElements');
    }
  });
}
