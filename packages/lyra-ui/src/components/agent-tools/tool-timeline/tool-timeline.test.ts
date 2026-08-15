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
async function openEntry(el: LyraToolTimeline, index = 0): Promise<HTMLElement> {
  const row = entriesEl(el)[index]!;
  row.querySelector('lr-details')!.dispatchEvent(
    new CustomEvent('lr-toggle', { detail: { open: true }, bubbles: true, composed: true }),
  );
  await el.updateComplete;
  return entriesEl(el)[index]!;
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

it('suppresses the chip-selection event while opening a pending approval', async () => {
  const entry = makeEntry({ needsApproval: true, approved: undefined });
  const el = (await fixture(html`<lr-tool-timeline .entries=${[entry]}></lr-tool-timeline>`)) as LyraToolTimeline;
  let leaked = 0;
  el.addEventListener('lr-tool-call-chip-select', () => leaked++);
  const chip = chipIn(entriesEl(el)[0]);
  chip.dispatchEvent(new CustomEvent('lr-tool-call-chip-select', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(leaked).to.equal(0);
  expect(dialog(el).open).to.be.true;
});

it('owns one chip activation and emits one correlated timeline event', async () => {
  const el = (await fixture(
    html`<lr-tool-timeline .entries=${[makeEntry()]}></lr-tool-timeline>`,
  )) as LyraToolTimeline;
  let rawSelections = 0;
  el.addEventListener('lr-tool-call-chip-select', () => rawSelections++);
  const activation = oneEvent(el, 'lr-tool-activate');

  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  expect((await activation).detail).to.deep.equal({ invocationId: 'call-1' });
  expect(rawSelections).to.equal(0);
});

it('ignores a stray lr-tool-chip-select on a pending-approval entry', async () => {
  const entry = makeEntry({ needsApproval: true, approved: undefined });
  const el = (await fixture(html`<lr-tool-timeline .entries=${[entry]}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[0]).dispatchEvent(
    new CustomEvent('lr-tool-chip-select', { bubbles: true, composed: true }),
  );
  await el.updateComplete;
  expect(dialog(el).open).to.be.false;
});

it('exposes a vetoed approval at the timeline boundary and lets a host revert it without losing edits', async () => {
  const entry = makeEntry({ needsApproval: true, approved: undefined, args: { path: '/workspace/draft.md' } });
  const el = (await fixture(html`<lr-tool-timeline .entries=${[entry]}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[0]).dispatchEvent(
    new CustomEvent('lr-tool-call-chip-select', { bubbles: true, composed: true }),
  );
  await el.updateComplete;
  const approvalDialog = dialog(el);
  approvalDialog.shadowRoot!.querySelector<HTMLButtonElement>('[part="edit-button"]')!.click();
  await approvalDialog.updateComplete;
  const editor = approvalDialog.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="args-editor"]')!;
  const editedArgs = '{\n  "path": "/workspace/retry.md"\n}';
  editor.value = editedArgs;
  editor.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await approvalDialog.updateComplete;
  el.addEventListener('lr-tool-approval-decide', (event) => event.preventDefault(), { once: true });
  approvalDialog.shadowRoot!.querySelector<HTMLElement>('[part="approve-button"]')!.click();
  await el.updateComplete;
  await approvalDialog.updateComplete;
  expect(el.pendingApproval).to.equal('approve');
  expect(approvalDialog.open).to.be.true;
  expect(approvalDialog.pending).to.equal('approve');

  el.revertPendingApproval();
  await el.updateComplete;
  await approvalDialog.updateComplete;
  expect(el.pendingApproval).to.equal(null);
  expect(approvalDialog.open).to.be.true;
  expect(approvalDialog.pending).to.equal(null);
  expect(editor.value).to.equal(editedArgs);

  const retry = oneEvent(el, 'lr-tool-approval-decide');
  approvalDialog.shadowRoot!.querySelector<HTMLElement>('[part="approve-button"]')!.click();
  const event = (await retry) as CustomEvent<ToolTimelineApprovalDetail>;
  expect(event.detail).to.deep.equal({ invocationId: 'call-1', approved: true, args: { path: '/workspace/retry.md' } });
  await el.updateComplete;
  expect(approvalDialog.open).to.be.false;
});

it('lets a host finalize a vetoed denial through the timeline boundary', async () => {
  const entry = makeEntry({ needsApproval: true, approved: undefined });
  const el = (await fixture(html`<lr-tool-timeline .entries=${[entry]}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[0]).dispatchEvent(
    new CustomEvent('lr-tool-call-chip-select', { bubbles: true, composed: true }),
  );
  await el.updateComplete;
  const approvalDialog = dialog(el);
  el.addEventListener('lr-tool-approval-decide', (event) => event.preventDefault(), { once: true });
  approvalDialog.shadowRoot!.querySelector<HTMLElement>('[part="deny-button"]')!.click();
  await el.updateComplete;
  await approvalDialog.updateComplete;
  expect(el.pendingApproval).to.equal('deny');
  expect(approvalDialog.pending).to.equal('deny');

  el.finalizePendingApproval();
  await el.updateComplete;
  await approvalDialog.updateComplete;
  expect(el.pendingApproval).to.equal(null);
  expect(approvalDialog.open).to.be.false;
});

it('uses prototype-safe redaction clones', async () => {
  const args = JSON.parse('{"safe":"yes","__proto__":{"secret":"value"}}') as Record<string, unknown>;
  const entry = makeEntry({ args, redactedFields: ['args.safe'] });
  const el = (await fixture(html`<lr-tool-timeline .entries=${[entry]}></lr-tool-timeline>`)) as LyraToolTimeline;
  const details = entriesEl(el)[0].querySelector('lr-details') as HTMLElement & { open: boolean };
  details.open = true;
  details.dispatchEvent(new CustomEvent('lr-toggle', { detail: { open: true }, bubbles: true, composed: true }));
  await el.updateComplete;
  const view = resultViewIn(entriesEl(el)[0]);
  expect(Object.getPrototypeOf(view.args)).to.equal(null);
  expect((view.args as Record<string, unknown>).secret).to.be.undefined;
});

it('does not mount heavy result views until an entry is disclosed', async () => {
  const entries = Array.from({ length: 100 }, (_, index) => makeEntry({ id: `call-${index}` }));
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(el.shadowRoot!.querySelectorAll('lr-tool-result-view')).to.have.lengthOf(0);
});

it('owns entry records once at assignment and avoids re-reading source proxies on disclosure', async () => {
  let ownKeyReads = 0;
  const args = new Proxy({ secret: 'hidden', visible: 'ok' }, {
    ownKeys(target) {
      ownKeyReads++;
      return Reflect.ownKeys(target);
    },
  });
  const entry = makeEntry({ args, redactedFields: ['args.secret'] });
  const el = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline .entries=${[entry]}></lr-tool-timeline>
  `);

  expect(ownKeyReads).to.equal(1);
  expect(el.shadowRoot!.querySelector('lr-tool-result-view') === null).to.be.true;
  expect(resultViewIn(await openEntry(el)).args).to.deep.equal({ secret: 'Value hidden', visible: 'ok' });
  const readsAfterOpen = ownKeyReads;
  expect(readsAfterOpen).to.equal(1);

  el.approvalEditable = false;
  await el.updateComplete;
  expect(ownKeyReads).to.equal(readsAfterOpen);
});

it('fails redaction closed at path, depth, and node ceilings without throwing', async () => {
  const tooManyPaths = Array.from({ length: 101 }, (_, index) => `args.field-${index}`);
  const deepPath = `args.${Array.from({ length: 65 }, () => 'child').join('.')}`;
  const wide = Object.fromEntries(Array.from({ length: 10_001 }, (_, index) => [`field-${index}`, index]));
  const el = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline .entries=${[
      makeEntry({ id: 'paths', args: { visible: 'sensitive' }, redactedFields: tooManyPaths }),
      makeEntry({ id: 'depth', args: { child: { visible: 'sensitive' } }, redactedFields: [deepPath] }),
      makeEntry({ id: 'nodes', args: wide, redactedFields: ['args.field-10000'] }),
    ]}></lr-tool-timeline>
  `);

  expect(resultViewIn(await openEntry(el, 0)).args).to.equal('Value hidden');
  expect(resultViewIn(await openEntry(el, 1)).args).to.equal('Value hidden');
  expect(resultViewIn(await openEntry(el, 2)).args).to.equal('Value hidden');
});

it('sorts non-finite timestamps with untimed entries after valid chronology', async () => {
  const el = (await fixture(html`
    <lr-tool-timeline
      .entries=${[
        makeEntry({ id: 'nan', startedAt: Number.NaN }),
        makeEntry({ id: 'later', startedAt: 200 }),
        makeEntry({ id: 'earlier', startedAt: 100 }),
      ]}
    ></lr-tool-timeline>
  `)) as LyraToolTimeline;
  expect(entriesEl(el).map((row) => chipIn(row).callId)).to.deep.equal(['earlier', 'later', 'nan']);
});

it('normalizes a foreign provider status once to pending for both timeline row and child chip', async () => {
  const el = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline .entries=${[makeEntry({ status: 'foreign' as never })]}></lr-tool-timeline>
  `);
  const row = entriesEl(el)[0]!;
  expect(row.dataset.status).to.equal('pending');
  expect(chipIn(row).status).to.equal('pending');
});

it('defaults to entries=[] and approvalEditable=true, rendering an empty list with no dialog decision affordance', async () => {
  const el = (await fixture(html`<lr-tool-timeline></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(el.entries).to.deep.equal([]);
  expect(el.approvalEditable).to.be.true;
  expect(el.pendingApproval).to.equal(null);
  expect(entriesEl(el).length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
  expect(dialog(el).open).to.be.false;
});

it('leaves timeline approval recovery methods inert when no approval is held', async () => {
  const el = (await fixture(html`<lr-tool-timeline></lr-tool-timeline>`)) as LyraToolTimeline;
  el.finalizePendingApproval();
  el.revertPendingApproval();
  await el.updateComplete;
  expect(el.pendingApproval).to.equal(null);
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

it('forwards an entry icon to the composed tool-call chip', async () => {
  const el = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline .entries=${[makeEntry({ icon: '🔎' })]}></lr-tool-timeline>
  `);
  expect(chipIn(entriesEl(el)[0]).icon).to.equal('🔎');
});

it('composes lr-tool-result-view per entry, wiring tool-name/args/result', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ args: { query: 'x' }, result: { count: 3 } }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const view = resultViewIn(await openEntry(el));
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
  const view = resultViewIn(await openEntry(el));
  expect(view.args).to.deep.equal({ apiKey: 'Value hidden', query: 'ok' });
  expect(view.result).to.deep.equal({ rows: [{ ssn: 'Value hidden', name: 'ok' }] });
  expect(entriesEl(el)[0].querySelector('[part="entry-redacted-indicator"]')).to.exist;
});

it('exposes localized redaction state text while hiding only the decorative glyph', async () => {
  const el = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline
      .entries=${[makeEntry({ redactedFields: ['args.secret'] })]}
      .strings=${{ envListValueHidden: 'Sensitive fields hidden' }}
    ></lr-tool-timeline>
  `);
  const indicator = entriesEl(el)[0]!.querySelector<HTMLElement>('[part="entry-redacted-indicator"]')!;
  expect(indicator.hasAttribute('aria-hidden')).to.be.false;
  expect(indicator.querySelector('[aria-hidden="true"]')).to.exist;
  expect(indicator.textContent).to.contain('Sensitive fields hidden');
});

it('renders no redacted-indicator and leaves args/result untouched when redactedFields is unset', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ args: { query: 'ok' }, result: { count: 1 } })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const row = await openEntry(el);
  expect((row.querySelector('[part="entry-redacted-indicator"]')) == null).to.be.true;
  expect(resultViewIn(row).args).to.deep.equal({ query: 'ok' });
});

it('a dangling redaction path is a no-op rather than throwing, and does not affect unrelated fields', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ args: { query: 'ok' }, redactedFields: ['args.doesNotExist.deeper'] }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  expect(resultViewIn(await openEntry(el)).args).to.deep.equal({ query: 'ok' });
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

it('does not open the dialog for an entry that does not need approval and emits its owned activation', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ id: 'call-plain' })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const listener = oneEvent(el, 'lr-tool-activate');
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  const event = (await listener) as CustomEvent<{ invocationId: string }>;
  expect(event.detail).to.deep.equal({ invocationId: 'call-plain' });
  expect(dialog(el).open).to.be.false;
});

it('uses deterministic first-wins duplicate identities and accepts duplicate ids with distinct source keys', async () => {
  const ambiguous = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline .entries=${[
      makeEntry({ id: 'reused', name: 'first' }),
      makeEntry({ id: 'reused', name: 'second' }),
    ]}></lr-tool-timeline>
  `);
  expect(entriesEl(ambiguous)).to.have.length(1);
  expect(chipIn(entriesEl(ambiguous)[0]!).name).to.equal('first');
  expect(dialog(ambiguous).open).to.be.false;

  const distinct = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline .entries=${[
      makeEntry({ id: 'reused', sourceKey: 'run-a', name: 'first' }),
      makeEntry({ id: 'reused', sourceKey: 'run-b', name: 'second' }),
    ]}></lr-tool-timeline>
  `);
  expect(entriesEl(distinct)).to.have.length(2);
  const activated = oneEvent(distinct, 'lr-tool-activate');
  chipIn(entriesEl(distinct)[1]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  expect((await activated).detail).to.deep.equal({ invocationId: 'reused', sourceKey: 'run-b' });
});

it('omits blank invocation identities and treats a blank source key as the absent scope', async () => {
  const el = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline .entries=${[
      makeEntry({ id: '', name: 'empty' }),
      makeEntry({ id: '   ', name: 'blank' }),
      makeEntry({ id: 'kept', sourceKey: '', name: 'first unscoped' }),
      makeEntry({ id: 'kept', name: 'later unscoped duplicate' }),
    ]}></lr-tool-timeline>
  `);

  expect(entriesEl(el)).to.have.length(1);
  expect(chipIn(entriesEl(el)[0]!).name).to.equal('first unscoped');
  const activated = oneEvent(el, 'lr-tool-activate');
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  expect((await activated).detail).to.deep.equal({ invocationId: 'kept' });
});

