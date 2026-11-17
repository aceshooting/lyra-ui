import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { INGESTION_ITEM_ACTION_LIMIT, projectIngestionPresentation } from './ingestion-queue-presentation.js';

describe('ingestion presentation data projection', () => {
  it('retains the first valid custom action identity within the bounded inspected prefix', () => {
    fc.assert(fc.property(fc.array(fc.record({
      id: fc.constantFrom('', ' ', 'resume', 'review', 'reselect'),
      label: fc.string({ maxLength: 24 }),
      disabled: fc.boolean(),
    }), { maxLength: 50 }), entries => {
      const actions = entries.map(entry => ({ type: 'custom' as const, ...entry }));
      const seen = new Set<string>();
      const expected = actions.slice(0, 32).filter(action => {
        if (action.id.trim() === '' || action.label.trim() === '' || seen.has(action.id)) return false;
        seen.add(action.id);
        return true;
      });
      const projected = projectIngestionPresentation({ actions }, 'queued');
      expect(projected.actions).to.deep.equal(expected);
      expect(Object.isFrozen(projected.actions)).to.equal(true);
      expect(projected.actions!.every(action => Object.isFrozen(action))).to.equal(true);
      expect(projected.actionLimit).to.deep.equal(actions.length > INGESTION_ITEM_ACTION_LIMIT
        ? { source: actions.length, retained: expected.length } : undefined);
    }), propertyRuns());
  });

  it('admits nonblank own stage labels and never interprets a wrong-typed progress flag as enabled', () => {
    fc.assert(fc.property(fc.string({ maxLength: 40 }), fc.string({ maxLength: 40 }),
      fc.oneof(fc.boolean(), fc.string({ maxLength: 8 }), fc.integer()), (id, label, showProgress) => {
        const projection = projectIngestionPresentation({ customStage: { id, label, showProgress } }, 'custom');
        if (id.trim() === '' || label.trim() === '') expect(projection.customStage).to.equal(undefined);
        else {
          expect(projection.customStage).to.deep.equal({ id, label, variant: 'neutral', showProgress: showProgress === true });
          expect(Object.isFrozen(projection.customStage)).to.equal(true);
        }
      }), propertyRuns());
  });

  it('does not inspect irrelevant custom-stage metadata or spend its text budget for known stages', () => {
    for (const stage of ['queued', 'failed']) {
      const actions = [{ type: 'custom' as const, id: 'resume', label: 'Resume' }];
      const raw = { customStage: { id: 'irrelevant', label: 'x'.repeat(65_536 - 'irrelevant'.length) }, actions };
      expect(projectIngestionPresentation(raw, stage).actions, stage).to.deep.equal(actions);
      let reads = 0;
      const hostile = new Proxy({ actions }, {
        getOwnPropertyDescriptor(target, key) {
          if (key === 'customStage') { reads++; throw new Error('irrelevant metadata must not be reflected'); }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      expect(projectIngestionPresentation(hostile, stage).actions).to.deep.equal(actions);
      expect(reads, stage).to.equal(0);
    }
  });
});
