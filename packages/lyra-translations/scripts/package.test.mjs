import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  relativeSpecifiersOutsideCatalog,
  retargetCatalogImports,
  retargetLocaleLoaders,
} from '../../lyra-ui/scripts/translations-companion.mjs';

test('catalog modules import the public localization entry', () => {
  assert.equal(
    retargetCatalogImports('import{registerLyraLocale}from"../../internal/localization-runtime.js";x()'),
    'import{registerLyraLocale}from"@aceshooting/lyra-ui/localization.js";x()',
  );
  assert.deepEqual(relativeSpecifiersOutsideCatalog('import"./fr/forms.js";import{a}from"../../internal/x.js"'), ['../../internal/x.js']);
  assert.deepEqual(relativeSpecifiersOutsideCatalog('import"../de/forms.js";import"../../internal/x.js"', 'de-CH/forms.js'), ['../../internal/x.js']);
});

test('locale loaders import the companion package', () => {
  assert.equal(
    retargetLocaleLoaders('{fr:()=>import("../translations/fr.js"),"de-CH":()=>import("../translations/de-CH.js")}'),
    '{fr:()=>import("@aceshooting/lyra-translations/fr.js"),"de-CH":()=>import("@aceshooting/lyra-translations/de-CH.js")}',
  );
});

test('catalog boundary accepts sibling imports and rejects traversal in module specifiers', () => {
  assert.deepEqual(relativeSpecifiersOutsideCatalog('import "../de/forms.js"; const text = "../outside.js";', 'de-CH/forms.js'), []);
  for (const specifier of ['../../outside.js', './../../../outside.js', './x/../../../outside.js']) {
    assert.deepEqual(relativeSpecifiersOutsideCatalog(`import "${specifier}";`, 'de-CH/forms.js'), [specifier]);
  }
  assert.deepEqual(relativeSpecifiersOutsideCatalog('export { x } from "../../outside.js";', 'de-CH/forms.js'), ['../../outside.js']);
  assert.deepEqual(relativeSpecifiersOutsideCatalog('import("../../outside.js")', 'de-CH/forms.js'), ['../../outside.js']);
});
