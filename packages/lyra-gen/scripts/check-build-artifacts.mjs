import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProgram, visitAst } from '../../lyra-ui/scripts/lib/ast.mjs';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registrationEntries = ['dist/dashboard-binding.js', 'dist/gen-view.js'];
const normalize = file => file.replaceAll('\\', '/');

/** Inspect emitted code, including its actual eager import graph, rather than compiler settings. */
export function findGenArtifactFindings(files, read, manifest) {
  const findings = [];
  const inventory = new Set(files);
  const graph = new Map();
  for (const file of files) {
    if (/\.(?:test|stories)\.|(?:^|\/)(?:test|fixtures)\/|\.map$/u.test(file)) findings.push(`${file}: build-only artifact is published`);
    if (!file.endsWith('.js') && !file.endsWith('.d.ts')) continue;
    const source = read(file);
    if (/(?:\/\/|\/\*)#\s*sourceMappingURL=/u.test(source)) findings.push(`${file}: source map reference is published`);
    if (file.endsWith('.d.ts')) continue;
    if (!inventory.has(file.slice(0, -3) + '.d.ts')) findings.push(`${file}: matching declaration is missing`);
    const edges = [];
    const program = parseProgram(file, source);
    visitAst(program, node => {
      const eager = ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type);
      if (!eager && node.type !== 'ImportExpression') return;
      const specifier = node.source?.value;
      if (typeof specifier !== 'string') return;
      if (/^@aceshooting\/lyra-ui\/(?:src|dist|internal)\//u.test(specifier)) findings.push(`${file}: imports private library source`);
      if (specifier.startsWith('.')) {
        const target = normalize(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
        if (!inventory.has(target)) findings.push(`${file}: missing imported module ${target}`);
        if (eager) edges.push(target);
      } else if (eager) edges.push(specifier);
    });
    graph.set(file, edges);
  }
  const declared = manifest.sideEffects;
  if (!Array.isArray(declared) || JSON.stringify([...declared].map(value => value.replace(/^\.\//u, '')).sort()) !== JSON.stringify(registrationEntries)) findings.push('sideEffects must mark exactly the registration and dashboard binding entries');
  for (const entry of registrationEntries) if (!inventory.has(entry)) findings.push(`${entry}: registration entry is missing`);
  if (!inventory.has('dist/index.js')) findings.push('dist/index.js: root module is missing');
  const pending = ['dist/index.js'];
  const reached = new Set();
  while (pending.length) {
    const entry = pending.pop();
    if (reached.has(entry)) continue;
    reached.add(entry);
    if (registrationEntries.includes(entry) || /^@aceshooting\/lyra-ui(?:$|\/components\/lr-)/u.test(entry)) findings.push(`root import eagerly reaches registration entry ${entry}`);
    pending.push(...(graph.get(entry) ?? []));
  }
  return findings;
}

export function checkGenBuildArtifacts(directory = packageDirectory) {
  const walk = relative => readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap(entry => {
    const child = `${relative}/${entry.name}`;
    return entry.isDirectory() ? walk(child) : [child];
  });
  const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const findings = findGenArtifactFindings(walk('dist'), file => readFileSync(path.join(directory, file), 'utf8'), manifest);
  if (findings.length) throw new Error(findings.join('\n'));
  console.log('Lyra Gen emitted-artifact and pure-root contracts passed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkGenBuildArtifacts();
