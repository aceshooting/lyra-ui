import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SLIM_MANIFEST_FILE, buildSlimManifest, publishedModulePath, renderSlimManifest } from './slim-manifest.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const full = {
  schemaVersion: '1.0.0',
  modules: [
    {
      kind: 'javascript-module',
      path: 'src/internal/base.ts',
      declarations: [{
        kind: 'class', name: 'Base', description: 'prose',
        members: [
          { kind: 'field', name: 'shared', type: { text: 'string' }, description: 'prose', attribute: 'shared' },
          { kind: 'field', name: 'hidden', privacy: 'protected', type: { text: 'string' } },
        ],
        attributes: [{ name: 'shared', fieldName: 'shared', type: { text: 'string' }, default: "'a'", description: 'prose' }],
        cssParts: [{ name: 'base', description: 'prose' }],
      }],
    },
    {
      kind: 'javascript-module',
      path: 'src/components/x/x.class.ts',
      declarations: [{
        kind: 'class', name: 'LyraX', tagName: 'lr-x', customElement: true, description: 'prose',
        status: 'stable', since: '1.0.0',
        superclass: { name: 'Base', module: '/src/internal/base.js' },
        members: [
          { kind: 'field', name: 'open', type: { text: 'boolean' }, description: 'prose', default: 'false' },
          { kind: 'field', name: 'secret', privacy: 'private', type: { text: 'string' } },
          { kind: 'field', name: '_internal', type: { text: 'string' } },
          { kind: 'method', name: 'show', return: { type: { text: 'void' } }, description: 'prose',
            parameters: [{ name: 'options', type: { text: 'ShowOptions' } }] },
        ],
        events: [{ name: 'lr-open', type: { text: 'CustomEvent' }, description: 'prose' }],
        slots: [{ name: '', description: 'prose' }],
        cssProperties: [{ name: '--lr-x', description: 'prose', default: '1' }],
        cssStates: [{ name: 'open', description: 'prose' }],
        deprecations: [{ description: 'gone' }],
      }],
      exports: [{ kind: 'js', name: 'LyraX', declaration: { name: 'LyraX', module: 'src/components/x/x.class.ts' } }],
    },
    {
      kind: 'javascript-module',
      path: 'src/components/lr-x.ts',
      declarations: [],
      exports: [
        { kind: 'js', name: '*', declaration: { name: '*', package: './x/x.class.js' } },
        { kind: 'custom-element-definition', name: 'lr-x', declaration: { name: 'LyraX', module: 'src/components/x/x.class.ts' } },
      ],
    },
    {
      // Registers its dependency on the side; the tag's own registration module is the one listed.
      kind: 'javascript-module',
      path: 'src/components/lr-y.ts',
      declarations: [],
      exports: [{ kind: 'custom-element-definition', name: 'lr-x', declaration: { name: 'LyraX', module: 'src/components/x/x.class.ts' } }],
    },
    {
      kind: 'javascript-module',
      path: 'lyra-docs/src/docx-editor.class.ts',
      declarations: [{ kind: 'class', name: 'LyraDocx', tagName: 'lr-docx-editor', customElement: true }],
    },
  ],
};

test('keeps discovery data only, flattened, with shipped dist paths and canonical definitions', () => {
  const slim = buildSlimManifest(full);
  assert.deepEqual(slim.modules.map((module) => module.path), ['dist/components/lr-x.js', 'dist/components/x/x.class.js']);
  const [registration, classModule] = slim.modules;
  assert.deepEqual(registration.exports, [
    { kind: 'custom-element-definition', name: 'lr-x', declaration: { name: 'LyraX', module: 'dist/components/x/x.class.js' } },
  ]);
  assert.deepEqual(classModule.exports, [
    { kind: 'js', name: 'LyraX', declaration: { name: 'LyraX', module: 'dist/components/x/x.class.js' } },
  ]);
  const [declaration] = classModule.declarations;
  assert.deepEqual(declaration.members, [
    { kind: 'field', name: 'open', type: { text: 'boolean' } },
    { kind: 'field', name: 'shared', type: { text: 'string' } },
    { kind: 'method', name: 'show', return: { type: { text: 'void' } } },
  ]);
  assert.deepEqual(declaration.attributes, [{ name: 'shared', fieldName: 'shared', type: { text: 'string' }, default: "'a'" }]);
  assert.deepEqual(declaration.events, [{ name: 'lr-open', type: { text: 'CustomEvent' } }]);
  assert.deepEqual(declaration.slots, [{ name: '' }]);
  assert.deepEqual(declaration.cssParts, [{ name: 'base' }]);
  assert.deepEqual(declaration.cssProperties, [{ name: '--lr-x' }]);
  assert.deepEqual(declaration.cssStates, [{ name: 'open' }]);
  assert.doesNotMatch(JSON.stringify(slim), /prose|deprecations|superclass|secret|_internal|hidden|inheritedFrom|status|since|lr-docx-editor/u);
});

test('is deterministic and does not mutate its input', () => {
  const input = structuredClone(full);
  assert.equal(renderSlimManifest(input), renderSlimManifest(structuredClone(full)));
  assert.deepEqual(input, full);
  assert.equal(publishedModulePath('/src/a/b.ts'), 'dist/a/b.js');
});

test('the committed slim manifest is fresh against the committed full manifest', () => {
  const slimPath = path.join(packageDir, SLIM_MANIFEST_FILE);
  assert.ok(existsSync(slimPath), `${SLIM_MANIFEST_FILE} is missing; run \`pnpm run generate-editor-data\``);
  const expected = renderSlimManifest(JSON.parse(readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8')));
  assert.ok(
    readFileSync(slimPath, 'utf8') === expected,
    `${SLIM_MANIFEST_FILE} is stale; run \`pnpm run generate-editor-data\` after \`pnpm manifest\``,
  );
  const pkg = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  assert.equal(pkg.customElements, SLIM_MANIFEST_FILE);
  assert.ok(pkg.files.includes(SLIM_MANIFEST_FILE));
  assert.equal(pkg.exports[`./${SLIM_MANIFEST_FILE}`], `./${SLIM_MANIFEST_FILE}`);
});
