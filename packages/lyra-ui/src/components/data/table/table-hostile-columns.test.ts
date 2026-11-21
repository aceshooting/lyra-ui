import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-table.js';
import type { LyraTable } from './table.class.js';

it('treats a revoked columns collection as empty instead of throwing', async () => {
  const table = await fixture<LyraTable>(html`<lr-table aria-label="Hostile columns"></lr-table>`);
  const revoked = Proxy.revocable([], {});
  revoked.revoke();
  table.columns = revoked.proxy as unknown as LyraTable['columns'];
  await table.updateComplete;
  expect(table.columns.length).to.equal(0);
});
