import { expect, fixture, html } from '@open-wc/testing';
import './tool-call-block.js';
import type { LyraToolCallBlock } from './tool-call-block.class.js';

it('masks an argument branch when reading a provider record throws', async () => {
  let traversalAttempts = 0;
  const args = new Proxy({ apiKey: 'secret-token', query: 'weather' }, {
    ownKeys(): never[] {
      traversalAttempts += 1;
      throw new Error('The provider payload cannot be enumerated.');
    },
  });
  const block = await fixture<LyraToolCallBlock>(html`
    <lr-tool-call-block
      name="lookup"
      expanded
      .args=${args}
      .redactedFields=${['args.apiKey']}
    ></lr-tool-call-block>
  `);
  await block.updateComplete;
  const viewer = block.shadowRoot!.querySelector('lr-json-viewer') as HTMLElement & { data: unknown };

  expect(traversalAttempts).to.be.greaterThan(0);
  expect(viewer.data).to.equal('Value hidden');
});