it('prunes disclosure state when an identity disappears so later reuse starts collapsed', async () => {
  const entry = makeEntry({ id: 'reused', sourceKey: 'run-a' });
  const el = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .entries=${[entry]}></lr-tool-timeline>`);
  await openEntry(el);
  expect((entriesEl(el)[0]!.querySelector('lr-details') as HTMLElement & { open: boolean }).open).to.be.true;

  el.entries = [];
  await el.updateComplete;
  el.entries = [{ ...entry }];
  await el.updateComplete;

  expect((entriesEl(el)[0]!.querySelector('lr-details') as HTMLElement & { open: boolean }).open).to.be.false;
});

it('bounds mounted history and exposes a localized truncation notice', async () => {
  const entries = Array.from({ length: 501 }, (_, index) => makeEntry({ id: `call-${index}` }));
  const el = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline
      .entries=${entries}
      .strings=${{ toolTimelineLimit: 'At most {count} calls shown' }}
    ></lr-tool-timeline>
  `);
  expect(entriesEl(el)).to.have.length(500);
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('At most 500 calls shown');
});

it('keeps an open row and the row under approval review mounted when history pushes them past the cap', async () => {
  const openTarget = makeEntry({ id: 'open-target' });
  const reviewTarget = makeEntry({ id: 'review-target', needsApproval: true });
  const el = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline .entries=${[openTarget, reviewTarget]}></lr-tool-timeline>
  `);
  await openEntry(el, 0);
  chipIn(entriesEl(el)[1]!).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;
  expect(dialog(el).open).to.be.true;

  const newer = Array.from({ length: 500 }, (_, index) => makeEntry({ id: `new-${index}` }));
  el.entries = [...newer, openTarget, reviewTarget];
  await el.updateComplete;

  const rows = entriesEl(el);
  expect(rows).to.have.length(500);
  const openRow = rows.find((row) => chipIn(row).callId === 'open-target');
  const reviewRow = rows.find((row) => chipIn(row).callId === 'review-target');
  expect(openRow).to.exist;
  expect((openRow!.querySelector('lr-details') as HTMLElement & { open: boolean }).open).to.be.true;
  expect(reviewRow).to.exist;
  expect(dialog(el).open).to.be.true;
  expect(dialog(el).toolName).to.equal(reviewTarget.name);
});

it('resets review drafts and disclosure state across a source-generation replacement', async () => {
  const first = makeEntry({
    id: 'reused',
    sourceKey: 'run-a',
    name: 'web_search',
    args: { query: 'first' },
    needsApproval: true,
    status: 'pending',
  });
  const el = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .entries=${[first]}></lr-tool-timeline>`);
  await openEntry(el);
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;
  const approval = dialog(el);
  approval.shadowRoot!.querySelector<HTMLButtonElement>('[part="edit-button"]')!.click();
  await approval.updateComplete;
  const editor = approval.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="args-editor"]')!;
  editor.value = '{"query":"stale"}';
  editor.dispatchEvent(new Event('input'));

  el.entries = [{
    ...first,
    sourceKey: 'run-b',
    name: 'read_file',
    args: { path: 'replacement.md' },
  }];
  await el.updateComplete;
  await approval.updateComplete;

  expect(approval.open).to.be.false;
  expect(approval.shadowRoot!.querySelector('[part="args-editor"]') === null).to.be.true;
  expect((entriesEl(el)[0].querySelector('lr-details') as HTMLElement & { open: boolean }).open).to.be.false;
});

