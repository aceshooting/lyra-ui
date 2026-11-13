import { register } from 'node:module';

const packageDirectory = process.env.LYRA_SSR_COVERAGE_PACKAGE_ROOT;
const cacheDirectory = process.env.LYRA_SSR_COVERAGE_CACHE;
if (!packageDirectory || !cacheDirectory) throw new Error('SSR coverage loader configuration is missing.');
register('./ssr-coverage-loader.mjs', import.meta.url, { data: { packageDirectory, cacheDirectory } });
