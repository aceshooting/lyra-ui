import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

const components = fileURLToPath(new URL('../src/components/', import.meta.url));
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
const packageRoot = resolve(sourceRoot, '..');

async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await findFiles(path)));
    else if (entry.name.endsWith('.class.ts')) files.push(path);
  }
  return files;
}

function parseProgram(source) {
  const result = parseSync('registration-audit.ts', source);
  if (result.errors.length > 0) {
    const details = result.errors
      .map((error) => error.message ?? String(error))
      .join('\n');
    throw new SyntaxError(`registration architecture parser rejected source:\n${details}`);
  }
  return result.program;
}

const TRANSPARENT_EXPRESSION_TYPES = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSInstantiationExpression',
  'ChainExpression',
]);

function unwrapExpression(node) {
  let current = node;
  while (current && TRANSPARENT_EXPRESSION_TYPES.has(current.type)) {
    current = current.expression;
  }
  return current;
}

function literalValue(node) {
  node = unwrapExpression(node);
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
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

function defineElementBindings(program) {
  const bindings = new Set();
  const namespaces = new Set();
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    const source = literalValue(statement.source);
    if (
      source !== './prefix.js' &&
      !source?.endsWith('/internal/prefix.js')
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.importKind !== 'type' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === 'defineElement'
      ) {
        bindings.add(specifier.local.name);
      } else if (specifier.type === 'ImportNamespaceSpecifier') {
        namespaces.add(specifier.local.name);
      }
    }
  }
  return { bindings, namespaces };
}

function reexportsDefineElement(program) {
  for (const statement of program.body) {
    const source = statement.source ? literalValue(statement.source) : undefined;
    if (
      source !== './prefix.js' &&
      !source?.endsWith('/internal/prefix.js')
    ) {
      continue;
    }
    if (statement.type === 'ExportAllDeclaration' && statement.exportKind !== 'type') {
      return true;
    }
    if (
      statement.type === 'ExportNamedDeclaration' &&
      statement.exportKind !== 'type' &&
      statement.specifiers.some((specifier) =>
        specifier.exportKind !== 'type' &&
        specifier.local.type === 'Identifier' &&
        specifier.local.name === 'defineElement'
      )
    ) {
      return true;
    }
  }
  return false;
}

function collectBindingNames(pattern, names) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') {
    names.add(pattern.name);
  } else if (pattern.type === 'RestElement') {
    collectBindingNames(pattern.argument, names);
  } else if (pattern.type === 'AssignmentPattern') {
    collectBindingNames(pattern.left, names);
  } else if (pattern.type === 'ArrayPattern') {
    for (const element of pattern.elements) collectBindingNames(element, names);
  } else if (pattern.type === 'ObjectPattern') {
    for (const property of pattern.properties) {
      collectBindingNames(property.type === 'Property' ? property.value : property.argument, names);
    }
  }
}

function collectDirectBlockBindings(block) {
  const names = new Set();
  for (const statement of block.body) {
    if (statement.type === 'VariableDeclaration') {
      for (const declaration of statement.declarations) collectBindingNames(declaration.id, names);
    } else if (
      (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
      statement.id
    ) {
      names.add(statement.id.name);
    }
  }
  return names;
}

function collectFunctionVarBindings(node, names, root = node) {
  if (!node || typeof node !== 'object') return;
  if (
    node !== root &&
    (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'ClassDeclaration' ||
      node.type === 'ClassExpression' ||
      node.type === 'StaticBlock'
    )
  ) {
    return;
  }
  if (node.type === 'VariableDeclaration' && node.kind === 'var') {
    for (const declaration of node.declarations) collectBindingNames(declaration.id, names);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) collectFunctionVarBindings(child, names, root);
    } else if (value && typeof value === 'object') {
      collectFunctionVarBindings(value, names, root);
    }
  }
}

function propertyName(node) {
  const property = node.type === 'Property' ? node.key : node.property;
  if (node.computed) return literalValue(property);
  return property?.type === 'Identifier' ? property.name : undefined;
}

