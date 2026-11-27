import { html, ssrFixture } from '../wtr-ssr-fixture.js';
import { expect, oneEvent } from '@open-wc/testing';
import type { LyraTransferManager } from '../../src/components/lr-transfer-manager.js';

it('adopts a populated transfer queue and dispatches its row action after hydration', async () => {
  const archive = { id: 'photos', name: 'Travel photos.zip', status: 'active', bytesDone: 18, bytesTotal: 72 } as const;
  const manager = await ssrFixture<LyraTransferManager>(html`<lr-transfer-manager .transfers=${[archive]}></lr-transfer-manager>`);
  const row = manager.shadowRoot!.querySelector('[data-id="photos"]')!;
  expect(row.textContent).to.contain(archive.name);
  const pause = oneEvent(manager, 'lr-transfer-pause');
  row.querySelector<HTMLButtonElement>('[data-action="pause"]')!.click();
  expect((await pause).detail.ids).to.deep.equal([archive.id]);
  expect(manager.transfers[0]?.status).to.equal('active');
});
