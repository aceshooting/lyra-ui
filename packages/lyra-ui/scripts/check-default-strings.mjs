#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

// Measured, not aspirational (see docs/agents/ci-and-gates.md on budgets that are red on day one):
// the number of `localize()` call sites whose key this script cannot resolve to a set today. It is
// a ratchet, so a new component cannot quietly widen the blind spot -- lower it when a call site
// becomes decidable, raise it (with the reason in the commit) only when a genuinely runtime key is
// unavoidable. `node scripts/check-default-strings.mjs --list-unresolved` prints the current set.
const UNRESOLVED_CEILING = 27;

const componentsRoot = fileURLToPath(new URL('../src/components/', import.meta.url));
const localizationFile = fileURLToPath(new URL('../src/internal/localization.ts', import.meta.url));
const packageRoot = fileURLToPath(new URL('../', import.meta.url));

function parseProgram(file, source) {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    const details = result.errors.map((error) => error.message ?? String(error)).join('\n');
    throw new SyntaxError(`${file} could not be parsed:\n${details}`);
  }
  return result.program;
}

function visitAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visitAst(child, visitor);
    } else if (value && typeof value === 'object') {
      visitAst(value, visitor);
    }
  }
}

function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
}

/** Wrappers TypeScript puts around an expression without changing the value it produces. */
const TRANSPARENT = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
  'ParenthesizedExpression',
]);

const unwrap = (node) => {
  let current = node;
  while (current && TRANSPARENT.has(current.type)) current = current.expression;
  return current;
};

/**
 * `Map<name, {scalar?: string, byProperty: Map<string, string>, values: string[]}>` for every
 * module-level `const` whose value is a string literal or an object literal of string literals.
 *
 * These are the lookup tables the dynamic call sites read from (`STATUS_KEY[this.phase]`,
 * `KIND_LABEL_KEY[k]`, `keys[name]!`). Every value in such a table is a key that can actually reach
 * `localize()`, so resolving the table resolves the call site to a small, exact set.
 */
export function stringConstants(program) {
  const constants = new Map();
  // Names another module can import, so the runner can resolve a shared table
  // (`FILE_SIZE_UNIT_KEYS`, declared once beside <lr-attachment-chip> and read by five components).
  const exported = new Set();
  for (const statement of program.body ?? []) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    for (const declarator of statement.declaration?.declarations ?? []) {
      if (declarator.id?.type === 'Identifier') exported.add(declarator.id.name);
    }
  }
  visitAst(program, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id?.type !== 'Identifier') return;
    const init = unwrap(node.init);
    const scalar = literalString(init);
    if (scalar !== undefined) {
      constants.set(node.id.name, {
        scalar,
        byProperty: new Map(),
        values: [scalar],
        exported: exported.has(node.id.name),
      });
      return;
    }
    if (init?.type !== 'ObjectExpression') return;
    const byProperty = new Map();
    let usable = init.properties.length > 0;
    for (const property of init.properties) {
      const value = property.type === 'Property' && !property.computed ? literalString(property.value) : undefined;
      const name =
        property.type === 'Property' && !property.computed
          ? property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'Literal'
              ? String(property.key.value)
              : undefined
          : undefined;
      // One non-literal member and the table stops being a closed set of keys, so the whole
      // constant is dropped rather than half-resolved into a misleadingly short list.
      if (value === undefined || name === undefined) {
        usable = false;
        break;
      }
      byProperty.set(name, value);
    }
    if (usable) {
      constants.set(node.id.name, {
        byProperty,
        values: [...byProperty.values()],
        exported: exported.has(node.id.name),
      });
    }
  });
  return constants;
}

/**
 * The complete set of keys an expression can hand to `localize()`, or `undefined` when that set is
 * not statically decidable.
 *
 * `undefined` is the important half. Before this existed, every non-literal argument was silently
 * treated as "nothing to check", so 131 of 1739 call sites — every ternary, every lookup table, and
 * the components whose whole localized surface is a table read (`lr-browser-frame`,
 * `lr-agent-trace`, `lr-tool-result-dialog`) — were invisible to a gate whose entire job is
 * catching a key with no English default. Resolving what is decidable and *counting* what is not is
 * the difference between a gate that is quiet because the code is clean and a gate that is quiet
 * because it is not looking.
 */
