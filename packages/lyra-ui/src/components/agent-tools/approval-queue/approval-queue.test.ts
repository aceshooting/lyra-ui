import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './approval-queue.js';
import type { LyraApprovalQueue, ToolApprovalRequest } from './approval-queue.class.js';
import type { LyraToolApprovalDialog } from '../tool-approval-dialog/tool-approval-dialog.class.js';

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

  it('honors editable="false" and forwards it to the reused dialog', async () => {
    const el = (await fixture(html`
      <lr-approval-queue editable="false" .requests=${requests}></lr-approval-queue>
    `)) as LyraApprovalQueue;
    (el.shadowRoot!.querySelector('[part="request"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.editable).to.be.false;
    expect((el.shadowRoot!.querySelector('lr-tool-approval-dialog') as HTMLElement & { editable: boolean }).editable).to.be.false;
  });

  it('keeps parent and reused-dialog open state synchronized after child close', async () => {
    const el = (await fixture(html`<lr-approval-queue .requests=${requests}></lr-approval-queue>`)) as LyraApprovalQueue;
    (el.shadowRoot!.querySelector('[part="request"]') as HTMLButtonElement).click();
    await el.updateComplete;
    const dialog = el.shadowRoot!.querySelector('lr-tool-approval-dialog') as HTMLElement & {
      close(reason?: string): void;
      open: boolean;
    };
    dialog.close('api');
    await el.updateComplete;
    expect(el.open).to.be.false;
    (el.shadowRoot!.querySelector('[part="request"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(dialog.open).to.be.true;
  });

  it('starts with a clean dialog draft and pending state when selection changes while open', async () => {
    const twoRequests: ToolApprovalRequest[] = [
      { id: 'call-1', toolName: 'web_search', args: { query: 'first' } },
      { id: 'call-2', toolName: 'read_file', args: { path: 'second.md' } },
    ];
    const el = (await fixture(html`
      <lr-approval-queue .requests=${twoRequests}></lr-approval-queue>
    `)) as LyraApprovalQueue;
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="request"]')];
    rows[0]!.click();
    await el.updateComplete;
    let dialog = el.shadowRoot!.querySelector('lr-tool-approval-dialog') as LyraToolApprovalDialog;
    const edit = dialog.shadowRoot!.querySelector('[part="edit-button"]') as HTMLButtonElement;
    edit.click();
    await dialog.updateComplete;
    expect(dialog.shadowRoot!.querySelector('[part="args-editor"]')).to.exist;

    dialog.addEventListener('lr-deny', (event) => event.preventDefault(), { once: true });
    (dialog.shadowRoot!.querySelector('[part="deny-button"]') as HTMLElement).click();
    await dialog.updateComplete;
    expect(dialog.pending).to.equal('deny');

    rows[1]!.click();
    await el.updateComplete;
    dialog = el.shadowRoot!.querySelector('lr-tool-approval-dialog') as LyraToolApprovalDialog;
    await dialog.updateComplete;
    expect(dialog.toolName).to.equal('read_file');
    expect(dialog.pending).to.equal(null);
    expect(dialog.shadowRoot!.querySelector('[part="args-editor"]')).to.not.exist;
    expect(dialog.shadowRoot!.querySelector('[part="args-view"]')).to.exist;
  });

  it('translates nested approve and deny requests into correlated queue decisions', async () => {
    const el = (await fixture(html`
      <lr-approval-queue selected-id="call-1" open .requests=${requests}></lr-approval-queue>
    `)) as LyraApprovalQueue;
    const dialog = el.shadowRoot!.querySelector('lr-tool-approval-dialog')!;

    const approved = oneEvent(el, 'lr-approval-decision');
    dialog.dispatchEvent(new CustomEvent('lr-approve', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { args: { query: 'confirmed' } },
    }));
    expect((await approved).detail).to.deep.equal({
      invocationId: 'call-1',
      approved: true,
      args: { query: 'confirmed' },
    });

    const denied = oneEvent(el, 'lr-approval-decision');
    dialog.dispatchEvent(new CustomEvent('lr-deny', {
      bubbles: true,
      composed: true,
      cancelable: true,
    }));
    expect((await denied).detail).to.deep.equal({
      invocationId: 'call-1',
      approved: false,
    });
  });

  it('propagates a canceled queue decision back to the nested dialog event', async () => {
    const el = (await fixture(html`
      <lr-approval-queue selected-id="call-1" open .requests=${requests}></lr-approval-queue>
    `)) as LyraApprovalQueue;
    const dialog = el.shadowRoot!.querySelector('lr-tool-approval-dialog')!;
    el.addEventListener('lr-approval-decision', (event) => event.preventDefault());

    const approve = new CustomEvent('lr-approve', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { args: requests[0]!.args },
    });
    dialog.dispatchEvent(approve);
    expect(approve.defaultPrevented).to.be.true;

    const deny = new CustomEvent('lr-deny', {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    dialog.dispatchEvent(deny);
    expect(deny.defaultPrevented).to.be.true;
  });

  it('forwards the host aria-label to the semantic section', async () => {
    const el = (await fixture(html`
      <lr-approval-queue aria-label="Author approvals" label="Visible approvals"></lr-approval-queue>
    `)) as LyraApprovalQueue;
    expect(el.shadowRoot!.querySelector('section')!.getAttribute('aria-label')).to.equal('Author approvals');
  });

  it('renders a strings override in the DOM', async () => {
    const el = (await fixture(html`
      <lr-approval-queue .strings=${{ approvalQueueEmpty: 'Nothing requires review' }}></lr-approval-queue>
    `)) as LyraApprovalQueue;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('Nothing requires review');
  });

  it('formats the pending count for the effective locale inside a localized label', async () => {
    const count = 12;
    const pendingRequests: ToolApprovalRequest[] = Array.from({ length: count }, (_, index) => ({
      id: `call-${index}`,
      toolName: 'web_search',
      args: {},
    }));
    const el = (await fixture(html`
      <lr-approval-queue
        lang="ar-EG"
        .requests=${pendingRequests}
        .strings=${{ approvalQueuePendingCount: 'Pending: {count}' }}
      ></lr-approval-queue>
    `)) as LyraApprovalQueue;
    expect(el.shadowRoot!.querySelector('[part="count"]')!.textContent!.trim()).to.equal(
      `Pending: ${new Intl.NumberFormat('ar-EG').format(count)}`,
    );
  });

  it('marks the selected request row with aria-current, not just data-selected', async () => {
    const el = (await fixture(html`
      <lr-approval-queue selected-id="call-1" .requests=${requests}></lr-approval-queue>
    `)) as LyraApprovalQueue;
    const request = el.shadowRoot!.querySelector('[part="request"]') as HTMLElement;
    expect(request.getAttribute('aria-current')).to.equal('true');

    const unselected = (await fixture(html`<lr-approval-queue .requests=${requests}></lr-approval-queue>`)) as LyraApprovalQueue;
    const unselectedRequest = unselected.shadowRoot!.querySelector('[part="request"]') as HTMLElement;
    expect(unselectedRequest.getAttribute('aria-current')).to.equal('false');
  });

  it('allows the selected request border to be rethemed independently', async () => {
    const el = (await fixture(html`
      <lr-approval-queue
        style="--lr-approval-queue-selected-border: rgb(1, 2, 3)"
        selected-id="call-1"
        .requests=${requests}
      ></lr-approval-queue>
    `)) as LyraApprovalQueue;
    const selected = el.shadowRoot!.querySelector('[part="request"][data-selected="true"]') as HTMLElement;
    expect(getComputedStyle(selected).borderTopColor).to.equal('rgb(1, 2, 3)');
  });

  it('contains long queue labels, tool names, and request ids at 320px', async () => {
    const token = 'unbroken'.repeat(80);
    const wrapper = (await fixture(html`
      <div style="inline-size: 320px; max-inline-size: 320px;">
        <lr-approval-queue
          label=${token}
          .requests=${[{ id: token, toolName: token, args: {} }]}
        ></lr-approval-queue>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-approval-queue') as LyraApprovalQueue;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
    const request = el.shadowRoot!.querySelector('[part="request"]') as HTMLElement;
    const toolName = el.shadowRoot!.querySelector('[part="tool-name"]') as HTMLElement;
    const requestId = el.shadowRoot!.querySelector('[part="request-id"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(Math.ceil(base.getBoundingClientRect().width) + 1);
    expect(heading.scrollWidth).to.be.at.most(Math.ceil(heading.getBoundingClientRect().width) + 1);
    expect(request.scrollWidth).to.be.at.most(Math.ceil(request.getBoundingClientRect().width) + 1);
    expect(toolName.scrollWidth).to.be.at.most(Math.ceil(toolName.getBoundingClientRect().width) + 1);
    expect(requestId.scrollWidth).to.be.at.most(Math.ceil(requestId.getBoundingClientRect().width) + 1);
  });
});
