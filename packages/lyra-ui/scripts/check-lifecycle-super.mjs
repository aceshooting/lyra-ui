#!/usr/bin/env node

// Every ReactiveElement lifecycle override whose superclass exposes a callable matching hook must
// keep that hook in the chain. Today several hooks are no-ops in LyraElement/ReactiveElement, but
// silently skipping them makes future shared behavior (and behavior supplied by an intermediate
// mixin) depend on which leaf component happened to remember the call.
//
// `adoptedCallback()` is deliberately absent: HTMLElement/ReactiveElement/LyraElement do not
// expose a callable matching implementation, so `super.adoptedCallback()` would itself be wrong.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseSync, visitorKeys } from 'oxc-parser';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(packageDir, 'src');

const CALLABLE_LIFECYCLE_HOOKS = Object.freeze([
  'connectedCallback',
  'disconnectedCallback',
  'attributeChangedCallback',
  'createRenderRoot',
  'requestUpdate',
  'performUpdate',
  'scheduleUpdate',
  'shouldUpdate',
  'willUpdate',
  'update',
  'updated',
  'firstUpdated',
]);

const callableHooks = new Set(CALLABLE_LIFECYCLE_HOOKS);

function isMatchingSuperCall(node, hook) {
  if (node.type !== 'CallExpression' || node.optional) return false;
  const target = node.callee;
  return (
    target.type === 'MemberExpression' &&
    !target.computed &&
    !target.optional &&
    target.object.type === 'Super' &&
    target.property.type === 'Identifier' &&
    target.property.name === hook
  );
}

function childNodes(node) {
  return (visitorKeys[node.type] ?? []).flatMap((key) => {
    const child = node[key];
    if (Array.isArray(child)) return child.filter(Boolean);
    return child ? [child] : [];
  });
}

function statementAlwaysStopsFollowingStatements(statement) {
  if (
    statement.type === 'ReturnStatement' ||
    statement.type === 'ThrowStatement' ||
    statement.type === 'BreakStatement' ||
    statement.type === 'ContinueStatement'
  ) {
    return true;
  }
  if (statement.type === 'BlockStatement') {
    return statement.body.some((child) => statementAlwaysStopsFollowingStatements(child));
  }
  if (statement.type === 'TryStatement') {
    // A completing finally controls whether execution can continue after the try statement. When
    // it falls through, an abrupt try still stays abrupt unless a catch can handle the throw. A
    // return cannot be caught; conservatively treat every abrupt try body with no catch as final.
    if (statement.finalizer && statementAlwaysStopsFollowingStatements(statement.finalizer)) return true;
    return !statement.handler && statementAlwaysStopsFollowingStatements(statement.block);
  }
  return false;
}

function statementsCallReachableSuper(statements, hook) {
  for (const statement of statements) {
    if (directStatementCallsSuper(statement, hook)) return true;
    if (statementAlwaysStopsFollowingStatements(statement)) return false;
  }
  return false;
}

/** A matching call must be synchronous and unconditional within the hook's own body. Calls buried
 * in a callback, nested declaration, branch, loop, logical short-circuit, or ternary do not keep
 * the superclass lifecycle chain intact on every invocation. */
function directStatementCallsSuper(statement, hook) {
  const visit = (node) => {
    if (isMatchingSuperCall(node, hook)) return true;
    if (node.type === 'BlockStatement') {
      return statementsCallReachableSuper(node.body, hook);
    }
    // The try body always begins synchronously, and a finally body always runs on completion.
    // A catch body alone is conditional on an exception and therefore cannot satisfy the policy.
    if (node.type === 'TryStatement') {
      return visit(node.block) || (node.finalizer ? visit(node.finalizer) : false);
    }
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'ClassDeclaration' ||
      node.type === 'ClassExpression' ||
      node.type === 'IfStatement' ||
      node.type === 'DoWhileStatement' ||
      node.type === 'WhileStatement' ||
      node.type === 'ForStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement' ||
      node.type === 'SwitchStatement' ||
      node.type === 'ConditionalExpression' ||
      node.type === 'LogicalExpression'
    ) {
      return false;
    }
    return childNodes(node).some(visit);
  };
  return visit(statement);
}

/** Returns each explicit lifecycle override that omits its matching `super.<hook>(...)` call. */
export function findLifecycleSuperOmissions(source) {
  const parsed = parseSync('lifecycle-source.ts', source);
  if (parsed.errors.length > 0) {
    throw new SyntaxError(
      `Unable to parse lifecycle source: ${parsed.errors.map(({ message }) => message).join('; ')}`,
    );
  }
  const omissions = [];

  const methodName = (key) => {
    if (key.type === 'Identifier') return key.name;
    if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
    return undefined;
  };

  const visit = (node) => {
    const hook = node.type === 'MethodDefinition' ? methodName(node.key) : undefined;
    if (
      node.type === 'MethodDefinition' &&
      node.override &&
      node.value.body &&
      callableHooks.has(hook)
    ) {
      if (!statementsCallReachableSuper(node.value.body.body, hook)) {
        const line = source.slice(0, node.start).split(/\r?\n/).length;
        omissions.push({ hook, line });
      }
    }
    for (const child of childNodes(node)) visit(child);
  };
  visit(parsed.program);

  return omissions;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function isCheckedSource(file) {
  return (
    file.endsWith('.ts') &&
    !file.endsWith('.d.ts') &&
    !file.endsWith('.test.ts') &&
    !file.endsWith('.stories.ts')
  );
}

export function checkLifecycleSuper(root = sourceRoot) {
  const failures = [];
  for (const file of walk(root).filter(isCheckedSource)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const omission of findLifecycleSuperOmissions(source)) {
      failures.push({
        ...omission,
        file: path.relative(packageDir, file).replaceAll('\\', '/'),
      });
    }
  }
  return failures;
}

function main() {
  const failures = checkLifecycleSuper();
  if (failures.length > 0) {
    console.error('Lifecycle overrides must call their matching callable superclass hook:');
    for (const failure of failures) {
      console.error(`  ${failure.file}:${failure.line} ${failure.hook}()`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Lifecycle superclass policy passed.');
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) main();