export function resolveKeys(node, constants) {
  const expression = unwrap(node);
  if (!expression) return undefined;
  const literal = literalString(expression);
  if (literal !== undefined) return [literal];

  const union = (...groups) => {
    if (groups.some((group) => group === undefined)) return undefined;
    return [...new Set(groups.flat())];
  };

  switch (expression.type) {
    case 'ConditionalExpression':
      // `cond ? 'a' : 'b'`, nested arbitrarily deep -- both arms are reachable, so both count.
      return union(
        resolveKeys(expression.consequent, constants),
        resolveKeys(expression.alternate, constants),
      );
    case 'LogicalExpression':
      // `TABLE[x] ?? TABLE.fallback`, `a || 'b'`. `&&` yields its right side when truthy; its left
      // side only surfaces when falsy, which is never a usable key, so only the right side counts.
      return expression.operator === '&&'
        ? resolveKeys(expression.right, constants)
        : union(resolveKeys(expression.left, constants), resolveKeys(expression.right, constants));
    case 'BinaryExpression': {
      if (expression.operator !== '+') return undefined;
      const left = resolveKeys(expression.left, constants);
      const right = resolveKeys(expression.right, constants);
      if (!left || !right) return undefined;
      return [...new Set(left.flatMap((prefix) => right.map((suffix) => prefix + suffix)))];
    }
    case 'TemplateLiteral': {
      // `\`prefix${suffixExpression}\`` -- resolvable exactly when every hole is.
      let combinations = [expression.quasis[0]?.value.cooked ?? ''];
      for (const [index, hole] of expression.expressions.entries()) {
        const resolved = resolveKeys(hole, constants);
        if (!resolved) return undefined;
        const tail = expression.quasis[index + 1]?.value.cooked ?? '';
        combinations = combinations.flatMap((prefix) =>
          resolved.map((piece) => `${prefix}${piece}${tail}`),
        );
      }
      return [...new Set(combinations)];
    }
    case 'MemberExpression': {
      if (expression.object?.type !== 'Identifier') return undefined;
      const table = constants.get(expression.object.name);
      if (!table) return undefined;
      // `TABLE[whatever]` can produce any value in the table; `TABLE.named` produces exactly one.
      if (expression.computed) return [...new Set(table.values)];
      const property =
        expression.property?.type === 'Identifier'
          ? expression.property.name
          : expression.property?.type === 'Literal'
            ? String(expression.property.value)
            : undefined;
      const value = property === undefined ? undefined : table.byProperty.get(property);
      return value === undefined ? undefined : [value];
    }
    case 'Identifier': {
      const constant = constants.get(expression.name);
      return constant?.scalar === undefined ? undefined : [constant.scalar];
    }
    default:
      return undefined;
  }
}

