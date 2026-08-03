import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Verifies the emitted, unbundled Node graph rather than relying on a tree-shaking simulation. */
export async function checkLocalizationSlices(packageDir) {
  const dist = path.join(packageDir, 'dist');
  const nonce = `?localization-slice-check=${Date.now()}`;
  // Keep the shared runtime dependency on its canonical URL. Adding a query only to this direct
  // import would instantiate a second locale registry that the public entry point cannot see.
  const runtime = await import(pathToFileURL(path.join(dist, 'internal', 'localization-runtime.js')));
  const { LyraButton } = await import(
    pathToFileURL(path.join(dist, 'components', 'forms', 'button', 'button.class.js')) + nonce
  );
  const localization = await import(pathToFileURL(path.join(dist, 'localization.js')) + nonce);

  const host = {
    parentElement: null,
    ownerDocument: null,
    getAttribute(name) {
      return name === 'lang' ? 'x-node-slice' : null;
    },
    getRootNode() {
      return this;
    },
  };
  const defaults = LyraButton.defaultStrings;
  assert.equal(
    runtime.resolveLyraString(host, 'loading', undefined, undefined, undefined, defaults),
    'Loading…',
    'an unbundled class import must resolve its generated English fallback',
  );
  localization.registerLyraLocale('x-node-slice', { loading: 'Node locale loading' });
  assert.equal(
    runtime.resolveLyraString(host, 'loading', undefined, undefined, undefined, defaults),
    'Node locale loading',
    'the public registry and lean component runtime must share one locale registry',
  );
  assert.equal(
    localization.resolveLyraString(host, 'cancel'),
    'Cancel',
    'the public localization entry must retain the complete English catalog',
  );

  const declaration = await readFile(
    path.join(dist, 'components', 'forms', 'button', 'button.class.d.ts'),
    'utf8',
  );
  assert.doesNotMatch(
    declaration,
    /defaultStrings/,
    'generated default slices must not enter the published declaration surface',
  );
}
