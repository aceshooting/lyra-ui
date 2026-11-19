import { expect, fixture, html } from '@open-wc/testing';
import './approval-queue.js';
import type { LyraApprovalQueue, ToolApprovalRequest } from './approval-queue.class.js';
import type { LyraToolApprovalDialog } from '../tool-approval-dialog/tool-approval-dialog.class.js';

const request = (type: 'lr-approve-request' | 'lr-deny-request', args?: unknown) =>
  new CustomEvent(type, { bubbles: true, composed: true, cancelable: true, detail: type === 'lr-approve-request' ? { args } : null });

it('emits one decision when a decision listener re-enters the nested dialog', async () => {
  const requests: ToolApprovalRequest[] = [{ id: 'call-1', toolName: 'web_search', args: { query: 'Lyra' } }];
  const el = await fixture<LyraApprovalQueue>(html`<lr-approval-queue selected-invocation-id="call-1" open .requests=${requests}></lr-approval-queue>`);
  const dialog = el.shadowRoot!.querySelector('lr-tool-approval-dialog')!;
  const decisions: { approved: boolean }[] = [];
  el.addEventListener('lr-approval-decision-request', (event) => {
    decisions.push((event as CustomEvent<{ approved: boolean }>).detail);
    dialog.dispatchEvent(request('lr-deny-request'));
    dialog.dispatchEvent(request('lr-approve-request', { query: 'again' }));
  });
  dialog.dispatchEvent(request('lr-approve-request', { query: 'Lyra' }));
  dialog.dispatchEvent(request('lr-deny-request'));
  expect(decisions.map((detail) => detail.approved)).to.deep.equal([true, false]);
});

it('does not decide or open a request that is no longer pending', async () => {
  const requests: ToolApprovalRequest[] = [{ id: 'done', toolName: 'read_file', args: {}, status: 'approved' }];
  const el = await fixture<LyraApprovalQueue>(html`<lr-approval-queue .requests=${requests}></lr-approval-queue>`);
  const selections: Event[] = [];
  el.addEventListener('lr-approval-select', (event) => selections.push(event));
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="request"]')!.click();
  await el.updateComplete;
  expect(selections.length).to.equal(0);
  expect(el.open).to.equal(false);
});

it('hands arguments that cannot be serialized to the dialog unchanged', async () => {
  const args = { budget: 10n };
  const requests: ToolApprovalRequest[] = [{ id: 'call-big', toolName: 'spend', args }];
  const el = await fixture<LyraApprovalQueue>(html`<lr-approval-queue selected-invocation-id="call-big" open .requests=${requests}></lr-approval-queue>`);
  const dialog = el.shadowRoot!.querySelector<LyraToolApprovalDialog>('lr-tool-approval-dialog')!;
  expect((dialog.args as { budget: bigint }).budget).to.equal(10n);
  el.requestUpdate();
  await el.updateComplete;
  expect((dialog.args as { budget: bigint }).budget).to.equal(10n);
});

for (const action of ['approve', 'deny']) {
  it(`rejects the rendered ${action} control as soon as the host resolves the selected request`, async () => {
    const call = { id: 'call', toolName: 'read', args: {} };
    const queue = await fixture<LyraApprovalQueue>(html`<lr-approval-queue selected-invocation-id="call" open .requests=${[call]}></lr-approval-queue>`);
    const dialog = queue.shadowRoot!.querySelector<LyraToolApprovalDialog>('lr-tool-approval-dialog')!;
    await dialog.updateComplete;
    const decisions: boolean[] = [], closes: string[] = [];
    queue.addEventListener('lr-approval-decision-request', event => { decisions.push(event.detail.approved); });
    queue.addEventListener('lr-approval-close', event => { closes.push(event.detail.reason); });
    queue.requests = [{ ...call, status: 'denied' }];
    dialog.shadowRoot!.querySelector<HTMLElement>(`[part="${action}-button"]`)!.click();
    await queue.updateComplete;
    expect(decisions).to.deep.equal([]);
    expect(closes).to.deep.equal(['request-invalidated']);
  });
}

it('rejects selection through a retired row before the host update renders', async () => {
  const call = { id: 'call', toolName: 'read', args: {} };
  const queue = await fixture<LyraApprovalQueue>(html`<lr-approval-queue .requests=${[call]}></lr-approval-queue>`);
  let selections = 0;
  queue.addEventListener('lr-approval-select', () => { selections++; });
  queue.requests = [{ ...call, status: 'denied' }];
  queue.shadowRoot!.querySelector<HTMLButtonElement>('[part="request"]')!.click();
  expect(selections).to.equal(0);
  expect(queue.selectedInvocationId).to.equal(null);
});
