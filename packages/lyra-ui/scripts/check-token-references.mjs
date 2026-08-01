// Fails on a `var(--lr-…)` that names a token nothing ever declares AND supplies no fallback.
//
// This is invisible to every other tool in the repo. The CSS parses, the manifest is happy, the
// type checker has nothing to say — but at computed-value time the whole declaration is dropped and
// the property silently keeps whatever it inherited. Two components shipped a `color:` that never
// applied because the token was `--lr-color-text-muted` and the real name is `--lr-color-text-quiet`.
//
// A reference WITH a fallback (`var(--lr-x, 1rem)`) is fine by construction: that is the documented
// way a component publishes a consumer-settable knob it also gives a default for.
//
// A reference with no fallback is fine only when something declares the name. That includes
// declarations the component makes at runtime for a per-instance computed value — via
// `style.setProperty('--lr-x', …)`, a Lit `styleMap({ '--lr-x': … })`, or a documented
// `@cssprop [--lr-x]` the component sets inline itself. All three count, so the scan covers `.ts`
// sources as well as stylesheets.
//
// Test files are scanned for declarations but never reported against: a test legitimately probes
// an undeclared token to prove exactly this failure mode.
//
// Run: node scripts/check-token-references.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(packageDir, 'src');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const sources = walk(sourceRoot).filter((file) => file.endsWith('.ts'));
const stylesheets = [path.join(packageDir, 'theme.css'), path.join(sourceRoot, 'theme.css')].filter((file) =>
  fs.existsSync(file),
);

const declared = new Set();
for (const file of [...sources, ...stylesheets]) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/(--lr-[a-z0-9-]+)\s*:/g)) declared.add(match[1]);
  for (const match of text.matchAll(/setProperty\(\s*['"`](--lr-[a-z0-9-]+)['"`]/g)) declared.add(match[1]);
  // Lit `styleMap({ '--lr-x': value })` and any other object-literal key form.
  for (const match of text.matchAll(/['"`](--lr-[a-z0-9-]+)['"`]\s*:/g)) declared.add(match[1]);
  // A documented `@cssprop [--lr-x]` the component sets inline on its own internals.
  for (const match of text.matchAll(/@cssprop\s+\[?(--lr-[a-z0-9-]+)/g)) declared.add(match[1]);
}

const findings = [];
for (const file of sources.filter((file) => !file.endsWith('.test.ts'))) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/var\(\s*(--lr-[a-z0-9-]+)\s*\)/g)) {
      const token = match[1];
      if (declared.has(token)) continue;
      findings.push(`${path.relative(packageDir, file)}:${index + 1}: ${token} is never declared and has no fallback, so this declaration is dropped at runtime`);
    }
  });
}

if (findings.length) {
  console.error(`Token-reference contract failed with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  console.error('\nEither correct the token name, declare it, or give the reference a fallback.');
  process.exitCode = 1;
} else {
  console.log(`Token-reference contract passed: every no-fallback var() resolves (${declared.size} declared tokens).`);
}
