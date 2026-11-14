import { expect, fixture, html } from '@open-wc/testing';
import './tool-timeline.js';
import '../tool-approval-dialog/tool-approval-dialog.js';
import type { LyraToolTimeline, ToolTimelineEntry } from './tool-timeline.js';
import type { LyraToolCallChip } from '../tool-call-chip/tool-call-chip.class.js';
import type { LyraToolApprovalDialog } from '../tool-approval-dialog/tool-approval-dialog.class.js';

const dialog = (el: LyraToolTimeline) => el.shadowRoot!.querySelector<LyraToolApprovalDialog>('lr-tool-approval-dialog')!;
const request = (type: 'lr-approve-request' | 'lr-deny-request') =>
  new CustomEvent(type, { bubbles: true, composed: true, cancelable: true, detail: type === 'lr-approve-request' ? { args: {} } : null });

async function openReview(el: LyraToolTimeline): Promise<void> {
  el.shadowRoot!.querySelector<LyraToolCallChip>('lr-tool-call-chip')!.shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;
}

it('emits one decision when a decide listener re-enters the shared approval dialog', async () => {
  const entries: ToolTimelineEntry[] = [{ id: 'call-1', name: 'write_file', status: 'pending', needsApproval: true, args: { path: 'a.md' } }];
  const el = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`);
  await openReview(el);
  expect(dialog(el).open).to.equal(true);
  const decisions: boolean[] = [];
  el.addEventListener('lr-tool-approval-decide-request', (event) => {
    decisions.push((event as CustomEvent<{ approved: boolean }>).detail.approved);
    dialog(el).dispatchEvent(request('lr-deny-request'));
    dialog(el).dispatchEvent(request('lr-approve-request'));
    event.preventDefault();
  });
  dialog(el).dispatchEvent(request('lr-approve-request'));
  expect(decisions).to.deep.equal([true]);
  expect(el.pendingApproval).to.equal('approve');
  decisions.length = 0;
  el.finalizePendingApproval();
  await el.updateComplete;
  await openReview(el);
  dialog(el).dispatchEvent(request('lr-deny-request'));
  expect(decisions).to.deep.equal([false]);
});

it('ignores dialog decisions while no entry is under review', async () => {
  const entries: ToolTimelineEntry[] = [{ id: 'call-1', name: 'write_file', status: 'pending', needsApproval: true, args: {} }];
  const el = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`);
  const decisions: Event[] = [];
  el.addEventListener('lr-tool-approval-decide-request', (event) => decisions.push(event));
  dialog(el).dispatchEvent(request('lr-approve-request'));
  dialog(el).dispatchEvent(request('lr-deny-request'));
  expect(decisions.length).to.equal(0);
});

it('omits a timestamp and duration that cannot be represented', async () => {
  const entries = [
    { id: 'far', name: 'scan', status: 'success', startedAt: 9e15, endedAt: 9e15 + 5 },
    { id: 'wide', name: 'scan', status: 'success', startedAt: -Number.MAX_VALUE, endedAt: Number.MAX_VALUE },
    { id: 'nameless', name: 42, status: 'success' },
  ] as unknown as ToolTimelineEntry[];
  const el = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`);
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="entry"]')];
  expect(rows.length).to.equal(3);
  expect(el.shadowRoot!.querySelectorAll('[part="entry-timestamp"]').length).to.equal(0);
  const chips = [...el.shadowRoot!.querySelectorAll<LyraToolCallChip>('lr-tool-call-chip')];
  expect(chips.map((chip) => chip.durationMs)).to.deep.equal([undefined, 5, undefined]);
  expect(chips[2]!.name).to.equal('');
  expect(el.shadowRoot!.textContent).not.to.include('Infinity').and.not.include('Invalid');
});

it('fails closed on an entry whose redaction list hides a field behind an accessor', async () => {
  let reads = 0;
  const redactedFields = Object.defineProperty([] as string[], '0', { enumerable: true, get() { reads++; return 'apiKey'; } });
  const entries = [
    { id: 'secret', name: 'call_api', status: 'success', args: { apiKey: 'sk-live' }, redactedFields },
    { id: 'plain', name: 'search', status: 'success' },
  ] as ToolTimelineEntry[];
  const el = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`);
  const chips = [...el.shadowRoot!.querySelectorAll<LyraToolCallChip>('lr-tool-call-chip')];
  expect(chips.map((chip) => chip.name)).to.deep.equal(['search']);
  expect(reads).to.equal(0);
  expect(el.shadowRoot!.textContent).not.to.include('sk-live');
});
