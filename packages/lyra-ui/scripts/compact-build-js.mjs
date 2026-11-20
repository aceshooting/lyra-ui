import { isMainModule } from './is-main-module.mjs';

import { existsSync } from 'node:fs';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { parseProgram, visitAst } from './lib/ast.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const requireFromPackage = createRequire(path.join(packageDir, 'package.json'));
const requireFromLoaderHost = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'));
const esbuild = requireFromLoaderHost('esbuild');
const { parseFragment } = createRequire(requireFromPackage.resolve('@lit-labs/ssr'))('parse5');

// These self-contained functions are serialized with Function#toString for the pre-paint script.
// Compact their local bindings before the ordinary module pass. A script transform (no module
// format) retains each declaration
// name and free identifier, so surrounding imports/exports and callback defaults stay intact.
const serializedFunctions = new Map([
  ['theme/theme.js', new Set(['applyStoredThemeBeforePaint', 'applyStoredStyleBeforePaint', 'styleTokenAllowed', 'styleMaterial'])],
  ['theme/startup-resolution.js', new Set(['resolveStyleStartup'])],
  ['theme/style-ownership.js', new Set(['readStyleOwnership'])],
]);

// The public export names survive identifier minification; local variable/function names do not.
// Restore only reviewed zero-argument calls and exact inert object freezes.
const pureInitializers = new Map([
  ['theme/theme.js', [{ exported: 'lyraThemeBootstrap', callee: 'createLyraThemeBootstrap' }]],
  ['internal/collection-snapshot.js', [
    { exported: 'collectionSupport', frozenProperties: [
      ['installProperties', 'installOwnedCollectionAccessors'], ['snapshotEvent', 'snapshotEnrolledEventDetail'],
    ] },
    { exported: 'eventCollectionSupport', frozenProperties: [
      ['installProperties', null], ['snapshotEvent', 'snapshotEnrolledEventDetail'],
    ] },
  ]],
]);

// Production diagnostics are reviewed no-ops. Marking each declaration side-effect free lets a
// consumer bundler drop every call, and the warning text passed to it, from production output.
const sideEffectFreeFunctions = new Map([
  ['internal/dev-warning.production.js', ['litDevWarnings', 'devWarn', 'devWarnOnce', 'warnLocaleFallback', 'warnDeprecatedUsage']],
  ['internal/dev-mode-attribute-warning.production.js', ['warnUnknownAttributes', 'warnThemeScopeUsage']],
]);
const NO_SIDE_EFFECTS = '/* @__NO_SIDE_EFFECTS__ */';

function restoreSideEffectFreeAnnotations(code, relativePath) {
  const names = sideEffectFreeFunctions.get(relativePath.split(path.sep).join('/'));
  if (!names) return code;
  const parsed = parseSync(relativePath, code);
  if (parsed.errors.length) throw new Error(`${relativePath}: cannot parse side-effect-free inventory`);
  const bindings = exportedBindings(parsed.program);
  const positions = [];
  for (const name of names) {
    const matches = parsed.program.body.map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node)
      .filter(node => node?.type === 'FunctionDeclaration' && node.id?.name === bindings.get(name));
    // Only an exported, synchronous declaration with an empty body is inert by construction.
    if (matches.length !== 1 || matches[0].async || matches[0].generator || matches[0].body.body.length !== 0) {
      throw new Error(`${relativePath}: side-effect-free function inventory changed`);
    }
    if (!code.slice(0, matches[0].start).trimEnd().endsWith(NO_SIDE_EFFECTS)) positions.push(matches[0].start);
  }
  for (const position of positions.sort((a, b) => b - a)) {
    code = code.slice(0, position) + NO_SIDE_EFFECTS + code.slice(position);
  }
  return code;
}

function exportedBindings(program) {
  const bindings = new Map();
  for (const node of program.body) {
    if (node.type !== 'ExportNamedDeclaration' || node.source) continue;
    if (node.declaration?.id) bindings.set(node.declaration.id.name, node.declaration.id.name);
    for (const declaration of node.declaration?.declarations ?? []) {
      if (declaration.id.type === 'Identifier') bindings.set(declaration.id.name, declaration.id.name);
    }
    for (const specifier of node.specifiers) {
      bindings.set(specifier.exported.name ?? specifier.exported.value, specifier.local.name);
    }
  }
  return bindings;
}

