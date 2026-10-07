import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './reorder-list.js';
import './reorder-item.js';
import type { LyraReorderItem } from './reorder-item.class.js';
import type { LyraReorderList } from './reorder-list.class.js';

const button = (item: LyraReorderItem, direction: string) => item.shadowRoot!.querySelector<HTMLButtonElement>(`[part="move-${direction}-button"]`)!;

it('renders standalone value removal as absence with null readback and later recovery', async () => {
  const item = await fixture<LyraReorderItem>(html`<lr-reorder-item value="a">A</lr-reorder-item>`);
  item.removeAttribute('value');
  await item.updateComplete;
  expect(item.value).to.equal(null);
  expect(button(item, 'up').disabled).to.equal(true);
  expect(button(item, 'down').disabled).to.equal(true);
  item.setAttribute('value', '');
  await item.updateComplete;
  expect(item.value).to.equal('');
  item.value = 'recovered';
  await item.updateComplete;
  expect(button(item, 'down').disabled).to.equal(false);
});

for (const route of ['attribute', 'property'] as const) {
  for (const initial of ['', 'a']) {
    it(`refreshes owned boundaries after ${route} identity corrections from ${initial || 'missing'}`, async () => {
      const list = await fixture<LyraReorderList>(html`<lr-reorder-list>
        <lr-reorder-item value="a">A</lr-reorder-item>
        <lr-reorder-item value=${initial}>B</lr-reorder-item>
        <lr-reorder-item value="c">C</lr-reorder-item>
      </lr-reorder-list>`);
      const items = [...list.children] as LyraReorderItem[];
      const middle = items[1]!;
      let events = 0;
      list.addEventListener('lr-reorder-request', () => events++);
      expect(button(middle, 'up').disabled).to.equal(true);
      const write = (value: string) => route === 'property' ? middle.value = value : middle.setAttribute('value', value);
      write('b');
      await waitUntil(() => !button(middle, 'up').disabled && !button(middle, 'down').disabled);
      expect(middle.atStart).to.equal(false);
      expect(middle.atEnd).to.equal(false);
      expect(events).to.equal(0);
      write('a');
      await waitUntil(() => button(middle, 'up').disabled && button(middle, 'down').disabled);
      expect(button(items[0]!, 'down').disabled).to.equal(false);
      middle.removeAttribute('value');
      if (route === 'property') middle.value = '';
      await middle.updateComplete;
      expect(button(middle, 'up').disabled).to.equal(true);
      write('b');
      await waitUntil(() => !button(middle, 'up').disabled);
      button(middle, 'up').click();
      expect([...list.children].map(item => (item as LyraReorderItem).value)).to.deep.equal(['b', 'a', 'c']);
      expect(events).to.equal(1);
    });
  }
}

it('derives boundary state without a per-item array search', async () => {
  const list = await fixture<LyraReorderList>(html`<lr-reorder-list>
    ${Array.from({ length: 300 }, (_, index) => html`<lr-reorder-item value=${`row-${index}`}>Row</lr-reorder-item>`)}
  </lr-reorder-list>`);
  const original = Array.prototype.indexOf;
  let searches = 0;
  Array.prototype.indexOf = function (this: unknown[], ...args: [unknown, number?]) {
    searches += 1;
    return original.apply(this, args);
  };
  try {
    (list as unknown as { syncBoundaryState(): void }).syncBoundaryState();
  } finally {
    Array.prototype.indexOf = original;
  }
  expect(searches).to.be.lessThan(20);
});

it('does not rewrite an item role that is already listitem on every update', async () => {
  const item = await fixture<LyraReorderItem>(html`<lr-reorder-item value="a">A</lr-reorder-item>`);
  let writes = 0;
  const observer = new MutationObserver((records) => { writes += records.length; });
  observer.observe(item, { attributes: true, attributeFilter: ['role'] });
  try {
    item.setAttribute('aria-label', 'Row A');
    await item.updateComplete;
    await Promise.resolve();
    expect(writes).to.equal(0);
    item.setAttribute('role', 'presentation');
    item.setAttribute('aria-label', 'Row A again');
    await item.updateComplete;
    expect(item.getAttribute('role')).to.equal('listitem');
  } finally {
    observer.disconnect();
  }
});
