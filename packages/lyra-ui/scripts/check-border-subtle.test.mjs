import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  GUARDED_PATHS,
  SUBTLE_BORDER_TOKENS,
  checkBorderSubtle,
  findSubtleBorderReferences,
  formatReport,
  isTestFile,
  listGuardedFiles,
} from './check-border-subtle.mjs';

const scriptPath = fileURLToPath(new URL('./check-border-subtle.mjs', import.meta.url));
const packageDir = dirname(dirname(scriptPath));

/** A throwaway package tree: `files` maps package-relative paths to their contents. */
function fixturePackage(files) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-border-subtle-'));
  for (const [relative, contents] of Object.entries(files)) {
    const file = join(root, ...relative.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
  return root;
}

function withFixture(files, run) {
  const root = fixturePackage(files);
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const CLEAN_FORMS_TREE = {
  'src/components/forms/input/input.styles.ts':
    "import { css } from 'lit';\nexport const styles = css`\n  [part='base'] { border: 1px solid var(--lr-color-border); }\n`;\n",
  'src/internal/form-control.styles.ts':
    "import { css } from 'lit';\nexport const formControl = css`\n  [part='label'] { color: var(--lr-color-text); }\n`;\n",
};

// -- findSubtleBorderReferences -------------------------------------------------------------

test('guards the resolved token and its theme input', () => {
  assert.deepEqual([...SUBTLE_BORDER_TOKENS], [
    '--lr-color-border-subtle',
    '--lr-theme-color-surface-border-subtle',
  ]);
});

test('flags the resolved token with a 1-based line and column', () => {
  const source = 'const a = 1;\n  border-color: var(--lr-color-border-subtle);\n';
  assert.deepEqual(findSubtleBorderReferences(source), [
    { line: 2, column: 21, token: '--lr-color-border-subtle' },
  ]);
});

test('flags the theme input read directly, which paints the same decorative colour', () => {
  const source = 'border-color: var(--lr-theme-color-surface-border-subtle, var(--lr-color-border));';
  assert.deepEqual(findSubtleBorderReferences(source), [
    { line: 1, column: 19, token: '--lr-theme-color-surface-border-subtle' },
  ]);
});

test('reports every reference on a line, in source order', () => {
  const source = 'a: var(--lr-color-border-subtle); b: var(--lr-color-border-subtle);';
  assert.deepEqual(
    findSubtleBorderReferences(source).map(({ column }) => column),
    [8, 42],
  );
});

test('does not flag the control-boundary tokens', () => {
  const source = [
    'border: 1px solid var(--lr-color-border);',
    'outline-color: var(--lr-color-border-strong);',
    'border-color: var(--lr-theme-color-surface-border, #8a8a90);',
    'border-color: var(--lr-card-border-color, var(--lr-color-border));',
  ].join('\n');
  assert.deepEqual(findSubtleBorderReferences(source), []);
});

test('flags a mention inside a comment too: the rule is on the literal name, not on parsed CSS', () => {
  // Deliberately strict. A control boundary most often drifts onto a decorative token by a copied
  // line, and a commented-out copy is one uncomment away from shipping.
  const source = "/* border-color: var(--lr-color-border-subtle); */\n// '--lr-color-border-subtle'";
  assert.equal(findSubtleBorderReferences(source).length, 2);
});

// -- isTestFile -----------------------------------------------------------------------------

test('treats every *.test.* module as a test file and nothing else', () => {
  for (const file of ['input.test.ts', 'select.docs.test.mjs', 'x.test.js', 'y.test.mts']) {
    assert.equal(isTestFile(file), true, file);
  }
  for (const file of ['input.styles.ts', 'input.class.ts', 'input.stories.ts', 'contest.ts', 'test-utils.ts']) {
    assert.equal(isTestFile(file), false, file);
  }
});

// -- listGuardedFiles -----------------------------------------------------------------------

test('walks guarded directories recursively, keeps single-file roots, and skips test files', () => {
  withFixture(
    {
      ...CLEAN_FORMS_TREE,
      'src/components/forms/select/select.class.ts': '',
      'src/components/forms/select/select.test.ts': '',
      'src/components/forms/select/nested/option.styles.ts': '',
      'src/components/layout/card/card.styles.ts': '',
    },
    (root) => {
      assert.deepEqual(listGuardedFiles(root), {
        files: [
          'src/components/forms/input/input.styles.ts',
          'src/components/forms/select/nested/option.styles.ts',
          'src/components/forms/select/select.class.ts',
          'src/internal/form-control.styles.ts',
        ],
        missing: [],
      });
    },
  );
});

test('reports a guarded path that no longer exists instead of silently shrinking the gate', () => {
  withFixture({ 'src/components/forms/input/input.styles.ts': '' }, (root) => {
    assert.deepEqual(listGuardedFiles(root).missing, ['src/internal/form-control.styles.ts']);
  });
});

// -- checkBorderSubtle ----------------------------------------------------------------------

test('passes a form tree that draws its boundaries with --lr-color-border', () => {
  withFixture(CLEAN_FORMS_TREE, (root) => {
    const result = checkBorderSubtle(root);
    assert.deepEqual(result.findings, []);
    assert.equal(result.files.length, 2);
    assert.equal(formatReport(result).ok, true);
  });
});

test('fails the subtle tier in a form-control stylesheet, a class file, and the shared form-control styles', () => {
  withFixture(
    {
      ...CLEAN_FORMS_TREE,
      'src/components/forms/input/input.styles.ts':
        "export const styles = css`\n  [part='base'] { border-color: var(--lr-color-border-subtle); }\n`;\n",
      'src/components/forms/select/select.class.ts':
        "const style = styleMap({ borderColor: 'var(--lr-theme-color-surface-border-subtle)' });\n",
      'src/internal/form-control.styles.ts': 'x\ny\n  --lr-x: var(--lr-color-border-subtle);\n',
    },
    (root) => {
      assert.deepEqual(checkBorderSubtle(root).findings, [
        { file: 'src/components/forms/input/input.styles.ts', line: 2, column: 37, token: '--lr-color-border-subtle' },
        {
          file: 'src/components/forms/select/select.class.ts',
          line: 1,
          column: 44,
          token: '--lr-theme-color-surface-border-subtle',
        },
        { file: 'src/internal/form-control.styles.ts', line: 3, column: 15, token: '--lr-color-border-subtle' },
      ]);
    },
  );
});

test('ignores test files under forms, and every stylesheet outside the guarded paths', () => {
  withFixture(
    {
      ...CLEAN_FORMS_TREE,
      // A test may name the token to assert a control does NOT resolve to it.
      'src/components/forms/input/input.test.ts':
        "expect(border).to.not.equal(read('--lr-color-border-subtle'));\n",
      // The decorative tier is exactly what a card edge or a divider is for.
      'src/components/layout/card/card.styles.ts': 'border: 1px solid var(--lr-color-border-subtle);\n',
      'src/internal/tokens.styles.ts': '--lr-color-border-subtle: var(--lr-color-border);\n',
    },
    (root) => {
      assert.deepEqual(checkBorderSubtle(root).findings, []);
    },
  );
});

// -- formatReport ---------------------------------------------------------------------------

test('a failure names each location and explains the SC 1.4.11 reason', () => {
  const report = formatReport({
    files: ['src/components/forms/input/input.styles.ts'],
    missing: [],
    findings: [
      { file: 'src/components/forms/input/input.styles.ts', line: 2, column: 36, token: '--lr-color-border-subtle' },
    ],
  });
  assert.equal(report.ok, false);
  assert.match(report.message, /src\/components\/forms\/input\/input\.styles\.ts:2:36 --lr-color-border-subtle/);
  assert.match(report.message, /SC 1\.4\.11/);
  assert.match(report.message, /3:1/);
  assert.match(report.message, /--lr-color-border\b/);
});

test('a missing guarded path or an empty scan fails rather than passing vacuously', () => {
  const missing = formatReport({ files: ['a.ts'], missing: ['src/internal/form-control.styles.ts'], findings: [] });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /src\/internal\/form-control\.styles\.ts/);
  const empty = formatReport({ files: [], missing: [], findings: [] });
  assert.equal(empty.ok, false);
  assert.match(empty.message, /ZERO/);
});

// -- this package ---------------------------------------------------------------------------

test('every guarded path exists in this package, so the gate scans real files', () => {
  const { files, missing } = listGuardedFiles(packageDir);
  assert.deepEqual(missing, []);
  assert.ok(files.length > GUARDED_PATHS.length, `expected the forms tree to be scanned, got ${files.length} file(s)`);
  assert.ok(files.includes('src/internal/form-control.styles.ts'));
  assert.ok(files.some((file) => file.startsWith('src/components/forms/input/')));
});

test('the CLI exits with the status its own report computes', () => {
  const child = spawnSync(process.execPath, [scriptPath], { cwd: packageDir, encoding: 'utf8' });
  const expected = formatReport(checkBorderSubtle(packageDir));
  assert.equal(child.status, expected.ok ? 0 : 1, child.stderr || child.stdout);
  assert.equal((expected.ok ? child.stdout : child.stderr).trim(), expected.message.trim());
});
