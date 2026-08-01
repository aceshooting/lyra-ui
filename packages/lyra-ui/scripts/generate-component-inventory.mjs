import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildMirrorMap } from './migrate-wa.mjs';
import {
  INVENTORY_SCHEMA_VERSION,
  SURFACE_SECTIONS,
  compareMappedSurfaces,
  emptySurface,
  familyFromModule,
  normalizeManifest,
} from './component-inventory.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutput = path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseArguments(argv) {
  const options = { output: defaultOutput, write: false, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') options.write = true;
    else if (argument === '--check') options.check = true;
    else if (argument === '--webawesome-manifest') options.webawesomeManifest = argv[++index];
    else if (argument === '--shoelace-manifest') options.shoelaceManifest = argv[++index];
    else if (argument === '--output') options.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.webawesomeManifest || !options.shoelaceManifest) {
    throw new Error(
      'Both --webawesome-manifest and --shoelace-manifest are required; pass the pinned published custom-elements.json files.',
    );
  }
  return options;
}

function parseStringArray(source, name) {
  const block = source.match(new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`));
  if (!block) throw new Error(`Could not read ${name} from root-registration-allowlist.ts`);
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function resolveTypeScriptImport(importer, specifier) {
  const target = path.resolve(path.dirname(importer), specifier);
  const candidates = [target, target.replace(/\.js$/, '.ts'), path.join(target, 'index.ts')];
  return candidates.find((candidate) => fs.existsSync(candidate) && candidate.endsWith('.ts')) || null;
}

function optionalPeersForComponent(component, packageJson) {
  const peers = Object.keys(packageJson.peerDependencies ?? {}).filter(
    (peer) => packageJson.peerDependenciesMeta?.[peer]?.optional === true,
  );
  const found = new Set();
  const seen = new Set();
  const queue = [path.join(packageDir, component.registrationModule)];

  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const peer of peers) {
      const escaped = peer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:from\\s+|import\\()\\s*['"]${escaped}(?:/|['"])`).test(source)) found.add(peer);
    }
    for (const match of source.matchAll(/(?:from\s+|import\()\s*['"](\.[^'"]+)['"]/g)) {
      const resolved = resolveTypeScriptImport(file, match[1]);
      if (resolved) queue.push(resolved);
    }
  }
  return [...found].sort();
}

function lyraComponents(manifest, existing, packageJson) {
  const normalized = normalizeManifest(manifest, { ecosystem: 'lyra' });
  const existingByTag = new Map((existing?.components ?? []).map((component) => [component.tag, component]));
  const allowlistSource = fs.readFileSync(
    path.join(packageDir, 'src', 'internal', 'root-registration-allowlist.ts'),
    'utf8',
  );
  const rootTags = new Set(parseStringArray(allowlistSource, 'ROOT_BARREL_TAGS'));
  const optionalRootTags = new Set(parseStringArray(allowlistSource, 'ROOT_BARREL_OPTIONAL_PEER_TAGS'));

  return normalized.map((entry) => {
    const classModule = entry.module;
    const registrationModule = classModule.replace(/\.class\.ts$/, '.ts');
    const previous = existingByTag.get(entry.tag);
    const component = {
      tag: entry.tag,
      family: familyFromModule(classModule),
      classModule,
      registrationModule,
      rootIncluded: rootTags.has(entry.tag),
      rootExclusion: optionalRootTags.has(entry.tag) ? 'optional-peer-family' : rootTags.has(entry.tag) ? null : 'unreviewed',
      optionalPeers: [],
      maturity: previous?.maturity ?? entry.maturity,
      counterparts: [],
      surface: entry.surface,
    };
    component.optionalPeers = optionalPeersForComponent(component, packageJson);
    return component;
  });
}

