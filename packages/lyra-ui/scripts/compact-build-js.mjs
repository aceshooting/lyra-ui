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
// Compact their local bindings before the ordinary module pass, which deliberately preserves
// readable identifiers elsewhere. A script transform (no module format) retains each declaration
// name and free identifier, so surrounding imports/exports and callback defaults stay intact.
const serializedFunctions = new Map([
  ['theme/theme.js', new Set(['applyStoredThemeBeforePaint', 'applyStoredStyleBeforePaint', 'styleTokenAllowed', 'styleMaterial'])],
  ['theme/startup-resolution.js', new Set(['resolveStyleStartup'])],
  ['theme/style-ownership.js', new Set(['readStyleOwnership'])],
]);

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

/** Removes comments and redundant syntax/whitespace from shipped JavaScript only. Declaration
 * comments remain intact for IDE documentation, class/property names remain readable, and no
 * source map is produced. Keeping the package as unbundled ESM preserves every granular export
 * and tree-shaking boundary while avoiding publishing the same authored prose in both `.js` and
 * `.d.ts`. */
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
      minifyIdentifiers: false,
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
    const code = result.code.trim() === '' && source.trim() !== '' ? 'export {};\n' : result.code;
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
