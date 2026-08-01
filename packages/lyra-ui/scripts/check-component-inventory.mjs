// Validates the authoritative component inventory against Lyra's current manifest and the frozen
// upstream tag pins. Pass both published upstream manifests to additionally verify member-level
// snapshot freshness. `--strict` enables release completeness: no unclassified maturity,
// tag-only surface review, or unsupported mapping may remain.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateInventory, validatePinnedManifests } from './component-inventory.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArguments(argv) {
  const options = { strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--strict') options.strict = true;
    else if (argument === '--webawesome-manifest') options.webawesomeManifest = argv[++index];
    else if (argument === '--shoelace-manifest') options.shoelaceManifest = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (Boolean(options.webawesomeManifest) !== Boolean(options.shoelaceManifest)) {
    throw new Error('Pass both --webawesome-manifest and --shoelace-manifest, or neither.');
  }
  return options;
}

try {
  const options = parseArguments(process.argv.slice(2));
  const inventory = readJson(path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'));
  const upstreamTags = readJson(path.join(packageDir, 'scripts', 'fixtures', 'upstream-tags.json'));
  const lyraManifest = readJson(path.join(packageDir, 'custom-elements.json'));
  const findings = validateInventory(inventory, { upstreamTags, lyraManifest, strict: options.strict });
  if (options.webawesomeManifest) {
    findings.push(
      ...validatePinnedManifests(inventory, {
        webawesomeManifest: readJson(options.webawesomeManifest),
        shoelaceManifest: readJson(options.shoelaceManifest),
      }),
    );
  }

  if (findings.length) {
    console.error(`Component inventory contract failed with ${findings.length} finding(s):`);
    for (const finding of [...new Set(findings)].sort()) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    const classifications = Object.fromEntries(
      ['exact', 'rewritten', 'warning-required', 'conceptual-only', 'unsupported'].map((classification) => [
        classification,
        inventory.mappings.filter((mapping) => mapping.classification === classification).length,
      ]),
    );
    console.log(
      `Component inventory contract passed: ${inventory.components.length} Lyra, ` +
        `${inventory.upstreams.webawesome.components.length} Web Awesome, ` +
        `${inventory.upstreams.shoelace.components.length} Shoelace tags; mappings ` +
        Object.entries(classifications)
          .map(([classification, count]) => `${classification}=${count}`)
          .join(', ') +
        '.',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

