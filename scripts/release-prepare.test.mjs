#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertCleanWorktree,
  normalizeReleaseChangelog,
  PACKAGE_GENERATORS,
  releaseCommitSubject,
  releaseNextSteps,
  releasedPackages,
  releasePreparationSteps,
} from './release-prepare.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(repoRoot, 'scripts/release-prepare.mjs'), 'utf8');
const render = (steps) => steps.map(([command, args]) => [command, ...args].join(' '));

test('independent generated-UI release builds public declaration prerequisites without bumping them', () => {
  const steps = render(releasePreparationSteps(['@aceshooting/lyra-gen']));
  assert.deepEqual(steps.slice(0, 2), [
    'pnpm --filter @aceshooting/lyra-map run build',
    'pnpm --filter @aceshooting/lyra-ui run build',
  ]);
  assert.ok(steps.includes('pnpm --filter @aceshooting/lyra-gen --if-present run build'));
  assert.ok(!steps.some(step => step.includes('--filter @aceshooting/lyra-ui --if-present')));
  assert.ok(!steps.some(step => step.includes('sync-plugin-version')));
});

function indexAfter(lines, line, after = -1) {
  const index = lines.indexOf(line, after + 1);
  assert.ok(index > after, `${line} must follow its required predecessor`);
  return index;
}