function isNamespaceReference(node, namespaces) {
  node = unwrapExpression(node);
  if (node?.type === 'SequenceExpression') {
    return isNamespaceReference(node.expressions.at(-1), namespaces);
  }
  return node?.type === 'Identifier' && namespaces.has(node.name);
}

function isRegistrarReference(node, bindings, namespaces) {
  node = unwrapExpression(node);
  if (node?.type === 'SequenceExpression') {
    return isRegistrarReference(node.expressions.at(-1), bindings, namespaces);
  }
  if (node?.type === 'Identifier') return bindings.has(node.name);
  if (node?.type !== 'MemberExpression') return false;
  const object = unwrapExpression(node.object);
  return (
    object?.type === 'Identifier' &&
    namespaces.has(object.name) &&
    propertyName(node) === 'defineElement'
  );
}

/**
 * Returns whether a runtime expression contains the registrar capability. This is deliberately
 * narrower than a generic AST walk: object property names and non-computed member names are not
 * values, while object property values, array elements, spreads, and computed operands are.
 */
function containsRegistrarCapability(node, bindings, namespaces) {
  node = unwrapExpression(node);
  if (!node) return false;
  if (
    isRegistrarReference(node, bindings, namespaces) ||
    isNamespaceReference(node, namespaces)
  ) {
    return true;
  }
  if (node.type === 'SpreadElement') {
    return containsRegistrarCapability(node.argument, bindings, namespaces);
  }
  if (node.type === 'SequenceExpression' || node.type === 'ArrayExpression') {
    const expressions = node.type === 'SequenceExpression' ? node.expressions : node.elements;
    return expressions.some((expression) =>
      expression && containsRegistrarCapability(expression, bindings, namespaces)
    );
  }
  if (node.type === 'ObjectExpression') {
    return node.properties.some((property) => {
      if (property.type === 'SpreadElement') {
        return containsRegistrarCapability(property.argument, bindings, namespaces);
      }
      return containsRegistrarCapability(property.value, bindings, namespaces);
    });
  }
  if (node.type === 'MemberExpression') {
    const object = unwrapExpression(node.object);
    // Accessing an unrelated member of the imported prefix namespace is not an escape. A direct
    // `prefix.defineElement` member was already recognized by isRegistrarReference() above.
    if (!isNamespaceReference(object, namespaces)) {
      if (containsRegistrarCapability(object, bindings, namespaces)) return true;
    }
    return Boolean(
      node.computed &&
      containsRegistrarCapability(node.property, bindings, namespaces)
    );
  }
  if (node.type === 'CallExpression' || node.type === 'NewExpression') {
    return (
      containsRegistrarCapability(node.callee, bindings, namespaces) ||
      node.arguments.some((argument) =>
        containsRegistrarCapability(argument, bindings, namespaces)
      )
    );
  }
  if (
    node.type === 'AssignmentExpression' ||
    node.type === 'BinaryExpression' ||
    node.type === 'LogicalExpression'
  ) {
    return (
      containsRegistrarCapability(node.left, bindings, namespaces) ||
      containsRegistrarCapability(node.right, bindings, namespaces)
    );
  }
  if (node.type === 'ConditionalExpression') {
    return (
      containsRegistrarCapability(node.test, bindings, namespaces) ||
      containsRegistrarCapability(node.consequent, bindings, namespaces) ||
      containsRegistrarCapability(node.alternate, bindings, namespaces)
    );
  }
  if (
    node.type === 'AwaitExpression' ||
    node.type === 'UnaryExpression' ||
    node.type === 'UpdateExpression' ||
    node.type === 'YieldExpression'
  ) {
    return containsRegistrarCapability(node.argument, bindings, namespaces);
  }
  if (node.type === 'TaggedTemplateExpression') {
    return (
      containsRegistrarCapability(node.tag, bindings, namespaces) ||
      node.quasi.expressions.some((expression) =>
        containsRegistrarCapability(expression, bindings, namespaces)
      )
    );
  }
  if (node.type === 'TemplateLiteral') {
    return node.expressions.some((expression) =>
      containsRegistrarCapability(expression, bindings, namespaces)
    );
  }
  return false;
}

