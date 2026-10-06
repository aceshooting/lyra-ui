import { parseSync } from 'oxc-parser';

/** Every specifier `source` loads eagerly (static imports, side-effect imports, re-exports); `import()` excluded. */
export function staticModuleSpecifiers(file, source) {
  const { module, errors } = parseSync(file, source, { sourceType: 'module' });
  if (errors.length > 0) {
    throw new SyntaxError(`${file}: ${errors.map((error) => error.message).join('; ')}`);
  }
  const specifiers = [];
  for (const entry of module.staticImports) specifiers.push(entry.moduleRequest.value);
  for (const entry of module.staticExports) {
    for (const exported of entry.entries) {
      if (exported.moduleRequest) specifiers.push(exported.moduleRequest.value);
    }
  }
  return [...new Set(specifiers)];
}