it('contains details lifecycle events and translates renderer failures with entry identity', async () => {
  const el = await fixture<LyraToolTimeline>(html`
    <lr-tool-timeline .entries=${[
      makeEntry({ id: 'first', sourceKey: 'run-a' }),
      makeEntry({ id: 'second', sourceKey: 'run-a' }),
    ]}></lr-tool-timeline>
  `);
  let rawShows = 0;
  let rawErrors = 0;
  el.addEventListener('lr-show', () => rawShows++);
  el.addEventListener('lr-render-error', () => rawErrors++);
  const second = await openEntry(el, 1);
  expect(rawShows).to.equal(0);

  const correlated = oneEvent(el, 'lr-tool-render-error');
  second.querySelector('lr-tool-result-view')!.dispatchEvent(new CustomEvent('lr-render-error', {
    bubbles: true,
    composed: true,
    detail: { toolName: 'web_search', error: 'failed' },
  }));
  expect((await correlated).detail).to.deep.equal({
    invocationId: 'second',
    sourceKey: 'run-a',
    toolName: 'web_search',
    error: 'failed',
  });
  expect(rawErrors).to.equal(0);
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

it('clears a held approval and closes the review dialog if its entry disappears or resolves via a new entries assignment', async () => {
  const entries: ToolTimelineEntry[] = [makeEntry({ id: 'call-x', needsApproval: true })];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  chipIn(entriesEl(el)[0]).shadowRoot!.querySelector<HTMLButtonElement>('[part="base"]')!.click();
  await el.updateComplete;
  expect(dialog(el).open).to.be.true;

  el.addEventListener('lr-tool-approval-decide', (event) => event.preventDefault(), { once: true });
  dialog(el).shadowRoot!.querySelector<HTMLElement>('[part="approve-button"]')!.click();
  await el.updateComplete;
  expect(el.pendingApproval).to.equal('approve');

  el.entries = [];
  await el.updateComplete;
  expect(dialog(el).open).to.be.false;
  expect(el.pendingApproval).to.equal(null);
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
  expect((badge) != null).to.equal(true);
  expect(rows[0].querySelector('[part="entry-retries-label"]')!.textContent).to.equal('Retry');
  expect(rows[0].querySelector('[part="entry-retries-count"]')!.textContent).to.equal('2');
  expect((rows[1].querySelector('[part="entry-retries"]')) == null).to.be.true;
  expect((rows[2].querySelector('[part="entry-retries"]')) == null).to.be.true;
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
  expect(resultViewIn(await openEntry(el)).args).to.deep.equal({ apiKey: 'Masqué' });
});

it('keeps a non-empty host name on the host and preserves an explicit-empty list name', async () => {
  const el = (await fixture(html`
    <lr-tool-timeline aria-label="Run timeline" .entries=${[makeEntry()]}></lr-tool-timeline>
  `)) as LyraToolTimeline;
  const list = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(el.getAttribute('aria-label')).to.equal('Run timeline');
  expect(list.hasAttribute('aria-label')).to.equal(false);

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(list.getAttribute('aria-label')).to.equal('');
});

it('names each details disclosure with its entry name', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'search', name: 'web_search' }),
    makeEntry({ id: 'code', name: 'run_code' }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  await el.updateComplete;
  const details = [...el.shadowRoot!.querySelectorAll<HTMLElement>('lr-details')];
  expect(details.map((item) => (item as HTMLElement & { summary: string }).summary)).to.deep.equal([
    'Details for web_search',
    'Details for run_code',
  ]);
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

it('retints denied and pending rail-dots plus the pending-approval border through independent cssprops', async () => {
  const denied: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-denied', status: 'denied', approved: false }),
    makeEntry({ id: 'c-pending', status: 'pending', needsApproval: true }),
  ];
  const el = (await fixture(
    html`<lr-tool-timeline
      .entries=${denied}
      style="
        --lr-tool-timeline-denied-marker-color: rgb(1, 2, 3);
        --lr-tool-timeline-pending-marker-color: rgb(4, 5, 6);
        --lr-tool-timeline-pending-approval-border-color: rgb(7, 8, 9);
      "
    ></lr-tool-timeline>`,
  )) as LyraToolTimeline;
  const rows = entriesEl(el);
  const deniedMarker = rows[0].querySelector('[part="entry-marker"]') as HTMLElement;
  const pendingMarker = rows[1].querySelector('[part="entry-marker"]') as HTMLElement;
  const pendingBody = rows[1].querySelector('[part="entry-body"]') as HTMLElement;

  expect(getComputedStyle(deniedMarker, '::before').backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(pendingMarker, '::before').backgroundColor).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(pendingBody).borderInlineStartColor).to.equal('rgb(7, 8, 9)');
});

