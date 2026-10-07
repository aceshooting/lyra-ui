import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseProgram, visitAst } from './ast.mjs';
import { walk } from './fs-walk.mjs';
import { isSuppressed, stripJsComments } from './source-text.mjs';

test('shared AST visitor reaches nested TypeScript expressions and reports parse errors', () => {
  const program = parseProgram('sample.ts', "const value = input as string;\n");
  const seen = [];
  visitAst(program, (node) => seen.push(node.type));
  assert.ok(seen.includes('TSAsExpression'));
  assert.ok(seen.includes('Identifier'));
  assert.throws(() => parseProgram('broken.ts', 'const = ;'), /broken\.ts could not be parsed/);
});

test('shared comment masking preserves offsets, templates, and suppression boundaries', () => {
  const source = "const literal = '// text'; // policy-allow(sample): reason\n" +
    "const template = `inside ${value /* hidden */}`;\n";
  const stripped = stripJsComments(source);
  assert.equal(stripped.length, source.length);
  assert.equal(stripped.split('\n').length, source.split('\n').length);
  assert.match(stripped, /'\/\/ text'/);
  assert.doesNotMatch(stripped, /hidden|policy-allow/);
  const rawLines = ['// policy-allow(sample): documented exception', '// explanation', 'const value = 1;'];
  const strippedLines = rawLines.map((line) => stripJsComments(line));
  assert.equal(isSuppressed(rawLines, strippedLines, 3, 'sample'), true);
  assert.equal(isSuppressed(rawLines, strippedLines, 3, 'other'), false);
  assert.equal(isSuppressed(['// policy-allow(sample): old', 'const break = 1;', 'const value = 1;'],
    ['', 'const break = 1;', 'const value = 1;'], 3, 'sample'), false);
});

test('shared file walk returns nested files without changing caller filter policy', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-script-walk-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'nested'));
  writeFileSync(join(root, 'root.ts'), '');
  writeFileSync(join(root, 'nested', 'item.mjs'), '');
  assert.deepEqual(walk(root).sort(), [join(root, 'root.ts'), join(root, 'nested', 'item.mjs')].sort());
});
