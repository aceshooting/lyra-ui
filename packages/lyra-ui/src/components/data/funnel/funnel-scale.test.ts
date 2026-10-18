import { expect, fixture, html } from '@open-wc/testing';
import './funnel.js';
import type { LyraFunnel } from './funnel.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import { aggregateMillionObservations } from '../../../../test/aggregate-observations.js';

it('bounds stage projection before rendering a 10000-stage source', async () => {
  const el = await fixture<LyraFunnel>(html`<lr-funnel></lr-funnel>`);
  let reads = 0;
  el.stages = Array.from({ length: 10_000 }, (_, index) => ({ label: String(index), get value() { reads++; return 10_000 - index; } }));
  await el.updateComplete;
  expect(reads).to.be.at.most(1002);
  expect(el.shadowRoot!.querySelectorAll('[part="stage"]').length).to.equal(500);
  recordScaleMeasurement('lr-funnel', '10000 stages admission', { valueReads: reads });
  reads = 0;
  el.label = 'Changed'; await el.updateComplete;
  expect(reads).to.equal(0);
  recordScaleMeasurement('lr-funnel', '10000 stages label change', { valueReads: reads });
});


it('refreshes mutated stages on an explicit update', async () => {
  const stages = [{ label: 'A', value: 10 }, { label: 'B', value: 5 }];
  const el = await fixture<LyraFunnel>(html`<lr-funnel .stages=${stages}></lr-funnel>`);
  stages[1]!.value = 7;
  el.requestUpdate(); await el.updateComplete;
  const seam = el as unknown as { resolveStages(): { value: number }[] };
  expect(seam.resolveStages()[1]!.value).to.equal(7);
});

it('renders aggregate conversion counts from every observation including the final cohort member', async () => {
  const aggregates = await aggregateMillionObservations();
  expect(aggregates.prefix.stages.map(stage => stage.value)).deep.equal([999_999, 500_000, 250_000, 125_000]);
  expect(aggregates.complete.stages.map(stage => stage.value)).deep.equal([1_000_000, 500_001, 250_001, 125_001]);
  const el = await fixture<LyraFunnel>(html`<lr-funnel label="Complete observation cohorts" lang="en" share-precision="4"
    .stages=${aggregates.complete.stages} .comparison=${aggregates.prefix.stages} comparison-label="Before the final observation"></lr-funnel>`);
  const texts = (part: string) => [...el.shadowRoot!.querySelectorAll(`[part="${part}"]`)].map(node => node.textContent?.trim());
  expect(texts('stage-value')).deep.equal(['1,000,000', '500,001', '250,001', '125,001']);
  expect(texts('stage-share')[3]).equal('12.5001%');
  expect(el.shadowRoot!.querySelectorAll('[part="stage"]').length).equal(4);
  expect(el.shadowRoot!.querySelectorAll('[part="comparison-bar"]').length).equal(4);
  el.label = 'Updated complete observation cohorts';
  await el.updateComplete;
  expect(aggregates.sourceReads).equal(1_000_000);
  const domNodes = renderedNodeCount(el);
  expect(domNodes).lessThan(100);
  recordScaleMeasurement('lr-funnel', 'aggregate-observations@1000000', {
    sourceReads: aggregates.sourceReads, sourceObservations: aggregates.complete.sourceCount,
    maxHostChunkRecords: aggregates.maxChunkRecords, retainedStages: el.stages.length,
    retainedComparisonStages: el.comparison.length, mountedStages: texts('stage-value').length, domNodes,
  });
});
