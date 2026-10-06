import assert from 'node:assert/strict';
import test from 'node:test';
import { FULL_SCOPE, changeScope, changedPaths } from './ci-change-scope.mjs';

test('lyra-docs sources skip only the lyra-ui runtime lanes and the docs site', () => {
  assert.deepEqual(
    changeScope(['packages/lyra-docs/src/docx/session.ts', 'packages/lyra-docs/scripts/browser-test.mjs', '.changeset/x.md']),
    { runtime: false, packages: true, docsSite: false },
  );
});

test('contributor text skips the runtime and packed lanes but keeps the docs site', () => {
  for (const path of ['docs/agents/testing.md', 'plugins/lyra-ui/skills/lyra-ui/SKILL.md', 'skills/lyra-ui.skill', 'README.md', 'CONTRIBUTING.md']) {
    assert.deepEqual(changeScope([path, '.changeset/y.md']), { runtime: false, packages: false, docsSite: true }, path);
  }
  assert.deepEqual(changeScope(['.changeset/only.md']), { runtime: false, packages: false, docsSite: false });
});

test('anything else runs every lane', () => {
  for (const path of [
    'packages/lyra-ui/src/components/forms/input/input.class.ts',
    'packages/lyra-ui/README.md',
    'packages/lyra-docs/package.json',
    'packages/lyra-flags/index.js',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.github/workflows/ci.yml',
    'scripts/ci.sh',
    '.storybook/main.js',
    'docs.md/odd-directory-name.ts',
    '.nvmrc',
  ]) {
    assert.deepEqual(changeScope(['docs/notes.md', path]), FULL_SCOPE, path);
  }
  assert.deepEqual(changeScope([]), FULL_SCOPE, 'an empty or unknown change set runs everything');
  assert.deepEqual(changeScope(undefined), FULL_SCOPE);
});

test('an unusable base or an unreadable diff yields no change set', () => {
  const head = 'a'.repeat(40);
  const calls = [];
  const git = (args) => { calls.push(args); return 'docs/a.md\nREADME.md\n'; };
  assert.equal(changedPaths('0'.repeat(40), head, { git }), null, 'a new branch has no base');
  assert.equal(changedPaths('', head, { git }), null);
  assert.equal(changedPaths('not-a-sha', head, { git }), null);
  assert.equal(calls.length, 0);
  assert.deepEqual(changedPaths('b'.repeat(40), head, { git }), ['docs/a.md', 'README.md']);
  assert.deepEqual(calls.at(-1), ['diff', '--no-renames', '--name-only', 'b'.repeat(40), head]);
  assert.equal(changedPaths('b'.repeat(40), head, { git: () => { throw new Error('unreachable'); } }), null);
});