function directVariableDeclarations(statements) {
  return statements
    .filter((statement) => statement.type === 'VariableDeclaration')
    .flatMap((statement) => statement.declarations);
}

function addRegistrarAliases(declarations, bindings, namespaces) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      if (!declaration.init) continue;
      if (declaration.id.type === 'Identifier') {
        if (
          isRegistrarReference(declaration.init, bindings, namespaces) &&
          !bindings.has(declaration.id.name)
        ) {
          bindings.add(declaration.id.name);
          changed = true;
        } else if (
          isNamespaceReference(declaration.init, namespaces) &&
          !namespaces.has(declaration.id.name)
        ) {
          namespaces.add(declaration.id.name);
          changed = true;
        }
        continue;
      }
      if (
        declaration.id.type !== 'ObjectPattern' ||
        !isNamespaceReference(declaration.init, namespaces)
      ) {
        continue;
      }
      for (const property of declaration.id.properties) {
        if (
          property.type !== 'Property' ||
          propertyName(property) !== 'defineElement'
        ) {
          continue;
        }
        const value = property.value.type === 'AssignmentPattern'
          ? property.value.left
          : property.value;
        if (value.type === 'Identifier' && !bindings.has(value.name)) {
          bindings.add(value.name);
          changed = true;
        }
      }
    }
  }
}

function scopedBindings(statements, parentBindings, parentNamespaces) {
  const bindings = new Set(parentBindings);
  const namespaces = new Set(parentNamespaces);
  const block = { body: statements };
  for (const name of collectDirectBlockBindings(block)) {
    bindings.delete(name);
    namespaces.delete(name);
  }
  addRegistrarAliases(directVariableDeclarations(statements), bindings, namespaces);
  return { bindings, namespaces };
}

