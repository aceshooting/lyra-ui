import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPackageMetadata, renderPackageMetadata } from './generate-package-metadata.mjs';

test('renders package identity and version deterministically', () => {
  const fixture = { name: '@scope/widgets', version: '3.4.5' };
  const first = renderPackageMetadata(fixture);
  assert.equal(renderPackageMetadata(fixture), first);
  assert.match(first, /LYRA_PACKAGE_NAME = '@scope\/widgets'/);
  assert.match(first, /LYRA_PACKAGE_VERSION = '3\.4\.5'/);
  assert.equal(checkPackageMetadata(fixture, first), true);
  assert.equal(checkPackageMetadata({ ...fixture, version: '3.4.6' }, first), false);
});

test('rejects incomplete or invalid package metadata', () => {
  assert.throws(() => renderPackageMetadata({ version: '1.0.0' }), /name is required/);
  assert.throws(
    () => renderPackageMetadata({ name: '@scope/widgets', version: 'next' }),
    /version must be a semver string/,
  );
});
