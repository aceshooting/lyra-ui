import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PACKAGE_PREFIX, MAX_DESCRIPTION_LENGTH, bundleDifferences, bundleText, parseFrontmatter, renderSkillBundle, writeSkillBundle,
} from './build-skill-bundle.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('rewrites plugin references to the package llms/ directory and drops plugin-only text', () => {
  const source = [
    'See `references/components/lr-table.md` and [t](references/shared/styles-and-tokens.md#a).',
    'Read `${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/index.md`, `${CLAUDE_PLUGIN_ROOT}/commands/frontend.md`',
    'and ${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/reporting.md.',
    '',
    '<!-- plugin-only:start -->',
    'Plugin install text.',
    '<!-- plugin-only:end -->',
    '',
    'Fall back: <!-- plugin-only:start -->to the plugin copy. <!-- plugin-only:end -->Done.',
  ].join('\n');
  const out = bundleText(source, 'lyra-ui');
  assert.ok(out.includes(`\`${PACKAGE_PREFIX}/llms/components/lr-table.md\``));
  assert.ok(out.includes(`(${PACKAGE_PREFIX}/llms/shared/styles-and-tokens.md#a)`));
  assert.ok(out.includes(`${PACKAGE_PREFIX}/llms/index.md`));
  assert.ok(out.includes(`${PACKAGE_PREFIX}/skills/lyra-ui/commands/frontend.md`));
  assert.ok(out.includes(`${PACKAGE_PREFIX}/skills/lyra-ui/reporting.md.`));
  assert.ok(!out.includes('Plugin install text'));
  assert.ok(out.includes('Fall back: Done.'));
  assert.ok(!out.includes('${CLAUDE_PLUGIN_ROOT}'));
  assert.ok(!/\n\n\n/u.test(out));
});

test('the compose skill keeps its own references/ and rewrites only the sibling skill path', () => {
  const out = bundleText('[x](references/composition-patterns.md) [y](../lyra-ui/references/shared/a.md)', 'compose');
  assert.equal(out, `[x](references/composition-patterns.md) [y](${PACKAGE_PREFIX}/llms/shared/a.md)`);
});

test('parses folded and plain frontmatter', () => {
  assert.deepEqual(parseFrontmatter('---\nname: a\ndescription: >\n  one\n  two\n---\nbody'), { name: 'a', description: 'one two' });
  assert.equal(parseFrontmatter('no frontmatter'), null);
});

test('the committed bundle is current, valid and within the size budget', () => {
  const { files, problems } = renderSkillBundle(repoRoot);
  assert.deepEqual(problems, []);
  assert.deepEqual(bundleDifferences(files, path.join(repoRoot, 'packages/lyra-ui/skills')), []);
  const bytes = [...files.values()].reduce((sum, text) => sum + Buffer.byteLength(text), 0);
  assert.ok(bytes < 70_000, `bundle is ${bytes} bytes`);
  for (const name of ['lyra-ui', 'compose-lyra-interfaces']) {
    const meta = parseFrontmatter(files.get(`${name}/SKILL.md`));
    assert.equal(meta.name, name);
    assert.ok(meta.description.length > 40 && meta.description.length <= MAX_DESCRIPTION_LENGTH);
  }
  assert.ok(files.has('lyra-ui/commands/review.md'));
  for (const [file, text] of files) {
    assert.ok(!text.includes('CLAUDE_PLUGIN_ROOT'), file);
    assert.ok(!text.includes('plugins/lyra-ui'), file);
  }
});

test('reports stale, missing and unexpected files and rewrites the tree', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'lyra-skill-bundle-'));
  try {
    const files = new Map([['a/SKILL.md', 'one'], ['a/x.md', 'two']]);
    writeSkillBundle(files, directory);
    assert.deepEqual(bundleDifferences(files, directory), []);
    writeFileSync(path.join(directory, 'a/SKILL.md'), 'changed');
    writeFileSync(path.join(directory, 'extra.md'), 'x');
    rmSync(path.join(directory, 'a/x.md'));
    assert.deepEqual(bundleDifferences(files, directory).sort(), ['missing: skills/a/x.md', 'stale: skills/a/SKILL.md', 'unexpected: skills/extra.md']);
    writeSkillBundle(files, directory);
    assert.deepEqual(bundleDifferences(files, directory), []);
    mkdirSync(path.join(directory, 'b'));
    assert.equal(readFileSync(path.join(directory, 'a/SKILL.md'), 'utf8'), 'one');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
