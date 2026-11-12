import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { projectEvalSourceReview, projectEvalSourceRun } from './eval-result-source.js';

describe('evaluation source projection properties', () => {
  it('preserves bounded run text and copies only the configured review choices', () => {
    fc.assert(fc.property(fc.record({ label: fc.string({ maxLength: 100 }), output: fc.string({ maxLength: 200 }),
      choices: fc.array(fc.string({ maxLength: 50 }), { maxLength: 20 }) }), input => {
      const review = { choices: input.choices, unrelated: 'private' };
      const run = projectEvalSourceRun({ key: 'run', order: 0, value: { id: 'run', label: input.label, output: input.output, review } }, () => true);
      expect(run.label).to.equal(input.label);
      expect(run.output).to.equal(input.output);
      expect(run.review === review).to.equal(true);
      expect(Object.isFrozen(run)).to.equal(true);
      const projected = projectEvalSourceReview(run.review, [{ key: 'choices', type: 'category', multiple: true }], () => true);
      const expected = [...input.choices]; input.choices.push('changed');
      expect(projected['choices']).to.deep.equal(expected);
      expect(Object.hasOwn(projected, 'unrelated')).to.equal(false);
      expect(Object.isFrozen(projected) && Object.isFrozen(projected['choices'])).to.equal(true);
    }), propertyRuns());
  });
});
