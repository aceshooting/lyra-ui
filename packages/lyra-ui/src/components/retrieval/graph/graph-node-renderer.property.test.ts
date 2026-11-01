import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { admitGraphNodeRenderer, GraphNodeRendererError } from './graph-node-renderer.js';

const context = (index: number) => Object.freeze({ id: String(index), index });
const admit = (value: unknown) => admitGraphNodeRenderer(() => value, 1, context, () => true, async () => {});

describe('graph node renderer properties', () => {
  it('preserves bounded positive triangle scales and owns every numeric byte', async () => {
    await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 64 }), fc.integer({ min: 10, max: 500 }), async (faces, scale) => {
      const radius = scale / 1000;
      const positions = new Float32Array(faces * 9), normals = new Float32Array(faces * 3);
      for (let face = 0; face < faces; face++) {
        positions.set([0, 0, 0, radius, 0, 0, 0, radius, 0], face * 9);
        normals.set([0, 0, 1], face * 3);
      }
      const expected = Array.from(positions);
      const result = await admit({ positions, normals });
      positions.fill(0); normals.fill(0);
      expect(Array.from(result![0]!.positions)).to.deep.equal(expected);
      expect(result![0]!.normals[2]).to.equal(1);
    }), propertyRuns());
  });

  it('rejects arbitrary nonfinite and outside-sphere coordinates', async () => {
    await fc.assert(fc.asyncProperty(fc.oneof(fc.constant(NaN), fc.constant(Infinity), fc.constant(-Infinity), fc.integer({ min: 2, max: 1_000_000 })), async value => {
      const positions = new Float32Array([value, 0, 0, 0.5, 0, 0, 0, 0.5, 0]);
      try {
        await admit({ positions, normals: new Float32Array([0, 0, 1]) });
        expect.fail('accepted an unbounded coordinate');
      } catch (error) {
        expect(error).to.be.instanceOf(GraphNodeRendererError);
        expect((error as GraphNodeRendererError).reason).to.equal('invalid');
      }
    }), propertyRuns());
  });
});
