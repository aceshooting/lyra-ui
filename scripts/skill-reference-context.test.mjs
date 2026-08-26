import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FAMILY_SUMMARY_LINK_SUFFIX,
  isLlmsFullMarkdownTarget,
  markdownLinkTargets,
  rewriteStandaloneComponentReference,
  rewriteStandaloneSharedReference,
} from './skill-reference-context.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageRoot = path.join(root, 'packages', 'lyra-ui');
const skillRoot = path.join(root, 'plugins', 'lyra-ui', 'skills', 'lyra-ui');
const referencesRoot = path.join(skillRoot, 'references');
const archivePath = path.join(root, 'skills', 'lyra-ui.skill');
const manifest = JSON.parse(
  readFileSync(path.join(packageRoot, 'custom-elements.json'), 'utf8'),
);
const expectedComponentCount = new Set(
  (manifest.modules ?? [])
    .flatMap((module) => module.declarations ?? [])
    .filter((declaration) => declaration.customElement && declaration.tagName)
    .map((declaration) => declaration.tagName),
).size;

function markdownFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) markdownFiles(absolute, files);
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(absolute);
  }
  return files.sort();
}

function allFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) allFiles(absolute, files);
    else if (entry.isFile()) files.push(absolute);
  }
  return files.sort();
}