function isReviewedFrozenObject(initializer, properties, program) {
  const callee = initializer.callee;
  if (callee.type !== 'MemberExpression' || callee.computed || callee.optional ||
    callee.object.type !== 'Identifier' || callee.object.name !== 'Object' ||
    callee.property.type !== 'Identifier' || callee.property.name !== 'freeze' ||
    initializer.arguments.length !== 1) return false;
  const object = initializer.arguments[0];
  if (object.type !== 'ObjectExpression' || object.properties.length !== properties.length) return false;
  // Only an unshadowed built-in and the exact reviewed function declarations are inert here.
  const declarations = program.body.map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node);
  if (program.body.some(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'Object')) ||
    declarations.some(node => node?.id?.name === 'Object' || node?.declarations?.some(item => item.id.type !== 'Identifier' || item.id.name === 'Object'))) return false;
  return properties.every(([name, binding], index) => {
    const property = object.properties[index];
    if (property.type !== 'Property' || property.kind !== 'init' || property.computed ||
      property.key.type !== 'Identifier' || property.key.name !== name) return false;
    if (binding === null) return property.method && property.value.type === 'FunctionExpression' &&
      !property.value.async && !property.value.generator;
    return !property.method && property.value.type === 'Identifier' && property.value.name === binding &&
      declarations.some(node => node?.type === 'FunctionDeclaration' && node.id.name === binding);
  });
}

function restorePureAnnotations(code, relativePath) {
  const inventory = pureInitializers.get(relativePath.split(path.sep).join('/'));
  if (!inventory) return code;
  const parsed = parseSync(relativePath, code);
  if (parsed.errors.length) throw new Error(`${relativePath}: cannot parse pure initializer inventory`);
  const bindings = exportedBindings(parsed.program);
  const declarations = parsed.program.body.flatMap(node =>
    (node.type === 'ExportNamedDeclaration' ? node.declaration : node)?.declarations ?? []);
  const positions = [];
  for (const { exported, callee, frozenProperties } of inventory) {
    const matches = declarations.filter(node => node.id.type === 'Identifier' && node.id.name === bindings.get(exported));
    const initializer = matches[0]?.init;
    if (matches.length !== 1 || initializer?.type !== 'CallExpression' || initializer.optional ||
      (frozenProperties ? !isReviewedFrozenObject(initializer, frozenProperties, parsed.program) :
        initializer.callee.type !== 'Identifier' || !bindings.has(callee) ||
        initializer.callee.name !== bindings.get(callee) || initializer.arguments.length !== 0)) {
      throw new Error(`${relativePath}: pure initializer inventory changed`);
    }
    positions.push(initializer.start);
  }
  for (const position of positions.sort((a, b) => b - a)) {
    code = code.slice(0, position) + '/* @__PURE__ */' + code.slice(position);
  }
  return code;
}

async function compactSerializedFunctions(source, relativePath) {
  const names = serializedFunctions.get(relativePath.split(path.sep).join('/'));
  if (!names) return source;
  const parsed = parseSync(relativePath, source);
  if (parsed.errors.length) throw new Error(`${relativePath}: cannot parse serialized bootstrap functions`);
  const declarations = parsed.program.body.map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node)
    .filter(node => node?.type === 'FunctionDeclaration' && names.has(node.id?.name));
  if (declarations.length !== names.size) throw new Error(`${relativePath}: serialized bootstrap function inventory changed`);
  for (const declaration of declarations.reverse()) {
    const compact = await esbuild.transform(source.slice(declaration.start, declaration.end), {
      loader: 'js', target: 'es2022', minifyIdentifiers: true, minifySyntax: true,
      minifyWhitespace: true, legalComments: 'none', charset: 'utf8', sourcemap: false,
    });
    source = source.slice(0, declaration.start) + compact.code.trimEnd() + source.slice(declaration.end);
  }
  return source;
}

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(fullPath);
    return entry.isFile() && /\.m?js$/u.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}

