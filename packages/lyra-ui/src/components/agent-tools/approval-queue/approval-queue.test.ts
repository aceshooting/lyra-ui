import { fixture, expect, html } from '@open-wc/testing';
import './approval-queue.js';
import type { LyraApprovalQueue, ToolApprovalRequest } from './approval-queue.class.js';

const requests: ToolApprovalRequest[] = [{ id: 'call-1', toolName: 'web_search', args: { query: 'Lyra UI' } }];

describe('lr-approval-queue', () => {
  it('renders the request queue and opens the reusable approval dialog', async () => {
    const el = (await fixture(html`<lr-approval-queue .strings=${{ approvalQueueLabel: 'Approvals' }} .requests=${requests}></lr-approval-queue>`)) as LyraApprovalQueue;
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="request"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.shadowRoot!.querySelector('lr-tool-approval-dialog')).to.exist;
  });

  it('emits a correlated selection', async () => {
    const el = (await fixture(html`<lr-approval-queue .requests=${requests}></lr-approval-queue>`)) as LyraApprovalQueue;
    await el.updateComplete;
    const event = new Promise<CustomEvent>((resolve) => el.addEventListener('lr-approval-select', resolve, { once: true }));
    (el.shadowRoot!.querySelector('[part="request"]') as HTMLButtonElement).click();
    expect((await event).detail.invocationId).to.equal('call-1');
  });

  it('is accessible in empty and populated states', async () => {
    const empty = (await fixture(html`<lr-approval-queue></lr-approval-queue>`)) as LyraApprovalQueue;
    await expect(empty).to.be.accessible();
    const populated = (await fixture(html`<lr-approval-queue .requests=${requests}></lr-approval-queue>`)) as LyraApprovalQueue;
    await expect(populated).to.be.accessible();
  });
});
