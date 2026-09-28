import assert from 'node:assert/strict';
import { generateScopedDefinitions } from './generate-scoped-definitions.mjs';
const manifest = { modules: [
  { path: 'src/components/utility/example/example.class.ts', declarations: [{ kind: 'class', name: 'LyraExample', tagName: 'lr-example', customElement: true }] },
  { path: 'src/components/utility/child/child.class.ts', declarations: [{ kind: 'class', name: 'LyraChild', tagName: 'lr-child', customElement: true }] },
] };
const graph = { entries: [{ tag: 'lr-example', registers: ['lr-example', 'lr-child'] }, { tag: 'lr-child', registers: ['lr-child'] }] };
const output = generateScopedDefinitions(manifest, graph);
assert.match(output, /import\('\.\.\/components\/utility\/example\/example\.class\.js'\)/);
assert.match(output, /'lr-example': \['lr-child', 'lr-example'\]/);
assert.doesNotMatch(output, /from '\.\.\/components\//);
assert.equal(generateScopedDefinitions({ modules: [...manifest.modules].reverse() }, { entries: [...graph.entries].reverse() }), output);
assert.throws(() => generateScopedDefinitions(manifest, { entries: [{ tag: 'lr-example', registers: ['lr-missing'] }] }), /lr-missing/);
assert.throws(() => generateScopedDefinitions({ modules: [{ path: '../escape.ts', declarations: manifest.modules[0].declarations }] }, graph), /class module/);
console.log('scoped definitions generator tests passed');