it('falls back denied and pending marker colors plus the pending-approval border to their shared token defaults when unset', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-denied', status: 'denied', approved: false }),
    makeEntry({ id: 'c-pending', status: 'pending', needsApproval: true }),
  ];
  const el = (await fixture(html`<lr-tool-timeline .entries=${entries}></lr-tool-timeline>`)) as LyraToolTimeline;
  const rows = entriesEl(el);
  const deniedMarker = rows[0].querySelector('[part="entry-marker"]') as HTMLElement;
  const pendingMarker = rows[1].querySelector('[part="entry-marker"]') as HTMLElement;
  const pendingBody = rows[1].querySelector('[part="entry-body"]') as HTMLElement;
  const probe = document.createElement('div');
  probe.style.color = 'var(--lr-color-warning)';
  const quietProbe = document.createElement('div');
  quietProbe.style.color = 'var(--lr-color-text-quiet)';
  el.shadowRoot!.append(probe, quietProbe);
  const warningColor = getComputedStyle(probe).color;
  const quietColor = getComputedStyle(quietProbe).color;
  probe.remove();
  quietProbe.remove();

  expect(getComputedStyle(deniedMarker, '::before').backgroundColor).to.equal(warningColor);
  expect(getComputedStyle(pendingMarker, '::before').backgroundColor).to.equal(quietColor);
  expect(getComputedStyle(pendingBody).borderInlineStartColor).to.equal(warningColor);
});

it('retints success markers and approval badges through component-scoped state hooks', async () => {
  const entries: ToolTimelineEntry[] = [
    makeEntry({ id: 'c-approved', status: 'success', approved: true }),
  ];
  const el = (await fixture(html`
    <lr-tool-timeline
      style="
        --lr-tool-timeline-success-marker-color: rgb(1, 2, 3);
        --lr-tool-timeline-approved-color: rgb(4, 5, 6);
      "
      .entries=${entries}
    ></lr-tool-timeline>
  `)) as LyraToolTimeline;
  const row = entriesEl(el)[0];
  const marker = row.querySelector('[part="entry-marker"]') as HTMLElement;
  const approval = row.querySelector('[part="entry-approval-status"]') as HTMLElement;
  expect(getComputedStyle(marker, '::before').backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(approval).color).to.equal('rgb(4, 5, 6)');
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
