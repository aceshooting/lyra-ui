// Tests for scripts/check-regen-coverage.mjs. Pure, in-memory fixtures -- a fake `package.json`
// scripts object plus a `Map`-backed `readScriptSource` -- rather than touching this repo's own
// `scripts/` directory, so a case exercises exactly the mechanism it names without depending on
// today's real generator/gate inventory.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeCoverage,
  computeRootScriptCoverage,
  expandScript,
  extractReferencedGeneratorFiles,
  extractRemedyNames,
  splitCommand,
} from './check-regen-coverage.mjs';

/** @param {Record<string,string>} files */
function sourceReaderFor(files) {
  return (file) => (Object.hasOwn(files, file) ? files[file] : null);
}

test('splitCommand splits only on top-level &&, trimming each segment', () => {
  assert.deepEqual(splitCommand('pnpm run a &&  pnpm run b  &&node scripts/c.mjs'), [
    'pnpm run a',
    'pnpm run b',
    'node scripts/c.mjs',
  ]);
});

test('expandScript follows a nested pnpm-run alias to the node script it ultimately invokes', () => {
  const scripts = {
    entry: 'pnpm run middle',
    middle: 'pnpm run generate-widget',
    'generate-widget': 'node scripts/generate-widget.mjs',
  };
  const { files, scriptNames } = expandScript('entry', scripts);
  assert.deepEqual([...files.keys()], ['generate-widget.mjs']);
  assert.ok(scriptNames.has('middle') && scriptNames.has('generate-widget'));
});

test('extractRemedyNames reads a backtick pnpm-run remedy and a pnpm --filter remedy alike', () => {
  const source =
    'throw new Error("widget.json is stale; run `pnpm run widget`.");\n' +
    'throw new Error("run `pnpm --filter @scope/pkg manifest` and commit the result.");';
  assert.deepEqual(extractRemedyNames(source), ['widget', 'manifest']);
});

test('extractReferencedGeneratorFiles finds an import specifier and a quoted scripts/ path, not a self-reference', () => {
  const source =
    "import { deriveWidget } from './generate-widget.mjs';\n" +
    "const OTHERS = ['scripts/generate-other.mjs'];\n" +
    "// mentions 'generate-widget-checker.mjs' itself, must not self-count\n";
  assert.deepEqual(
    extractReferencedGeneratorFiles(source, 'generate-widget-checker.mjs').sort(),
    ['generate-other.mjs', 'generate-widget.mjs'],
  );
});

test('a generator reachable only through a nested pnpm-run alias passes', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    widget: 'pnpm run inner-widget',
    'inner-widget': 'node scripts/generate-widget.mjs',
    regen: 'pnpm run widget',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run widget`.");',
    'generate-widget.mjs': '// generator',
  });
  const result = computeCoverage({ scripts, readScriptSource, exemptions: {} });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('a generator a gate requires, but that regen never reaches, fails', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    widget: 'pnpm run inner-widget',
    'inner-widget': 'node scripts/generate-widget.mjs',
    regen: 'pnpm run something-unrelated',
    'something-unrelated': 'node scripts/generate-other.mjs',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run widget`.");',
    'generate-widget.mjs': '// generator',
    'generate-other.mjs': '// unrelated',
  });
  const result = computeCoverage({ scripts, readScriptSource, exemptions: {} });
  assert.equal(result.ok, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].file, 'generate-widget.mjs');
  assert.ok(result.violations[0].reasons[0].includes('pnpm run widget'));
});

test('an exempted generator passes even though regen never reaches it', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    widget: 'node scripts/generate-widget.mjs',
    regen: 'pnpm run something-unrelated',
    'something-unrelated': 'node scripts/generate-other.mjs',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run widget`.");',
    'generate-widget.mjs': '// generator',
    'generate-other.mjs': '// unrelated',
  });
  const result = computeCoverage({
    scripts,
    readScriptSource,
    exemptions: { 'generate-widget.mjs': 'covered by a manual release-time step, not ordinary regen.' },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
  assert.equal(result.exemptedCount, 1);
});

test('an exemption with no stated reason fails, even when it would otherwise pass', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    widget: 'node scripts/generate-widget.mjs',
    regen: 'pnpm run widget',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run widget`.");',
  });
  const result = computeCoverage({
    scripts,
    readScriptSource,
    exemptions: { 'generate-unrelated.mjs': '   ' },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.invalidExemptions, ['generate-unrelated.mjs']);
});

test('a same-file --check/write flag pair (no shared naming, no message) is still discovered', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:registration-graph',
    'check:registration-graph': 'node scripts/generate-registration-graph.mjs --check',
    'registration-graph': 'node scripts/generate-registration-graph.mjs',
    regen: 'pnpm run something-else',
    'something-else': 'node scripts/generate-noop.mjs',
  };
  const readScriptSource = sourceReaderFor({
    'generate-registration-graph.mjs': '// no message at all naming its own remedy script',
    'generate-noop.mjs': '// unrelated',
  });
  const result = computeCoverage({ scripts, readScriptSource, exemptions: {} });
  assert.equal(result.ok, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].file, 'generate-registration-graph.mjs');
  assert.match(result.violations[0].reasons[0], /self-check-paired/);
});

