import childProcess from 'node:child_process';
import { register, syncBuiltinESMExports } from 'node:module';

// Preloaded into the browser driver by browser-driver-flow.test.mjs. It lets a test make the driver's
// external steps fail on demand and replace the consumer bundler with one whose result the test decides;
// everything else (the archive, the extraction, the plugin import, the file copies) stays real.
const spawnSync = childProcess.spawnSync;
childProcess.spawnSync = function (command, args, options) {
  const fault = process.env['DRIVER_FAULT'];
  if (fault === 'npm-unavailable' && command === 'npm') {
    return { error: new Error('spawnSync npm ENOENT'), status: null, signal: null, stdout: '', stderr: '' };
  }
  if (fault === 'npm-fails-quietly' && command === 'npm') return { status: 1, signal: null, stdout: 'npm reported on stdout', stderr: '' };
  if (fault === 'tar-fails' && command === 'tar') return { status: 2, signal: null, stdout: '', stderr: 'tar: unexpected end of archive' };
  if (fault === 'runtime-unavailable' && String(args?.[0]).endsWith('runtime.mjs')) {
    return { error: new Error('spawnSync node EPERM'), status: null, signal: null };
  }
  return spawnSync.call(this, command, args, options);
};
syncBuiltinESMExports();

const bundler = `
let mode;
export function initialize(data) { mode = data.mode; }
export function resolve(specifier, context, next) {
  if (specifier === 'vite' && mode && context.parentURL?.endsWith('/scripts/browser-test.mjs')) {
    return { url: 'data:text/javascript,' + encodeURIComponent(
      'export async function build(options) {' +
      '  const rolldown = options.build.rolldownOptions;' +
      '  if (' + JSON.stringify(mode) + ' === "warning") rolldown.onwarn({ code: "UNRESOLVED_IMPORT", message: "Could not resolve missing" });' +
      '  const facade = ' + JSON.stringify(mode) + ' === "no-entry" ? "/somewhere/else.mjs" : rolldown.input;' +
      '  return { output: [{ type: "chunk", facadeModuleId: facade, fileName: "entry-1.mjs", code: "export const marker = 1;", imports: [], dynamicImports: [] }] };' +
      '}'), shortCircuit: true };
  }
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(bundler)}`, { data: { mode: process.env['DRIVER_BUNDLER'] } });
