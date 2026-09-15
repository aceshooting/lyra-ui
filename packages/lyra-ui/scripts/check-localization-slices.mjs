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
  // Probe with a key lr-button GENUINELY localizes (`fieldRequired`, from its valueMissing validity
  // message). This used to probe `loading`, which lr-button never localizes at all -- that key only
  // reached its slice because the generator once treated any string literal in the class as a
  // reachable message key, and `setCustomState(this.internals, 'loading', ...)` names a CSS custom
  // state that merely collides with a catalog key. Once the generator became call-scoped, the slice
  // (correctly) lost `loading` and this probe started reading back the bare key name.
  assert.equal(
    runtime.resolveLyraString(host, 'fieldRequired', undefined, undefined, undefined, defaults),
    'This field is required.',
    'an unbundled class import must resolve its generated English fallback',
  );
  localization.registerLyraLocale('x-node-slice', { fieldRequired: 'Node locale required' });
  assert.equal(
    runtime.resolveLyraString(host, 'fieldRequired', undefined, undefined, undefined, defaults),
    'Node locale required',
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

/**
 * The translation-catalog counterpart of {@link checkLocalizationSlices}: proves, against the
 * emitted, unbundled Node graph (not a tree-shaking simulation), that a per-family translation
 * slice registers ONLY its own family's strings, that a sibling family's slice is unaffected, and
 * that the unchanged `translations/<tag>.js` aggregate path still registers the complete catalog --
 * a byte-identical merge result to the pre-16.0.0 monolith it replaced.
 *
 * `lr-table` (family `data`) and `lr-code-block` (family `conversation`) are the two probes: they
 * ship in different families, so importing only `translations/fr/data.js` must resolve `lr-table`'s
 * French string while `lr-code-block`'s stays at its English fallback.
 */
export async function checkTranslationSlices(packageDir) {
  const dist = path.join(packageDir, 'dist');
  const nonce = `?translation-slice-check=${Date.now()}`;
  const runtime = await import(pathToFileURL(path.join(dist, 'internal', 'localization-runtime.js')));
  const { LyraTable } = await import(
    pathToFileURL(path.join(dist, 'components', 'data', 'table', 'table.class.js')) + nonce
  );
  const { LyraCodeBlock } = await import(
    pathToFileURL(path.join(dist, 'components', 'conversation', 'code-block', 'code-block.class.js')) + nonce
  );

  const host = {
    parentElement: null,
    ownerDocument: null,
    getAttribute(name) {
      return name === 'lang' ? 'fr' : null;
    },
    getRootNode() {
      return this;
    },
  };
  // `tableFilterLabel` is a key lr-table genuinely localizes; `copyCode` is one lr-code-block
  // genuinely localizes. Neither is reachable from the other family.
  assert.equal(
    runtime.resolveLyraString(host, 'tableFilterLabel', undefined, undefined, undefined, LyraTable.defaultStrings),
    'Filter rows',
    'importing only the data slice must not have registered fr yet',
  );
  await import(pathToFileURL(path.join(dist, 'translations', 'fr', 'data.js')) + nonce);
  assert.equal(
    runtime.resolveLyraString(host, 'tableFilterLabel', undefined, undefined, undefined, LyraTable.defaultStrings),
    'Filtrer les lignes',
    'translations/fr/data.js must register lr-table\'s French string',
  );
  assert.equal(
    runtime.resolveLyraString(host, 'copyCode', undefined, undefined, undefined, LyraCodeBlock.defaultStrings),
    'Copy code',
    'translations/fr/data.js must NOT register lr-code-block\'s (conversation family) French string',
  );

  await import(pathToFileURL(path.join(dist, 'translations', 'fr', 'conversation.js')) + nonce);
  assert.equal(
    runtime.resolveLyraString(host, 'copyCode', undefined, undefined, undefined, LyraCodeBlock.defaultStrings),
    'Copier le code',
    'translations/fr/conversation.js must register lr-code-block\'s French string',
  );

  // The unchanged aggregate path still registers everything, for a locale ('de') no earlier probe
  // in this function touched -- proving the aggregate is not merely a re-export of the two slices
  // already exercised above.
  const deHost = {
    ...host,
    getAttribute(name) {
      return name === 'lang' ? 'de' : null;
    },
  };
  assert.equal(
    runtime.resolveLyraString(deHost, 'tableFilterLabel', undefined, undefined, undefined, LyraTable.defaultStrings),
    'Filter rows',
    'the de aggregate must not have registered yet',
  );
  await import(pathToFileURL(path.join(dist, 'translations', 'de.js')) + nonce);
  assert.equal(
    runtime.resolveLyraString(deHost, 'tableFilterLabel', undefined, undefined, undefined, LyraTable.defaultStrings),
    'Zeilen filtern',
    'translations/de.js (unchanged path) must still register every family, including data',
  );
  assert.equal(
    runtime.resolveLyraString(deHost, 'copyCode', undefined, undefined, undefined, LyraCodeBlock.defaultStrings),
    'Code kopieren',
    'translations/de.js (unchanged path) must still register every family, including conversation',
  );
}