function isChangelogMarkdownTarget(target) {
  let decoded = target.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // A malformed escape cannot disguise the literal filename check below.
  }
  const pathOnly = decoded.split(/[?#]/u, 1)[0].replaceAll('\\', '/');
  return path.posix.basename(path.posix.normalize(pathOnly)).toLowerCase() === 'changelog.md';
}

function resolveMarkdownTarget(file, target) {
  let decoded = target;
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Preserve malformed escapes so the exact-target assertion fails closed.
  }
  return path.resolve(path.dirname(file), decoded.split(/[?#]/u, 1)[0]);
}

function validateStandaloneTree(treeRoot) {
  const referenceFiles = markdownFiles(path.join(treeRoot, 'references'));
  const skillMarkdownFiles = markdownFiles(treeRoot);
  const componentFiles = referenceFiles.filter((file) =>
    file.includes(`${path.sep}references${path.sep}components${path.sep}`),
  );
  assert.ok(componentFiles.length > 250, 'the standalone catalog must not become vacuous');
  assert.ok(
    skillMarkdownFiles.includes(path.join(treeRoot, 'SKILL.md')),
    'standalone validation must include SKILL.md, not only references/',
  );
  assert.equal(
    allFiles(treeRoot).some((file) => path.basename(file) === 'llms-full.txt'),
    false,
    'the standalone skill must not bundle llms-full.txt anywhere',
  );

  let changelogLinks = 0;
  for (const file of skillMarkdownFiles) {
    const contents = readFileSync(file, 'utf8');
    const targets = markdownLinkTargets(contents);
    assert.deepEqual(
      targets.filter(isLlmsFullMarkdownTarget),
      [],
      `${path.relative(treeRoot, file)} must not target the omitted llms-full.txt`,
    );
    for (const target of targets) {
      if (!isChangelogMarkdownTarget(target)) continue;
      const resolved = resolveMarkdownTarget(file, target);
      assert.ok(
        existsSync(resolved),
        `${path.relative(treeRoot, file)} has a dead changelog link: ${target}`,
      );
      changelogLinks += 1;
      assert.equal(
        resolved,
        path.join(treeRoot, 'CHANGELOG.md'),
        `${path.relative(treeRoot, file)} must resolve its changelog link inside the skill`,
      );
    }
  }
  assert.equal(
    changelogLinks,
    componentFiles.length + 1,
    'every component plus shared.md must link the standalone changelog exactly once',
  );
  return { componentFiles, referenceFiles, skillMarkdownFiles };
}

test('context rewrites are exact and fail closed on drift', () => {
  const packageShared = readFileSync(path.join(packageRoot, 'llms', 'shared.md'), 'utf8');
  const standaloneShared = rewriteStandaloneSharedReference(packageShared);
  assert.match(
    standaloneShared,
    /bundled \[CHANGELOG\.md\]\(\.\.\/CHANGELOG\.md\)[\s\S]*bundled references link that\s+self-contained changelog/u,
  );
  assert.match(
    standaloneShared,
    /Family-wide breaking-change summaries\s+remain in the installed\s+package's `llms-full\.txt`/u,
  );
  assert.deepEqual(
    markdownLinkTargets(standaloneShared).filter(isLlmsFullMarkdownTarget),
    [],
  );
  assert.throws(
    () => rewriteStandaloneSharedReference(packageShared.replace('Family-wide', 'Release-wide')),
    /Expected exactly one authored release-history paragraph/u,
  );

  const component =
    '- **Release history** [CHANGELOG.md](../../CHANGELOG.md)' + FAMILY_SUMMARY_LINK_SUFFIX;
  assert.equal(
    rewriteStandaloneComponentReference(component),
    '- **Release history** [CHANGELOG.md](../../CHANGELOG.md)',
  );
  assert.throws(
    () => rewriteStandaloneComponentReference(
      '- **Release history** [CHANGELOG.md](../../CHANGELOG.md); family-wide summaries: ' +
        '[full reference](../../nested/../llms-full.txt?view=family#breaking)',
    ),
    /llms-full\.txt Markdown link target/u,
  );
  const changedLabelSkill =
    '# Skill\n\nRead the [full reference](references/../llms-full.txt?view=family#breaking).';
  assert.deepEqual(
    markdownLinkTargets(changedLabelSkill).filter(isLlmsFullMarkdownTarget),
    ['references/../llms-full.txt?view=family#breaking'],
    'SKILL.md-style links must be classified by target even when their label changes',
  );
  const codeAndProse = [
    '# Not links',
    '',
    '`[full reference](../../llms-full.txt)`',
    '',
    "`:host([compact])\n[part='base']` is ordered before `:host([active]) [part='base']`.",
  ].join('\n');
  assert.deepEqual(
    markdownLinkTargets(codeAndProse).filter(isLlmsFullMarkdownTarget),
    [],
    'link-shaped inline code and selector prose must not be treated as Markdown links',
  );
  assert.throws(
    () => rewriteStandaloneComponentReference(`${component}\n${component}`),
    /2 exact family-summary suffix/u,
  );
});

test('staged standalone references preserve package truth in their own link context', () => {
  const packageChangelog = readFileSync(path.join(packageRoot, 'CHANGELOG.md'), 'utf8');
  assert.equal(readFileSync(path.join(skillRoot, 'CHANGELOG.md'), 'utf8'), packageChangelog);

  const packageShared = readFileSync(path.join(packageRoot, 'llms', 'shared.md'), 'utf8');
  const stagedShared = readFileSync(path.join(referencesRoot, 'shared.md'), 'utf8');
  assert.equal(stagedShared, rewriteStandaloneSharedReference(packageShared));
  assert.match(stagedShared, /standalone skill[\s\S]*installed[\s\S]*`llms-full\.txt`/u);

  const staged = validateStandaloneTree(skillRoot);
  const table = readFileSync(path.join(referencesRoot, 'components', 'lr-table.md'), 'utf8');
  assert.match(table, /\[CHANGELOG\.md\]\(\.\.\/\.\.\/CHANGELOG\.md\)/u);
  assert.doesNotMatch(table, /family-wide breaking-change summaries/u);
  assert.equal(staged.componentFiles.length, expectedComponentCount);
});

test('the deterministic skill archive is self-contained without llms-full.txt', () => {
  assert.ok(existsSync(archivePath), 'skills/lyra-ui.skill must exist before archive validation');
  const extracted = mkdtempSync(path.join(tmpdir(), 'lyra-skill-archive-'));
  try {
    const unzip = spawnSync('unzip', ['-qq', archivePath, '-d', extracted], {
      encoding: 'utf8',
    });
    assert.equal(unzip.status, 0, unzip.stderr);
    assert.equal(
      readFileSync(path.join(extracted, 'CHANGELOG.md'), 'utf8'),
      readFileSync(path.join(packageRoot, 'CHANGELOG.md'), 'utf8'),
    );
    const archived = validateStandaloneTree(extracted);
    assert.equal(archived.componentFiles.length, expectedComponentCount);
    assert.equal(
      archived.referenceFiles.length,
      markdownFiles(referencesRoot).length,
      'the archive must contain the complete staged Markdown reference set',
    );
    assert.equal(
      archived.skillMarkdownFiles.length,
      markdownFiles(skillRoot).length,
      'archive validation must cover SKILL.md and every other staged Markdown file',
    );
  } finally {
    rmSync(extracted, { recursive: true, force: true });
  }
});
