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
      list.addEventListener('lr-reorder', () => events++);
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
