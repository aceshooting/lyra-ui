import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { MAP_HASH_UNNAMED } from './map-hash-option.js';
import { readMapHash, removeMapHash, replaceMapHash } from './map-hash.js';

const cameras = fc.record({
  zoom: fc.double({ min: 0, max: 24, noNaN: true }),
  center: fc.tuple(fc.double({ min: -180, max: 180, noNaN: true }), fc.double({ min: -90, max: 90, noNaN: true })),
  bearing: fc.double({ min: -360, max: 360, noNaN: true }),
  pitch: fc.double({ min: 0, max: 85, noNaN: true }),
});
// Fields other than the owned `map` field; a lone empty token is indistinguishable from no fragment.
const unrelatedTokens = fc.array(fc.stringMatching(/^[a-z][a-z0-9_-]{0,8}(?:=[a-z0-9]{0,6})?$/u).filter(token => token.split('=')[0] !== 'map'), { maxLength: 6 });

describe('map hash properties', () => {
  it('reads back exactly the camera it wrote, for the named and the unnamed field', () => {
    fc.assert(fc.property(cameras, fc.constantFrom<unknown>(true, 'view', MAP_HASH_UNNAMED), (camera, option) => {
      const written = replaceMapHash('', option, camera);
      expect(written.status).to.equal('written');
      const read = readMapHash(written.fragment, option);
      expect(read.status).to.equal('camera');
      if (read.status !== 'camera') return;
      expect(read.camera.zoom).to.equal(camera.zoom);
      expect(read.camera.center[0]).to.equal(camera.center[0]);
      expect(read.camera.center[1]).to.equal(camera.center[1]);
      expect(read.camera.bearing).to.equal(camera.bearing);
      expect(read.camera.pitch).to.equal(camera.pitch);
    }), propertyRuns());
  });

  it('keeps every unrelated field in order and restores the original fragment on removal', () => {
    fc.assert(fc.property(unrelatedTokens, cameras, (tokens, camera) => {
      fc.pre(tokens.length !== 1 || tokens[0] !== '');
      const fragment = tokens.length ? `#${tokens.join('&')}` : '';
      const written = replaceMapHash(fragment, true, camera);
      expect(written.status).to.equal('written');
      expect(written.fragment.startsWith(fragment || '#')).to.equal(true);
      expect(readMapHash(written.fragment, true).status).to.equal('camera');
      expect(removeMapHash(written.fragment, true).fragment).to.equal(fragment);
    }), propertyRuns());
  });

  it('answers any text with a status result and never throws', () => {
    fc.assert(fc.property(fc.string({ maxLength: 200 }), cameras, fc.constantFrom<unknown>(true, 'view', MAP_HASH_UNNAMED, false, 7), (text, camera, option) => {
      expect(['camera', 'none', 'invalid', 'disabled']).to.include(readMapHash(text, option).status);
      expect(['written', 'invalid', 'disabled']).to.include(replaceMapHash(text, option, camera).status);
      expect(['written', 'invalid', 'disabled']).to.include(removeMapHash(text, option).status);
    }), propertyRuns());
  });
});
