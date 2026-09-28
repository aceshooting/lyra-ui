import { isMainModule } from './is-main-module.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { expandManifestInheritance } from './manifest-compact.mjs';
import { INVENTORY_SCHEMA_VERSION, LOCAL_MIGRATION_PROFILES } from './component-inventory.mjs';
import { packageDir } from './component-inventory/paths.mjs';
import { lyraComponents } from './component-inventory/source-analysis.mjs';
import { upstreamComponents } from './component-inventory/upstream-definitions.mjs';
import { accessibilityProfileCatalog } from './component-inventory/accessibility.mjs';
import { mappingDecisions, addCounterparts } from './component-inventory/migration-mappings.mjs';

// Keep the generation API stable while each responsibility owns its implementation.
export {
  runtimeModuleSpecifiers,
  sourceForwardsRemoteIconCapability,
  rootRegistrationMetadata,
  rootRegistrationPredecessorTag,
  optionalPeersForComponent,
  retainedComponentQualityMetadata,
} from './component-inventory/source-analysis.mjs';
export {
  reviewedWebAwesomeChart,
  reviewedWebAwesomeSparkline,
  reviewedWebAwesomeCombobox,
  reviewedWebAwesomeFileInput,
  reviewedWebAwesomeDateInput,
  reviewedWebAwesomeDatePicker,
  reviewedWebAwesomeDataGrid,
  reviewedWebAwesomeVideo,
  reviewedWebAwesomeVideoPlaylist,
} from './component-inventory/upstream-definitions.mjs';
export {
  accessibilityProfileCatalog,
  assertAccessibilityProfilesReferenced,
  reviewedAccessibilityMetadata,
} from './component-inventory/accessibility.mjs';
export {
  reviewedMappingNormalizations,
} from './component-inventory/mapping-normalizations.mjs';
export {
  reviewedMigrationDecision,
  reviewedMethodEdgeParity,
  migrationParityMetadata,
} from './component-inventory/migration-mappings.mjs';

const defaultOutput = path.join(
  packageDir,
  'scripts',
  'fixtures',
  'component-inventory.json'
);

/** Restores standard-resolvable inherited public surfaces before inventory normalization. The
 * published CEM is compact, while the inventory intentionally records each tag's effective API. */
export function expandLyraInventoryManifest(manifest) {
  return expandManifestInheritance(manifest);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArguments(argv) {
  const options = { output: defaultOutput, write: false, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') options.write = true;
    else if (argument === '--check') options.check = true;
    else if (argument === '--lyra-manifest')
      options.lyraManifest = argv[++index];
    else if (argument === '--webawesome-manifest')
      options.webawesomeManifest = argv[++index];
    else if (argument === '--shoelace-manifest')
      options.shoelaceManifest = argv[++index];
    else if (argument === '--output')
      options.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.webawesomeManifest || !options.shoelaceManifest) {
    throw new Error(
      'Both --webawesome-manifest and --shoelace-manifest are required; pass the pinned published custom-elements.json files.'
    );
  }
  return options;
}

export function generateInventory({
  webawesomeManifest,
  shoelaceManifest,
  lyraManifest = path.join(packageDir, 'custom-elements.json'),
  output = defaultOutput,
}) {
  const fixture = readJson(
    path.join(packageDir, 'scripts', 'fixtures', 'upstream-tags.json')
  );
  const lyraManifestJson = expandLyraInventoryManifest(readJson(lyraManifest));
  const packageJson = readJson(path.join(packageDir, 'package.json'));
  const readme = fs.readFileSync(path.join(packageDir, 'README.md'), 'utf8');
  const existing = fs.existsSync(output) ? readJson(output) : null;
  const components = lyraComponents(lyraManifestJson, existing, packageJson);
  const upstreams = {
    webawesome: {
      packages: [
        { name: '@awesome.me/webawesome', tiers: ['free'] },
        { name: '@awesome.me/webawesome-pro', tiers: ['free', 'pro'] },
      ],
      version: fixture.webawesome.version,
      commit: fixture.webawesome.commit,
      components: upstreamComponents(
        readJson(webawesomeManifest),
        'webawesome',
        fixture,
        existing
      ),
    },
    shoelace: {
      packages: [{ name: '@shoelace-style/shoelace', tiers: ['free'] }],
      version: fixture.shoelace.version,
      commit: fixture.shoelace.commit,
      components: upstreamComponents(
        readJson(shoelaceManifest),
        'shoelace',
        fixture,
        existing
      ),
    },
  };
  const mappings = mappingDecisions({
    fixture,
    readme,
    components,
    upstreams,
    existing,
  });
  addCounterparts(components, mappings);

  return {
    $comment:
      'Authoritative component, public-surface, and upstream mapping inventory. Refresh with generate-component-inventory.mjs using the pinned published manifests and artifact-bound black-box evidence; do not infer upstream behavior from implementation source.',
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    pins: {
      lyraVersion: packageJson.version,
      webawesome: {
        version: fixture.webawesome.version,
        commit: fixture.webawesome.commit,
      },
      shoelace: {
        version: fixture.shoelace.version,
        commit: fixture.shoelace.commit,
      },
    },
    accessibilityProfiles: accessibilityProfileCatalog(),
    components,
    localMigrations: structuredClone(LOCAL_MIGRATION_PROFILES),
    upstreams,
    mappings,
  };
}

function serialize(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

if (isMainModule(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const inventory = generateInventory(options);
    const serialized = serialize(inventory);
    if (options.check) {
      const current = fs.existsSync(options.output)
        ? fs.readFileSync(options.output, 'utf8')
        : '';
      if (current !== serialized) {
        console.error(
          'component-inventory.json is stale; regenerate it from the pinned published manifests.'
        );
        process.exitCode = 1;
      } else {
        console.log(
          'component-inventory.json generation is deterministic and current.'
        );
      }
    } else if (options.write) {
      fs.writeFileSync(options.output, serialized);
      console.log(
        `component inventory generated: ${inventory.components.length} Lyra, ` +
          `${inventory.upstreams.webawesome.components.length} Web Awesome, ` +
          `${inventory.upstreams.shoelace.components.length} Shoelace tags.`
      );
    } else {
      process.stdout.write(serialized);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
