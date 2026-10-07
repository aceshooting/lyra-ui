import assert from 'node:assert/strict';
import test from 'node:test';
import { collectStyleSources, declaredStyleTokens } from './manifest-style-reachability.mjs';

test('stylesheet coverage follows composed bindings without leaking unused exports', () => {
  const sources = new Map([
    ['src/component/example.class.ts', `import { styles as surface } from './example.styles.js'; export class Example { static styles = [surface]; }`],
    ['src/component/example.styles.ts', "import { shared as paint } from '../shared.styles.js'; export const styles = css`div { ${paint} }`;"],
    ['src/shared.styles.ts', "import { marker } from './marker.styles.js'; export const shared = css`color: var(--lr-real-hook); ${marker}`; export const unrelated = css`color: var(--lr-phantom-hook);`;"],
    ['src/marker.styles.ts', "export const marker = css`content: var(--lr-required-content);`;"],
  ]);
  const result = collectStyleSources('src/component/example.class.ts', (file) => sources.get(file));
  const css = [...result.values()].join('\n');
  assert.match(css, /--lr-real-hook/);
  assert.match(css, /--lr-required-content/);
  assert.doesNotMatch(css, /--lr-phantom-hook/);
});

test('default exports and re-export aliases preserve composed consumer hooks', () => {
  const sources = new Map([
    ['src/component/example.class.ts', "import sheet from './example.styles.js'; class Example { static styles = sheet; }"],
    ['src/component/example.styles.ts', "export { paint as default } from '../shared.styles.js';"],
    ['src/shared.styles.ts', "const base = css`color: var(--lr-shared-fill);`; export const paint = css`${base}`;"],
  ]);
  const result = collectStyleSources('src/component/example.class.ts', (file) => sources.get(file));
  assert.match(result.get('src/shared.styles.ts'), /--lr-shared-fill/);
});

test('shared token inventory uses declarations rather than mentions or fallback reads', () => {
  const tokens = declaredStyleTokens(`/* --lr-fake: red; */ :host { --lr-icon-button-size: 2rem; color: var(--lr-consumer-hook, red); }`);
  assert.deepEqual([...tokens], ['--lr-icon-button-size']);
});

test('runtime-owned annotations exclude only their named hook and preserve consumer hooks', async () => {
  const { sharedStyleHooks } = await import('./manifest-style-reachability.mjs');
  const hooks = sharedStyleHooks(`
    /* @internalcssprop --lr-managed-stack - Set by the stack manager. */
    z-index: var(--lr-managed-stack);
    color: var(--lr-consumer-color, red);
    padding: var(--lr-shared-space);
    --lr-local-value: blue;
    background: var(--lr-local-value);
  `, (name) => name === '--lr-shared-space');
  assert.deepEqual([...hooks], ['--lr-consumer-color']);
});

for (const [name, sheet] of [
  ['namespace composition', "import * as shared from '../shared.styles.js'; export const styles = css`${shared.paint}`;"],
  ['wildcard re-export', "export * from '../shared.styles.js';"],
  ['unresolved binding', 'export const unrelated = css`color: red;`;'],
  ['parse error', 'export const styles = ;'],
]) {
  test(`fails closed on ${name}`, () => {
    const sources = new Map([
      ['src/component/example.class.ts', "import { styles } from './example.styles.js'; class Example { static styles = styles; }"],
      ['src/component/example.styles.ts', sheet],
      ['src/shared.styles.ts', 'export const paint = css`color: var(--lr-real-hook);`;'],
    ]);
    assert.throws(() => collectStyleSources('src/component/example.class.ts', (file) => sources.get(file)), /stylesheet/);
  });
}

test('called stylesheet factories contribute their CSS hooks', () => {
  const sources = new Map([
    ['src/component/example.class.ts', "import { styles } from './example.styles.js'; class Example { static styles = styles; }"],
    ['src/component/example.styles.ts', "import { paint } from '../shared.styles.js'; export const styles = css`${paint('div')}`;"],
    ['src/shared.styles.ts', "export function paint(selector) { return css`${selector} { color: var(--lr-factory-color); }`; }"],
  ]);
  const result = collectStyleSources('src/component/example.class.ts', (file) => sources.get(file));
  assert.match(result.get('src/shared.styles.ts'), /--lr-factory-color/);
});
