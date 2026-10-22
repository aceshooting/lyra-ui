import { register } from 'node:module';

// Preloaded into the engine build by build-bundler-results.test.mjs: the build runs for real, but the
// bundler it calls is replaced by one that reports the output shape the test chooses.
const bundler = `
let mode;
export function initialize(data) { mode = data.mode; }
export function resolve(specifier, context, next) {
  if (specifier === 'rolldown' && mode && context.parentURL?.endsWith('/scripts/build.mjs')) {
    return { url: 'data:text/javascript,' + encodeURIComponent(
      'export async function rolldown(options) {' +
      '  return {' +
      '    async generate() {' +
      '      const omitted = ' + JSON.stringify(mode) + ' === "without-worker" ? "worker" : ' + JSON.stringify(mode) + ' === "without-index" ? "index" : null;' +
      '      const output = Object.entries(options.input).filter(([name]) => name !== omitted).map(([name, id]) => (' +
      '        { type: "chunk", facadeModuleId: id, fileName: "modules/" + name + "-1.mjs", code: "export {};", imports: [], dynamicImports: [] }));' +
      '      if (' + JSON.stringify(mode) + ' === "with-asset") output.push({ type: "asset", fileName: "logo.svg", source: "<svg/>" });' +
      '      return { output };' +
      '    },' +
      '    async close() {},' +
      '  };' +
      '}'), shortCircuit: true };
  }
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(bundler)}`, { data: { mode: process.env['BUNDLER_RESULT'] } });
