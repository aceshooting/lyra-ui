import { expect } from '@open-wc/testing';
import { loadMaplibre } from './map-loader.js';

it('resolves the maplibre-gl module', async () => {
  const mod = await loadMaplibre();
  expect(mod).to.not.be.null;
  expect(mod!.Map).to.exist;
});

it('caches the module — a second call returns the same promise result', async () => {
  const a = await loadMaplibre();
  const b = await loadMaplibre();
  expect(a).to.equal(b);
});
