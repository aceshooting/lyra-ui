import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { applyReviewedExceptions, diffPublicApi, normalizePublicApi } from './public-api-diff.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = 'components/conversation/message-parts/message-parts.ts';
const children = [
  ['../../forms/button/button.js', 'lr-button', 'LyraButton'],
  ['../../layout/details/details.js', 'lr-details', 'LyraDetails'],
  ['../../forms/icon-button/icon-button.js', 'lr-icon-button', 'LyraIconButton'],
  ['../../overlays/overlay/tooltip.js', 'lr-tooltip', 'LyraTooltip'],
];

test('message-parts preserves child tag declarations without emitting child registration imports', () => {
  const source = readFileSync(path.join(packageDir, 'src', entry), 'utf8');
  const declarations = parseSync(entry, source).program.body
    .filter(node => node.type === 'ExportNamedDeclaration' && node.exportKind === 'type')
    .map(node => source.slice(node.start, node.end)).join('\n');
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-type-registration-'));
  try {
    const entryFile = path.join(root, entry);
    mkdirSync(path.dirname(entryFile), { recursive: true });
    writeFileSync(entryFile, declarations);
    for (const [relative, tag, name] of children) {
      const child = path.resolve(path.dirname(entryFile), relative.replace(/\.js$/, '.ts'));
      mkdirSync(path.dirname(child), { recursive: true });
      writeFileSync(child, `export class ${name} extends HTMLElement {}\n`
        + `declare global { interface HTMLElementTagNameMap { '${tag}': ${name}; } }\n`);
    }
    writeFileSync(path.join(root, 'consumer.ts'), `import type {} from './${entry.replace(/\.ts$/, '.js')}';\n`
      + children.map(([, tag], index) => `export type Child${index} = HTMLElementTagNameMap['${tag}'];`).join('\n'));
    writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
        declaration: true, verbatimModuleSyntax: true, types: [], outDir: 'out',
      }, files: ['consumer.ts'],
    }));
    try {
      execFileSync(process.execPath, [path.join(packageDir, 'node_modules/typescript/bin/tsc'), '-p', root], {
        encoding: 'utf8', stdio: 'pipe',
      });
    } catch (error) {
      assert.fail(error.stdout || error.message);
    }
    const emittedEntry = path.join(root, 'out', entry.replace(/\.ts$/, ''));
    assert.equal(readFileSync(`${emittedEntry}.js`, 'utf8').trim(), 'export {};');
    const declaration = readFileSync(`${emittedEntry}.d.ts`, 'utf8');
    const declarationEntry = `dist/${entry.replace(/\.ts$/, '.d.ts')}`;
    const files = { [declarationEntry]: declaration };
    for (const [relative, tag, name] of children) {
      files[path.posix.join(path.posix.dirname(declarationEntry), relative).replace(/\.js$/, '.d.ts')]
        = `export class ${name} extends HTMLElement {}\ndeclare global { interface HTMLElementTagNameMap { '${tag}': ${name}; } }`;
    }
    const fixture = text => normalizePublicApi({
      packageJson: { name: '@aceshooting/lyra-ui', version: '30.2.0', exports: { './parts': `./${declarationEntry.replace(/\.d\.ts$/, '.js')}` } },
      manifest: { modules: [] },
      declarations: { files: { ...files, [declarationEntry]: text } },
    });
    const before = fixture(children.map(([relative]) => `import '${relative}';`).join('\n'));
    assert.deepEqual(diffPublicApi(before, fixture(declaration)), []);
    assert.equal(diffPublicApi(before, fixture('export {};')).some(change => change.bump === 'major'), true);
    writeFileSync(entryFile, 'export {};');
    assert.throws(() => execFileSync(process.execPath, [
      path.join(packageDir, 'node_modules/typescript/bin/tsc'), '-p', root,
    ], { encoding: 'utf8', stdio: 'pipe' }), error =>
      children.every(([, tag]) => error.stdout.includes(`Property '${tag}' does not exist on type 'HTMLElementTagNameMap'`)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('A2UI return exceptions remain fingerprint-bound after their release records retire', () => {
  const ids = ['subpath-export:./ai:adaptA2UiSurface:contract', 'subpath-export:./ai:adaptA2UiSurface:dependencies'];
  const reviewed = ids.map((changeId, index) => ({
    changeId, before: `before-${index}`, after: `after-${index}`, requiredBump: 'major', allowedBump: 'minor',
    reason: 'Optional return fields preserve structural compatibility.', reviewer: 'fixture', reviewedOn: '2026-10-26',
  }));
  const changes = reviewed.map(exception => ({ id: exception.changeId, bump: 'major', before: exception.before, after: exception.after }));
  assert.deepEqual(applyReviewedExceptions(changes, { exceptions: reviewed }).map(change => change.bump), ['minor', 'minor']);
  for (const field of ['before', 'after']) {
    const changed = changes.map((change, index) => index === 0 ? { ...change, [field]: 'different-contract' } : change);
    assert.throws(() => applyReviewedExceptions(changed, { exceptions: reviewed }), /does not match any current API change/);
  }
  assert.throws(() => applyReviewedExceptions([], { exceptions: reviewed }), /does not match any current API change/);
  const unrelated = { id: 'subpath-export:./ai:anotherFunction:contract', bump: 'major', before: 'old', after: 'new' };
  assert.equal(applyReviewedExceptions([...changes, unrelated], { exceptions: reviewed }).at(-1).bump, 'major');
});
