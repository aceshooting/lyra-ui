import assert from 'node:assert/strict';

// Restore module boundaries in the published browser bundle. The CMYK lookup table is a
// constant, so it can share the codec chunk that its JPEG decoder already imports.
const boundaries = [
  ['emf-color-helpers', 'graphics'],
  ['jpeg-cmyk-data', 'codecs'],
  ['jpeg-cmyk', 'graphics'],
  ['fnt-font', 'drawing'],
  ['emf-gdi-clip-records', 'replay'],
];
const dependencyOrder = ['codecs', 'graphics', 'drawing', 'replay'];

export function metafileChunks(file) {
  const prefix = file + '?metafile=';
  const modules = new Map();
  return {
    name: 'lyra-docx-metafile-chunks',
    enforce: 'pre',
    resolveId(id) {
      if (modules.has(id)) return id;
    },
    load(id) {
      if (modules.has(id)) return modules.get(id);
    },
    transform(code, id) {
      if (id !== file) return;
      const sections = new Map();
      let start = 0;
      let name = 'codecs';
      for (const [banner, next] of boundaries) {
        const marker = '\n// src/' + banner + '.ts\n';
        const end = code.indexOf(marker);
        assert(end > start && end === code.lastIndexOf(marker), 'Metafile module boundary changed: ' + banner);
        sections.set(name, (sections.get(name) ?? '') + code.slice(start, end));
        name = next;
        start = end;
      }
      sections.set(name, code.slice(start));

      // Published bindings have unique top-level names. Import earlier declarations as live ESM
      // bindings and let the bundler eliminate unused imports just as it does for authored modules.
      const imports = [];
      for (const group of dependencyOrder) {
        const body = sections.get(group);
        const moduleId = prefix + group;
        const source = imports.join('\n') + '\n' + body;
        if (group === 'replay') {
          modules.set(moduleId, source);
          break;
        }
        const names = [];
        for (const statement of this.parse(body).body) {
          if (statement.type === 'VariableDeclaration') {
            for (const declaration of statement.declarations) {
              assert.equal(declaration.id.type, 'Identifier', 'Unexpected metafile binding pattern');
              names.push(declaration.id.name);
            }
          } else if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') {
            names.push(statement.id.name);
          }
        }
        const bindings = names.join(',');
        modules.set(moduleId, source + '\nexport {' + bindings + '};');
        imports.push('import {' + bindings + '} from ' + JSON.stringify(moduleId) + ';');
      }
      return { code: 'export * from ' + JSON.stringify(prefix + 'replay') + ';', map: null };
    },
  };
}

export const metafileChunkGroups = dependencyOrder.map((group, index) => ({
  name: 'metafile-' + group,
  test: id => id.endsWith('?metafile=' + group),
  priority: dependencyOrder.length - index,
}));
