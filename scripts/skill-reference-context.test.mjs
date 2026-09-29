import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
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
  STANDALONE_CHANGELOG_POINTER,
  trimStandaloneChangelog,
  validateSharedTopicLinks,
} from './skill-reference-context.mjs';
import { SHARED_TOPICS } from '../packages/lyra-ui/scripts/shared-topics.mjs';

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
  const sharedTopicFiles = referenceFiles.filter((file) =>
    file.includes(`${path.sep}references${path.sep}shared${path.sep}`),
  );
  assert.equal(
    sharedTopicFiles.length,
    SHARED_TOPICS.length,
    'the standalone reference tree must include every focused shared topic',
  );
  const skillIndex = readFileSync(path.join(treeRoot, 'SKILL.md'), 'utf8');
  for (const [topic] of SHARED_TOPICS) {
    assert.ok(skillIndex.includes(`${topic}.md`), `SKILL.md must route to ${topic}.md`);
  }
  assert.equal(
    validateSharedTopicLinks(path.join(treeRoot, 'references', 'shared')),
    true,
    'all focused shared routes, including relative heading anchors, must resolve in the skill tree',
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
    componentFiles.length + 1 + sharedTopicFiles.reduce((count, file) => {
      const contents = readFileSync(file, 'utf8');
      return count + markdownLinkTargets(contents).filter(isChangelogMarkdownTarget).length;
    }, 0),
    'every component, shared.md, and focused topic changelog link must resolve inside the skill',
  );
  return { componentFiles, referenceFiles, skillMarkdownFiles };
}