function lineAt(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

export function defaultStringKeys(source, file = 'localization.ts') {
  const program = parseProgram(file, source);
  let defaults;
  visitAst(program, (node) => {
    if (
      defaults ||
      node.type !== 'VariableDeclarator' ||
      node.id?.type !== 'Identifier' ||
      node.id.name !== 'DEFAULT_STRINGS' ||
      node.init?.type !== 'ObjectExpression'
    ) {
      return;
    }
    defaults = node.init;
  });
  if (!defaults) throw new Error(`${file} does not declare DEFAULT_STRINGS as an object literal`);

  const keys = new Set();
  for (const property of defaults.properties) {
    if (property.type !== 'Property' || property.computed) continue;
    const key =
      property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'Literal' && typeof property.key.value === 'string'
          ? property.key.value
          : undefined;
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Every `localize()` call in `source` as `{ keys, line, expression }`.
 *
 * `keys` is `undefined` for a call whose argument is not statically decidable (a bare parameter, a
 * property read off a runtime object). Those are the calls the gate cannot vouch for, and the
 * runner counts and lists them rather than passing over them in silence.
 */
export function localizeCalls(source, file = 'component.ts', sharedConstants = new Map()) {
  const program = parseProgram(file, source);
  // A module's own declarations win; the shared pool only fills in names it imported.
  const constants = new Map([...sharedConstants, ...stringConstants(program)]);
  const calls = [];
  visitAst(program, (node) => {
    if (
      node.type !== 'CallExpression' ||
      node.callee?.type !== 'MemberExpression' ||
      node.callee.computed ||
      node.callee.property?.type !== 'Identifier' ||
      node.callee.property.name !== 'localize'
    ) {
      return;
    }
    const argument = node.arguments?.[0];
    const keys = argument === undefined ? undefined : resolveKeys(argument, constants);
    calls.push({
      keys: keys && keys.length > 0 ? keys : undefined,
      line: lineAt(source, node.start ?? 0),
      expression:
        argument === undefined
          ? '(no argument)'
          : source.slice(argument.start ?? 0, argument.end ?? 0).replace(/\s+/g, ' ').trim(),
    });
  });
  return calls;
}

/**
 * The statically resolved keys only, flattened — the shape the original literal-only helper
 * returned, kept because it is what the freshness tooling and the self-test read.
 */
export function literalLocalizeCalls(source, file = 'component.ts', sharedConstants = new Map()) {
  return localizeCalls(source, file, sharedConstants)
    .filter(({ keys }) => keys !== undefined)
    .flatMap(({ keys, line }) => keys.map((key) => ({ key, line })));
}

/** The calls whose argument no static analysis of this file can pin down. */
export function unresolvedLocalizeCalls(source, file = 'component.ts', sharedConstants = new Map()) {
  return localizeCalls(source, file, sharedConstants).filter(({ keys }) => keys === undefined);
}

/**
 * The exported string tables of every scanned module, keyed by name.
 *
 * A name declared differently in two modules is dropped rather than merged: an over-wide key set
 * would invent findings, and "cannot resolve this" is the honest answer when two files disagree.
 */
export function sharedStringConstants(componentSources) {
  const shared = new Map();
  const conflicting = new Set();
  for (const { file, source } of componentSources) {
    for (const [name, constant] of stringConstants(parseProgram(file, source))) {
      if (!constant.exported || conflicting.has(name)) continue;
      const existing = shared.get(name);
      if (!existing) {
        shared.set(name, constant);
      } else if (existing.values.join('\u0000') !== constant.values.join('\u0000')) {
        conflicting.add(name);
        shared.delete(name);
      }
    }
  }
  return shared;
}

export function findMissingDefaultStrings(componentSources, localizationSource) {
  const defaults = defaultStringKeys(localizationSource);
  const shared = sharedStringConstants(componentSources);
  return componentSources
    .flatMap(({ file, source }) =>
      literalLocalizeCalls(source, file, shared)
        .filter(({ key }) => !defaults.has(key))
        .map(({ key, line }) => ({ file, key, line })),
    )
    .sort((a, b) => a.key.localeCompare(b.key) || a.file.localeCompare(b.file) || a.line - b.line);
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(path)));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.stories.ts')
    ) {
      files.push(path);
    }
  }
  return files;
}

async function main() {
  const files = (await sourceFiles(componentsRoot)).sort();
  const [localizationSource, ...sources] = await Promise.all([
    readFile(localizationFile, 'utf8'),
    ...files.map((file) => readFile(file, 'utf8')),
  ]);
  const componentSources = files.map((file, index) => ({
    file: relative(packageRoot, file),
    source: sources[index],
  }));
  const shared = sharedStringConstants(componentSources);
  const all = componentSources.flatMap(({ file, source }) =>
    localizeCalls(source, file, shared).map((call) => ({ ...call, file })),
  );
  const resolved = all.filter(({ keys }) => keys !== undefined);
  const unresolved = all.filter(({ keys }) => keys === undefined);
  const keys = new Set(resolved.flatMap(({ keys: resolvedKeys }) => resolvedKeys));
  const missing = findMissingDefaultStrings(componentSources, localizationSource);
  if (missing.length > 0) {
    console.error('Component localize() keys missing from DEFAULT_STRINGS:');
    for (const finding of missing) {
      console.error(`- ${finding.key}: ${finding.file}:${finding.line}`);
    }
    process.exitCode = 1;
    return;
  }
  if (unresolved.length > UNRESOLVED_CEILING) {
    console.error(
      `Default-string contract: ${unresolved.length} localize() call(s) cannot be resolved to a key ` +
        `set, above the recorded ceiling of ${UNRESOLVED_CEILING}:`,
    );
    for (const call of unresolved) console.error(`- ${call.file}:${call.line}: this.localize(${call.expression})`);
    console.error(
      '\nGive the key a decidable shape -- a literal, a ternary of literals, or a read from a ' +
        'module-level lookup table of literals -- so the English-default contract can see it. If the ' +
        'call genuinely cannot take one, lower/raise UNRESOLVED_CEILING in this script with the new ' +
        'measurement in the same change.',
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `Default-string contract passed: ${all.length} component localize() call(s), ` +
      `${resolved.length} resolved to ${keys.size} distinct key(s), ` +
      `${unresolved.length} not statically decidable (ceiling ${UNRESOLVED_CEILING}).`,
  );
  if (unresolved.length > 0 && process.argv.includes('--list-unresolved')) {
    for (const call of unresolved) console.log(`  ? ${call.file}:${call.line}: this.localize(${call.expression})`);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  await main();
}
