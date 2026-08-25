import { realpathSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const requireFromPackage = createRequire(path.join(packageDir, 'package.json'));
const requireFromLoaderHost = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'));
const esbuild = requireFromLoaderHost('esbuild');

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
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
    const result = await esbuild.transform(source, {
      format: 'esm',
      legalComments: 'none',
      loader: 'js',
      minifyIdentifiers: false,
      minifySyntax: true,
      minifyWhitespace: true,
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

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(packageDir, 'dist');
  const result = await compactBuildJavaScript(directory);
  console.log(
    `Compacted ${result.files} JavaScript modules: ${result.beforeBytes.toLocaleString('en')} -> ` +
      `${result.afterBytes.toLocaleString('en')} bytes.`,
  );
}
