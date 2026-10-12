import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Keep companion imports on the same source modules as component stories, without dist. */
export function sourcePackageExportsPlugin() {
  const packageRoot = new URL('../packages/lyra-ui/', import.meta.url);
  const { exports: packageExports } = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8'));
  const sourceModules = new Map();
  for (const [route, entry] of Object.entries(packageExports)) {
    if (route.includes('*')) continue;
    const target = typeof entry === 'string' ? entry : entry?.default;
    if (typeof target !== 'string' || !target.startsWith('./dist/') || !target.endsWith('.js')) continue;
    const source = new URL(target.replace('./dist/', './src/').replace(/\.js$/, '.ts'), packageRoot);
    if (existsSync(source)) {
      const specifier = `@aceshooting/lyra-ui${route === '.' ? '' : route.slice(1)}`;
      sourceModules.set(specifier, fileURLToPath(source));
    }
  }
  return {
    name: 'lyra-source-package-exports',
    enforce: 'pre',
    resolveId(source) {
      return sourceModules.get(source);
    },
  };
}
