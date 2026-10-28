import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { validateGraphColumns } from './typed-columns.js';

it('retains every finite signed Float32 edge curvature without changing caller data', () => {
  fc.assert(fc.property(fc.array(fc.float({ noNaN: true, noDefaultInfinity: true }), { maxLength: 100 }), values => {
    const edgeCurvature = new Float32Array(values);
    const result = validateGraphColumns({ ids: ['a'], source: new Uint32Array(values.length), target: new Uint32Array(values.length), edgeCurvature });
    expect(result.ok).to.equal(true);
    expect(result.ok && (result.columns as unknown as { edgeCurvature?: Float32Array }).edgeCurvature === edgeCurvature).to.equal(true);
    expect(Array.from(edgeCurvature)).to.deep.equal(values);
  }), propertyRuns());
});
