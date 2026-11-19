import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';
import { parseProgram, visitAst } from './lib/ast.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(packageDir, 'scripts/fixtures/test-wait-baseline.json');
const TEST = /\b(?:it|test|specify)\s*\(\s*(['"`])([^'"`]+)\1/;
const MIN_WAIT_MS = 100;

function timerDelay({ callee, arguments: [callback, delay] }, resolver) {
  const target = callee.type === 'MemberExpression' && !callee.computed ? callee.property : callee;
  if (target.name === 'setTimeout' && callback?.type === 'Identifier' &&
      (resolver === undefined || callback.name === resolver)) return delay;
}

/** Find which argument a local promise-based sleep passes to its timer. */
function sleepParameter(callable) {
  if (!callable?.params) return -1;
  let parameter = -1;
  visitAst(callable.body, (node) => {
    if (node.type !== 'NewExpression' || node.callee.name !== 'Promise') return;
    const executor = node.arguments[0];
    const resolve = executor?.params?.[0];
    if (resolve?.type !== 'Identifier') return;
    visitAst(executor.body, (bodyNode) => {
      if (bodyNode.type !== 'CallExpression') return;
      const delay = timerDelay(bodyNode, resolve.name);
      const index = callable.params.findIndex((param) => param.type === 'Identifier' && param.name === delay?.name);
      if (index >= 0) parameter = index;
    });
  });
  return parameter;
}

function waitCalls(program) {
  const constants = new Map();
  const wrappers = new Map([['aTimeout', 0]]);
  const calls = [];
  visitAst(program, (node) => {
    if (node.type === 'VariableDeclaration' && node.kind === 'const') {
      for (const { id, init } of node.declarations) {
        if (id.type === 'Identifier' && typeof init?.value === 'number') constants.set(id.name, init.value);
      }
    }
    if (node.type === 'FunctionDeclaration' || node.type === 'VariableDeclarator') {
      const parameter = sleepParameter(node.type === 'FunctionDeclaration' ? node : node.init);
      if (node.id?.type === 'Identifier' && parameter >= 0) wrappers.set(node.id.name, parameter);
    }
    if (node.type === 'CallExpression') calls.push(node);
  });

  const waits = [];
  for (const call of calls) {
    const name = call.callee.type === 'Identifier' ? call.callee.name : undefined;
    const parameter = wrappers.get(name);
    const delay = parameter === undefined ? timerDelay(call) : call.arguments[parameter];
    const milliseconds = delay?.type === 'Identifier' ? constants.get(delay.name) : delay?.value;
    if (typeof milliseconds !== 'number' || milliseconds < MIN_WAIT_MS) continue;
    const argument = delay.type === 'Identifier' ? `${delay.name}=${milliseconds}` : milliseconds;
    waits.push({ start: call.start, fingerprint: `${parameter === undefined ? 'setTimeout' : name}(${argument})` });
  }
  return waits;
}

/** Stable test title + call fingerprint; line moves do not renew a wait allowance. */
export function literalLongWaits(source, file) {
  if (!/\b(?:aTimeout|setTimeout)\b/.test(source)) return [];
  const calls = waitCalls(parseProgram(file, source));
  let scope = '<module>';
  const lines = source.split(/\r?\n/);
  const scopes = lines.map((line) => {
    const title = TEST.exec(line);
    if (title) scope = title[2];
    return scope;
  });
  return calls.map(({ start, fingerprint }) => {
    const line = source.slice(0, start).split('\n').length;
    const key = `${file}\t${scopes[line - 1]}\t${fingerprint}`;
    const reason = lines.slice(Math.max(0, line - 3), line).some((text) => /wait-reason:\s*\S/.test(text));
    return { key, reason, line };
  });
}

export function newLongWaits(rows, baseline) {
  const grouped = new Map();
  for (const row of rows) {
    const group = grouped.get(row.key) ?? [];
    group.push(row);
    grouped.set(row.key, group);
  }
  const failures = [];
  for (const [key, group] of grouped) {
    const allowance = (baseline[key] ?? 0) + group.filter(row => row.reason).length;
    if (group.length > allowance) failures.push(`${key} (${group.length - allowance} new wait${group.length - allowance === 1 ? '' : 's'})`);
  }
  return failures.sort();
}

function testFiles(dir, prefix = '') {
  const files = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name);
    if (item.isDirectory()) files.push(...testFiles(path.join(dir, item.name), relative));
    else if (/\.test\.(?:ts|js|mjs)$/.test(item.name)) files.push(relative);
  }
  return files;
}

export function checkTestWaits() {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const files = [...testFiles(path.join(packageDir, 'src'), 'src'), ...testFiles(path.join(packageDir, 'test'), 'test')];
  const rows = files.flatMap(file => literalLongWaits(readFileSync(path.join(packageDir, file), 'utf8'), file));
  return { failures: newLongWaits(rows, baseline), waits: rows.length, files: files.length };
}

if (isMainModule(import.meta.url)) {
  const { failures, waits, files } = checkTestWaits();
  process.stdout.write(`Examined ${waits} waits of ${MIN_WAIT_MS} ms or more across ${files} test files.\n`);
  if (failures.length) {
    process.stderr.write(`New waits of ${MIN_WAIT_MS} ms or more need a nearby wait-reason comment:\n${failures.join('\n')}\n`);
    process.exitCode = 1;
  }
}