function upstreamComponents(manifest, ecosystem, fixture, existing) {
  const prefix = ecosystem === 'webawesome' ? 'wa-' : 'sl-';
  const tierByTag =
    ecosystem === 'webawesome'
      ? new Map([
          ...fixture.webawesome.free.map((tag) => [tag, 'free']),
          ...fixture.webawesome.pro.map((tag) => [tag, 'pro']),
        ])
      : new Map(fixture.shoelace.tags.map((tag) => [tag, 'free']));
  const normalized = normalizeManifest(manifest, { ecosystem, tierByTag });
  const byTag = new Map(normalized.filter((entry) => entry.tag.startsWith(prefix)).map((entry) => [entry.tag, entry]));
  const previous = new Map((existing?.upstreams?.[ecosystem]?.components ?? []).map((entry) => [entry.tag, entry]));
  const catalog =
    ecosystem === 'webawesome' ? [...fixture.webawesome.free, ...fixture.webawesome.pro] : [...fixture.shoelace.tags];

  return catalog
    .map((tag) => {
      const published = byTag.get(tag);
      if (published) return published;
      const reviewed = previous.get(tag);
      if (reviewed?.review?.status === 'complete') return reviewed;
      return {
        tag,
        module: null,
        tier: tierByTag.get(tag),
        maturity: { status: 'unreviewed', since: null, deprecated: null },
        surface: emptySurface(),
        review: {
          status: 'tag-only',
          source: 'pinned-public-tag-catalog',
          unreviewedSections: [...SURFACE_SECTIONS],
        },
      };
    })
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

const REQUIRED_TARGETS = new Map([
  ['sl-alert', 'lr-alert'],
  ['sl-split-panel', 'lr-split-panel'],
  ['wa-page', 'lr-page'],
  ['wa-split-panel', 'lr-split-panel'],
  ['wa-video', 'lr-video'],
  ['wa-video-playlist', 'lr-video-playlist'],
]);

const DECISION_OVERRIDES = new Map([
  [
    'wa-data-grid',
    {
      classification: 'conceptual-only',
      rationale:
        'The current lr-table relationship is conceptual: a data grid owns editing and grid interaction contracts that a semantic table does not, so prefix substitution is intentionally disabled.',
    },
  ],
  [
    'wa-dropdown',
    {
      classification: 'unsupported',
      rationale:
        'The current target is a generic popover and does not yet own the documented menu, selection, and submenu contracts; automatic migration is blocked until those contracts share one implementation.',
    },
  ],
  [
    'sl-dropdown',
    {
      classification: 'unsupported',
      rationale:
        'The current target is a generic popover and does not yet own the documented menu, selection, and submenu contracts; automatic migration is blocked until those contracts share one implementation.',
    },
  ],
  [
    'wa-time-input',
    {
      classification: 'unsupported',
      rationale:
        'The current target wraps a native time input rather than the documented segmented field and popup contract, so the identical tag name is not presently migration-safe.',
    },
  ],
  [
    'wa-zoomable-frame',
    {
      classification: 'unsupported',
      rationale:
        'The current target is a slotted pan-and-zoom surface rather than the documented iframe contract, so prefix substitution is blocked until the iframe-compatible surface ships.',
    },
  ],
  [
    'wa-include',
    {
      classification: 'warning-required',
      rationale:
        'Lyra intentionally sanitizes included markup and keeps a same-origin default; uses that depend on cross-origin or script-executing behavior require an explicit security warning rather than a silent rename.',
    },
  ],
  [
    'sl-include',
    {
      classification: 'warning-required',
      rationale:
        'Lyra intentionally sanitizes included markup and keeps a same-origin default; uses that depend on cross-origin or script-executing behavior require an explicit security warning rather than a silent rename.',
    },
  ],
]);

function summarizeDrift(drift) {
  const byCode = new Map();
  for (const finding of drift) {
    const members = byCode.get(finding.code) ?? [];
    members.push(finding.member);
    byCode.set(finding.code, members);
  }
  const summaries = [...byCode]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, members]) => {
      const examples = [...new Set(members)].slice(0, 5).join(', ');
      return `${members.length} ${code}${examples ? ` (${examples})` : ''}`;
    });
  return `Prefix substitution is not currently public-surface safe: ${summaries.join('; ')}.`;
}

function attributeRewrites(fixture, upstreamTag) {
  return (fixture.attributeRenames ?? [])
    .filter((entry) => entry.upstream === upstreamTag)
    .map(({ from, to }) => ({ from, to }))
    .sort((a, b) => a.from.localeCompare(b.from));
}

