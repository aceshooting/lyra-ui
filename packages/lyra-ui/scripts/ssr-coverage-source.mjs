import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transform } = createRequire(require.resolve('@web/dev-server-esbuild'))('esbuild');

/** Use the same installed compiler and transform options as the browser test runner. */
export async function transformSsrSource(source, sourcePath, tsconfigRaw) {
  const { code, warnings } = await transform(source, {
    loader: 'ts', target: 'es2022', sourcefile: sourcePath, sourcemap: 'inline', tsconfigRaw,
  });
  if (warnings.length) throw new Error(`SSR source transformation warned for ${sourcePath}.`);
  return code;
}
