// A bare `import('peer')` is resolved at build time, so esbuild (and the Angular application builder
// on top of it), webpack and Rspack reject an application that does not install an optional peer,
// although the peer is only ever loaded on demand. All of them downgrade an import inside a `try`
// block: esbuild keeps the specifier for run time, webpack and Rspack emit a stub that rejects. The
// published import therefore sits in a `try`, while source keeps the literal form for type-checking
// and test seams. A rejection still reaches the same loader, which fails closed as documented.
// Runs over emitted JavaScript so that a new peer or import site cannot miss the guard.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSync, visitorKeys } from 'oxc-parser';

/** The optional peers declared by a package manifest. */
export function optionalPeerNames(manifest) {
  return Object.entries(manifest.peerDependenciesMeta ?? {}).filter(([, meta]) => meta?.optional === true).map(([name]) => name);
}

function isPeerSpecifier(specifier, peers) {
  return peers.some(peer => specifier === peer || specifier.startsWith(`${peer}/`));
}

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** Dynamic imports of an optional peer that a bundler would resolve unguarded. */
export function findUnguardedPeerImports(source, peers) {
  if (!source.includes('import(')) return [];
  const { program, errors } = parseSync('module.js', source);
  if (errors.length) throw new Error(`Cannot parse emitted module: ${errors[0].message}`);
  const found = [];
  const visit = (node, guarded) => {
    if (node.type === 'ImportExpression' && node.source.type === 'Literal' && typeof node.source.value === 'string'
      && isPeerSpecifier(node.source.value, peers) && !guarded) {
      found.push({ specifier: node.source.value, start: node.start, end: node.end });
    }
    const inner = FUNCTION_TYPES.has(node.type) ? false : guarded;
    for (const key of visitorKeys[node.type] ?? []) {
      const value = node[key];
      for (const child of Array.isArray(value) ? value : [value]) {
        if (child) visit(child, inner || (node.type === 'TryStatement' && key === 'block'));
      }
    }
  };
  visit(program, false);
  return found;
}

/** Wraps each unguarded peer import, keeping the expression a promise of the same module namespace. */
export function guardPeerImports(source, peers) {
  let guarded = source;
  for (const { start, end } of findUnguardedPeerImports(source, peers).reverse()) {
    guarded = `${guarded.slice(0, start)}(async()=>{try{return await ${guarded.slice(start, end)}}catch(e){throw e}})()${guarded.slice(end)}`;
  }
  return guarded;
}

/** Guards every emitted module under `dist`. */
export async function guardBuildPeerImports(dist, peers) {
  let imports = 0;
  let files = 0;
  for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const path = join(entry.parentPath, entry.name);
    const source = await readFile(path, 'utf8');
    const count = findUnguardedPeerImports(source, peers).length;
    if (!count) continue;
    await writeFile(path, guardPeerImports(source, peers));
    imports += count;
    files += 1;
  }
  return { imports, files };
}
