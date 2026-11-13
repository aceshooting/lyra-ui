import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraReorderList } from './reorder-list.class.js';
import type { LyraReorderItem } from './reorder-item.class.js';
import './reorder-list.js';
import './reorder-item.js';
import '../../forms/input/input.js';

for (const [name, control] of [
  ['link', html`<a data-control href="#">Link</a>`],
  ['button', html`<button data-control>Action</button>`],
  ['input', html`<input data-control aria-label="Text" value="editable">`],
  ['select', html`<select data-control aria-label="Choice"><option>A</option><option>B</option></select>`],
  ['textarea', html`<textarea data-control aria-label="Text">editable</textarea>`],
  ['editable content', html`<div data-control contenteditable="true">editable</div>`],
  ['custom input', html`<lr-input data-control label="Text" value="editable"></lr-input>`],
] as const) {
  it(`leaves native modifier-arrow keys in a nested ${name} with that control`, async () => {
    const list = await fixture<LyraReorderList>(html`<lr-reorder-list label="Steps">
      <lr-reorder-item value="before">Before</lr-reorder-item>
      <lr-reorder-item value="editable">${control}</lr-reorder-item>
      <lr-reorder-item value="after">After</lr-reorder-item>
    </lr-reorder-list>`);
    const rows = [...list.children] as LyraReorderItem[];
    await Promise.all(rows.map(row => row.updateComplete));
    let requests = 0;
    list.addEventListener('lr-reorder-request', () => { requests++; });
    const nested = list.querySelector<HTMLElement>('[data-control]')!;
    await focusByKeyboard(nested);
    expect(document.activeElement === nested).to.equal(true);
    await sendKeys({ press: 'Control+ArrowDown' });
    await sendKeys({ press: 'Control+ArrowUp' });
    expect(requests).to.equal(0);
    expect([...list.children].map(row => (row as LyraReorderItem).value)).to.deep.equal(['before', 'editable', 'after']);
    expect(document.activeElement === nested).to.equal(true);

    const move = rows[1]!.shadowRoot!.querySelector<HTMLElement>('[part="move-down-button"]')!;
    await focusByKeyboard(move);
    await sendKeys({ press: 'Control+ArrowDown' });
    await waitUntil(() => (list.children[2] as LyraReorderItem).value === 'editable');
    expect(requests).to.equal(1);
    expect([...list.children].map(row => (row as LyraReorderItem).value)).to.deep.equal(['before', 'after', 'editable']);
  });
}