/** Keep text nodes and attribute values verbatim. Only the HTML parser identifies tag boundaries. */
export function compactLitStartTags(source, filename) {
  if (!source.includes('html`')) return source;
  const program = parseProgram(filename, source);
  const binding = program.body.flatMap(node =>
    node.type === 'ImportDeclaration' && ['lit', 'lit-html'].includes(node.source.value)
      ? node.specifiers : []).find(specifier =>
    specifier.type === 'ImportSpecifier' && specifier.imported.name === 'html' && specifier.local.name === 'html');
  if (!binding) return source;

  const templates = [];
  const references = new Set();
  const tagUses = new Set([binding.imported.start, binding.local.start]);
  visitAst(program, node => {
    if (node.type === 'Identifier' && node.name === 'html') references.add(node.start);
    if (node.type === 'TaggedTemplateExpression' && node.tag.type === 'Identifier' && node.tag.name === 'html') {
      templates.push(node.quasi);
      tagUses.add(node.tag.start);
    }
  });
  // A different lexical binding may read raw template strings. Skip ambiguous modules.
  if ([...references].some(offset => !tagUses.has(offset))) return source;

  const edits = new Map();
  for (const { quasis } of templates) {
    if (quasis.some(chunk => chunk.value.raw !== chunk.value.cooked)) continue;
    let markup = '';
    const spans = quasis.map((chunk, index) => {
      if (index > 0) markup += 'lr-binding-' + index;
      const start = markup.length;
      markup += chunk.value.raw;
      return { start, end: markup.length, sourceStart: chunk.start };
    });
    function compactBefore(offset) {
      const span = spans.find(({ start, end }) => offset >= start && offset <= end);
      if (!span) return;
      let start = offset;
      while (start > span.start && /[\t\n\f\r ]/u.test(markup[start - 1])) start--;
      if (offset - start > 1) {
        edits.set(span.sourceStart + start - span.start, span.sourceStart + offset - span.start);
      }
    }
    function visitElement(node) {
      const tag = node.sourceCodeLocation?.startTag;
      if (tag) {
        for (const location of Object.values(tag.attrs ?? {})) compactBefore(location.startOffset);
        const close = tag.endOffset - 1;
        if (markup[close] === '>') compactBefore(markup[close - 1] === '/' ? close - 1 : close);
      }
      for (const child of node.childNodes ?? []) visitElement(child);
      if (node.content) visitElement(node.content);
    }
    visitElement(parseFragment(markup, { sourceCodeLocationInfo: true }));
  }
  // Nested templates have disjoint quasis, but visit order is independent of source offsets.
  for (const [start, end] of [...edits].sort((left, right) => right[0] - left[0])) {
    source = source.slice(0, start) + ' ' + source.slice(end);
  }
  return source;
}

/** Compacts shipped JavaScript while preserving exported bindings and class/function `.name`.
 * Serialized bootstrap locals are shortened; module bindings keep their names without runtime
 * name setters that would prevent consumer tree-shaking. Declaration documentation
 * stays in `.d.ts`, and the unbundled ESM tree keeps every granular export boundary. */
export async function compactBuildJavaScript(directory) {
  const files = await javascriptFiles(directory);
  let beforeBytes = 0;
  let afterBytes = 0;
  const results = await Promise.allSettled(files.map(async (file) => {
    const source = await readFile(file, 'utf8');
    beforeBytes += Buffer.byteLength(source);
    // Validate before syntax folding can turn a spread or computed key into an inert-looking
    // object, then restore the reviewed annotation again after the printer removes comments.
    const prepared = restorePureAnnotations(
      await compactSerializedFunctions(source, path.relative(directory, file)), path.relative(directory, file));
    const result = await esbuild.transform(prepared, {
      format: 'esm',
      legalComments: 'none',
      loader: 'js',
      // Renaming module bindings with keepNames emits top-level name setters. Consumer bundlers
      // treat those setters as side effects and retain otherwise-unused declarations.
      minifyIdentifiers: false,
      minifySyntax: true,
      minifyWhitespace: true,
      // ES modules are UTF-8; esbuild's default ASCII charset would rewrite every non-ASCII
      // character (most of each translation catalog) as a six-byte `\uXXXX` escape.
      charset: 'utf8',
      sourcemap: false,
      sourcefile: path.relative(directory, file),
      target: 'es2022',
      // Import attributes postdate the es2022 target; without this esbuild strips them, so a
      // JSON import loses `with { type: 'json' }` and native ESM loaders reject it.
      supported: { 'import-attributes': true },
    });
    if (result.map) throw new Error(`${file}: JavaScript compaction unexpectedly produced a map`);
    // A type-only source file (all `import type`/`export type`) compiles to a bare `export {};`
    // module marker with no runtime statements. esbuild's printer drops that empty export clause
    // entirely once asked to minify whitespace, since it exports nothing -- silently turning a
    // real (if inert) ES module into a 0-byte non-module file. Restore the marker whenever a
    // non-empty source would otherwise compact to nothing.
    const code = result.code.trim() === '' && source.trim() !== '' ? 'export {};\n' : restoreSideEffectFreeAnnotations(
      restorePureAnnotations(compactLitStartTags(result.code, file), path.relative(directory, file)), path.relative(directory, file));
    afterBytes += Buffer.byteLength(code);
    await writeFile(file, code);
  }));
  // Finish every sibling write before reporting an error so callers can safely clean up.
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  return { files: files.length, beforeBytes, afterBytes };
}

