import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
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
    expect((dialog.shadowRoot!.querySelector('[part="args-editor"]')) == null).to.be.true;
    expect(dialog.shadowRoot!.querySelector('[part="args-view"]')).to.exist;
  });

  it('translates nested approve and deny requests into correlated queue decisions', async () => {
    const el = (await fixture(html`
      <lr-approval-queue selected-invocation-id="call-1" open .requests=${requests}></lr-approval-queue>
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
      <lr-approval-queue selected-invocation-id="call-1" open .requests=${requests}></lr-approval-queue>
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

  it('preserves the selected identity for close when a decision listener removes the request synchronously', async () => {
    const el = await fixture<LyraApprovalQueue>(html`
      <lr-approval-queue selected-invocation-id="call-1" open .requests=${requests}></lr-approval-queue>
    `);
    const dialog = el.shadowRoot!.querySelector('lr-tool-approval-dialog')!;
    el.addEventListener('lr-approval-decision', () => {
      el.requests = [];
    });
    const closed = oneEvent(el, 'lr-approval-close');
    dialog.dispatchEvent(new CustomEvent('lr-approve', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { args: requests[0]!.args },
    }));
    dialog.dispatchEvent(new CustomEvent('lr-close', {
      bubbles: true,
      composed: true,
      detail: 'approve',
    }));
    expect((await closed).detail).to.deep.equal({ invocationId: 'call-1', reason: 'approve' });
  });

  it('clears stale selected and open state when the controlled queue shrinks', async () => {
    const el = await fixture<LyraApprovalQueue>(html`
      <lr-approval-queue selected-invocation-id="call-1" open .requests=${requests}></lr-approval-queue>
    `);
    el.requests = [];
    await el.updateComplete;
    expect(el.selectedInvocationId).to.equal(null);
    expect(el.open).to.be.false;
    expect(el.shadowRoot!.querySelector('lr-tool-approval-dialog') === null).to.be.true;
  });

  it('keeps resolved requests visible but non-actionable', async () => {
    const resolved: ToolApprovalRequest[] = [
      { ...requests[0]!, status: 'approved' },
      { id: 'call-2', toolName: 'delete_file', args: {}, status: 'denied' },
    ];
    const el = await fixture<LyraApprovalQueue>(html`
      <lr-approval-queue selected-invocation-id="call-1" open .requests=${resolved}></lr-approval-queue>
    `);
    let selections = 0;
    el.addEventListener('lr-approval-select', () => selections += 1);
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="request"]')];
    const row = rows[0]!;
    expect(row.disabled).to.be.true;
    expect(
      rows.map((candidate) => candidate.querySelector('lr-badge')?.textContent?.trim()),
    ).to.deep.equal(['Approved', 'Denied']);
    row.click();
    await el.updateComplete;
    expect(selections).to.equal(0);
    expect(el.selectedInvocationId).to.equal(null);
    expect(el.open).to.be.false;
  });

  it('fails a non-array runtime request collection closed', async () => {
    const el = await fixture<LyraApprovalQueue>(html`<lr-approval-queue></lr-approval-queue>`);
    el.requests = { 0: requests[0], length: 1 } as unknown as ToolApprovalRequest[];
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="request"]')).to.have.lengthOf(0);
    expect(el.shadowRoot!.querySelectorAll('[part="empty"]')).to.have.lengthOf(1);
  });

  it('paints and de-affords a resolved row while a pending sibling keeps its hover and press feedback', async () => {
    const mixed: ToolApprovalRequest[] = [
      { id: 'call-1', toolName: 'pending_tool', args: {} },
      { id: 'call-2', toolName: 'approved_tool', args: {}, status: 'approved' },
    ];
    const el = await fixture<LyraApprovalQueue>(html`
      <lr-approval-queue .requests=${mixed}></lr-approval-queue>
    `);
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="request"]')];
    const pending = buttons[0];
    const resolved = buttons[1];
    if (!pending || !resolved) throw new Error('Expected one pending and one resolved approval row.');
    // The IDL flag was already true while the row looked and felt exactly like a pending one, so
    // everything below asserts the rendered result instead.
    expect(pending.disabled).to.be.false;
    expect(resolved.disabled).to.be.true;

    expect(getComputedStyle(pending).cursor).to.equal('pointer');
    expect(getComputedStyle(resolved).cursor).to.equal('not-allowed');
    expect(Number(getComputedStyle(pending).opacity)).to.equal(1);
    expect(Number(getComputedStyle(resolved).opacity)).to.be.lessThan(1);

    const pendingResting = getComputedStyle(pending).backgroundColor;
    const resolvedResting = getComputedStyle(resolved).backgroundColor;
    const center = (node: Element): [number, number] => {
      const rect = node.getBoundingClientRect();
      return [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ];
    };
    try {
      await resetMouse();
      await sendMouse({ type: 'move', position: center(pending) });
      await waitUntil(
        () => getComputedStyle(pending).backgroundColor !== pendingResting,
        'a pending row must still light up under the pointer',
      );
      const pendingHover = getComputedStyle(pending).backgroundColor;
      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(pending).backgroundColor !== pendingHover,
        'a pending row must still darken under a press',
      );
      await sendMouse({ type: 'up' });

      await sendMouse({ type: 'move', position: center(resolved) });
      await waitUntil(
        () => getComputedStyle(pending).backgroundColor === pendingResting,
        'the pointer should have left the pending row',
      );
      expect(
        getComputedStyle(resolved).backgroundColor,
        'a resolved row must not light up under the pointer',
      ).to.equal(resolvedResting);
      await sendMouse({ type: 'down' });
      expect(
        getComputedStyle(resolved).backgroundColor,
        'a resolved row must not react to a press either',
      ).to.equal(resolvedResting);
      await sendMouse({ type: 'up' });
    } finally {
      await resetMouse();
    }
  });

  it('omits requests with empty or blank identities before counts, selection, and rendering', async () => {
    const emptyIdRequest: ToolApprovalRequest = { id: '', toolName: 'empty_id_tool', args: {} };
    const blankIdRequest: ToolApprovalRequest = { id: '   ', toolName: 'blank_id_tool', args: {} };
    const el = await fixture<LyraApprovalQueue>(html`
      <lr-approval-queue .requests=${[emptyIdRequest, blankIdRequest]}></lr-approval-queue>
    `);
    expect(el.selectedInvocationId).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('[part="request"]')).to.have.length(0);
    expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
    expect(Boolean(el.shadowRoot!.querySelector('lr-tool-approval-dialog'))).to.equal(false);
  });

  it('keeps a non-empty host name on the host and preserves explicit-empty section semantics', async () => {
    const el = (await fixture(html`
      <lr-approval-queue aria-label="Author approvals" label="Visible approvals"></lr-approval-queue>
    `)) as LyraApprovalQueue;
    expect(el.getAttribute('aria-label')).to.equal('Author approvals');
    expect(el.shadowRoot!.querySelector('section')!.hasAttribute('aria-label')).to.equal(false);

    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('section')!.getAttribute('aria-label')).to.equal('');
  });

  it('distinguishes an omitted label from an explicit empty override on the heading', async () => {
    const omitted = (await fixture(html`<lr-approval-queue></lr-approval-queue>`)) as LyraApprovalQueue;
    expect(omitted.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Tool approval queue');

    const explicitEmpty = (await fixture(html`<lr-approval-queue label=""></lr-approval-queue>`)) as LyraApprovalQueue;
    expect(explicitEmpty.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('');

    const explicitOverride = (await fixture(
      html`<lr-approval-queue label="Custom heading"></lr-approval-queue>`
    )) as LyraApprovalQueue;
    expect(explicitOverride.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('Custom heading');
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
      <lr-approval-queue selected-invocation-id="call-1" .requests=${requests}></lr-approval-queue>
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
        selected-invocation-id="call-1"
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

it('normalizes duplicate request ids first-wins before selection and dialog lookup', async () => {
  const el = await fixture<LyraApprovalQueue>(html`
    <lr-approval-queue .requests=${[
      { id: 'same', toolName: 'first_tool', args: { first: true } },
      { id: 'same', toolName: 'later_tool', args: { later: true } },
    ]}></lr-approval-queue>
  `);
  const rows = el.shadowRoot!.querySelectorAll('[part="request"]');
  expect(rows).to.have.length(1);
  expect(rows[0]!.textContent).to.contain('first_tool');
  expect(rows[0]!.textContent).not.to.contain('later_tool');
});
