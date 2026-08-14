import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  collectPublicSupportTypes,
  missingPublicSupportTypes,
} from './public-type-reachability.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the derived public-class closure reaches support modules and type-only re-exports', () => {
  const required = collectPublicSupportTypes({ packageDir });
  const byName = new Map(required.map((entry) => [entry.name, entry]));
  for (const name of [
    'LyraAnchorTarget',
    'LyraAnchorTargetEventMap',
    'AnchorTargetCapabilities',
    'OverlayVirtualRect',
  ]) {
    const entry = byName.get(name);
    assert.ok(entry, `${name} must be derived from a supported class contract`);
    assert.match(entry.referencedBy, /^src\/components\/.*\.class\.ts$/);
  }
});
test('removing a derived support type from the root export set is a blocking finding', () => {
  const required = collectPublicSupportTypes({ packageDir });
  const rootExports = new Set(required.map(({ name }) => name));
  rootExports.delete('LyraAnchorTarget');
  rootExports.delete('OverlayVirtualRect');
  assert.deepEqual(
    missingPublicSupportTypes(required, rootExports).map(({ name }) => name),
    ['LyraAnchorTarget', 'OverlayVirtualRect'],
  );
});