/** Only a standalone Lit CSS literal can move without importing any sibling runtime or evaluating an expression. */
function staticStyleTemplate(program) {
  if (program.body.length !== 3) return;
  const [dependency, declaration, exported] = program.body;
  const css = dependency.specifiers?.[0];
  const styles = declaration.declarations?.[0];
  const template = styles?.init;
  const binding = exported.specifiers?.[0];
  if (dependency.type === 'ImportDeclaration' && dependency.source.value === 'lit' &&
      dependency.specifiers.length === 1 && css.type === 'ImportSpecifier' &&
      css.imported.name === 'css' && css.local.name === 'css' &&
      declaration.kind === 'const' && declaration.declarations.length === 1 && styles.id.name === 'styles' &&
      template?.type === 'TaggedTemplateExpression' && template.tag.name === 'css' && !template.quasi.expressions.length &&
      exported.type === 'ExportNamedDeclaration' && !exported.source && exported.specifiers.length === 1 &&
      binding.local.name === 'styles' && binding.exported.name === 'styles') return template.quasi;
}

/** Remove unreferenced private ESM markers and fold single-consumer static styles into sibling classes. */
export async function pruneEmptyBuildJavaScript(directory, manifest, { foldStaticStyles = false } = {}) {
  const files = await javascriptFiles(directory);
  const modules = await Promise.all(files.map(async file => {
    const parsed = parseSync(file, await readFile(file, 'utf8'));
    if (parsed.errors.length) throw new Error(`${file}: cannot parse runtime pruning inventory`);
    return { file, program: parsed.program };
  }));
  const candidates = modules.filter(({ program }) => program.body.length === 1 &&
    program.body[0].type === 'ExportNamedDeclaration' && program.body[0].declaration === null &&
    program.body[0].source === null && program.body[0].specifiers.length === 0).map(({ file }) => file);
  const targets = [];
  function collectTargets(value, into = targets, keys = false) {
    if (typeof value === 'string') into.push(value);
    else if (Array.isArray(value)) value.forEach(item => collectTargets(item, into, keys));
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (keys) into.push(key);
        collectTargets(item, into, keys);
      }
    }
  }
  for (const value of [manifest.exports, manifest.imports, manifest.main, manifest.module, manifest.bin]) collectTargets(value);
  collectTargets(manifest.browser, targets, true);
  const sideEffectTargets = [];
  collectTargets(manifest.sideEffects, sideEffectTargets);
  // Package subpath stars substitute arbitrary substrings, including directory separators.
  const targetPatterns = targets.map(target => new RegExp('^' + target.replace(/^\.\//u, '').split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('.*') + '$'));
  const protectedFiles = new Set();
  const styles = new Map();
  const byPath = new Map(modules.map(module => [path.resolve(module.file), module]));
  for (const { file, program } of modules) {
    if (!foldStaticStyles || !file.endsWith('.styles.js') || !path.relative(directory, file).startsWith('components' + path.sep)) continue;
    const template = staticStyleTemplate(program);
    if (template && !existsSync(file.replace(/\.js$/u, '.d.ts'))) {
      styles.set(path.resolve(file), { template, references: new Set() });
    }
  }
  let unknownReference = false;
  function protectReference(file, literal, moduleUrl = false) {
    const specifier = literal.value;
    if (moduleUrl ? /^(?:[a-z][a-z0-9+.-]*:|\/)/iu.test(specifier) : !specifier.startsWith('.')) return;
    const target = path.resolve(path.dirname(file), specifier.split(/[?#]/u)[0]);
    for (const suffix of ['', '.js', '.mjs', '/index.js', '/index.mjs']) {
      protectedFiles.add(target + suffix);
      styles.get(target + suffix)?.references.add(literal);
    }
  }
  for (const { file, program } of modules) {
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      const staticSource = ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) ? node.source : null;
      const dynamicSource = node.type === 'ImportExpression' ? node.source :
        node.type === 'CallExpression' && ((node.callee?.type === 'Identifier' && node.callee.name === 'require') ||
          (node.callee?.type === 'MemberExpression' && node.callee.object?.name === 'require' && node.callee.property?.name === 'resolve')) ? node.arguments[0] : null;
      if (typeof staticSource?.value === 'string') protectReference(file, staticSource);
      if (dynamicSource) {
        if (typeof dynamicSource.value === 'string') protectReference(file, dynamicSource);
        else unknownReference = true;
      }
      // Relative module strings also protect uncommon loader aliases such as requireFromPackage.
      if (typeof node.value === 'string' && /^\.{1,2}\/.*\.m?js(?:[?#].*)?$/u.test(node.value)) protectReference(file, node);
      const base = node.type === 'NewExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'URL' ? node.arguments[1] : null;
      if (base?.type === 'MemberExpression' && base.object?.type === 'MetaProperty' && base.object.meta?.name === 'import' && base.property?.name === 'url') {
        if (typeof node.arguments[0]?.value === 'string') protectReference(file, node.arguments[0], true);
        else unknownReference = true;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === 'parent') continue;
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') visit(value);
      }
    }
    visit(program);
  }
  const removedPaths = [];
  if (unknownReference || manifest.sideEffects === true) return { removedPaths };
  function published(file) {
    const packagePath = path.relative(path.dirname(directory), file).split(path.sep).join('/');
    return targetPatterns.some(pattern => pattern.test(packagePath)) ||
      sideEffectTargets.some(target => path.posix.matchesGlob(packagePath, target.replace(/^\.\//u, '')));
  }
  for (const [file, { template, references }] of styles) {
    if (references.size !== 1 || published(file)) continue;
    const consumer = byPath.get(file.replace(/\.styles\.js$/u, '.class.js'));
    const imported = consumer?.program.body.find(node => node.type === 'ImportDeclaration' &&
      references.has(node.source) && node.source.value === './' + path.basename(file) && !node.attributes?.length && node.specifiers.length === 1 &&
      node.specifiers[0].type === 'ImportSpecifier' && node.specifiers[0].imported.name === 'styles');
    if (!imported || consumer.program.body.some(node => node.start < imported.start && node.type !== 'ImportDeclaration')) continue;
    const source = await readFile(consumer.file, 'utf8');
    if (source.includes('lyraStaticStyleCss')) continue;
    const literal = (await readFile(file, 'utf8')).slice(template.start, template.end);
    const folded = 'import{css as lyraStaticStyleCss}from"lit";const ' +
      imported.specifiers[0].local.name + '=lyraStaticStyleCss' + literal + ';';
    await writeFile(consumer.file, source.slice(0, imported.start) + folded + source.slice(imported.end));
    await rm(file);
    removedPaths.push(path.relative(directory, file).split(path.sep).join('/'));
  }
  for (const file of candidates.sort()) {
    if (protectedFiles.has(path.resolve(file)) || published(file)) continue;
    await rm(file);
    removedPaths.push(path.relative(directory, file).split(path.sep).join('/'));
  }
  return { removedPaths };
}

if (isMainModule(import.meta.url)) {
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(packageDir, 'dist');
  const result = await compactBuildJavaScript(directory);
  console.log(
    `Compacted ${result.files} JavaScript modules: ${result.beforeBytes.toLocaleString('en')} -> ` +
      `${result.afterBytes.toLocaleString('en')} bytes.`,
  );
}