function programRegistersElement(program) {
  const imported = defineElementBindings(program);
  if (reexportsDefineElement(program)) return true;
  if (imported.bindings.size === 0 && imported.namespaces.size === 0) return false;
  let found = false;

  const walkBindingInitializers = (pattern, bindings, namespaces) => {
    if (found || !pattern) return;
    if (pattern.type === 'TSParameterProperty') {
      walkBindingInitializers(pattern.parameter, bindings, namespaces);
    } else if (pattern.type === 'AssignmentPattern') {
      walk(pattern.right, bindings, namespaces);
      walkBindingInitializers(pattern.left, bindings, namespaces);
    } else if (pattern.type === 'RestElement') {
      walkBindingInitializers(pattern.argument, bindings, namespaces);
    } else if (pattern.type === 'ArrayPattern') {
      for (const element of pattern.elements) {
        walkBindingInitializers(element, bindings, namespaces);
      }
    } else if (pattern.type === 'ObjectPattern') {
      for (const property of pattern.properties) {
        if (property.type === 'RestElement') {
          walkBindingInitializers(property.argument, bindings, namespaces);
          continue;
        }
        if (property.computed) walk(property.key, bindings, namespaces);
        walkBindingInitializers(property.value, bindings, namespaces);
      }
    }
  };

  const walk = (node, bindings, namespaces) => {
    if (found || !node || typeof node !== 'object') return;
    if (
      node.type === 'VariableDeclarator' &&
      node.init &&
      containsRegistrarCapability(node.init, bindings, namespaces)
    ) {
      // Aliasing the registrar (including exporting that alias later) is itself an unsafe
      // registration-capability edge. Treat it fail-closed instead of requiring every downstream
      // import/export spelling to reproduce the alias dataflow.
      found = true;
      return;
    }
    if (
      node.type === 'AssignmentExpression' &&
      containsRegistrarCapability(node.right, bindings, namespaces)
    ) {
      found = true;
      return;
    }
    if (
      node.type === 'ExportNamedDeclaration' &&
      !node.source &&
      node.specifiers.some((specifier) =>
        specifier.exportKind !== 'type' &&
        (
          isRegistrarReference(specifier.local, bindings, namespaces) ||
          isNamespaceReference(specifier.local, namespaces)
        )
      )
    ) {
      found = true;
      return;
    }
    if (
      node.type === 'ExportDefaultDeclaration' &&
      containsRegistrarCapability(node.declaration, bindings, namespaces)
    ) {
      found = true;
      return;
    }
    if (
      node.type === 'ReturnStatement' &&
      node.argument &&
      containsRegistrarCapability(node.argument, bindings, namespaces)
    ) {
      found = true;
      return;
    }
    if (
      node.type === 'CallExpression' &&
      (
        containsRegistrarCapability(node.callee, bindings, namespaces) ||
        (
          unwrapExpression(node.callee)?.type === 'MemberExpression' &&
          ['apply', 'bind', 'call'].includes(propertyName(unwrapExpression(node.callee)) ?? '') &&
          isRegistrarReference(
            unwrapExpression(node.callee).object,
            bindings,
            namespaces,
          )
        )
        ||
        node.arguments.some((argument) =>
          containsRegistrarCapability(argument, bindings, namespaces)
        )
      )
    ) {
      found = true;
      return;
    }
    if (
      (node.type === 'PropertyDefinition' || node.type === 'AccessorProperty') &&
      node.value &&
      containsRegistrarCapability(node.value, bindings, namespaces)
    ) {
      found = true;
      return;
    }

    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      const parameterBindings = new Set(bindings);
      const parameterNamespaces = new Set(namespaces);
      const parameterNames = new Set();
      if (node.id) parameterNames.add(node.id.name);
      for (const parameter of node.params) collectBindingNames(parameter, parameterNames);
      for (const name of parameterNames) {
        parameterBindings.delete(name);
        parameterNamespaces.delete(name);
      }

      const functionBindings = new Set(bindings);
      const functionNamespaces = new Set(namespaces);
      const localNames = new Set(parameterNames);
      collectFunctionVarBindings(node.body, localNames);
      for (const name of localNames) {
        functionBindings.delete(name);
        functionNamespaces.delete(name);
      }
      for (const parameter of node.params) {
        walkBindingInitializers(parameter, parameterBindings, parameterNamespaces);
      }
      if (
        !found &&
        node.type === 'ArrowFunctionExpression' &&
        node.body.type !== 'BlockStatement' &&
        containsRegistrarCapability(node.body, functionBindings, functionNamespaces)
      ) {
        found = true;
        return;
      }
      walk(node.body, functionBindings, functionNamespaces);
      return;
    }

    if (node.type === 'SwitchStatement') {
      walk(node.discriminant, bindings, namespaces);
      const statements = node.cases.flatMap((switchCase) => switchCase.consequent);
      const scoped = scopedBindings(statements, bindings, namespaces);
      for (const switchCase of node.cases) {
        walk(switchCase.test, scoped.bindings, scoped.namespaces);
        for (const statement of switchCase.consequent) {
          walk(statement, scoped.bindings, scoped.namespaces);
        }
      }
      return;
    }

    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      const classBindings = new Set(bindings);
      const classNamespaces = new Set(namespaces);
      if (node.id) {
        classBindings.delete(node.id.name);
        classNamespaces.delete(node.id.name);
      }
      walk(node.superClass, bindings, namespaces);
      walk(node.body, classBindings, classNamespaces);
      return;
    }

    if (node.type === 'BlockStatement') {
      const scoped = scopedBindings(node.body, bindings, namespaces);
      for (const statement of node.body) {
        walk(statement, scoped.bindings, scoped.namespaces);
      }
      return;
    }

    if (node.type === 'StaticBlock') {
      const scoped = scopedBindings(node.body, bindings, namespaces);
      for (const statement of node.body) {
        walk(statement, scoped.bindings, scoped.namespaces);
      }
      return;
    }

    if (node.type === 'CatchClause') {
      const catchBindings = new Set(bindings);
      const catchNamespaces = new Set(namespaces);
      const catchNames = new Set();
      collectBindingNames(node.param, catchNames);
      for (const name of catchNames) {
        catchBindings.delete(name);
        catchNamespaces.delete(name);
      }
      walk(node.body, catchBindings, catchNamespaces);
      return;
    }

    if (
      node.type === 'ForStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement'
    ) {
      const loopBindings = new Set(bindings);
      const loopNamespaces = new Set(namespaces);
      const declaration = node.type === 'ForStatement' ? node.init : node.left;
      if (declaration?.type === 'VariableDeclaration') {
        const loopNames = new Set();
        for (const item of declaration.declarations) {
          collectBindingNames(item.id, loopNames);
        }
        for (const name of loopNames) {
          loopBindings.delete(name);
          loopNamespaces.delete(name);
        }
        addRegistrarAliases(declaration.declarations, loopBindings, loopNamespaces);
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === 'start' || key === 'end') continue;
        if (Array.isArray(value)) {
          for (const child of value) walk(child, loopBindings, loopNamespaces);
        } else if (value && typeof value === 'object') {
          walk(value, loopBindings, loopNamespaces);
        }
      }
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'start' || key === 'end') continue;
      if (Array.isArray(value)) {
        for (const child of value) walk(child, bindings, namespaces);
      } else if (value && typeof value === 'object') {
        walk(value, bindings, namespaces);
      }
    }
  };

  const root = scopedBindings(program.body, imported.bindings, imported.namespaces);
  for (const statement of program.body) {
    walk(statement, root.bindings, root.namespaces);
  }
  return found;
}

