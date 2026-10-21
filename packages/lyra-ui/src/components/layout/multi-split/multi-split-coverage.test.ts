import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './multi-split.js';
import type { LyraMultiSplit } from './multi-split.class.js';

describe('lr-multi-split panel ownership', () => {
  it('takes back a collapse-state attribute an author writes onto an owned panel', async () => {
    const el = await fixture<LyraMultiSplit>(html`<lr-multi-split style="inline-size:400px;block-size:200px">
      <div id="one">One</div>
      <div id="two">Two</div>
    </lr-multi-split>`);
    await el.updateComplete;
    const panel = el.querySelector<HTMLElement>('#one')!;
    const owned = panel.getAttribute('data-collapse-state');

    panel.setAttribute('data-collapse-state', 'author-value');

    await waitUntil(() => panel.getAttribute('data-collapse-state') === owned, 'the component restores the state it owns');
    expect(panel.getAttribute('data-collapse-state')).to.equal(owned);
  });
});