test('heading anchors retain text, Unicode and duplicate suffixes without markup characters', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'lyra-heading-anchors-'));
  try {
    mkdirSync(path.join(directory, 'shared'));
    for (const [topic] of SHARED_TOPICS) {
      writeFileSync(path.join(directory, 'shared', `${topic}.md`), [
        '# <b>Safe</b> `Code`',
        '# <b>Safe</b> `Code`',
        '# Éléments 中文',
        '# <scr<script>ipt>',
        '# <scrip<script>ignored</script>t>',
        '# before <unclosed <tag',
        '# 𐐀_12 -- 😀 A\tB',
        '[first](#safe-code) [duplicate](#safe-code-1) [unicode](#éléments-中文) [malformed](#ipt)',
        '[nested](#ignoredt) [unclosed](#before-unclosed-tag) [codepoints](#𐐨_12-----ab)',
      ].join('\n'));
    }
    assert.equal(validateSharedTopicLinks(path.join(directory, 'shared')), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('context rewrites are exact and fail closed on drift', () => {
  const packageShared = readFileSync(path.join(packageRoot, 'llms', 'shared.md'), 'utf8');
  assert.equal(
    validateSharedTopicLinks(path.join(packageRoot, 'llms', 'shared')),
    true,
    'published topic paths and heading anchors must resolve from their package location',
  );
  const standaloneShared = rewriteStandaloneSharedReference(packageShared);
  assert.match(
    standaloneShared,
    /bundled\s+\[CHANGELOG\.md\]\(\.\.\/CHANGELOG\.md\):\s+it\s+holds\s+the\s+current\s+major/u,
  );
  assert.doesNotMatch(standaloneShared, /self-contained changelog/u);
  assert.match(
    standaloneShared,
    /Family-wide\s+breaking-change\s+summaries\s+are\s+linked/u,
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

test('trimStandaloneChangelog keeps the newest majors and points to the rest', () => {
  const changelog = [
    '# Changelog',
    '',
    '## 21.0.0',
    '',
    '### Major Changes',
    '',
    '- abc1234: twenty-one.',
    '',
    '## 20.0.1',
    '',
    '### Patch Changes',
    '',
    '- abc1235: twenty-oh-one.',
    '',
    '## 20.0.0',
    '',
    '### Major Changes',
    '',
    '- abc1236: twenty.',
    '',
    '## 19.0.0',
    '',
    '### Major Changes',
    '',
    '- abc1237: nineteen.',
    '',
    '## 18.4.0',
    '',
    '### Minor Changes',
    '',
    '- abc1238: eighteen-four.',
    '',
    '## Unreleased',
    '',
    '- stray non-major heading nested under an old (dropped) major.',
    '',
    '## 1.0.0',
    '',
    '### Major Changes',
    '',
    '- abc1239: one.',
    '',
  ].join('\n');

  const trimmed = trimStandaloneChangelog(changelog, 3);
  assert.ok(trimmed.startsWith('# Changelog'), 'the file preamble must survive the trim');
  assert.match(trimmed, /## 21\.0\.0/);
  assert.match(trimmed, /## 20\.0\.1/);
  assert.match(trimmed, /## 20\.0\.0/);
  assert.match(trimmed, /## 19\.0\.0/);
  assert.doesNotMatch(trimmed, /## 18\.4\.0/, 'a fourth major must be dropped');
  assert.doesNotMatch(trimmed, /## Unreleased/, 'a heading below the cutoff is dropped with its major');
  assert.doesNotMatch(trimmed, /## 1\.0\.0/);
  assert.equal(
    trimmed.split(STANDALONE_CHANGELOG_POINTER).length - 1,
    1,
    'the pointer to older history must appear exactly once',
  );
  assert.ok(trimmed.trimEnd().endsWith(STANDALONE_CHANGELOG_POINTER));

  const trimmedToOne = trimStandaloneChangelog(changelog, 1);
  assert.match(trimmedToOne, /## 21\.0\.0/);
  assert.doesNotMatch(trimmedToOne, /## 20\.0\.1/, 'a smaller majors budget keeps fewer majors');

  const untouched = 'No version headings here at all.';
  assert.equal(
    trimStandaloneChangelog(untouched),
    untouched,
    'text with no `## X.Y.Z` heading is returned unchanged rather than corrupted',
  );

  assert.equal(
    trimStandaloneChangelog(changelog, 3),
    trimStandaloneChangelog(changelog, 3),
    'the trim is a pure function of its inputs',
  );
});

test('staged standalone references preserve package truth in their own link context', () => {
  const packageChangelog = readFileSync(path.join(packageRoot, 'CHANGELOG.md'), 'utf8');
  const stagedChangelog = readFileSync(path.join(skillRoot, 'CHANGELOG.md'), 'utf8');
  assert.equal(stagedChangelog, trimStandaloneChangelog(packageChangelog));
  assert.ok(
    stagedChangelog.length <= packageChangelog.length,
    'the staged standalone changelog retains only the current major',
  );
  assert.ok(stagedChangelog.includes(STANDALONE_CHANGELOG_POINTER));

  const packageShared = readFileSync(path.join(packageRoot, 'llms', 'shared.md'), 'utf8');
  const stagedShared = readFileSync(path.join(referencesRoot, 'shared.md'), 'utf8');
  assert.equal(stagedShared, rewriteStandaloneSharedReference(packageShared));
  assert.match(stagedShared, /breaking-change summaries are linked/u);

  const packageSharedTopics = path.join(packageRoot, 'llms', 'shared');
  const stagedSharedTopics = path.join(referencesRoot, 'shared');
  for (const [topic] of SHARED_TOPICS) {
    const packageTopic = readFileSync(path.join(packageSharedTopics, `${topic}.md`), 'utf8');
    const stagedTopic = readFileSync(path.join(stagedSharedTopics, `${topic}.md`), 'utf8');
    assert.equal(stagedTopic, packageTopic, `${topic} must keep its package-relative route in the skill copy`);
  }
  const nativeTopic = readFileSync(path.join(stagedSharedTopics, 'native-styles-and-utilities.md'), 'utf8');
  assert.match(nativeTopic, /^## Optional native styles and CSS utilities$/mu);
  assert.match(nativeTopic, /\]\(\.\/styles-and-tokens\.md#reading-the-resolved-tokens-from-your-own-components--tokens-rootcss\)/u,
    'native CSS should keep its cross-topic token route in the standalone skill');
  assert.match(
    readFileSync(path.join(stagedSharedTopics, 'imports-and-registration.md'), 'utf8'),
    /\]\(\.\/styles-and-tokens\.md#the-shadcn-look--themesshadcncss\)/u,
    'topic-local relative anchors must survive standalone packaging',
  );
  assert.match(
    readFileSync(path.join(stagedSharedTopics, 'localization-and-rtl.md'), 'utf8'),
    /\]\(\.\/testing-and-utilities\.md#shared-helpers-utilities\)/u,
    'cross-topic relative anchors must survive standalone packaging',
  );

  const staged = validateStandaloneTree(skillRoot);
  const table = readFileSync(path.join(referencesRoot, 'components', 'lr-table.md'), 'utf8');
  assert.match(table, /\[CHANGELOG\.md\]\(\.\.\/\.\.\/CHANGELOG\.md\)/u);
  assert.match(table, /family-wide breaking-change summaries/u);
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
      trimStandaloneChangelog(readFileSync(path.join(packageRoot, 'CHANGELOG.md'), 'utf8')),
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
