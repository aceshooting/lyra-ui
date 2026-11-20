import lyraUiConfig from '../lyra-ui/custom-elements-manifest.config.js';

// Companion manifest: only the element modules, with the same `defineElement()` registration
// handling lyra-ui uses so the tag name resolves. The `LyraElement` superclass stays a reference
// into lyra-ui's own manifest.
export default {
  packagejson: false,
  globs: ['src/gen-view.class.ts', 'src/gen-view.ts'],
  exclude: ['**/*.test.ts', '**/*.styles.ts', '**/*.stories.ts'],
  outdir: '.',
  litelement: true,
  plugins: lyraUiConfig.plugins.filter((plugin) => plugin.name === 'lr-define-element-registration'),
};
