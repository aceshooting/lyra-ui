import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { staticModuleSpecifiers } from '../../../lyra-ui/scripts/module-specifiers.mjs';

/** Find engine imports reachable without a dynamic import from a public entry. */
export function eagerEngineImports(entries, readSource) {
  const visited = new Set();
  const findings = [];
  const visit = file => {
    if (visited.has(file)) return;
    visited.add(file);
    for (const specifier of staticModuleSpecifiers(file, readSource(file))) {
      if (specifier.startsWith('@docx-editor.dev/')) findings.push({ file, specifier });
      else if (specifier.startsWith('.')) visit(path.resolve(path.dirname(file), specifier));
      else if (path.isAbsolute(specifier)) visit(specifier);
      else if (specifier.startsWith('file:')) visit(fileURLToPath(specifier));
      else if (specifier.startsWith('#')) throw new Error('Cannot inspect an unresolved package-import alias');
    }
  };
  for (const file of entries) visit(path.resolve(file));
  return findings;
}
