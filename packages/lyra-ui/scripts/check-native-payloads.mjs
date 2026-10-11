import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { parseProgram, visitAst } from './lib/ast.mjs';

const normalize = (file) => file.replaceAll('\\', '/');
const toolingRecord = (file) => /(?:^|\/)internal\/(?:tokens\.styles|tokens\/palette\.styles|specialist-tokens\.styles)\.(?:js|d\.ts)$/.test(normalize(file));
const defaultSlice = (file) => /\/internal\/default-strings\/[^/]+\.generated\.js$/.test(normalize(file));

/** Native ESM fetches each complete module; named exports are not a byte-saving boundary. */
export function findNativePayloadFindings(files, read, { packageDirectory, imports = {} } = {}) {
  const findings = [];
  const graph = new Map();
  const contents = new Map();
  for (const file of files) {
    if (toolingRecord(file)) findings.push(`${file}: tooling-only token record emitted into dist`);
    if (!file.endsWith('.js')) continue;
    const source = read(file);
    contents.set(path.resolve(file), source);
    const program = parseProgram(file, source);
    const edges = [];
    visitAst(program, (node) => {
      const eager = ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type);
      if (!eager && node.type !== 'ImportExpression') return;
      let specifier = node.source?.value;
      if (typeof specifier !== 'string') return;
      if (specifier.startsWith('#')) {
        const target = imports[specifier];
        specifier = typeof target === 'string' ? target : target?.default;
        if (typeof specifier !== 'string') return;
        specifier = packageDirectory ? path.resolve(packageDirectory, specifier) : specifier;
      } else if (specifier.startsWith('.')) {
        specifier = path.resolve(path.dirname(file), specifier);
      } else return;
      if (toolingRecord(specifier)) findings.push(`${file}: references tooling-only token record ${node.source.value}`);
      if (eager) edges.push(specifier);
    });
    graph.set(path.resolve(file), edges);
  }
  const walk = (entry) => {
    const reached = new Set();
    const visit = (file) => {
      if (reached.has(file) || !graph.has(file)) return;
      reached.add(file);
      for (const dependency of graph.get(file)) visit(dependency);
    };
    visit(entry);
    return reached;
  };
  const slices = [...contents.keys()].filter(defaultSlice);
  if (slices.length > 12) findings.push(`Default English payload has ${slices.length} modules; maximum is 12 family/shared modules`);
  for (const file of contents.keys()) {
    if (normalize(file).endsWith('/internal/default-strings.generated.js')) {
      findings.push(`${file}: obsolete monolithic default-English payload emitted into dist`);
    }
  }
  // A card needs only its own label. Its eager graph must not fetch other families or palettes.
  const card = [...graph.keys()].find((file) => normalize(file).endsWith('/components/layout/card/card.class.js'));
  if (card) {
    const reachable = [...walk(card)];
    const english = reachable.filter(defaultSlice);
    for (const file of reachable) {
      if (/\/internal\/(?:localization|specialist-tokens\.generated)\.js$/.test(normalize(file))) {
        findings.push(`${card}: native ESM reaches unrelated full-catalog or specialist payload ${file}`);
      }
      if (defaultSlice(file) && !/\/(?:layout|shared)\.generated\.js$/.test(normalize(file))) {
        findings.push(`${card}: native ESM reaches unrelated English family ${file}`);
      }
    }
    if (english.length === 0 || english.length > 2) {
      findings.push(`${card}: native English payload must use one or two family/shared modules, found ${english.length}`);
    }
    const raw = english.reduce((total, file) => total + Buffer.byteLength(contents.get(file)), 0);
    const gzip = english.reduce((total, file) => total + gzipSync(contents.get(file)).byteLength, 0);
    if (raw > 16000 || gzip > 5000) {
      findings.push(`${card}: native English payload exceeds 16000 raw / 5000 gzip bytes (${raw} raw / ${gzip} gzip)`);
    }
  }
  return findings;
}
