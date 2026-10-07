import { parseSync } from 'oxc-parser';
import path from 'node:path';

/** Resolve only stylesheet bindings a component actually adopts and interpolates. */
export function collectStyleSources(entry, readSource) {
  const result = new Map();
  const visited = new Set();
  const visit = (file, binding = '*') => {
    const key = `${file}#${binding}`;
    if (visited.has(key)) return;
    visited.add(key);
    const text = readSource(file);
    if (text === undefined) return;
    const parsed = parseSync(file, text);
    if (parsed.errors.length) throw new Error(`Cannot inspect stylesheet composition in ${file}: ${parsed.errors[0].message}`);
    const source = parsed.program;
    const wildcardExports = [];
    const imports = new Map();
    const declarations = new Map();
    const targetFor = (specifier) => path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)).replace(/\.js$/, '.ts');
    for (const statement of source.body) {
      if (statement.type === 'ImportDeclaration' && statement.source.value.endsWith('.styles.js')) {
        for (const item of statement.specifiers) imports.set(item.local.name, [targetFor(statement.source.value), item.type === 'ImportDefaultSpecifier' ? 'default' : item.type === 'ImportNamespaceSpecifier' ? '<namespace>' : item.imported?.name]);
      }
      const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
      if (declaration?.type === 'FunctionDeclaration' && declaration.id) declarations.set(declaration.id.name, declaration.body);
      if (declaration?.type === 'VariableDeclaration') {
        for (const item of declaration.declarations) if (item.id.type === 'Identifier' && item.init) declarations.set(item.id.name, item.init);
      }
      if (statement.type === 'ExportAllDeclaration' && statement.source.value.endsWith('.styles.js')) wildcardExports.push(targetFor(statement.source.value));
      if (statement.type === 'ExportDefaultDeclaration') declarations.set('default', statement.declaration);
      if (statement.type === 'ExportNamedDeclaration' && statement.source?.value.endsWith('.styles.js')) {
        for (const item of statement.specifiers) imports.set(item.exported.name, [targetFor(statement.source.value), item.local.name]);
      }
    }
    const seenNames = new Set();
    const inspect = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'Identifier') {
        if (seenNames.has(node.name)) return;
        seenNames.add(node.name);
        const imported = imports.get(node.name);
        // Keep the coverage gate's component-sheet scope: common class-level vocabulary
        // sheets are documented separately from fragments adopted by a component sheet.
        if (imported && (file !== entry || path.posix.dirname(imported[0]) === path.posix.dirname(entry))) visit(...imported);
        else if (declarations.has(node.name)) inspect(declarations.get(node.name));
      }
      if (node.type === 'TaggedTemplateExpression' && node.tag.name === 'css') {
        // Template quasis contain CSS, while expressions link to the composed fragments.
        result.set(file, `${result.get(file) ?? ''}\n${node.quasi.quasis.map((item) => item.value.raw).join('\n')}`);
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(inspect);
        else if (value && typeof value === 'object') inspect(value);
      }
    };
    if (binding === '<namespace>') throw new Error(`Namespace stylesheet composition needs explicit coverage support: ${file}`);
    if (binding === '*') {
      for (const statement of source.body) {
        const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
        if (declaration?.type === 'ClassDeclaration') {
          for (const member of declaration.body.body) if (member.static && member.key?.name === 'styles' && member.value) inspect(member.value);
        }
      }
    } else if (imports.has(binding)) visit(...imports.get(binding));
    else if (declarations.has(binding)) inspect(declarations.get(binding));
    else if (wildcardExports.length) throw new Error(`Wildcard stylesheet re-exports need explicit coverage support: ${file} (${binding})`);
    else throw new Error(`Cannot resolve stylesheet binding ${binding} in ${file}`);
  };
  visit(entry);
  return result;
}

export function declaredStyleTokens(text) {
  return new Set([...text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').matchAll(/(--lr-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
}

/**
 * Custom properties an imported shared sheet exposes to the components that compose it: every
 * `var(--lr-…)` it reads that it does not also declare itself.
 *
 * The "reads but never declares" shape is exactly what makes a property a consumer hook — a sheet
 * that declares `--lr-form-control-height-m` before reading it is resolving its own plumbing, while
 * `--lr-form-control-required-content` is read through an inline fallback precisely so a consumer
 * can set it. Shared tokens and the `--lr-theme-*` override layer are excluded as everywhere else.
 *
 * Comments are stripped first: these sheets carry long rationale blocks that quote token names and
 * whole `var()` expressions in prose (`internal/tokens.styles.ts`'s REQUIRED_MARKER note), and a
 * quoted name is not a read.
 */
export function sharedStyleHooks(source, isSharedToken) {
  const internal = new Set([...source.matchAll(/@internalcssprop\s+(--lr-[a-z0-9-]+)/g)].map((match) => match[1]));
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const declared = new Set([...text.matchAll(/(--lr-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const hooks = new Set();
  for (const m of text.matchAll(/var\(\s*(--lr-[a-z0-9-]+)/g)) {
    const token = m[1];
    if (internal.has(token)) continue;
    if (isSharedToken(token) || token.startsWith('--lr-theme-') || declared.has(token)) continue;
    hooks.add(token);
  }
  return hooks;
}
