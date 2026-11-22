import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-thread-list.js';
import type { LyraThreadList } from '../../lr-thread-list.js';

const input = (el: LyraThreadList) => getComputedStyle(el.shadowRoot!.querySelector('[part="search-input"]')!);

it('styles the search field fill, border and text from its tokens, matching the shared surface while unset', async () => {
  const plain = await fixture<LyraThreadList>(html`<lr-thread-list searchable></lr-thread-list>`);
  const surface = getComputedStyle(plain);
  const defaults = input(plain);
  const probe = document.createElement('div');
  probe.style.cssText = `color: ${surface.getPropertyValue('--lr-color-text')}; background: ${surface.getPropertyValue('--lr-color-surface')}; border-color: ${surface.getPropertyValue('--lr-color-border')}`;
  document.body.append(probe);
  const expected = getComputedStyle(probe);
  try {
    expect([defaults.color, defaults.backgroundColor, defaults.borderTopColor]).to.deep.equal([expected.color, expected.backgroundColor, expected.borderTopColor]);
  } finally {
    probe.remove();
  }
  const themed = await fixture<LyraThreadList>(html`<lr-thread-list searchable
    style="--lr-thread-list-search-bg: rgb(1, 2, 3); --lr-thread-list-search-border-color: rgb(4, 5, 6); --lr-thread-list-search-color: rgb(7, 8, 9)"></lr-thread-list>`);
  const tuned = input(themed);
  expect([tuned.backgroundColor, tuned.borderTopColor, tuned.color]).to.deep.equal(['rgb(1, 2, 3)', 'rgb(4, 5, 6)', 'rgb(7, 8, 9)']);
});
