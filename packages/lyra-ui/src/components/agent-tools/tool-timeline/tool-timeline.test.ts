import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './tool-timeline.js';
import type { LyraToolTimeline, ToolTimelineEntry, ToolTimelineApprovalDetail } from './tool-timeline.js';
import type { LyraToolCallChip } from '../tool-call-chip/tool-call-chip.class.js';
import type { LyraToolResultView } from '../tool-result-view/tool-result-view.class.js';
import type { LyraToolApprovalDialog } from '../tool-approval-dialog/tool-approval-dialog.class.js';

function entriesEl(el: LyraToolTimeline): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part="entry"]')] as HTMLElement[];
}
function chipIn(entry: HTMLElement): LyraToolCallChip {
  return entry.querySelector('lr-tool-call-chip') as LyraToolCallChip;
}
function resultViewIn(entry: HTMLElement): LyraToolResultView {
  return entry.querySelector('lr-tool-result-view') as LyraToolResultView;
}
function dialog(el: LyraToolTimeline): LyraToolApprovalDialog {
  return el.shadowRoot!.querySelector('lr-tool-approval-dialog') as LyraToolApprovalDialog;
}

function makeEntry(overrides: Partial<ToolTimelineEntry> = {}): ToolTimelineEntry {
  return {
    id: 'call-1',
    name: 'web_search',
    args: { query: 'solar inverters' },
    status: 'success',
    ...overrides,
  };
}

