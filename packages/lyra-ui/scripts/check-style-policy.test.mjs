import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const checker = fileURLToPath(
  new URL('./check-style-policy.mjs', import.meta.url)
);

function write(root, relative, source) {
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
}

function run(root) {
  return spawnSync(process.execPath, [checker], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('allows only the exact path-scoped data-grid compatibility variables', () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-style-policy-'));
  try {
    const dataGrid = 'src/components/data/data-grid/data-grid.styles.ts';
    write(
      root,
      dataGrid,
      'export const styles = css`\n:host {\n  --accent-color: var(--lr-color-brand);\n}\n`;\n'
    );
    assert.equal(run(root).status, 0);

    write(
      root,
      dataGrid,
      'export const styles = css`\n:host {\n  --accent-color: var(--lr-color-brand);\n  --nineteenth-hook: var(--lr-color-brand);\n}\n`;\n'
    );
    const unlisted = run(root);
    assert.equal(unlisted.status, 1);
    assert.match(unlisted.stderr, /--nineteenth-hook/u);

    write(
      root,
      dataGrid,
      'export const styles = css`\n:host {\n  --accent-color: var(--lr-color-brand);\n}\n`;\n'
    );
    write(
      root,
      'src/components/data/table/table.styles.ts',
      'export const styles = css`\n:host {\n  --accent-color: var(--lr-color-brand);\n}\n`;\n'
    );
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
      'export const styles = css`\n:host {\n  --accent-color: currentColor;\n}\n`;\n'
    );
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must resolve through a --lr-\* token/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects documented CSS inputs declared by a component while accepting private defaults', () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-style-policy-'));
  try {
    const directory = 'src/components/utility/fixture';
    write(
      root,
      `${directory}/fixture.class.ts`,
      `/**\n * @cssprop [--lr-fixture-color=var(--lr-color-brand)] - Paint.\n */\nexport class Fixture {}\n`
    );
    write(
      root,
      `${directory}/fixture.styles.ts`,
      "export const styles = css`\n:host { --lr-fixture-color: var(--lr-color-brand); }\n[part='base'] { color: var(--lr-fixture-color); }\n`;\n"
    );

    const hostDefault = run(root);
    assert.equal(hostDefault.status, 1);
    assert.match(
      hostDefault.stderr,
      /documented CSS custom property.*--lr-fixture-color/u
    );

    write(
      root,
      `${directory}/fixture.styles.ts`,
      "export const styles = css`\n:host { --_lr-fixture-color: var(--lr-color-brand); }\n[part='base'] { color: var(--lr-fixture-color, var(--_lr-fixture-color)); }\n`;\n"
    );
    assert.equal(run(root).status, 0);

    for (const runtimeDeclaration of [
      'return html`<div style="--lr-fixture-color: red"></div>`;',
      `return styleMap({ '--lr-fixture-color': 'red' });`,
      `this.style.setProperty('--lr-fixture-color', 'red');`,
    ]) {
      write(
        root,
        `${directory}/fixture.class.ts`,
        `/**\n * @cssprop [--lr-fixture-color=var(--lr-color-brand)] - Paint.\n */\nexport class Fixture { method() { ${runtimeDeclaration} } }\n`
      );
      const runtimeDefault = run(root);
      assert.equal(runtimeDefault.status, 1);
      assert.match(runtimeDefault.stderr, /runtime code.*--lr-fixture-color/u);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
