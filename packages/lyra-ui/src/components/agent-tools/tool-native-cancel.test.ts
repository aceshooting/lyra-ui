import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './tool-approval-dialog/tool-approval-dialog.js';
import './tool-select-dialog/tool-select-dialog.js';
import './tool-result-dialog/tool-result-dialog.js';
import type { LyraToolApprovalDialog } from './tool-approval-dialog/tool-approval-dialog.js';
import type { LyraToolSelectDialog } from './tool-select-dialog/tool-select-dialog.js';
import type { LyraToolResultDialog } from './tool-result-dialog/tool-result-dialog.js';

type ToolDialog = LyraToolApprovalDialog | LyraToolSelectDialog | LyraToolResultDialog;

async function openCarrier(parent: HTMLElement, name: string): Promise<{ element: ToolDialog; carrier: HTMLDialogElement }> {
  const element = document.createElement(name) as ToolDialog;
  parent.append(element); await element.updateComplete;
  element.open = true;
  await waitUntil(() => element.shadowRoot!.querySelector('dialog')?.matches(':modal') === true);
  return { element, carrier: element.shadowRoot!.querySelector('dialog')! };
}

for (const name of ['lr-tool-approval-dialog', 'lr-tool-select-dialog', 'lr-tool-result-dialog']) {
  it(`${name} handles native cancellation once and leaves the underlying modal open`, async () => {
    const parent = await fixture<HTMLElement>(html`<div><dialog><button>Original modal</button></dialog></div>`);
    const underlying = parent.querySelector('dialog')!;
    underlying.showModal();
    try {
      const { element, carrier } = await openCarrier(parent, name);
      const reasons: string[] = [];
      element.addEventListener('lr-close', event => reasons.push((event as CustomEvent<{ reason: string }>).detail.reason));
      carrier.requestClose(); await element.updateComplete;
      expect(element.open).to.equal(false);
      expect(reasons).to.deep.equal(['escape']);
      expect(underlying.matches(':modal')).to.equal(true);
      carrier.dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(reasons).to.deep.equal(['escape']);
    } finally { underlying.close(); }
  });

  it(`${name} ignores cancellation while another tool dialog owns the modal stack`, async () => {
    const parent = await fixture<HTMLElement>(html`<div><dialog><button>Original modal</button></dialog></div>`);
    const underlying = parent.querySelector('dialog')!;
    underlying.showModal();
    try {
      const lower = await openCarrier(parent, name);
      const upper = await openCarrier(parent, 'lr-tool-result-dialog');
      const reasons: string[] = [];
      lower.element.addEventListener('lr-close', event => reasons.push((event as CustomEvent<{ reason: string }>).detail.reason));
      lower.carrier.requestClose(); await lower.element.updateComplete;
      expect(lower.element.open).to.equal(true);
      expect(reasons).to.deep.equal([]);
      upper.carrier.requestClose(); await upper.element.updateComplete;
      expect(upper.element.open).to.equal(false);
      await waitUntil(() => lower.carrier.matches(':modal'));
      lower.carrier.requestClose(); await lower.element.updateComplete;
      expect(lower.element.open).to.equal(false);
      expect(reasons).to.deep.equal(['escape']);
    } finally { underlying.close(); }
  });
}

it('keeps a pending tool approval open until its decision finishes', async () => {
  const parent = await fixture<HTMLElement>(html`<div><dialog><button>Original modal</button></dialog></div>`);
  const underlying = parent.querySelector('dialog')!;
  underlying.showModal();
  try {
    const { element, carrier } = await openCarrier(parent, 'lr-tool-approval-dialog');
    const approval = element as LyraToolApprovalDialog;
    const reasons: string[] = [];
    approval.addEventListener('lr-close', event => reasons.push(event.detail.reason));
    approval.pendingAction = 'approve'; await approval.updateComplete;
    carrier.requestClose(); await approval.updateComplete;
    expect(approval.open).to.equal(true);
    expect(carrier.matches(':modal')).to.equal(true);
    expect(reasons).to.deep.equal([]);
    approval.pendingAction = null; await approval.updateComplete;
    carrier.requestClose(); await approval.updateComplete;
    expect(approval.open).to.equal(false);
    expect(reasons).to.deep.equal(['escape']);
  } finally { underlying.close(); }
});