it('defaults to entries=[] and approvalEditable=true, rendering an empty list with no dialog decision affordance', async () => {
  const el = (await fixture(html`<lr-tool-timeline></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(el.entries).to.deep.equal([]);
  expect(el.approvalEditable).to.be.true;
  expect(entriesEl(el).length).to.equal(0);
  expect(dialog(el).open).to.be.false;
});

it('renders one [part="entry"] per input entry, sorted chronologically by startedAt regardless of input order', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-third', name: 'third', startedAt: 3000 }),
    makeEntry({ id: 'c-first', name: 'first', startedAt: 1000 }),
    makeEntry({ id: 'c-second', name: 'second', startedAt: 2000 }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const rows = entriesEl(el);
  expect(rows.length).to.equal(3);
  expect(rows.map((r) => chipIn(r).name)).to.deep.equal(['first', 'second', 'third']);
});

it('sorts entries with no startedAt after every timed entry, preserving their relative input order', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-untimed-a', name: 'untimed-a' }),
    makeEntry({ id: 'c-timed', name: 'timed', startedAt: 500 }),
    makeEntry({ id: 'c-untimed-b', name: 'untimed-b' }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const rows = entriesEl(el);
  expect(rows.map((r) => chipIn(r).name)).to.deep.equal(['timed', 'untimed-a', 'untimed-b']);
});

it('composes lr-tool-call-chip per entry, wiring name/status/call-id and a duration derived from startedAt/endedAt', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'call-a', name: 'search_web', status: 'success', startedAt: 1000, endedAt: 1820 }),
    makeEntry({ id: 'call-b', name: 'run_python', status: 'running', startedAt: 2000 }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const rows = entriesEl(el);
  const chipA = chipIn(rows[0]);
  expect(chipA.name).to.equal('search_web');
  expect(chipA.status).to.equal('success');
  expect(chipA.callId).to.equal('call-a');
  expect(chipA.durationMs).to.equal(820);

  const chipB = chipIn(rows[1]);
  expect(chipB.durationMs).to.be.undefined;
});

it('composes lr-tool-result-view per entry, wiring tool-name/args/result', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ args: { query: 'x' }, result: { count: 3 } }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const view = resultViewIn(entriesEl(el)[0]);
  expect(view.toolName).to.equal('web_search');
  expect(view.args).to.deep.equal({ query: 'x' });
  expect(view.result).to.deep.equal({ count: 3 });
});

it('redacts top-level and nested fields named in redactedFields with the localized placeholder, leaving other fields intact', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({
      args: { apiKey: 'sk-secret', query: 'ok' },
      result: { rows: [{ ssn: '000-00-0000', name: 'ok' }] },
      redactedFields: ['args.apiKey', 'result.rows.0.ssn'],
    }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const view = resultViewIn(entriesEl(el)[0]);
  expect(view.args).to.deep.equal({ apiKey: 'Value hidden', query: 'ok' });
  expect(view.result).to.deep.equal({ rows: [{ ssn: 'Value hidden', name: 'ok' }] });
  expect(entriesEl(el)[0].querySelector('[part="entry-redacted-indicator"]')).to.exist;
});

it('renders no redacted-indicator and leaves args/result untouched when redactedFields is unset', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ args: { query: 'ok' }, result: { count: 1 } })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const row = entriesEl(el)[0];
  expect(row.querySelector('[part="entry-redacted-indicator"]')).to.not.exist;
  expect(resultViewIn(row).args).to.deep.equal({ query: 'ok' });
});

it('a dangling redaction path is a no-op rather than throwing, and does not affect unrelated fields', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ args: { query: 'ok' }, redactedFields: ['args.doesNotExist.deeper'] }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(resultViewIn(entriesEl(el)[0]).args).to.deep.equal({ query: 'ok' });
});

it('never redacts the args handed to the approval dialog, even when redactedFields would mask them in the result view', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({
      id: 'call-secret',
      args: { apiKey: 'sk-secret' },
      needsApproval: true,
      redactedFields: ['args.apiKey'],
    }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;
  expect(dialog(el).args).to.deep.equal({ apiKey: 'sk-secret' });
});

it('opens the shared approval dialog for a pending-approval entry when its chip is activated', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ id: 'call-approve', args: { path: '/tmp/x' }, needsApproval: true })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(dialog(el).open).to.be.false;

  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;

  expect(dialog(el).open).to.be.true;
  expect(dialog(el).toolName).to.equal('web_search');
  expect(dialog(el).args).to.deep.equal({ path: '/tmp/x' });
});

it('emits lr-tool-approval-decide with approved:true and the dialog args on approve, then closes the dialog', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ id: 'call-approve', args: { path: '/tmp/x' }, needsApproval: true })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;

  const listener = oneEvent(el, 'lr-tool-approval-decide');
  dialog(el).shadowRoot!.querySelector<HTMLButtonElement>('[part="approve-button"]')!.click();
  const event = (await listener) as CustomEvent<ToolTimelineApprovalDetail>;
  expect(event.detail).to.deep.equal({ invocationId: 'call-approve', approved: true, args: { path: '/tmp/x' } });
  await el.updateComplete;
  expect(dialog(el).open).to.be.false;
});

it('emits lr-tool-approval-decide with approved:false (no args) on deny', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ id: 'call-deny', needsApproval: true })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;

  const listener = oneEvent(el, 'lr-tool-approval-decide');
  dialog(el).shadowRoot!.querySelector<HTMLButtonElement>('[part="deny-button"]')!.click();
  const event = (await listener) as CustomEvent<ToolTimelineApprovalDetail>;
  expect(event.detail).to.deep.equal({ invocationId: 'call-deny', approved: false });
});

it('dismissing the dialog via escape/backdrop closes it without emitting a decision', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ id: 'call-x', needsApproval: true })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;

  let fired = false;
  el.addEventListener('lr-tool-approval-decide', () => (fired = true));
  dialog(el).close('escape');
  await el.updateComplete;
  expect(dialog(el).open).to.be.false;
  expect(fired).to.be.false;
});

it('does not open the dialog for an entry that does not need approval, and lets its raw chip-select event bubble out unmodified', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ id: 'call-plain' })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const listener = oneEvent(el, 'lr-tool-call-chip-select');
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  const event = (await listener) as CustomEvent<{ name: string; callId: string }>;
  expect(event.detail).to.deep.equal({ name: 'web_search', callId: 'call-plain' });
  expect(dialog(el).open).to.be.false;
});

it('does not reopen the dialog for an already-decided entry, and shows the localized decision badge instead', async () => {
  const approved: ToolTimelineEntry[] = [makeEntry({ id: 'call-a', needsApproval: true, approved: true })];
  const elApproved = (await fixture(html`<lr-tool-timeline .entries=${approved}></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(entriesEl(elApproved)[0].querySelector('[part="entry-approval-status"]')!.textContent!.trim()).to.equal('Approved');
  chipIn(entriesEl(elApproved)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await elApproved.updateComplete;
  expect(dialog(elApproved).open).to.be.false;

  const denied: ToolTimelineEntry[] = [makeEntry({ id: 'call-b', needsApproval: true, approved: false })];
  const elDenied = (await fixture(html`<lr-tool-timeline .entries=${denied}></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(entriesEl(elDenied)[0].querySelector('[part="entry-approval-status"]')!.textContent!.trim()).to.equal('Denied');
});

it('closes the review dialog if its entry disappears or resolves out from under it via a new entries assignment', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ id: 'call-x', needsApproval: true })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;
  expect(dialog(el).open).to.be.true;

  el.entries = [];
  await el.updateComplete;
  expect(dialog(el).open).to.be.false;
});

it('renders a retry badge with the localized "Retry" label and formatted count only when retryCount > 0', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'call-a', retryCount: 2 }),
    makeEntry({ id: 'call-b', retryCount: 0 }),
    makeEntry({ id: 'call-c' }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const rows = entriesEl(el);
  const badge = rows[0].querySelector('[part="entry-retries"]');
  expect(badge).to.exist;
  expect(rows[0].querySelector('[part="entry-retries-label"]')!.textContent).to.equal('Retry');
  expect(rows[0].querySelector('[part="entry-retries-count"]')!.textContent).to.equal('2');
  expect(rows[1].querySelector('[part="entry-retries"]')).to.not.exist;
  expect(rows[2].querySelector('[part="entry-retries"]')).to.not.exist;
});

it('honors a `.strings` override for the reused "retry" key', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ retryCount: 1 })];
  const el = (await fixture(
    html`<lr-tool-timeline .entries=${entries} .strings=${{ retry: 'Nouvelle tentative' }}></lr-tool-timeline>`,
  )) as LyraToolTimeline;
  expect(entriesEl(el)[0].querySelector('[part="entry-retries-label"]')!.textContent).to.equal('Nouvelle tentative');
});

it('honors a `.strings` override for the reused "envListValueHidden" redaction placeholder', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ args: { apiKey: 'secret' }, redactedFields: ['args.apiKey'] }),
  ];
  const el = (await fixture(
    html`<lr-tool-timeline .entries=${entries} .strings=${{ envListValueHidden: 'Masqué' }}></lr-tool-timeline>`,
  )) as LyraToolTimeline;
  expect(resultViewIn(entriesEl(el)[0]).args).to.deep.equal({ apiKey: 'Masqué' });
});

it('forwards a host aria-label onto the internal list element', async () => {
  const el = (await fixture(html`<lr-tool-timeline aria-label="Run timeline"></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Run timeline');
});

it('accepts approval-editable="false" as a plain-HTML attribute string', async () => {
  const el = (await fixture(html`<lr-tool-timeline approval-editable="false"></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(el.approvalEditable).to.be.false;
});

it('renders correctly under dir="rtl" with no crash, preserving chronological order', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-first', name: 'first', startedAt: 1000 }),
    makeEntry({ id: 'c-second', name: 'second', startedAt: 2000 }),
  ];
  const wrapper = document.createElement('div');
  wrapper.dir = 'rtl';
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`, {
    parentNode: wrapper,
  })) as LyraToolTimeline;
  const rows = entriesEl(el);
  expect(rows.map((r) => chipIn(r).name)).to.deep.equal(['first', 'second']);
});

it('stays within a 320px allocation without the host overflowing it', async () => {
  const container = document.createElement('div');
  container.style.inlineSize = '320px';
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-a', name: 'query_customer_database_readonly', startedAt: 1000, endedAt: 4200, retryCount: 3 }),
    makeEntry({ id: 'c-b', name: 'run_python', status: 'error', startedAt: 5000, error: 'Timed out after 30s' }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`, { parentNode: container })) as LyraToolTimeline;
  await el.updateComplete;
  expect((el as unknown as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
});

it('retints a denied entry\'s rail-dot and a pending-approval entry\'s leading border independently via their own cssprops, both falling back to --lr-color-warning', async () => {
  const denied: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-denied', status: 'denied', approved: false }),
    makeEntry({ id: 'c-pending', status: 'pending', needsApproval: true }),
  ];
  const el = (await fixture(
    html`<lr-tool-timeline
      .entries=${denied}
      style="
        --lr-tool-timeline-denied-marker-color: rgb(1, 2, 3);
        --lr-tool-timeline-pending-approval-border-color: rgb(7, 8, 9);
      "
    ></lr-tool-timeline>`,
  )) as LyraToolTimeline;
  const rows = entriesEl(el);
  const deniedMarker = rows[0].querySelector('[part="entry-marker"]') as HTMLElement;
  const pendingBody = rows[1].querySelector('[part="entry-body"]') as HTMLElement;

  expect(getComputedStyle(deniedMarker, '::before').backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(pendingBody).borderInlineStartColor).to.equal('rgb(7, 8, 9)');
});

it('falls back both denied-marker and pending-approval-border colors to the shared --lr-color-warning token when unset', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-denied', status: 'denied', approved: false }),
    makeEntry({ id: 'c-pending', status: 'pending', needsApproval: true }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const rows = entriesEl(el);
  const deniedMarker = rows[0].querySelector('[part="entry-marker"]') as HTMLElement;
  const pendingBody = rows[1].querySelector('[part="entry-body"]') as HTMLElement;
  const probe = document.createElement('div');
  probe.style.color = 'var(--lr-color-warning)';
  el.shadowRoot!.appendChild(probe);
  const warningColor = getComputedStyle(probe).color;
  probe.remove();

  expect(getComputedStyle(deniedMarker, '::before').backgroundColor).to.equal(warningColor);
  expect(getComputedStyle(pendingBody).borderInlineStartColor).to.equal(warningColor);
});

it('is accessible with a populated timeline and the approval dialog open', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-a', status: 'success', startedAt: 1000, endedAt: 1500, retryCount: 1 }),
    makeEntry({ id: 'c-b', name: 'delete_file', status: 'pending', needsApproval: true, args: { path: '/tmp/x' } }),
    makeEntry({ id: 'c-c', name: 'send_email', status: 'denied', approved: false, error: 'Blocked by policy' }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[1]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;
  expect(dialog(el).open).to.be.true;
  await expect(el).to.be.accessible();
});
