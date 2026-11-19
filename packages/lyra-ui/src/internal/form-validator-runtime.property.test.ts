import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { runFormValidators } from './form-validator-runtime.js';

const KEYS = ['badInput', 'customError', 'patternMismatch', 'rangeOverflow', 'rangeUnderflow', 'stepMismatch', 'tooLong', 'tooShort', 'typeMismatch', 'valueMissing'];

it('never throws and only ever reports known flags, whatever a validator returns', () => {
  fc.assert(fc.property(fc.array(fc.anything()), fc.anything(), (results, value) => {
    const outcome = runFormValidators(results.map((r) => () => r), value, {}, 'generic');
    for (const key of Object.keys(outcome.flags ?? {})) expect(KEYS).to.include(key);
    if (outcome.flags) expect(Object.values(outcome.flags).some(Boolean)).to.equal(true);
    if (outcome.flags) expect(typeof outcome.message).to.equal('string');
  }), propertyRuns());
});

it('treats every non-array validator list as having no validators', () => {
  fc.assert(fc.property(fc.anything().filter((v) => !Array.isArray(v)), (list) => {
    expect(runFormValidators(list, '', {}, 'generic')).to.deep.equal({});
  }), propertyRuns());
});
