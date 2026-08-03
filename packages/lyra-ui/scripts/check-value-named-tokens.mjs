#!/usr/bin/env node

// Enforces the authored classification and no-growth policy in tokens/canonical-tokens.json.
// Equal numeric values do not imply equal semantic roles: the checked-in evidence is the reviewable
// record of why each compatibility name remains a component role or audited fixed geometry.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateDesignTokenArtifacts,
  readCanonicalTokens,
  readRuntimeTokenValues,
  validateCanonicalTokens,
  verifyRuntimeTokenParity,
} from './generate-design-tokens.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = readCanonicalTokens(packageDir);
const errors = [...validateCanonicalTokens(source), ...verifyRuntimeTokenParity(source, packageDir)];
const runtimeNames = [...readRuntimeTokenValues(packageDir).keys()]
  .filter((name) => /^--lr-size-/.test(name))
  .sort();
const classifiedNames = Object.keys(source.tokens)
  .filter((name) => /^--lr-size-/.test(name))
  .sort();

if (JSON.stringify(runtimeNames) !== JSON.stringify(classifiedNames)) {
  errors.push(
    'Runtime and classified value-named token sets differ; every declaration must have exactly one classification.',
  );
}

for (const name of classifiedNames) {
  const token = source.tokens[name];
  for (const evidence of token.evidence ?? []) {
    if (!evidence.startsWith('src/')) continue;
    const file = path.join(packageDir, evidence);
    if (!existsSync(file)) errors.push(`${name}: evidence path no longer exists: ${evidence}`);
    else if (!readFileSync(file, 'utf8').includes(name)) {
      errors.push(`${name}: evidence path no longer references the compatibility token: ${evidence}`);
    }
  }
}

try {
  generateDesignTokenArtifacts({ packageDir, check: true });
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

if (errors.length) {
  console.error(`Value-named/canonical token policy failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  const counts = Object.create(null);
  for (const name of classifiedNames) {
    const classification = source.tokens[name].valueNameClassification;
    counts[classification] = (counts[classification] ?? 0) + 1;
  }
  console.log(
    `Value-named token family frozen at ${classifiedNames.length}: ` +
      Object.entries(counts).map(([key, count]) => `${key}=${count}`).join(', ') +
      '. Canonical runtime and generated artifacts are fresh.',
  );
}