test('a file referenced only outside this package\'s scripts/ directory is not required', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    regen: 'pnpm run noop',
    noop: 'node scripts/generate-noop.mjs',
  };
  const readScriptSource = sourceReaderFor({
    // References a file that does not exist in this package's scripts/ (readScriptSource returns
    // null for it), e.g. a monorepo-root tool -- must not become a phantom requirement.
    'check-widget.mjs': "const ROOT_TOOL = 'scripts/generate-root-tool.mjs';",
    'generate-noop.mjs': '// unrelated',
  });
  const result = computeCoverage({ scripts, readScriptSource, exemptions: {} });
  assert.equal(result.ok, true);
  assert.equal(result.requiredCount, 0);
});

// computeRootScriptCoverage: the same required-generator set `computeCoverage` derives against
// the literal text of root repo-level shell entry points (`scripts/regen.sh`,
// `scripts/upgrade.sh`), which are outside this package's own package.json and so invisible to
// `computeCoverage` itself -- see NEW:dist-regen-scripts-generator-drift.

test('a root script that hand-invokes a generator by its own package.json script name passes', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    widget: 'node scripts/generate-widget.mjs',
    regen: 'pnpm run widget',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run widget`.");',
    'generate-widget.mjs': '// generator',
  });
  const result = computeRootScriptCoverage({
    scripts,
    readScriptSource,
    exemptions: {},
    rootScripts: { 'scripts/regen.sh': 'pnpm --filter @scope/pkg widget\n' },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('a root script that hand-invokes a generator by its own filename passes', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    widget: 'node scripts/generate-widget.mjs',
    regen: 'pnpm run widget',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run widget`.");',
    'generate-widget.mjs': '// generator',
  });
  const result = computeRootScriptCoverage({
    scripts,
    readScriptSource,
    exemptions: {},
    rootScripts: { 'scripts/regen.sh': 'pnpm --filter @scope/pkg exec node scripts/generate-widget.mjs\n' },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('a root script reaching a generator only through a nested non-leaf alias still passes', () => {
  // Mirrors `registrations` -> `tag-aliases` -> `generate-tag-aliases.mjs`: a root script that
  // hand-invokes the AGGREGATE alias, never the nested leaf name, still genuinely regenerates the
  // file, so it must count as reached.
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    aggregate: 'pnpm run nested-widget',
    'nested-widget': 'node scripts/generate-widget.mjs',
    regen: 'pnpm run aggregate',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run aggregate`.");',
    'generate-widget.mjs': '// generator',
  });
  const result = computeRootScriptCoverage({
    scripts,
    readScriptSource,
    exemptions: {},
    rootScripts: { 'scripts/regen.sh': 'pnpm --filter @scope/pkg aggregate\n' },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('a root script missing a required generator entirely fails, naming the file and the script', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    widget: 'node scripts/generate-widget.mjs',
    regen: 'pnpm run widget',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run widget`.");',
    'generate-widget.mjs': '// generator',
  });
  const result = computeRootScriptCoverage({
    scripts,
    readScriptSource,
    exemptions: {},
    rootScripts: {
      'scripts/regen.sh': 'pnpm --filter @scope/pkg widget\n',
      'scripts/upgrade.sh': 'pnpm install\n',
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].file, 'generate-widget.mjs');
  assert.equal(result.violations[0].script, 'scripts/upgrade.sh');
});

test('an exempted generator never fails root-script coverage, even absent from every root script', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    widget: 'node scripts/generate-widget.mjs',
    regen: 'pnpm run widget',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run widget`.");',
    'generate-widget.mjs': '// generator',
  });
  const result = computeRootScriptCoverage({
    scripts,
    readScriptSource,
    exemptions: { 'generate-widget.mjs': 'covered by a manual release-time step.' },
    rootScripts: { 'scripts/regen.sh': 'pnpm install\n' },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('a short alias name never matches as a substring of an unrelated longer token', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    gen: 'node scripts/generate-widget.mjs',
    regen: 'pnpm run gen',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run gen`.");',
    'generate-widget.mjs': '// generator',
  });
  // "regeneration" and "generate-widget-extra.mjs" both contain "gen" as a bare substring; neither
  // is a real invocation of the `gen` script or `generate-widget.mjs`, so this must still fail.
  const result = computeRootScriptCoverage({
    scripts,
    readScriptSource,
    exemptions: {},
    rootScripts: { 'scripts/regen.sh': 'Full regeneration of generate-widget-extra.mjs happens elsewhere.\n' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].file, 'generate-widget.mjs');
});

test('a gate name that happens to reach a file with matching args is never treated as reaching it', () => {
  const scripts = {
    'contract-policy': 'pnpm run check:widget',
    'check:widget': 'node scripts/check-widget.mjs',
    // A pathological gate-prefixed name that (unusually) itself runs the write-mode generator --
    // must never count, since a root script is never expected to invoke a `check:`/`test:` name to
    // regenerate anything, and treating it as if it did would hide a genuine gap.
    'check:decoy': 'node scripts/generate-widget.mjs',
    widget: 'node scripts/generate-widget.mjs',
    regen: 'pnpm run widget',
  };
  const readScriptSource = sourceReaderFor({
    'check-widget.mjs': 'if (stale) throw new Error("widget.json is stale; run `pnpm run widget`.");',
    'generate-widget.mjs': '// generator',
  });
  const result = computeRootScriptCoverage({
    scripts,
    readScriptSource,
    exemptions: {},
    rootScripts: { 'scripts/regen.sh': 'pnpm run check:decoy\n' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].file, 'generate-widget.mjs');
});
