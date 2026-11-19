import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('@web/dev-server-esbuild'))('esbuild');

/** Preserve the CLI entry points and adjacent contract lookup in the installed package. */
export function buildMigrationRuntime(sourceDirectory, outputDirectory) {
  esbuild.buildSync({
    entryPoints: ['lyra-ui', 'init-agents', 'migrate-wa'].map(name => join(sourceDirectory, name + '.mjs')),
    outdir: outputDirectory,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    external: ['./init-agents.mjs'],
    platform: 'node',
    target: 'node22',
    format: 'esm',
    minify: true,
    keepNames: true,
    charset: 'utf8',
  });
}
