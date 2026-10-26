import { fileURLToPath } from 'node:url';
import uiConfig from '../lyra-ui/web-test-runner.config.js';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import genSsrFixturePlugin from './test/ssr-plugin.mjs';
import genThreatFixturePlugin from './test/threat-plugin.mjs';

// Reuse the repository's trusted-input and media emulation commands across engines.
export default {
  ...uiConfig,
  rootDir: fileURLToPath(new URL('../../', import.meta.url)),
  files: ['test/browser/**/*.test.ts'],
  groups: [],
  // Each composition cold-loads several component graphs through the development server.
  concurrency: process.env.WTR_CONCURRENCY ? uiConfig.concurrency : Math.min(4, uiConfig.concurrency),
  plugins: [
    genSsrFixturePlugin(),
    genThreatFixturePlugin(),
    {
      name: 'lyra-gen-source-exports',
      resolveImport({ source }) {
        if (source === '@aceshooting/lyra-gen') return '/packages/lyra-gen/src/index.ts';
        const prefix = '@aceshooting/lyra-gen/';
        if (source.startsWith(prefix) && source.endsWith('.js')) {
          const route = source.slice(prefix.length, -3);
          if (!route.split('/').some(part => !part || part === '.' || part === '..')) return `/packages/lyra-gen/src/${route}.ts`;
        }
      },
    },
    esbuildPlugin({ ts: true, json: true, target: 'es2022', tsconfig: 'tsconfig.json' }),
    ...uiConfig.plugins.filter(plugin => plugin.name !== 'esbuild'),
  ],
  coverage: false,
};
