// Informational watch: compares the newest stable npm release of each upstream package against the
// reviewed pin in upstream-package-pins.json and reports surface drift (tags, attributes, properties,
// slots, parts, CSS custom properties, events, methods, new deprecations). It never gates a build:
// "drift found" exits 0; only tool errors exit non-zero. The newest tarball is verified against the
// integrity the registry publishes for it, and only package.json and the published custom-elements
// manifest are read, so no lifecycle script ever runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_METADATA_BYTES,
  MAX_TARBALL_BYTES,
  REGISTRY,
  downloadPinnedManifest,
  exactFetch,
  expectedTarballUrl,
  extractTarEntries,
  invariant,
  parseJsonBuffer,
  sha512Integrity,
  validateSha512Integrity,
} from './npm-tarball.mjs';
import { isMainModule } from './is-main-module.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIN_FIXTURE = path.join(packageDir, 'scripts', 'fixtures', 'upstream-package-pins.json');
const STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const KINDS = ['attributes', 'properties', 'methods', 'slots', 'parts', 'cssProperties', 'events'];

export function compareVersions(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

const isDeprecated = (item) => Boolean(item && item.deprecated);

/** Collects the public surface of every custom element a CEM declares, keyed by tag name. */
export function collectSurface(manifest) {
  const tags = new Map();
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.kind !== 'class' || !declaration.tagName) continue;
      const surface = Object.fromEntries(KINDS.map((kind) => [kind, new Map()]));
      const put = (kind, name, item) => {
        if (typeof name === 'string' && name && !surface[kind].has(name)) surface[kind].set(name, item);
      };
      for (const attribute of declaration.attributes ?? []) put('attributes', attribute.name, attribute);
      for (const member of declaration.members ?? []) {
        if (member.privacy === 'private' || member.privacy === 'protected' || member.static) continue;
        if (member.kind === 'method') put('methods', member.name, member);
        else if (member.kind === 'field') put('properties', member.name, member);
      }
      for (const slot of declaration.slots ?? []) put('slots', slot.name || '(default)', slot);
      for (const part of declaration.cssParts ?? []) put('parts', part.name, part);
      for (const property of declaration.cssProperties ?? []) put('cssProperties', property.name, property);
      for (const event of declaration.events ?? []) put('events', event.name, event);
      tags.set(declaration.tagName, { deprecated: isDeprecated(declaration), surface });
    }
  }
  return tags;
}

const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));

/** Diffs two manifests; the result is plain data suitable for JSON output. */
export function diffManifests(pinnedManifest, latestManifest) {
  const before = collectSurface(pinnedManifest);
  const after = collectSurface(latestManifest);
  const addedTags = sorted([...after.keys()].filter((tag) => !before.has(tag)));
  const removedTags = sorted([...before.keys()].filter((tag) => !after.has(tag)));
  const newlyDeprecatedTags = sorted(
    [...after.keys()].filter((tag) => before.has(tag) && after.get(tag).deprecated && !before.get(tag).deprecated),
  );
  const changedTags = {};
  for (const tag of sorted([...after.keys()].filter((name) => before.has(name)))) {
    const old = before.get(tag).surface;
    const next = after.get(tag).surface;
    const entry = {};
    for (const kind of KINDS) {
      const added = sorted([...next[kind].keys()].filter((name) => !old[kind].has(name)));
      const removed = sorted([...old[kind].keys()].filter((name) => !next[kind].has(name)));
      const deprecated = sorted(
        [...next[kind].keys()].filter(
          (name) => old[kind].has(name) && isDeprecated(next[kind].get(name)) && !isDeprecated(old[kind].get(name)),
        ),
      );
      if (added.length || removed.length || deprecated.length) entry[kind] = { added, removed, deprecated };
    }
    if (Object.keys(entry).length) changedTags[tag] = entry;
  }
  return { addedTags, removedTags, newlyDeprecatedTags, changedTags };
}

export const hasDrift = (diff) =>
  diff.addedTags.length + diff.removedTags.length + diff.newlyDeprecatedTags.length > 0 ||
  Object.keys(diff.changedTags).length > 0;

/** Newest stable release (registry `latest` dist-tag) with its verified manifest. */
export async function downloadLatestManifest(name, { fetchImpl = globalThis.fetch, manifestPath } = {}) {
  invariant(typeof fetchImpl === 'function', `${name}: Fetch API is unavailable`);
  const metadata = parseJsonBuffer(
    await exactFetch(fetchImpl, `${REGISTRY}${encodeURIComponent(name)}/latest`, {
      accept: 'application/json',
      label: `${name}@latest metadata`,
      maxBytes: MAX_METADATA_BYTES,
    }),
    `${name}@latest metadata`,
  );
  invariant(metadata.name === name, `${name}: registry metadata identity mismatch`);
  invariant(STABLE.test(metadata.version), `${name}: latest dist-tag is not a stable version (${String(metadata.version)})`);
  const { version } = metadata;
  const integrity = metadata.dist?.integrity;
  validateSha512Integrity(integrity, `${name}@${version}`);
  const tarballUrl = metadata.dist?.tarball;
  invariant(tarballUrl === expectedTarballUrl(name, version), `${name}@${version}: unexpected tarball URL`);
  const tarball = await exactFetch(fetchImpl, tarballUrl, {
    accept: 'application/octet-stream',
    label: `${name}@${version} tarball`,
    maxBytes: MAX_TARBALL_BYTES,
  });
  invariant(sha512Integrity(tarball) === integrity, `${name}@${version}: tarball does not match registry integrity`);
  const entries = extractTarEntries(tarball, ['package/package.json', manifestPath]);
  const packageJson = parseJsonBuffer(entries.get('package/package.json'), `${name} package.json`);
  invariant(packageJson.name === name && packageJson.version === version, `${name}@${version}: embedded package identity mismatch`);
  const manifest = parseJsonBuffer(entries.get(manifestPath), `${name}@${version} custom-elements.json`);
  invariant(Array.isArray(manifest.modules), `${name}@${version}: manifest modules are missing`);
  return { version, manifest };
}

