import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-chunk-inspector.js';
import type { LyraChunkInspector } from './chunk-inspector.class.js';

const chunks = (count: number) => Array.from({ length: count }, (_, index) =>
  ({ id: `c${index}`, text: `Chunk ${index}`, score: 0.5, sourceId: 's' }));

it('registers the virtualizer only when the chunk count first passes virtualizeAt', async () => {
  const inspector = await fixture<LyraChunkInspector>(html`<lr-chunk-inspector virtualize-at="3"
    .chunks=${chunks(2)}></lr-chunk-inspector>`);
  expect(Boolean(customElements.get('lr-virtual-list'))).to.equal(false);
  inspector.chunks = chunks(5);
  await inspector.updateComplete;
  const list = inspector.shadowRoot!.querySelector('lr-virtual-list');
  const VirtualList = customElements.get('lr-virtual-list');
  expect(Boolean(VirtualList && list instanceof VirtualList)).to.equal(true);
});
