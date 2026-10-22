import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { resolveModelFormat, snapshotModelCamera } from './model-viewer-contract.js';

const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
const camera = fc.record({
  yaw: finite, pitch: finite, distance: finite,
  target: fc.record({ x: finite, y: finite, z: finite }),
});
const formats = ['gltf', 'glb', 'stl', 'obj', 'ply', 'xyz', 'pcd'] as const;
const format = fc.constantFrom(...formats);
const text = fc.string({ maxLength: 80 });
const mimeFormat = fc.constantFrom(
  ['model/gltf+json', 'gltf'] as const,
  ['model/gltf-binary', 'glb'] as const,
  ['model/stl', 'stl'] as const,
  ['application/sla', 'stl'] as const,
  ['model/obj', 'obj'] as const,
  ['application/x-ply', 'ply'] as const,
  ['application/ply', 'ply'] as const,
  ['application/x-pcd', 'pcd'] as const,
  ['application/pcd', 'pcd'] as const,
);

describe('model camera snapshot properties', () => {
  it('bounds every finite camera and produces an immutable, idempotent snapshot', () => {
    fc.assert(fc.property(camera, input => {
      const result = snapshotModelCamera(input);
      expect([result.yaw, result.pitch, result.distance, result.target.x, result.target.y, result.target.z].every(Number.isFinite)).to.equal(true);
      expect(Math.abs(result.yaw)).to.be.lessThan(Math.PI * 2);
      expect(Math.abs(result.pitch)).to.be.at.most(Math.PI / 2 - 0.01);
      expect(result.distance).to.be.at.least(0.01);
      expect(result.distance * 8).to.be.at.most((2 - 2 ** -23) * 2 ** 127);
      for (const coordinate of Object.values(result.target)) expect(Math.abs(coordinate)).to.be.at.most(1e7);
      expect(Object.isFrozen(result)).to.equal(true);
      expect(Object.isFrozen(result.target)).to.equal(true);
      expect(snapshotModelCamera(result)).to.deep.equal(result);
    }), propertyRuns());
  });

  it('detaches both camera levels from caller mutations without freezing caller data', () => {
    fc.assert(fc.property(camera, generated => {
      const input = { ...generated, target: { ...generated.target } };
      const result = snapshotModelCamera(input);
      const before = { ...result, target: { ...result.target } };
      expect(result === input).to.equal(false);
      expect(result.target === input.target).to.equal(false);
      expect(Object.isFrozen(input)).to.equal(false);
      expect(Object.isFrozen(input.target)).to.equal(false);
      input.yaw = 123; input.pitch = -123; input.distance = 456;
      input.target.x = 789; input.target.y = -789; input.target.z = 987;
      expect(result).to.deep.equal(before);
    }), propertyRuns());
  });

  it('rejects any nonfinite camera field rather than silently accepting invalid geometry', () => {
    fc.assert(fc.property(camera, fc.constantFrom('yaw', 'pitch', 'distance', 'x', 'y', 'z'),
      fc.constantFrom(NaN, Infinity, -Infinity), (generated, field, invalid) => {
        const input = { ...generated, target: { ...generated.target } };
        if (field === 'x' || field === 'y' || field === 'z') input.target[field] = invalid;
        else input[field] = invalid;
        expect(() => snapshotModelCamera(input)).to.throw(TypeError);
      }), propertyRuns());
  });
});

describe('model format resolution properties', () => {
  it('honors an explicit format regardless of conflicting file names, MIME types or URLs', () => {
    fc.assert(fc.property(format, text, text, text, (explicit, name, mime, src) => {
      expect(resolveModelFormat(explicit, name, mime, src)).to.equal(explicit);
    }), propertyRuns());
  });

  it('rejects unknown explicit preferences even when automatic detection could succeed', () => {
    const unknown = text.filter(value => value !== 'auto' && !formats.some(known => known === value));
    fc.assert(fc.property(unknown, format, (preference, extension) => {
      expect(resolveModelFormat(preference, `shape.${extension}`, 'model/gltf+json', '/shape.glb')).to.equal(null);
    }), propertyRuns());
  });

  it('gives recognized MIME types precedence and ignores their casing, whitespace and parameters', () => {
    fc.assert(fc.property(mimeFormat, format, format, fc.boolean(), (pair, name, source, upper) => {
      const [mime, expected] = pair;
      const value = ` ${upper ? mime.toUpperCase() : mime} ; charset=utf-8`;
      expect(resolveModelFormat('auto', `shape.${name}`, value, `/shape.${source}`)).to.equal(expected);
    }), propertyRuns());
  });

  it('prefers the file-name suffix and otherwise ignores URL query and fragment suffixes', () => {
    fc.assert(fc.property(format, format, text, (name, source, stem) => {
      const url = `https://example.invalid/${stem.replace(/[?#]/g, '_')}.${source.toUpperCase()}?download=.obj#part.glb`;
      expect(resolveModelFormat('auto', `shape.${name.toUpperCase()}`, 'application/octet-stream', url)).to.equal(name);
      expect(resolveModelFormat('auto', 'descriptive name', 'application/octet-stream', url)).to.equal(source);
    }), propertyRuns());
  });

  it('never exposes inherited MIME-map properties as formats', () => {
    fc.assert(fc.property(fc.constantFrom('__proto__', 'constructor', 'toString', 'valueOf'), text, (mime, stem) => {
      expect(resolveModelFormat('auto', `${stem}.unknown`, mime, '/shape.unknown')).to.equal(null);
    }), propertyRuns());
  });
});