/** Runs the watch for every pinned package; resolves to one result per package. */
export async function runUpstreamDrift({ pins, fetchImpl = globalThis.fetch } = {}) {
  const results = [];
  for (const [ecosystem, pin] of Object.entries(pins.packages)) {
    const latest = await downloadLatestManifest(pin.name, { fetchImpl, manifestPath: pin.manifestPath });
    const result = { ecosystem, name: pin.name, pinned: pin.version, latest: latest.version, drift: false, diff: null };
    if (compareVersions(latest.version, pin.version) > 0) {
      const pinned = await downloadPinnedManifest(pin, { fetchImpl });
      result.diff = diffManifests(pinned.manifest, latest.manifest);
      result.drift = true;
    }
    results.push(result);
  }
  return results;
}

const list = (values) => values.map((value) => `\`${value}\``).join(', ');

export function renderMarkdown(results, { heading = '# Upstream drift report' } = {}) {
  const lines = [heading, ''];
  for (const result of results) {
    lines.push(`## ${result.name}: pinned ${result.pinned}, latest ${result.latest}`, '');
    if (!result.drift) {
      lines.push('No newer stable release than the pin.', '');
      continue;
    }
    const { diff } = result;
    if (!hasDrift(diff)) lines.push('Newer release found; the custom-elements surface is unchanged.', '');
    if (diff.addedTags.length) lines.push(`- Added tags: ${list(diff.addedTags)}`);
    if (diff.removedTags.length) lines.push(`- Removed tags: ${list(diff.removedTags)}`);
    if (diff.newlyDeprecatedTags.length) lines.push(`- Newly deprecated tags: ${list(diff.newlyDeprecatedTags)}`);
    const tags = Object.keys(diff.changedTags);
    if (tags.length) {
      lines.push('', '### Changed tags', '');
      for (const tag of tags) {
        lines.push(`- \`${tag}\``);
        for (const kind of KINDS) {
          const change = diff.changedTags[tag][kind];
          if (!change) continue;
          for (const [label, values] of [['added', change.added], ['removed', change.removed], ['newly deprecated', change.deprecated]]) {
            if (values.length) lines.push(`  - ${kind} ${label}: ${list(values)}`);
          }
        }
      }
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

const ISSUE_BODY_LIMIT = 60_000;

/** Issue title and body for one drifting package; the title is the stable duplicate-search key. */
export function issueFor(result) {
  const body = renderMarkdown([result], { heading: '# Upstream drift' }).replace(/^## .*\n\n/u, '');
  const clipped = body.length > ISSUE_BODY_LIMIT ? `${body.slice(0, ISSUE_BODY_LIMIT)}\n\n(report truncated)\n` : body;
  return {
    title: `Upstream drift: ${result.name} ${result.pinned} \u2192 ${result.latest}`,
    body: `${clipped}\nGenerated by the upstream-watch workflow. Bump the pin in \`scripts/fixtures/upstream-package-pins.json\` once the parity work lands.\n`,
  };
}

function writeIssueFiles(results, directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const result of results.filter((entry) => entry.drift && hasDrift(entry.diff))) {
    const issue = issueFor(result);
    fs.writeFileSync(path.join(directory, `${result.ecosystem}.title`), `${issue.title}\n`);
    fs.writeFileSync(path.join(directory, `${result.ecosystem}.md`), issue.body);
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const issueFlag = args.indexOf('--issue-dir');
    const issueDirectory = issueFlag >= 0 ? args[issueFlag + 1] : undefined;
    if (issueFlag >= 0 && !issueDirectory) throw new Error('--issue-dir needs a directory');
    const unknown = args.filter((argument, index) => argument !== '--json' && argument !== '--issue-dir' && index !== issueFlag + 1);
    if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
    const pins = JSON.parse(fs.readFileSync(PIN_FIXTURE, 'utf8'));
    const results = await runUpstreamDrift({ pins });
    if (issueDirectory) writeIssueFiles(results, issueDirectory);
    process.stdout.write(args.includes('--json') ? `${JSON.stringify(results, null, 2)}\n` : renderMarkdown(results));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (isMainModule(import.meta.url)) await main();