function mappingDecisions({ fixture, readme, components, upstreams, existing }) {
  const { map: mirrorMap, conflicts } = buildMirrorMap(readme);
  if (conflicts.length) throw new Error(`README mirror table has conflicts: ${conflicts.join('; ')}`);
  const lyraByTag = new Map(components.map((component) => [component.tag, component]));
  const previous = new Map((existing?.mappings ?? []).map((mapping) => [mapping.upstreamTag, mapping]));
  const entries = [
    ...upstreams.webawesome.components.map((component) => ({ upstream: 'webawesome', component })),
    ...upstreams.shoelace.components.map((component) => ({ upstream: 'shoelace', component })),
  ];

  return entries
    .map(({ upstream, component }) => {
      const upstreamTag = component.tag;
      const targetTag = REQUIRED_TARGETS.get(upstreamTag) || mirrorMap.get(upstreamTag) || null;
      const existingDecision = previous.get(upstreamTag);
      const rewrites =
        existingDecision?.decisionSource === 'reviewed'
          ? existingDecision.rewrites
          : { attributes: attributeRewrites(fixture, upstreamTag) };
      const target = lyraByTag.get(targetTag);
      const drift =
        component.review.status === 'complete' && target
          ? compareMappedSurfaces(component.surface, target.surface, {
              upstreamPrefix: upstream === 'webawesome' ? 'wa-' : 'sl-',
              rewrites,
            })
          : [];

      let classification;
      let rationale;
      let decisionSource = 'derived';
      if (existingDecision?.decisionSource === 'reviewed') {
        classification = existingDecision.classification;
        rationale = existingDecision.rationale;
        decisionSource = 'reviewed';
      } else if (DECISION_OVERRIDES.has(upstreamTag)) {
        ({ classification, rationale } = DECISION_OVERRIDES.get(upstreamTag));
      } else if (targetTag && !target) {
        classification = 'unsupported';
        rationale = `The required ${targetTag} target is not registered yet; automatic migration remains blocked until its complete public contract ships.`;
      } else if (!target) {
        classification = 'unsupported';
        rationale = 'The pinned upstream tag has no reviewed Lyra target; automatic migration is blocked.';
      } else if (component.review.status !== 'complete') {
        classification = 'unsupported';
        rationale =
          'The pinned public snapshot identifies this tag but does not include a member-level manifest; automatic migration remains blocked until every documented member is reviewed and recorded.';
      } else if (drift.length === 0) {
        const hasRewrite = Object.values(rewrites).some((list) => list?.some((entry) => entry.from !== entry.to));
        classification = hasRewrite ? 'rewritten' : 'exact';
        rationale = hasRewrite ? 'All reviewed differences are covered by deterministic member rewrites.' : null;
      } else {
        classification = 'unsupported';
        rationale = summarizeDrift(drift);
      }

      return {
        upstream,
        upstreamTag,
        upstreamTier: component.tier,
        targetTag,
        classification,
        rationale,
        decisionSource,
        rewrites,
        drift,
      };
    })
    .sort((a, b) => a.upstreamTag.localeCompare(b.upstreamTag));
}

function addCounterparts(components, mappings) {
  const byTag = new Map(components.map((component) => [component.tag, component]));
  for (const mapping of mappings) {
    const target = byTag.get(mapping.targetTag);
    if (!target) continue;
    target.counterparts.push({
      upstream: mapping.upstream,
      tag: mapping.upstreamTag,
      tier: mapping.upstreamTier,
      classification: mapping.classification,
    });
  }
  for (const component of components) component.counterparts.sort((a, b) => a.tag.localeCompare(b.tag));
}

export function generateInventory({ webawesomeManifest, shoelaceManifest, output = defaultOutput }) {
  const fixture = readJson(path.join(packageDir, 'scripts', 'fixtures', 'upstream-tags.json'));
  const lyraManifest = readJson(path.join(packageDir, 'custom-elements.json'));
  const packageJson = readJson(path.join(packageDir, 'package.json'));
  const readme = fs.readFileSync(path.join(packageDir, 'README.md'), 'utf8');
  const existing = fs.existsSync(output) ? readJson(output) : null;
  const components = lyraComponents(lyraManifest, existing, packageJson);
  const upstreams = {
    webawesome: {
      package: '@awesome.me/webawesome',
      version: fixture.webawesome.version,
      commit: fixture.webawesome.commit,
      components: upstreamComponents(readJson(webawesomeManifest), 'webawesome', fixture, existing),
    },
    shoelace: {
      package: '@shoelace-style/shoelace',
      version: fixture.shoelace.version,
      commit: fixture.shoelace.commit,
      components: upstreamComponents(readJson(shoelaceManifest), 'shoelace', fixture, existing),
    },
  };
  const mappings = mappingDecisions({ fixture, readme, components, upstreams, existing });
  addCounterparts(components, mappings);

  return {
    $comment:
      'Authoritative component, public-surface, and upstream mapping inventory. Refresh with generate-component-inventory.mjs using the pinned published manifests; do not infer upstream behavior from implementation source.',
    schemaVersion: INVENTORY_SCHEMA_VERSION,
    pins: {
      lyraVersion: packageJson.version,
      webawesome: { version: fixture.webawesome.version, commit: fixture.webawesome.commit },
      shoelace: { version: fixture.shoelace.version, commit: fixture.shoelace.commit },
    },
    components,
    upstreams,
    mappings,
  };
}

function serialize(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const inventory = generateInventory(options);
    const serialized = serialize(inventory);
    if (options.check) {
      const current = fs.existsSync(options.output) ? fs.readFileSync(options.output, 'utf8') : '';
      if (current !== serialized) {
        console.error('component-inventory.json is stale; regenerate it from the pinned published manifests.');
        process.exitCode = 1;
      } else {
        console.log('component-inventory.json generation is deterministic and current.');
      }
    } else if (options.write) {
      fs.writeFileSync(options.output, serialized);
      console.log(
        `component inventory generated: ${inventory.components.length} Lyra, ` +
          `${inventory.upstreams.webawesome.components.length} Web Awesome, ` +
          `${inventory.upstreams.shoelace.components.length} Shoelace tags.`,
      );
    } else {
      process.stdout.write(serialized);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
