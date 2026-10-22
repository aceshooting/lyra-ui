import { register } from 'node:module';

// Preloaded by the coverage run (NODE_OPTIONS reaches every test process and the child processes
// they spawn): the tests import the shipped build, and this hands them the instrumented copy.
const base = new URL('../', import.meta.url);
register('./coverage-redirect-hooks.mjs', import.meta.url, {
  data: { from: new URL('dist/', base).href, to: new URL('coverage/build/dist/', base).href },
});
