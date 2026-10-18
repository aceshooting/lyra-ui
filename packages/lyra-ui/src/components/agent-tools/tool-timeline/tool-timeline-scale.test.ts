import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html } from '@open-wc/testing';
import './tool-timeline.js';
import type { LyraToolTimeline } from './tool-timeline.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-tool-timeline', 'entries'));

it('retains newest input and rendered windows and reuses canonical approval lookup at n=10001', async () => {
  let reads = 0;
  const entries = Array.from({ length: 10001 }, (_, i) => new Proxy({ id: `t${i}`, name: 'tool', args: {}, status: 'success', startedAt: i }, {
    getOwnPropertyDescriptor(target, key) { reads++; return Reflect.getOwnPropertyDescriptor(target, key); },
  }));
  const el = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .entries=${entries}
    .strings=${{ toolTimelineInputLimit: 'Only the newest {count} of {total} tool calls are retained.' }}></lr-tool-timeline>`);
  const seam = el as unknown as { sortedEntries: { id: string }[]; entryStillNeedsApproval(key: string): boolean };
  reads = 0;
  for (let i = 0; i < 20; i++) seam.entryStillNeedsApproval(JSON.stringify([null, 't9999']));
  recordScaleMeasurement('lr-tool-timeline', 'n=10001 twenty approval checks', { reads, retained: el.entries.length, rendered: seam.sortedEntries.length });
  expect(reads).to.equal(0);
  expect(el.entries[0]!.id).to.equal('t1');
  expect(seam.sortedEntries[0]!.id).to.equal('t9501');
  expect(seam.sortedEntries.at(-1)!.id).to.equal('t10000');
  expect(el.shadowRoot!.textContent).to.include('Only the newest 10,000 of 10,001 tool calls are retained.');
});

it('reserves earlier open and reviewed rows when the newest window advances', async () => {
  const entries = Array.from({ length: 502 }, (_, i) => ({ id: `t${i}`, name: 'tool', args: {}, status: 'success' as const, startedAt: i }));
  const el = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .entries=${entries.slice(0, 2)}></lr-tool-timeline>`);
  const seam = el as unknown as { openedEntryIds: Set<string>; reviewingEntryKey?: string; sortedEntries: { id: string }[] };
  seam.openedEntryIds = new Set([JSON.stringify([null, 't0'])]);
  seam.reviewingEntryKey = JSON.stringify([null, 't1']);
  el.entries = entries.map(entry => entry.id === 't1' ? { ...entry, needsApproval: true } : entry);
  await el.updateComplete;
  expect(seam.sortedEntries.length).to.equal(500);
  expect(seam.sortedEntries.some(entry => entry.id === 't0')).to.equal(true);
  expect(seam.sortedEntries.some(entry => entry.id === 't1')).to.equal(true);
  expect(seam.reviewingEntryKey).to.equal(JSON.stringify([null, 't1']));
  expect(seam.sortedEntries.at(-1)!.id).to.equal('t501');
});

it('announces a newly exceeded input boundary once and keeps the initial boundary silent', async () => {
  const row = { id: 't', name: 'Tool', args: {}, status: 'success' as const };
  const el = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .strings=${{ toolTimelineInputLimit: 'Only the newest {count} of {total} tool calls are retained.' }}></lr-tool-timeline>`);
  const expected = 'Only the newest 10,000 of 10,001 tool calls are retained.';
  const before = sinkTexts().filter(text => text === expected).length;
  el.entries = Array.from({ length: 10001 }, () => row);
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include(expected);
  expect(sinkTexts().filter(text => text === expected).length).to.equal(before + 1);
  el.requestUpdate();
  await el.updateComplete;
  expect(sinkTexts().filter(text => text === expected).length).to.equal(before + 1);
  const initial = await fixture<LyraToolTimeline>(html`<lr-tool-timeline .entries=${Array.from({ length: 10001 }, () => row)} .strings=${{ toolTimelineInputLimit: 'Only the newest {count} of {total} tool calls are retained.' }}></lr-tool-timeline>`);
  expect(initial.shadowRoot!.textContent).to.include(expected);
  expect(sinkTexts().filter(text => text === expected).length).to.equal(before + 1);
});
