import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateLook, readStyleModel } from './style-axes-model.mjs';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const canonical = JSON.parse(readFileSync(new URL('../tokens/canonical-tokens.json', import.meta.url)));
const roles = new Set([...Object.keys(canonical.tokens), ...Object.values(canonical.tokens).map(token => token.themeInput).filter(Boolean)]);

for (const id of ['data', 'terminal', 'high-contrast']) {
  test(`${id} is an original optional look using existing portable roles`, () => {
    const look = JSON.parse(readFileSync(new URL(`../tokens/looks/${id}.json`, import.meta.url)));
    assert.equal(look.id, id);
    assert.deepEqual(Object.keys(look).sort(), ['id', 'tokens']);
    assert.doesNotThrow(() => validateLook(look));
    for (const name of Object.keys(look.tokens)) {
      assert.ok(roles.has(name), `${name} is an existing role`);
      assert.ok(!/density|surface-opacity|surface-blur|duration|easing|space-|form-control-height|icon-button-size/.test(name), `${name} must leave independent choices alone`);
    }
    for (const role of ['brand', 'success', 'warning', 'danger', 'neutral']) {
      for (const tier of ['quiet', 'normal', 'loud']) {
        assert.ok(look.tokens[`--lr-theme-color-${role}-fill-${tier}`]);
        assert.ok(look.tokens[`--lr-theme-color-${role}-on-${tier}`]);
      }
    }
    const model = readStyleModel(packageDir);
    const inherited = { ...model, looks: model.looks.filter(item => !['data', 'terminal', 'high-contrast'].includes(item.id)) };
    const priorNames = new Set([...Object.keys(inherited.base), ...inherited.looks.flatMap(item => Object.keys(item.tokens))]);
    for (const name of Object.keys(look.tokens)) assert.ok(priorNames.has(name), `${name} does not expand the base resolver`);
  });
  test(`${id} imports and serializes without a DOM`, async () => {
    const module = await import(new URL(`../dist/theme/looks/${id}.js`, import.meta.url));
    const look = module[`LYRA_${id.toUpperCase().replaceAll('-', '_')}_LOOK`];
    const authored = JSON.parse(readFileSync(new URL(`../tokens/looks/${id}.json`, import.meta.url)));
    assert.deepEqual(JSON.parse(JSON.stringify(look)), authored);
    assert.ok(Object.isFrozen(look));
    assert.ok(Object.isFrozen(look.tokens));
    const { lyraLookCss } = await import(new URL('../dist/theme/look-css.js', import.meta.url));
    assert.equal(typeof document, 'undefined');
    assert.ok(lyraLookCss(look).includes(`[data-lr-look='${id}']`));
  });
}