function moduleSpecifiers(source) {
  const eager = [];
  const dynamic = [];
  const program = parseProgram(source);

  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      const specifier = literalValue(statement.source);
      const hasRuntimeBindings =
        statement.importKind !== 'type' &&
        (
          statement.specifiers.length === 0 ||
          statement.specifiers.some((binding) => binding.importKind !== 'type')
        );
      if (specifier?.startsWith('.') && hasRuntimeBindings) eager.push(specifier);
    } else if (statement.type === 'ExportNamedDeclaration' && statement.source) {
      const specifier = literalValue(statement.source);
      const hasRuntimeBindings =
        statement.exportKind !== 'type' &&
        (
          statement.specifiers.length === 0 ||
          statement.specifiers.some((binding) => binding.exportKind !== 'type')
        );
      if (specifier?.startsWith('.') && hasRuntimeBindings) eager.push(specifier);
    } else if (statement.type === 'ExportAllDeclaration') {
      const specifier = literalValue(statement.source);
      if (specifier?.startsWith('.') && statement.exportKind !== 'type') eager.push(specifier);
    }
  }

  visitAst(program, (node) => {
    if (node.type !== 'ImportExpression') return;
    const specifier = literalValue(node.source);
    if (specifier?.startsWith('.')) dynamic.push(specifier);
  });

  return {
    eager: [...new Set(eager)],
    dynamic: [...new Set(dynamic)],
  };
}

/**
 * Returns relative module specifiers that survive TypeScript's
 * `verbatimModuleSyntax` emit. Type-only imports/re-exports are deliberately
 * absent because they cannot execute a registration entry.
 */
export function runtimeRelativeSpecifiers(source) {
  return moduleSpecifiers(source).eager;
}

/** Returns relative literal dynamic-import specifiers for separate lazy-registration auditing. */
export function dynamicRelativeSpecifiers(source) {
  return moduleSpecifiers(source).dynamic;
}

function resolveRuntimeSpecifier(fromFile, specifier, modules) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = base.endsWith('.js')
    ? [base.replace(/\.js$/, '.ts')]
    : [`${base}.ts`, join(base, 'index.ts')];
  return candidates.find((candidate) => modules.has(candidate));
}

/**
 * Finds every runtime import path from a class module to the first module
 * that calls `defineElement()`. The map-shaped input keeps the graph logic
 * independently testable without creating fixture files in the repository.
 */
export function findTransitiveRegistrationPaths(classFiles, modules, options = {}) {
  const graph = new Map();
  const registering = new Set();
  for (const [file, source] of modules) {
    const program = parseProgram(source);
    if (programRegistersElement(program)) registering.add(file);
    const analysis = moduleSpecifiers(source);
    const specifiers = analysis.eager;
    if (options.includeDynamic) specifiers.push(...analysis.dynamic);
    graph.set(
      file,
      [...new Set(specifiers)]
        .map((specifier) => resolveRuntimeSpecifier(file, specifier, modules))
        .filter(Boolean),
    );
  }

  const paths = [];
  for (const classFile of classFiles) {
    const visit = (file, path, seen) => {
      if (registering.has(file)) {
        paths.push(path);
        return;
      }
      for (const dependency of graph.get(file) ?? []) {
        if (seen.has(dependency)) continue;
        visit(dependency, [...path, dependency], new Set([...seen, dependency]));
      }
    };
    visit(classFile, [classFile], new Set([classFile]));
  }
  return paths;
}

