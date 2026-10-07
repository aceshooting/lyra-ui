import { isMainModule } from './is-main-module.mjs';

import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const requireFromPackage = createRequire(path.join(packageDir, 'package.json'));
const requireFromLoaderHost = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'));
const esbuild = requireFromLoaderHost('esbuild');

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
// Restore only the reviewed zero-argument initializer after resolving both public bindings.
const pureInitializers = new Map([['theme/theme.js', [
  { exported: 'lyraThemeBootstrap', callee: 'createLyraThemeBootstrap' },
]]]);

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

function restorePureAnnotations(code, relativePath) {
  const inventory = pureInitializers.get(relativePath.split(path.sep).join('/'));
  if (!inventory) return code;
  const parsed = parseSync(relativePath, code);
  if (parsed.errors.length) throw new Error(`${relativePath}: cannot parse pure initializer inventory`);
  const bindings = exportedBindings(parsed.program);
  const declarations = parsed.program.body.flatMap(node =>
    (node.type === 'ExportNamedDeclaration' ? node.declaration : node)?.declarations ?? []);
  const positions = [];
  for (const { exported, callee } of inventory) {
    const matches = declarations.filter(node => node.id.type === 'Identifier' && node.id.name === bindings.get(exported));
    const initializer = matches[0]?.init;
    if (matches.length !== 1 || initializer?.type !== 'CallExpression' || initializer.optional ||
      initializer.callee.type !== 'Identifier' || !bindings.has(callee) ||
      initializer.callee.name !== bindings.get(callee) || initializer.arguments.length !== 0) {
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
  const functions = parsed.program.body.map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node)
    .filter(node => node?.type === 'FunctionDeclaration');
  const bindings = exportedBindings(parsed.program);
  // A repeated pass sees esbuild's short local names and its keepNames calls. Those calls retain
  // each original function name, including private serialized functions with no public export.
  for (const node of parsed.program.body) {
    const call = node.type === 'ExpressionStatement' ? node.expression : null;
    if (call?.type !== 'CallExpression' || call.arguments.length !== 2) continue;
    const [binding, name] = call.arguments;
    if (binding.type === 'Identifier' && typeof name.value === 'string' && names.has(name.value) &&
      functions.some(declaration => declaration.id?.name === binding.name)) {
      if (bindings.has(name.value) && bindings.get(name.value) !== binding.name) {
        throw new Error(`${relativePath}: ambiguous serialized bootstrap function`);
      }
      bindings.set(name.value, binding.name);
    }
  }
  const declarations = functions.filter(node =>
    names.has(node.id?.name) || [...names].some(name => bindings.get(name) === node.id?.name));
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

/** Compacts shipped JavaScript while preserving exported bindings and class/function `.name`.
 * Local identifiers may be shortened; properties are never mangled. Declaration documentation
 * stays in `.d.ts`, and the unbundled ESM tree keeps every granular export boundary. */
export async function compactBuildJavaScript(directory) {
  const files = await javascriptFiles(directory);
  let beforeBytes = 0;
  let afterBytes = 0;
  await Promise.all(files.map(async (file) => {
    const source = await readFile(file, 'utf8');
    beforeBytes += Buffer.byteLength(source);
    const prepared = await compactSerializedFunctions(source, path.relative(directory, file));
    const result = await esbuild.transform(prepared, {
      format: 'esm',
      legalComments: 'none',
      loader: 'js',
      minifyIdentifiers: true,
      keepNames: true,
      minifySyntax: true,
      minifyWhitespace: true,
      // ES modules are UTF-8; esbuild's default ASCII charset would rewrite every non-ASCII
      // character (most of each translation catalog) as a six-byte `\uXXXX` escape.
      charset: 'utf8',
      sourcemap: false,
      sourcefile: path.relative(directory, file),
      target: 'es2022',
    });
    if (result.map) throw new Error(`${file}: JavaScript compaction unexpectedly produced a map`);
    // A type-only source file (all `import type`/`export type`) compiles to a bare `export {};`
    // module marker with no runtime statements. esbuild's printer drops that empty export clause
    // entirely once asked to minify whitespace, since it exports nothing -- silently turning a
    // real (if inert) ES module into a 0-byte non-module file. Restore the marker whenever a
    // non-empty source would otherwise compact to nothing.
    const code = result.code.trim() === '' && source.trim() !== '' ? 'export {};\n' : restorePureAnnotations(result.code, path.relative(directory, file));
    afterBytes += Buffer.byteLength(code);
    await writeFile(file, code);
  }));
  return { files: files.length, beforeBytes, afterBytes };
}

/** Remove only empty private runtime markers after the complete module tree is compacted.
 * Package entry points, declared side effects and every runtime reference are protected; an
 * unknown dynamic import keeps all candidates. Declaration files are never removed. */
export async function pruneEmptyBuildJavaScript(directory, manifest) {
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
  let unknownReference = false;
  function protectReference(file, specifier, moduleUrl = false) {
    if (moduleUrl ? /^(?:[a-z][a-z0-9+.-]*:|\/)/iu.test(specifier) : !specifier.startsWith('.')) return;
    const target = path.resolve(path.dirname(file), specifier.split(/[?#]/u)[0]);
    for (const suffix of ['', '.js', '.mjs', '/index.js', '/index.mjs']) protectedFiles.add(target + suffix);
  }
  for (const { file, program } of modules) {
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      const staticSource = ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) ? node.source : null;
      const dynamicSource = node.type === 'ImportExpression' ? node.source :
        node.type === 'CallExpression' && ((node.callee?.type === 'Identifier' && node.callee.name === 'require') ||
          (node.callee?.type === 'MemberExpression' && node.callee.object?.name === 'require' && node.callee.property?.name === 'resolve')) ? node.arguments[0] : null;
      if (typeof staticSource?.value === 'string') protectReference(file, staticSource.value);
      if (dynamicSource) {
        if (typeof dynamicSource.value === 'string') protectReference(file, dynamicSource.value);
        else unknownReference = true;
      }
      // Relative module strings also protect uncommon loader aliases such as requireFromPackage.
      if (typeof node.value === 'string' && /^\.{1,2}\/.*\.m?js(?:[?#].*)?$/u.test(node.value)) protectReference(file, node.value);
      const base = node.type === 'NewExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'URL' ? node.arguments[1] : null;
      if (base?.type === 'MemberExpression' && base.object?.type === 'MetaProperty' && base.object.meta?.name === 'import' && base.property?.name === 'url') {
        if (typeof node.arguments[0]?.value === 'string') protectReference(file, node.arguments[0].value, true);
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
  for (const file of candidates.sort()) {
    const packagePath = path.relative(path.dirname(directory), file).split(path.sep).join('/');
    if (unknownReference || manifest.sideEffects === true || protectedFiles.has(path.resolve(file)) ||
      targetPatterns.some(pattern => pattern.test(packagePath)) ||
      sideEffectTargets.some(target => path.posix.matchesGlob(packagePath, target.replace(/^\.\//u, '')))) continue;
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
