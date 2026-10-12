import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraReorderItem } from './reorder-item.class.js';
import type { LyraReorderList } from './reorder-list.class.js';
import './reorder-list.js';
import './reorder-item.js';

it('preserves textarea Alt+ArrowDown behavior without requesting a row move', async () => {
  const list = (await fixture(html`<lr-reorder-list>
    <lr-reorder-item value="alpha">Alpha <textarea aria-label="Edit alpha"></textarea></lr-reorder-item>
    <lr-reorder-item value="beta">Beta</lr-reorder-item>
  </lr-reorder-list>`)) as LyraReorderList;
  const before = [...list.querySelectorAll<LyraReorderItem>(':scope > lr-reorder-item')];
  const textarea = before[0]!.querySelector('textarea')!;
  const initialOrder = before.map((row) => row.value);
  let requests = 0;
  list.addEventListener('lr-reorder-request', () => requests += 1);

  await focusByKeyboard(textarea);
  await sendKeys({ press: 'Alt+ArrowDown' });
  await list.updateComplete;

  const after = [...list.querySelectorAll<LyraReorderItem>(':scope > lr-reorder-item')];
  expect(after.map((row) => row.value)).to.deep.equal(initialOrder);
  expect(requests).to.equal(0);
  expect(document.activeElement === textarea, 'the nested editor keeps keyboard focus').to.equal(true);
});
