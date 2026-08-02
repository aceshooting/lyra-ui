import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const checker = fileURLToPath(new URL('./check-style-policy.mjs', import.meta.url));

function write(root, relative, source) {
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
}

function run(root) {
  return spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8' });
}

test('allows only the exact path-scoped data-grid compatibility variables', () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-style-policy-'));
  try {
    const dataGrid = 'src/components/data/data-grid/data-grid.styles.ts';
    write(root, dataGrid, "export const styles = css`\n:host {\n  --accent-color: var(--lr-color-brand);\n}\n`;\n");
    assert.equal(run(root).status, 0);

    write(root, dataGrid, "export const styles = css`\n:host {\n  --accent-color: var(--lr-color-brand);\n  --nineteenth-hook: var(--lr-color-brand);\n}\n`;\n");
    const unlisted = run(root);
    assert.equal(unlisted.status, 1);
    assert.match(unlisted.stderr, /--nineteenth-hook/u);

    write(root, dataGrid, "export const styles = css`\n:host {\n  --accent-color: var(--lr-color-brand);\n}\n`;\n");
    write(root, 'src/components/data/table/table.styles.ts', "export const styles = css`\n:host {\n  --accent-color: var(--lr-color-brand);\n}\n`;\n");
    const wrongPath = run(root);
    assert.equal(wrongPath.status, 1);
    assert.match(wrongPath.stderr, /table\.styles\.ts.*--accent-color/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('requires compatibility variables to resolve through Lyra tokens', () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-style-policy-'));
  try {
    write(
      root,
      'src/components/data/data-grid/data-grid.styles.ts',
      "export const styles = css`\n:host {\n  --accent-color: currentColor;\n}\n`;\n",
    );
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must resolve through a --lr-\* token/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
