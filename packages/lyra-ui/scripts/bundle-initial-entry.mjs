import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

// Measures only the entry chunk and its transitively static imports. A first-open dynamic import
// remains in the separately guarded no-splitting total, but is deliberately absent from this
// initial-route number -- exactly how a production code-splitting consumer pays for it.
export async function bundleInitialRoute(esbuild, packageDir, external, name, imports, preserveExports = false) {
  const sourceFile = `bundle-initial-${name}.js`;
  const result = await esbuild.build({
    stdin: {
      // Callable loaders are pure modules: a bare import would erase their entire initial route.
      // Registration routes retain their established side-effect-only consumer shape.
      contents: imports.map((entry) => `${preserveExports ? 'export * from' : 'import'} ${JSON.stringify(`./${entry}`)};`).join("\n"),
      resolveDir: packageDir,
      sourcefile: sourceFile,
    },
    bundle: true,
    splitting: true,
    format: "esm",
    minify: true,
    write: false,
    outdir: ".bundle-initial",
    metafile: true,
    external,
    absWorkingDir: packageDir,
    logLevel: "silent",
  });
  const entryOutput = Object.entries(result.metafile.outputs).find(
    ([, output]) => output.entryPoint === sourceFile
  )?.[0];
  if (!entryOutput) throw new Error(`${name}: splitting-aware bundle emitted no entry output`);

  const pending = [entryOutput];
  const initialOutputs = new Set();
  while (pending.length > 0) {
    const outputPath = pending.pop();
    if (!outputPath || initialOutputs.has(outputPath)) continue;
    initialOutputs.add(outputPath);
    const output = result.metafile.outputs[outputPath];
    if (!output) throw new Error(`${name}: missing metafile output ${outputPath}`);
    for (const imported of output.imports) {
      if (imported.external || imported.kind === "dynamic-import") continue;
      pending.push(imported.path);
    }
  }

  const filesByPath = new Map(
    result.outputFiles.map((file) => [resolve(file.path), file.contents])
  );
  let gzipBytes = 0;
  for (const outputPath of initialOutputs) {
    const contents = filesByPath.get(resolve(packageDir, outputPath));
    if (!contents) throw new Error(`${name}: no emitted bytes for ${outputPath}`);
    gzipBytes += gzipSync(contents, { level: 9 }).length;
  }
  return { gzipBytes, outputCount: initialOutputs.size };
}
