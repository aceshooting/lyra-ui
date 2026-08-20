import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  DOC_SPECIFIER_EXCEPTIONS,
  checkDocumentedSpecifiers,
  collectDocumentedSpecifiers,
} from './check-doc-specifiers.mjs';

// The production tree must always pass -- this is the gate itself, run against reality.
assert.deepEqual(
  checkDocumentedSpecifiers().findings,
  [],
  'every specifier a shipped file documents must resolve through package.json#exports'
);

const root = mkdtempSync(join(tmpdir(), 'lyra-doc-specifiers-'));
const write = (relativePath, contents) => {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

try {
  write(
    'package.json',
    `${JSON.stringify(
      {
        name: '@aceshooting/lyra-ui',
        exports: {
          '.': './dist/lyra.js',
          './components/media/flag/flag-peer.js': './dist/components/media/flag/flag-peer.js',
          './utilities/*': './dist/utilities/*',
        },
      },
      null,
      2
    )}\n`
  );

  // 1. A fenced import of an unlisted specifier -- how `flow-types.js` was promised.
  write(
    'llms/data.md',
    'Import the types directly:\n\n```ts\n'
      + "import type { LyraFlowNode } from '@aceshooting/lyra-ui/components/data/flow/flow-types.js';\n"
      + '```\n'
  );

  // 2. A PROSE import of an unlisted specifier -- how `flag-peer-bulk.js` was promised. A check
  //    that only understood fenced imports would have missed the bug that motivated this file.
  write(
    'llms/media.md',
    'Alternatively, import `@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js` instead\n'
      + 'of the default `@aceshooting/lyra-ui/components/media/flag/flag-peer.js`.\n'
  );

  // 3. Shapes that must NEVER be reported.
  write(
    'src/noise.ts',
    // Directory prose, not an instruction to import anything.
    "// Everything under `@aceshooting/lyra-ui/components/` is generated.\n"
      // A namespaced identifier that merely borrows the package name.
      + "const KEY = Symbol.for('@aceshooting/lyra-ui/markdown-katex-override');\n"
      + "const PROTOCOL = '@aceshooting/lyra-ui/toast-region/enqueue/v1';\n"
      // A filesystem path into node_modules -- resolved by the editor, not by the exports map.
      + '// "html.customData": ["./node_modules/@aceshooting/lyra-ui/vscode-html-data.json"]\n'
      // A resolvable specifier, through a wildcard route.
      + "import { place } from '@aceshooting/lyra-ui/utilities/positioner.js';\n"
      + 'export { KEY, PROTOCOL, place };\n'
  );

  const { findings } = checkDocumentedSpecifiers(root);
  assert.deepEqual(findings, [
    '@aceshooting/lyra-ui/components/data/flow/flow-types.js is documented as an import in '
      + 'llms/data.md but does not resolve through package.json#exports',
    '@aceshooting/lyra-ui/components/media/flag/flag-peer-bulk.js is documented as an import in '
      + 'llms/media.md but does not resolve through package.json#exports',
  ]);

  // The `.json`/`.js` alternation must not report a `custom-elements.js` nobody wrote.
  const collected = [...collectDocumentedSpecifiers(root).keys()];
  assert.ok(
    !collected.some((specifier) => specifier.endsWith('vscode-html-data.js')),
    '`.js` must not match the leading characters of a `.json` path'
  );
  assert.ok(
    !collected.includes('@aceshooting/lyra-ui/toast-region/enqueue/v1'),
    'a namespaced identifier string is not a module specifier'
  );

  // Adding the two missing routes clears both findings and nothing else changes.
  write(
    'package.json',
    `${JSON.stringify(
      {
        name: '@aceshooting/lyra-ui',
        exports: {
          '.': './dist/lyra.js',
          './components/data/flow/flow-types.js': './dist/components/data/flow/flow-types.js',
          './components/media/flag/flag-peer.js': './dist/components/media/flag/flag-peer.js',
          './components/media/flag/flag-peer-bulk.js':
            './dist/components/media/flag/flag-peer-bulk.js',
          './utilities/*': './dist/utilities/*',
        },
      },
      null,
      2
    )}\n`
  );
  assert.deepEqual(checkDocumentedSpecifiers(root).findings, []);

  // A stale exception is reported too: it excuses a specifier that no longer needs excusing, and
  // would go on excusing a genuinely-broken future namesake.
  assert.ok(
    DOC_SPECIFIER_EXCEPTIONS.every((entry) => entry.specifier && entry.reason),
    'every exception states which specifier it excuses and why'
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log('documented package specifier checks passed.');
