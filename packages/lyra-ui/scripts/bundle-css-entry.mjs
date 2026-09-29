import { gzipSync } from 'node:zlib';
import { isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * Bundles one CSS-only consumer entry through the caller's existing esbuild instance.
 * `sourceRoot` is either this package root or an unpacked published package root containing dist/.
 */
export async function bundleCssMeasurement(esbuild, sourceRoot, measurement) {
  const root = resolve(sourceRoot);
  if (typeof measurement.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(measurement.id)) {
    throw new TypeError('CSS measurement id must be stable lowercase kebab-case');
  }
  const imports = measurement.imports.map((entry) => {
    const cssPath = entry;
    const absolutePath = resolve(root, cssPath);
    const fromRoot = relative(root, absolutePath);
    if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
      throw new Error(`${measurement.id}: CSS path escaped its source root`);
    }
    return `@import ${JSON.stringify(`./${cssPath}`)};`;
  });
  const result = await esbuild.build({
    stdin: {
      contents: imports.join('\n'),
      resolveDir: root,
      sourcefile: `lyra-css-${measurement.id}.css`,
      loader: 'css',
    },
    bundle: true,
    minify: true,
    write: false,
    absWorkingDir: root,
    outfile: resolve(root, `lyra-css-${measurement.id}.css`),
    logLevel: 'silent',
  });
  const cssOutputs = result.outputFiles.filter((output) => output.path.endsWith('.css'));
  if (result.outputFiles.length !== 1 || cssOutputs.length !== 1) {
    throw new Error(
      `${measurement.id}: CSS measurement must produce exactly one CSS output ` +
        `(got ${result.outputFiles.length} files, ${cssOutputs.length} CSS)`,
    );
  }
  const contents = cssOutputs[0].contents;
  return {
    id: measurement.id,
    kind: measurement.kind,
    imports: [...measurement.imports],
    minBytes: contents.length,
    gzipBytes: gzipSync(contents, { level: 9 }).length,
  };
}