function collectSourceFiles(directory, output = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      collectSourceFiles(path, output);
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.stories.ts') &&
      !entry.endsWith('.d.ts')
    ) {
      output.push(path);
    }
  }
  return output;
}

async function checkRegistrationArchitecture() {
  const classFiles = await findFiles(components);
  assert.ok(classFiles.length >= 80, 'expected pure class modules for the component families');
  const sourceFiles = collectSourceFiles(sourceRoot);
  const modules = new Map(sourceFiles.map((file) => [file, readFileSync(file, 'utf8')]));
  const registrationPaths = findTransitiveRegistrationPaths(classFiles, modules);
  const pathKey = (path) => path.map((file) => relative(packageRoot, file)).join(' -> ');
  const eagerPathKeys = new Set(registrationPaths.map(pathKey));
  const lazyRegistrationPaths = findTransitiveRegistrationPaths(classFiles, modules, {
    includeDynamic: true,
  })
    .map(pathKey)
    .filter((path) => !eagerPathKeys.has(path))
    .sort();
  assert.deepEqual(
    lazyRegistrationPaths,
    [
      'src/components/forms/phone-input/phone-input.class.ts -> src/components/media/flag/flag.ts',
    ],
    'lazy registration edges must remain limited to the documented opt-in flag loader',
  );
  assert.equal(
    registrationPaths.length,
    0,
    `class modules must not reach registration entries at runtime:\n${registrationPaths
      .map((path) => `  ${pathKey(path)}`)
      .join('\n')}`,
  );

  console.log(`registration architecture verified: ${classFiles.length} pure class modules`);

  const rootBarrel = await readFile(join(sourceRoot, 'lyra.ts'), 'utf8');
  const allowlist = await readFile(join(sourceRoot, 'internal', 'root-registration-allowlist.ts'), 'utf8');
  const rootBlock = allowlist.match(/ROOT_BARREL_TAGS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  assert.ok(rootBlock, 'root registration allowlist must define ROOT_BARREL_TAGS');
  const expectedRootTags = [...rootBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  const optionalBlock = allowlist.match(/ROOT_BARREL_OPTIONAL_PEER_TAGS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  assert.ok(optionalBlock, 'root registration allowlist must define ROOT_BARREL_OPTIONAL_PEER_TAGS');
  const expectedOptionalTags = [...optionalBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  const importedRootTags = [
    ...rootBarrel.matchAll(/^import '\.\/components\/(?:[^/\n]+\/)*([^']+)\.js';$/gm),
  ]
    .map((match) => match[1])
    .filter((moduleName) => !moduleName.endsWith('-register'))
    .map((moduleName) => `lr-${moduleName}`);
  if (rootBarrel.includes("export { LyraFlag } from './components/media/flag/flag.js';")) {
    importedRootTags.push('lr-flag');
  }
  assert.deepEqual(
    [...new Set(importedRootTags)].sort(),
    expectedRootTags,
    'root barrel imports must match ROOT_BARREL_TAGS',
  );

  const manifest = JSON.parse(readFileSync(join(sourceRoot, '..', 'custom-elements.json'), 'utf8'));
  const manifestTags = manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .filter((declaration) => declaration.customElement && declaration.tagName)
    .map((declaration) => declaration.tagName)
    .filter((tag, index, tags) => tags.indexOf(tag) === index)
    .sort();
  assert.deepEqual(
    [...expectedRootTags, ...expectedOptionalTags].sort(),
    manifestTags,
    'root registration allowlist must cover every manifest custom element exactly once',
  );

  console.log(`root registration allowlist verified: ${expectedRootTags.length} tags`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkRegistrationArchitecture();
}
