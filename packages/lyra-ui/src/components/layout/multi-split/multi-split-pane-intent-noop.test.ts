import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './multi-split.js';
import type { LyraMultiSplit } from './multi-split.class.js';

describe('lr-multi-split pane intent no-ops', () => {
  it('treats collapsePane() on an already-railed pane as a no-op', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split collapse="end" style="inline-size:800px;block-size:120px">
      <div>A</div>
      <div>B</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'wide');
    const changes: string[] = [];
    split.addEventListener('lr-multi-split-collapse-change', (event) =>
      changes.push((event as CustomEvent<{ state: string }>).detail.state)
    );

    split.collapsePane();
    await split.updateComplete;
    expect(split.collapseState).to.equal('rail');
    split.collapsePane();
    await split.updateComplete;
    expect(split.collapseState).to.equal('rail');
    expect(changes).to.eql(['rail']);
  });
});
