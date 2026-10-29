import { register } from 'node:module';

// Observe the real bundler result without replacing its inputs, modules or emitted code.
const receipt = process.env.SCENE_BUILD_GRAPH;
if (!receipt) throw new Error('Missing scene build graph destination.');
const wrapper = `
import * as engine from __SCENE_REAL_ROLLDOWN__;
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
export async function rolldown(...args) {
  const bundle = await engine.rolldown(...args);
  return new Proxy(bundle, {
    get(target, key) {
      if (key === 'generate') return async (...options) => {
        const result = await target.generate(...options);
        await writeFile(${JSON.stringify(receipt)}, JSON.stringify(result.output
          .filter(item => item.type === 'chunk')
          .map(item => ({ file: item.fileName, facade: item.facadeModuleId,
            sha256: createHash('sha256').update(item.code).digest('hex'),
            modules: Object.keys(item.modules), imports: item.imports, dynamicImports: item.dynamicImports }))));
        return result;
      };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}
`;
const loader = `
const template = ${JSON.stringify(wrapper)};
export async function resolve(specifier, context, next) {
  if (specifier === 'rolldown' && context.parentURL?.endsWith('/scripts/build.mjs')) {
    const actual = await next(specifier, context);
    const code = template.replace('__SCENE_REAL_ROLLDOWN__', JSON.stringify(actual.url));
    return { url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true };
  }
  return next(specifier, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(loader)}`);
