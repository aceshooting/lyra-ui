import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-approval-queue.js';
import type { LyraApprovalQueue } from './approval-queue.class.js';

it('registers the approval dialog only when a request is first opened', async () => {
  const queue = await fixture<LyraApprovalQueue>(html`<lr-approval-queue
    .requests=${[{ id: 'call-1', toolName: 'web_search', args: { query: 'Lyra UI' } }]}
  ></lr-approval-queue>`);
  expect(Boolean(customElements.get('lr-tool-approval-dialog'))).to.equal(false);
  queue.shadowRoot!.querySelector<HTMLButtonElement>('[part="request"]')!.click();
  await queue.updateComplete;
  const dialog = queue.shadowRoot!.querySelector('lr-tool-approval-dialog');
  const Dialog = customElements.get('lr-tool-approval-dialog');
  expect(Boolean(Dialog && dialog instanceof Dialog)).to.equal(true);
});
