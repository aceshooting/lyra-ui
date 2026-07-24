import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

assert.equal(
  pkg.peerDependencies['maplibre-gl'],
  '>=5 <7',
  'the optional MapLibre peer must accept the supported v5 and v6 majors',
);
assert.equal(
  pkg.peerDependenciesMeta['maplibre-gl']?.optional,
  true,
  'MapLibre must remain optional for consumers that do not use lr-map',
);

console.log('MapLibre v5-v6 peer range contract passed.');