for (const released of [
  ['@aceshooting/lyra-docs', '@aceshooting/lyra-ui'],
  ['@aceshooting/lyra-ui', '@aceshooting/lyra-docs'],
  ['@aceshooting/lyra-docs'],
  ['@aceshooting/lyra-map', '@aceshooting/lyra-ui', '@aceshooting/lyra-docs'],
  ['@aceshooting/lyra-docs', '@aceshooting/lyra-map', '@aceshooting/lyra-ui'],
  ['@aceshooting/lyra-ui'],
  ['@aceshooting/lyra-gen'],
  ['@aceshooting/lyra-ui', '@aceshooting/lyra-gen'],
  ['@aceshooting/lyra-gen', '@aceshooting/lyra-ui'],
  ['@aceshooting/lyra-map'],
]) {
  test(`release preparation builds clean prerequisites for ${released.join(', ')}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'lyra-release-build-order-'));
    try {
      const ui = join(root, 'packages/lyra-ui');
      const docs = join(root, 'packages/lyra-docs');
      const map = join(root, 'packages/lyra-map');
      const gen = join(root, 'packages/lyra-gen');
      const uiReleased = released.includes('@aceshooting/lyra-ui');
      const genReleased = released.includes('@aceshooting/lyra-gen');
      const refreshGen = uiReleased || genReleased;
      const needsUI = refreshGen || released.includes('@aceshooting/lyra-docs');
      mkdirSync(map, { recursive: true });
      writeFileSync(join(map, 'package.json'), JSON.stringify({
        name: '@aceshooting/lyra-map', version: '1.0.0',
        scripts: { build: 'node ../../fixture.mjs map' },
      }));
      mkdirSync(ui, { recursive: true });
      mkdirSync(docs, { recursive: true });
      mkdirSync(join(gen, 'scripts'), { recursive: true });
      writeFileSync(join(gen, 'metadata.json'), '"current"');
      writeFileSync(join(ui, 'source-revision.json'), '"initial"');
      // Source metadata starts at the unchanged version; the released UI generator updates it.
      writeFileSync(join(ui, 'metadata.json'), '"current"');
      writeFileSync(join(root, 'package.json'), JSON.stringify({
        private: true,
        packageManager: JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).packageManager,
      }));
      writeFileSync(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
      writeFileSync(join(ui, 'package.json'), JSON.stringify({
        name: '@aceshooting/lyra-ui', version: '1.0.0',
        scripts: {
          'package-metadata': 'node ../../fixture.mjs metadata',
          build: 'node ../../fixture.mjs ui',
          'component-quality': 'node ../../fixture.mjs quality',
        },
      }));
      writeFileSync(join(docs, 'package.json'), JSON.stringify({
        name: '@aceshooting/lyra-docs', version: '1.0.0',
        scripts: { build: 'node ../../fixture.mjs docs' },
      }));
      writeFileSync(join(gen, 'package.json'), JSON.stringify({
        name: '@aceshooting/lyra-gen', version: '1.0.0',
        scripts: { 'package-metadata': 'node ../../fixture.mjs gen-metadata', build: 'node ../../fixture.mjs gen' },
      }));
      writeFileSync(join(gen, 'scripts/measure-bundles.mjs'), "import '../../../fixture.mjs';\n");
      const packageVersions = [map, ui, docs, gen].map(directory => readFileSync(join(directory, 'package.json'), 'utf8'));
      writeFileSync(join(root, 'fixture.mjs'), `
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const root = new URL('./', import.meta.url);
const ui = new URL('packages/lyra-ui/', root);
const metadata = new URL('metadata.json', ui);
const declaration = new URL('dist/localization.d.ts', ui);
const gen = new URL('packages/lyra-gen/', root);
const revision = new URL('source-revision.json', ui);
const task = process.argv[2];
if (task === 'metadata') writeFileSync(metadata, '"released"');
if (task === 'gen-metadata') writeFileSync(new URL('metadata.json', gen), '"released"');
if (task === 'packaged') writeFileSync(revision, '"packaged"');
if (task === 'map') {
  mkdirSync(new URL('packages/lyra-map/dist/', root), { recursive: true });
  writeFileSync(new URL('packages/lyra-map/dist/index.d.ts', root), 'map declarations');
}
if (task === 'ui') {
  assert.equal(readFileSync(new URL('packages/lyra-map/dist/index.d.ts', root), 'utf8'), 'map declarations');
  mkdirSync(new URL('dist/', ui), { recursive: true });
  writeFileSync(declaration, JSON.stringify({ metadata: JSON.parse(readFileSync(metadata)), revision: JSON.parse(readFileSync(revision)) }));
}
if (task === 'docs' || task === 'quality') {
  assert.equal(JSON.parse(readFileSync(declaration)).metadata, process.env.EXPECTED_METADATA);
}
if (task === 'gen') {
  mkdirSync(new URL('dist/', gen), { recursive: true });
  writeFileSync(new URL('dist/ui-input.json', gen), readFileSync(declaration));
}
if (task === '--refresh-versions') {
  assert.equal(process.argv.length, 3);
  const built = JSON.parse(readFileSync(new URL('dist/ui-input.json', gen)));
  assert.deepEqual(built, JSON.parse(readFileSync(declaration)));
  assert.equal(built.metadata, process.env.EXPECTED_METADATA);
  assert.equal(built.revision, process.env.EXPECTED_REVISION);
  assert.equal(JSON.parse(readFileSync(new URL('metadata.json', gen))), process.env.EXPECTED_GEN_METADATA);
}
appendFileSync(new URL('steps.log', root), task + '\\n');
`);
      for (const script of [
        'update-framework-recipe-versions', 'sync-plugin-version', 'update-readme-status',
      ]) {
        mkdirSync(join(root, 'scripts'), { recursive: true });
        writeFileSync(join(root, 'scripts', `${script}.mjs`), '');
      }
      writeFileSync(join(root, 'package.sh'), '#!/bin/sh\nexec node fixture.mjs packaged\n', { mode: 0o755 });
      for (const [command, args] of releasePreparationSteps(released)) {
        const result = spawnSync(command === 'node' ? process.execPath : command, args, {
          cwd: root,
          env: {
            ...process.env,
            EXPECTED_METADATA: uiReleased ? 'released' : 'current',
            EXPECTED_REVISION: uiReleased ? 'packaged' : 'initial',
            EXPECTED_GEN_METADATA: genReleased ? 'released' : 'current',
          },
          encoding: 'utf8',
        });
        assert.equal(result.status, 0,
          `${[command, ...args].join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
      }
      const tasks = readFileSync(join(root, 'steps.log'), 'utf8').trim().split('\n');
      assert.equal(tasks.filter(task => task === 'map').length, 1);
      if (needsUI) assert.ok(tasks.indexOf('map') < tasks.indexOf('ui'), 'map declarations exist before UI builds');
      assert.equal(tasks.filter(task => task === 'docs').length, released.includes('@aceshooting/lyra-docs') ? 1 : 0);
      if (released.includes('@aceshooting/lyra-docs')) {
        assert.ok(tasks.indexOf('ui') < tasks.indexOf('docs'), 'UI declarations exist before docs builds');
      }
      assert.equal(tasks.filter(task => task === 'ui').length, uiReleased ? 2 : needsUI ? 1 : 0,
        'a prerequisite is prepared once, plus the post-packaging UI rebuild when released');
      assert.equal(tasks.filter(task => task === 'metadata').length, uiReleased ? 1 : 0,
        'an unchanged prerequisite is built without regenerating its release metadata');
      assert.equal(tasks.filter(task => task === 'gen').length, refreshGen ? 1 : 0,
        'Gen builds once after final UI, only when either package releases');
      assert.equal(tasks.filter(task => task === '--refresh-versions').length, refreshGen ? 1 : 0);
      if (refreshGen) {
        assert.ok(tasks.indexOf('gen') > tasks.lastIndexOf('ui'));
        assert.ok(tasks.indexOf('--refresh-versions') > tasks.indexOf('gen'));
      }
      assert.equal(tasks.filter(task => task === 'gen-metadata').length, genReleased ? 1 : 0);
      assert.equal(JSON.parse(readFileSync(join(gen, 'metadata.json'))), genReleased ? 'released' : 'current');
      assert.equal(JSON.parse(readFileSync(join(ui, 'metadata.json'))), uiReleased ? 'released' : 'current');
      assert.deepEqual([map, ui, docs, gen].map(directory => readFileSync(join(directory, 'package.json'), 'utf8')), packageVersions,
        'preparation preserves package versions after the separate version bump');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('release preparation runs every per-package generator in dependency order', () => {
  const lines = render(releasePreparationSteps(['@aceshooting/lyra-ui']));
  let cursor = -1;
  for (const script of PACKAGE_GENERATORS) {
    cursor = indexAfter(lines, `pnpm --filter @aceshooting/lyra-ui --if-present run ${script}`, cursor);
  }
  assert.deepEqual(PACKAGE_GENERATORS, [
    'archive-changelog',
    'package-metadata',
    'manifest',
    'component-inventory',
    'tag-aliases',
    'manifest',
    'component-metadata:history',
    'registrations',
    'manifest',
    'component-inventory',
    'visual-manifest',
    'autoloader-manifest',
    'registration-graph',
    'scoped-definitions',
    'events',
    'testing-event-registry',
    'default-string-slices',
    'translation-slices',
    'translation-review-fixture',
    'locale-manifest',
    'framework-types',
    'design-tokens',
    'generate-editor-data',
    'llms',
    'build',
    'component-quality',
  ]);
});

test('release preparation regenerates the component inventory after the bump stamps deprecation versions', () => {
  const metadata = PACKAGE_GENERATORS.indexOf('component-metadata:history');
  const manifest = PACKAGE_GENERATORS.indexOf('manifest', metadata + 1);
  const inventory = PACKAGE_GENERATORS.indexOf('component-inventory', manifest + 1);
  assert.ok(metadata > 0 && manifest > metadata, 'component metadata precedes the manifest refresh');
  assert.ok(inventory > manifest, 'the inventory follows the stamped metadata and manifest');
});

test('release preparation refreshes immutable release history between manifest generations', () => {
  const lines = render(releasePreparationSteps(['@aceshooting/lyra-ui']));
  const manifest = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run manifest');
  const inventory = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run component-inventory', manifest);
  const aliases = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run tag-aliases', inventory);
  const aliasManifest = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run manifest', aliases);
  const history = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run component-metadata:history', aliasManifest);
  const registrations = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run registrations', history);
  const refreshedManifest = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run manifest', registrations);
  indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui --if-present run component-inventory', refreshedManifest);
});

test('hosted source preparation bootstraps manifest and inventory before history reconciliation', () => {
  const lines = readFileSync(join(repoRoot, '.github/workflows/prepare-artifacts.yml'), 'utf8')
    .split('\n').map(line => line.trim());
  const sourceStep = indexAfter(lines, '- name: Reconcile release history and generate source');
  const manifest = indexAfter(lines, 'pnpm manifest', sourceStep);
  const inventory = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui run component-inventory', manifest);
  const history = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui run component-metadata:history', inventory);
  indexAfter(lines, './scripts/regen.sh', history);
});

test('release preparation fetches published tags before bumping and refuses conflicting local tags', () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-release-tags-'));
  const remote = join(root, 'remote');
  const checkout = join(root, 'checkout');
  const bin = join(root, 'bin');
  const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    mkdirSync(remote);
    mkdirSync(bin);
    for (const directory of ['scripts', 'packages/lyra-ui/scripts', '.github', '.changeset']) {
      mkdirSync(join(remote, directory), { recursive: true });
    }
    for (const file of [
      'scripts/release-prepare.mjs',
      'scripts/release-integrity.mjs',
      'scripts/release-artifacts.mjs',
      'scripts/check-node-version.mjs',
      'packages/lyra-ui/scripts/is-main-module.mjs',
      '.github/release-qualification.json',
      '.nvmrc',
    ]) {
      copyFileSync(join(repoRoot, file), join(remote, file));
    }
    writeFileSync(join(remote, 'scripts/changeset-release-plan.mjs'), '');
    writeFileSync(join(remote, '.changeset/release.md'), "---\n'@aceshooting/lyra-ui': patch\n---\n\nRelease fixture.\n");
    writeFileSync(join(remote, 'packages/lyra-ui/package.json'), JSON.stringify({
      name: '@aceshooting/lyra-ui', version: '24.0.0', private: false,
    }));
    git(remote, ['init', '--initial-branch=main']);
    git(remote, ['config', 'user.name', 'Release fixture']);
    git(remote, ['config', 'user.email', 'release@example.invalid']);
    git(remote, ['add', '.']);
    git(remote, ['commit', '-m', 'Release fixture']);
    git(root, ['clone', '--no-tags', remote, checkout]);
    git(remote, ['tag', '-a', 'lyra-ui@24.0.0', '-m', 'Published release']);
    assert.equal(git(checkout, ['tag', '--list', 'lyra-ui@24.0.0']).trim(), '');
    writeFileSync(join(bin, 'pnpm'), `#!/bin/sh
if git rev-parse --verify --quiet refs/tags/lyra-ui@24.0.0 >/dev/null; then
  echo TAG_VISIBLE_BEFORE_BUMP
else
  echo TAG_MISSING_BEFORE_BUMP
fi
exit 73
`, { mode: 0o755 });
    const result = spawnSync(process.execPath, ['scripts/release-prepare.mjs'], {
      cwd: checkout,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, 'the fixture intentionally stops before a real version bump');
    assert.match(result.stdout, /TAG_VISIBLE_BEFORE_BUMP/u, result.stderr);
    assert.doesNotMatch(result.stdout, /TAG_MISSING_BEFORE_BUMP/u);
    assert.equal(git(checkout, ['rev-parse', 'lyra-ui@24.0.0^{}']).trim(), git(remote, ['rev-parse', 'HEAD']).trim());
    assert.equal(git(checkout, ['status', '--porcelain']).trim(), '');
    git(checkout, ['config', 'user.name', 'Release fixture']);
    git(checkout, ['config', 'user.email', 'release@example.invalid']);
    git(checkout, ['tag', '--force', '-a', 'lyra-ui@24.0.0', '-m', 'Conflicting local annotation']);
    const localTag = git(checkout, ['rev-parse', 'refs/tags/lyra-ui@24.0.0']).trim();
    const conflict = spawnSync(process.execPath, ['scripts/release-prepare.mjs'], {
      cwd: checkout,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(conflict.status, 1);
    assert.match(conflict.stderr, /Command failed: git fetch/u);
    assert.doesNotMatch(conflict.stdout, /pnpm changeset version/u);
    assert.equal(git(checkout, ['rev-parse', 'refs/tags/lyra-ui@24.0.0']).trim(), localTag);
    assert.equal(git(checkout, ['status', '--porcelain']).trim(), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a lyra-ui release syncs the plugin, repackages, and rebuilds quality evidence before the README', () => {
  const lines = render(releasePreparationSteps(['@aceshooting/lyra-ui', '@aceshooting/lyra-flags']));
  const lastQuality = lines.lastIndexOf('pnpm --filter @aceshooting/lyra-flags --if-present run component-quality');
  const recipes = indexAfter(lines, 'node scripts/update-framework-recipe-versions.mjs', lastQuality);
  const sync = indexAfter(lines, 'node scripts/sync-plugin-version.mjs', recipes);
  const pack = indexAfter(lines, './package.sh', sync);
  const rebuild = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui run build', pack);
  const remeasure = indexAfter(lines, 'pnpm --filter @aceshooting/lyra-ui run component-quality', rebuild);
  const readme = indexAfter(lines, 'node scripts/update-readme-status.mjs', remeasure);
  assert.equal(readme, lines.length - 1, 'the README status update is the final step');
});

test('a companion-only release leaves the lyra-ui plugin untouched', () => {
  for (const name of ['@aceshooting/lyra-flags', '@aceshooting/lyra-docs']) {
    const lines = render(releasePreparationSteps([name]));
    assert.ok(!lines.includes('node scripts/update-framework-recipe-versions.mjs'));
    assert.ok(!lines.includes('node scripts/sync-plugin-version.mjs'));
    assert.ok(!lines.includes('./package.sh'));
    assert.equal(lines.at(-1), 'node scripts/update-readme-status.mjs');
  }
});

test('release preparation never lints, tests, packs, commits, tags, or pushes', () => {
  const lines = render(releasePreparationSteps(['@aceshooting/lyra-ui', '@aceshooting/lyra-flags']));
  for (const line of lines) {
    assert.doesNotMatch(line, /\brun (?:lint(?:\b|:)|test(?:\b|:)|check:)|\bpack\b|publish/u, line);
  }
  const executable = source.replace(/^\s*(\/\/|\*|\/\*\*).*$/gmu, '');
  assert.doesNotMatch(executable, /\['(commit|tag|push|add)'/u);
  assert.doesNotMatch(executable, /'gh'/u);
  assert.doesNotMatch(executable, /'(lint|test|pack)'\]/u);
});

test('release preparation checks the exact Node patch and a clean tree before bumping', () => {
  const nodeCheck = source.indexOf('await checkNodeVersionAtRoot(repoRoot)');
  const cleanTree = source.indexOf("assertCleanWorktree(git(['status', '--porcelain']))");
  const bump = source.indexOf("run('pnpm', ['changeset', 'version'])");
  const normalize = source.indexOf('normalizeReleaseChangelog(changelog, version)');
  const install = source.indexOf("run('pnpm', ['install'])");
  const generators = source.indexOf('releasePreparationSteps(released.map');
  assert.ok(nodeCheck > 0 && nodeCheck < cleanTree, 'the exact Node patch is checked first');
  assert.ok(cleanTree < bump, 'a dirty tree is refused before the bump');
  assert.ok(bump < normalize && normalize < install && install < generators,
    'new release notes are normalized after the bump and before archival and packaging');

  assert.doesNotThrow(() => assertCleanWorktree(''));
  assert.throws(() => assertCleanWorktree(' M README.md\n'), /Working tree is not clean[\s\S]*README\.md/u);
});

test('new release notes normalize blank indentation without changing Markdown or published history', () => {
  for (const eol of ['\n', '\r\n']) {
    const preamble = ['# Changelog', '  ', ''].join(eol);
    const current = [
      '## 25.5.0', '', '### Minor Changes', '',
      '- abc123: First paragraph.', '  ', '  Second paragraph.  ', '\t',
      '    nestedExample();', ' \t ', '  Final paragraph.', '', '',
    ].join(eol);
    const expected = [
      '## 25.5.0', '', '### Minor Changes', '',
      '- abc123: First paragraph.', '', '  Second paragraph.  ', '',
      '    nestedExample();', '', '  Final paragraph.', '', '',
    ].join(eol);
    const published = ['## 25.4.0', '', '- Published paragraph.', '  ', '  Prior continuation.', ''].join(eol);
    const normalized = normalizeReleaseChangelog(preamble + current + published, '25.5.0');
    assert.equal(normalized, preamble + expected + published);
    assert.equal(normalizeReleaseChangelog(normalized, '25.5.0'), normalized);
    assert.equal(normalizeReleaseChangelog(preamble + current, '25.5.0'), preamble + expected);
  }
});

test('release changelog normalization rejects missing and duplicate exact release headings', () => {
  assert.throws(() => normalizeReleaseChangelog('# Changelog\n\n## 25.5.01\n', '25.5.0'),
    /Expected exactly one changelog heading for 25\.5\.0; found 0/u);
  assert.throws(() => normalizeReleaseChangelog('## 25.5.0\n\n## 25.5.0\n', '25.5.0'),
    /Expected exactly one changelog heading for 25\.5\.0; found 2/u);
});

test('the released set is the publishable version delta, with stable release tags', () => {
  const before = new Map([
    ['packages/lyra-ui', '21.2.0'],
    ['packages/lyra-flags', '2.3.0'],
    ['packages/private-tool', '1.0.0'],
  ]);
  const after = [
    { directory: 'packages/lyra-ui', name: '@aceshooting/lyra-ui', version: '22.0.0', private: false },
    { directory: 'packages/lyra-flags', name: '@aceshooting/lyra-flags', version: '2.3.0', private: false },
    { directory: 'packages/private-tool', name: 'private-tool', version: '1.1.0', private: true },
  ];
  const released = releasedPackages(before, after);
  assert.deepEqual(
    released.map(({ name, previousVersion, version, tag }) => ({ name, previousVersion, version, tag })),
    [{ name: '@aceshooting/lyra-ui', previousVersion: '21.2.0', version: '22.0.0', tag: 'lyra-ui@22.0.0' }],
  );
  assert.equal(releaseCommitSubject(released), 'chore(release): @aceshooting/lyra-ui@22.0.0');
  assert.throws(
    () => releasedPackages(before, [{ ...after[0], version: '22.0.0-next.0' }]),
    /Unsupported release tag/u,
  );
});

test('the closing guidance names every qualification workflow to dispatch on the release commit', () => {
  const text = releaseNextSteps([{ name: '@aceshooting/lyra-ui', version: '22.0.0' }]);
  assert.match(text, /pnpm release:budgets/u);
  assert.match(text, /git commit -m "chore\(release\): @aceshooting\/lyra-ui@22\.0\.0"/u);
  for (const workflow of ['test-all-browsers.yml', 'full-engine.yml', 'quality-tools.yml']) {
    assert.match(text, new RegExp(`gh workflow run ${workflow.replace('.', '\\.')} --ref main`, 'u'), `${workflow} is dispatched on the release commit`);
  }
  assert.match(text, /Quality tools/u);
  assert.ok(text.indexOf('quality-tools.yml') < text.indexOf('gh workflow run release.yml --ref main'), 'Release runs after every gate');
  // The workflow inputs stay at their defaults: a Quality tools run without the benchmark cannot qualify.
  assert.doesNotMatch(text, /ab_benchmark=false|-f ab_benchmark/u);
});


test('release budgets check generated bundles before archive and installed-consumer checks', () => {
  const script = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).scripts['release:budgets'];
  const commands = script.split(' && ');
  const build = indexAfter(commands, 'pnpm --filter @aceshooting/lyra-gen run build');
  const bundles = indexAfter(commands, 'pnpm --filter @aceshooting/lyra-gen run check:bundles', build);
  for (const archive of [
    'pnpm --filter @aceshooting/lyra-ui run check:package-size',
    'node scripts/check-companion-package-sizes.mjs',
    'node scripts/check-packed-consumer.mjs --skip-attw',
  ]) indexAfter(commands, archive, bundles);
  assert.equal(commands.filter(command => command.includes('@aceshooting/lyra-gen')).length, 2);
  assert.doesNotMatch(script, /--(?:write-budgets|refresh-versions)/u);
});
