import { inspectExportContract } from './component-metadata.mjs';
import { mirroredMembers } from './lyra-rename-ledger.mjs';

const sections = Object.freeze({
  attribute: 'attributes', property: 'properties', event: 'events', part: 'parts',
  'css-property': 'cssProperties', slot: 'slots', 'css-state': 'cssStates', method: 'methods',
});
const exposureKinds = ['event', 'part', 'css-property'];
const memberKinds = new Set([...Object.keys(sections), 'component', 'slot-content']);
const exportKinds = new Set(['entry-point', 'stylesheet', 'function', 'type', 'constant', 'class', 'window-event', 'root-attribute']);
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const clone = value => structuredClone(value);
function requireThat(condition, message) { if (!condition) throw new Error(message); }
function version(value) {
  const match = typeof value === 'string' && stableVersion.exec(value);
  requireThat(match, `Expected a stable published version, received ${String(value)}`);
  return match.slice(1).map(Number);
}
function compare(left, right) {
  const a = version(left); const b = version(right);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Exact identities, including the unnamed default slot, never use ambiguous joined strings. */
export function compatibilityKey(key) {
  requireThat(plain(key), 'Invalid compatibility identity');
  const text = value => typeof value === 'string' && !/[\u0000-\u001f]/u.test(value);
  if (key.scope === 'member') {
    requireThat(/^lr-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(key.tag) && memberKinds.has(key.kind) && text(key.name) &&
      (key.name.length > 0 || ['slot', 'slot-content'].includes(key.kind)), 'Invalid member identity');
    return JSON.stringify(['member', key.tag, key.kind, key.name]);
  }
  requireThat(key.scope === 'export' && exportKinds.has(key.kind) && text(key.name) && key.name.length > 0 &&
    (key.module == null || (text(key.module) && key.module.length > 0)), 'Invalid export identity');
  return JSON.stringify(['export', key.kind, key.module ?? null, key.name]);
}

export function policyKey(policy, scope = 'member') {
  return scope === 'member'
    ? { scope, tag: policy.tag, kind: policy.kind, name: policy.name }
    : { scope, kind: policy.kind, module: policy.module ?? null, name: policy.name };
}

/** Current exports and historical export policies/replacements inspected in the exact source. */
export function compatibilityExportCandidates(metadata, captures) {
  const candidates = new Map();
  const add = entry => candidates.set(compatibilityKey(policyKey(entry, 'export')), entry);
  const current = new Set(metadata.exportDeprecations.map(entry => compatibilityKey(policyKey(entry, 'export'))));
  for (const entry of metadata.exportDeprecations) add(entry);
  for (const capture of captures) for (const entry of capture.records) {
    if (entry.key.scope !== 'export' || current.has(compatibilityKey(entry.key))) continue;
    add(entry.policy);
    add({ ...entry.policy.replacement, module: entry.policy.replacement.module ?? entry.policy.module });
  }
  return [...candidates.values()];
}

function member(component, kind, name) {
  if (kind === 'component') return component ? { name: component.tag, deprecated: Boolean(component.maturity?.deprecated) } : null;
  return component?.surface?.[sections[kind === 'slot-content' ? 'slot' : kind]]?.find(item => item.name === name) ?? null;
}
function policies(component) {
  const entries = [...(component.maturity?.deprecations ?? [])];
  if (component.maturity?.deprecated && !entries.some(entry => entry.kind === 'component')) entries.push(component.maturity.deprecated);
  return entries;
}
function index(items, key, label) {
  const result = Object.create(null);
  for (const item of items) {
    const id = key(item);
    requireThat(!Object.hasOwn(result, id), `Duplicate ${label}: ${id}`);
    result[id] = item;
  }
  return result;
}

/** Only exports eligible in the next major need replacement-source evidence in this capture. */
export function publishedExportSurface({ metadata, packageJson, readSource }) {
  const entries = new Map();
  for (const policy of metadata.exportDeprecations) {
    if (version(policy.removalNotBefore)[0] > version(packageJson.version)[0] + 1) continue;
    const replacement = { ...policy.replacement, module: policy.replacement.module ?? policy.module };
    const key = policyKey(replacement, 'export');
    const fact = inspectExportContract(replacement, { packageJson, readSource, exportDeprecations: metadata.exportDeprecations });
    requireThat(fact.status === 'present' && !fact.deprecated, `Published replacement export is unavailable: ${compatibilityKey(key)}`);
    entries.set(compatibilityKey(key), { key, sourcePath: fact.sourcePath, isType: fact.isType, deprecated: fact.deprecated });
  }
  return [...entries.values()];
}

/** Versioned reader for the schema shipped in 22; takes immutable parsed inputs, never current files. */
export function extractPublishedCompatibility({ metadata, inventory, packageJson, renameLedger, manifest, exportSources = {} }, readerVersion = 1) {
  requireThat(readerVersion === 1, `Unsupported compatibility reader ${readerVersion}`);
  requireThat(metadata?.schemaVersion === 2 && inventory?.schemaVersion === 1 && renameLedger?.schemaVersion === 1 && manifest?.schemaVersion === '1.0.0', 'Unsupported published input schema');
  const sourceVersion = packageJson?.version;
  version(sourceVersion);
  requireThat(packageJson.name === '@aceshooting/lyra-ui' && inventory.pins?.lyraVersion === sourceVersion &&
    metadata.history?.current?.version === sourceVersion, 'Published input versions disagree');
  const components = inventory.components.map(component => ({
    tag: component.tag,
    maturity: { deprecated: clone(component.maturity?.deprecated ?? null), deprecations: clone(component.maturity?.deprecations ?? []) },
    surface: Object.fromEntries(Object.values(sections).map(section => [section, (component.surface?.[section] ?? []).map(entry =>
      Object.fromEntries(['name', 'type', 'attribute', 'property', 'reflects', 'hasDefault', 'default', 'deprecated'].filter(key => Object.hasOwn(entry, key)).map(key => [key, key === 'deprecated' ? Boolean(entry[key]) : clone(entry[key])])))])),
  }));
  const byTag = index(components, component => component.tag, 'published owner');
  const records = [...metadata.deprecations.map(policy => ({ key: policyKey(policy), policy: clone(policy) })),
    ...metadata.exportDeprecations.map(policy => ({ key: policyKey(policy, 'export'), policy: clone(policy) }))];
  index(records, entry => compatibilityKey(entry.key), 'published policy');
  for (const { key, policy } of records) {
    version(policy.since); version(policy.removalNotBefore);
    requireThat(compare(policy.since, sourceVersion) <= 0, 'Published notice predates its release incorrectly');
    if (key.scope === 'member') {
      const original = policies(byTag[key.tag] ?? {}).find(candidate => compatibilityKey(policyKey(candidate)) === compatibilityKey(key));
      requireThat(original && same(original, policy), `Published inventory policy disagrees: ${compatibilityKey(key)}`);
      requireThat(member(byTag[key.tag], key.kind, key.name), `Published source member missing: ${compatibilityKey(key)}`);
    }
  }
  const exposure = Object.fromEntries(exposureKinds.map(kind => [kind, Object.create(null)]));
  for (const component of components) for (const kind of exposureKinds) {
    for (const item of component.surface[sections[kind]]) (exposure[kind][item.name] ??= []).push(component.tag);
  }
  for (const names of Object.values(exposure)) for (const tags of Object.values(names)) tags.sort();
  const policyIdentities = new Set(records.filter(entry => entry.key.scope === 'member').flatMap(({ key, policy }) => [
    compatibilityKey(key), ...(policy.attribute ? [compatibilityKey({ ...key, kind: 'attribute', name: policy.attribute })] : []),
  ]));
  const mirrors = [...mirroredMembers(inventory)].map(([key, upstreamTag]) => {
    const [tag, kind, name] = key.split('\u0000'); return { tag, kind, name, upstreamTag };
  }).filter(entry => policyIdentities.has(compatibilityKey(policyKey(entry))));
  // Full exact policies live once in records; owner snapshots retain only migration surface facts.
  const sourceComponents = components.map(({ tag, surface }) => ({ tag, surface }));
  const eligible = records.filter(entry => version(entry.policy.removalNotBefore)[0] === version(sourceVersion)[0] + 1 && version(entry.policy.since)[0] < version(sourceVersion)[0]);
  const firstSince = eligible.map(entry => entry.policy.since).sort(compare)[0];
  const policyReleaseHistory = firstSince ? (metadata.history.releases ?? []).filter(release => compare(release.version, firstSince) >= 0 && compare(release.version, sourceVersion) < 0)
    .map(({ tag, version, sourceCommit }) => ({ tag, version, sourceCommit })) : [];
  return { schemaVersion: 1, sourceRelease: `lyra-ui@${sourceVersion}`, sourceVersion, records, components: sourceComponents,
    mirrors, exposure, renameLedger: clone(renameLedger), policyReleaseHistory,
    publishedExports: publishedExportSurface({ metadata, packageJson, readSource: path => {
      requireThat(Object.hasOwn(exportSources, path), `Missing published export source ${path}`); return exportSources[path];
    } }) };
}

/** Validates actual-version eligibility and produces detached facts for existing ledger operations. */
export function assembleCompatibilityContext({ packageVersion, currentInventory, currentExportDeprecations = [],
  currentExportSurface = null, componentRegistrationRoutes = {}, captures = [], retirementIndex = [] }) {
  version(packageVersion);
  requireThat(Array.isArray(captures) && Array.isArray(retirementIndex), 'Compatibility captures and retirements must be arrays');
  const components = index(currentInventory.components, item => item.tag, 'current owner');
  requireThat(plain(componentRegistrationRoutes), 'Current component registration routes must be an object');
  for (const [tag, route] of Object.entries(componentRegistrationRoutes)) {
    requireThat(components[tag], `Registration route references an unknown current component: ${tag}`);
    requireThat(route === `./components/${tag}.js`, `Registration route is not the stable tag-shaped route for ${tag}`);
  }
  const currentRecords = index([
    ...currentInventory.components.flatMap(component => policies(component).map(policy => ({ key: policyKey(policy), policy }))),
    ...currentExportDeprecations.map(policy => ({ key: policyKey(policy, 'export'), policy })),
  ], item => compatibilityKey(item.key), 'current policy');
  const exportSurface = index(currentExportSurface ?? [], item => compatibilityKey(item.key), 'current export surface');
  const retirements = index(retirementIndex, item => compatibilityKey(item.key), 'retirement');
  const historical = Object.create(null); const sourceComponents = Object.create(null); const capturesByRelease = new Map(); const mirrors = new Set();
  const exposure = Object.fromEntries(exposureKinds.map(kind => [kind, Object.create(null)]));
  const addExposure = (kind, name, tags) => { exposure[kind][name] = [...new Set([...(exposure[kind][name] ?? []), ...tags])].sort(); };
  for (const capture of captures) {
    version(capture.sourceVersion);
    requireThat(capture.sourceRelease === `lyra-ui@${capture.sourceVersion}` && compare(capture.sourceVersion, packageVersion) <= 0, 'Invalid published capture version');
    requireThat(!capturesByRelease.has(capture.sourceRelease), `Duplicate published capture: ${capture.sourceRelease}`);
    capturesByRelease.set(capture.sourceRelease, capture);
    for (const component of capture.components) {
      // Multiple released snapshots retain the latest source contract while exact policy must agree.
      const previous = sourceComponents[component.tag];
      if (!previous || compare(capture.sourceVersion, previous.version) > 0) sourceComponents[component.tag] = { version: capture.sourceVersion, component };
    }
    for (const mirror of capture.mirrors) mirrors.add(compatibilityKey(policyKey(mirror)));
    for (const kind of exposureKinds) for (const [name, tags] of Object.entries(capture.exposure[kind])) addExposure(kind, name, tags);
    for (const entry of capture.records) {
      const id = compatibilityKey(entry.key);
      version(entry.policy.since); version(entry.policy.removalNotBefore);
      requireThat(compare(entry.policy.since, capture.sourceVersion) <= 0, `Unpublished policy: ${id}`);
      requireThat(!historical[id] || same(historical[id].policy, entry.policy), `Conflicting published policy: ${id}`);
      historical[id] ??= { ...entry, sources: [] };
      historical[id].sources.push(capture.sourceRelease);
    }
  }
  for (const component of currentInventory.components) for (const kind of exposureKinds) {
    for (const item of component.surface?.[sections[kind]] ?? []) addExposure(kind, item.name, [component.tag]);
  }
  const records = Object.create(null); const aliases = Object.create(null);
  const effectiveOwner = tag => {
    if (components[tag]) return tag;
    const id = compatibilityKey({ scope: 'member', tag, kind: 'component', name: tag });
    const policy = historical[id]?.policy; const retirement = retirements[id];
    requireThat(policy?.replacement?.kind === 'component' && retirement && compare(packageVersion, retirement.removedIn) >= 0 && components[policy.replacement.name], `Historical owner ${tag} has no current supported replacement`);
    return policy.replacement.name;
  };
  const hasSupportedMemberSuccessor = (owner, kind, name) => {
    const seen = new Set();
    while (true) {
      const id = compatibilityKey({ scope: 'member', tag: owner, kind, name });
      if (seen.has(id)) return false;
      seen.add(id);
      const currentMember = member(components[owner], kind, name);
      if (!currentMember) return false;
      if (!currentMember.deprecated) return true;
      const replacement = currentRecords[id]?.policy?.replacement;
      if (!replacement || replacement.kind === 'host-css-property') return false;
      if (replacement.kind === 'component') owner = replacement.name;
      kind = replacement.kind;
      name = replacement.name;
    }
  };
  for (const [id, historicalEntry] of Object.entries(historical)) {
    const { key, policy, sources } = historicalEntry;
    const current = currentRecords[id]; const retirement = retirements[id];
    const currentMember = key.scope === 'member' ? member(components[key.tag], key.kind, key.name) : exportSurface[id];
    if (current) {
      requireThat(same(current.policy, policy), `The published policy has changed: ${id}`);
      if (key.scope === 'member' || currentExportSurface !== null) requireThat(currentMember, `Current notice references a missing source member or export: ${id}`);
      records[id] = { state: 'current', key, policy, sourceMember: currentMember, sourceOwner: key.tag ?? null };
    } else {
      if (key.scope === 'member' && key.kind === 'property' && policy.attribute) requireThat(!member(components[key.tag], 'attribute', policy.attribute), `Current notice is missing for surviving paired attribute: ${id}`);
      requireThat(!currentMember || key.kind === 'slot-content', `Current notice is missing for surviving source: ${id}`);
      requireThat(retirement, `Missing retirement record: ${id}`);
      requireThat(sources.includes(retirement.sourceRelease), `Retirement has no exact published source: ${id}`);
      const retirementSource = capturesByRelease.get(retirement.sourceRelease);
      const sourceComponent = key.scope === 'member'
        ? retirementSource?.components.find(component => component.tag === key.tag) ?? null
        : null;
      const sourceMember = key.scope === 'member' && sourceComponent ? member(sourceComponent, key.kind, key.name) : null;
      if (key.scope === 'member') {
        requireThat(sourceComponent, `Retirement has no exact published source component: ${id}`);
        requireThat(sourceMember, `Retirement has no exact published source member: ${id}`);
      }
      requireThat(compare(packageVersion, retirement.removedIn) >= 0, `Cannot remove ${id} before ${retirement.removedIn}`);
      requireThat(compare(retirement.removedIn, policy.removalNotBefore) >= 0 && version(policy.removalNotBefore)[0] >= version(policy.since)[0] + 2, `Retirement violates published floor: ${id}`);
      const pairedId = key.scope === 'member' && key.kind === 'property' && policy.attribute
        ? compatibilityKey({ ...key, kind: 'attribute', name: policy.attribute }) : null;
      requireThat(!mirrors.has(id) && (!pairedId || !mirrors.has(pairedId)), `Protected upstream mirrored member cannot retire: ${id}`);
      if (key.kind === 'slot-content') requireThat(currentMember, `Retired slot content requires its surviving public slot: ${id}`);
      const replacement = policy.replacement;
      requireThat(plain(replacement), `Missing replacement: ${id}`);
      let replacementMember; let replacementOwner = null;
      if (key.scope === 'member') {
        replacementOwner = replacement.kind === 'component' ? replacement.name : effectiveOwner(key.tag);
        replacementMember = member(components[replacementOwner], replacement.kind, replacement.name);
        // Host CSS replacements are native public inputs, not a fabricated component member.
        if (replacement.kind === 'host-css-property' && ['background', 'color', 'inline-size'].includes(replacement.name)) replacementMember = { name: replacement.name };
      } else {
        const replacementKey = policyKey({ ...replacement, module: replacement.module ?? policy.module }, 'export');
        replacementMember = exportSurface[compatibilityKey(replacementKey)];
      }
      const publishedReplacement = captures.some(capture => {
        if (!sources.includes(capture.sourceRelease) || version(capture.sourceVersion)[0] < version(policy.removalNotBefore)[0] - 1) return false;
        if (key.scope === 'export') {
          const target = compatibilityKey(policyKey({ ...replacement, module: replacement.module ?? policy.module }, 'export'));
          return capture.publishedExports?.some(entry => compatibilityKey(entry.key) === target && !entry.deprecated);
        }
        if (replacement.kind === 'host-css-property') return ['background', 'color', 'inline-size'].includes(replacement.name);
        const source = capture.components.find(component => component.tag === replacementOwner);
        const value = member(source, replacement.kind, replacement.name);
        if (replacement.kind === 'component' && capture.records.some(entry => entry.key.scope === 'member' && entry.key.kind === 'component' && entry.key.tag === source?.tag)) return false;
        return value && !value.deprecated;
      });
      requireThat(publishedReplacement, `Replacement was not available in the published compatibility window: ${id}`);
      const supported = key.scope === 'member' && replacement.kind !== 'host-css-property'
        ? hasSupportedMemberSuccessor(replacementOwner, replacement.kind, replacement.name)
        : replacementMember && !replacementMember.deprecated;
      requireThat(replacementMember && supported, `Missing current supported replacement: ${id}`);
      records[id] = { state: 'retired', key, policy, removedIn: retirement.removedIn,
        sourceComponent, sourceMember,
        sourceOwner: key.tag ?? null, replacementOwner, replacementMember };
    }
    if (key.scope === 'member' && key.kind === 'property' && policy.attribute) {
      const alias = compatibilityKey({ ...key, kind: 'attribute', name: policy.attribute });
      requireThat(!historical[alias] || same(historical[alias].policy, policy), `Paired attribute policy collision: ${alias}`);
      requireThat(!aliases[alias] || aliases[alias] === id, `Paired attribute identity collision: ${alias}`);
      aliases[alias] = id;
    }
  }
  for (const [id, retirement] of Object.entries(retirements)) {
    requireThat(historical[id], `Retirement has no published record: ${id}`);
    version(retirement.removedIn);
    const published = historical[id];
    requireThat(published.sources.includes(retirement.sourceRelease), `Retirement has no exact published source: ${id}`);
    requireThat(compare(retirement.removedIn, published.policy.removalNotBefore) >= 0 && version(published.policy.removalNotBefore)[0] >= version(published.policy.since)[0] + 2, `Retirement violates published floor: ${id}`);
    const paired = published.key.scope === 'member' && published.key.kind === 'property' && published.policy.attribute
      ? compatibilityKey({ ...published.key, kind: 'attribute', name: published.policy.attribute }) : null;
    requireThat(!mirrors.has(id) && (!paired || !mirrors.has(paired)), `Protected upstream mirrored member cannot retire: ${id}`);
  }
  return freeze(clone({ schemaVersion: 1, packageVersion, componentRegistrationRoutes, records, aliases, exposure,
    sourceComponents: Object.fromEntries(Object.entries(sourceComponents).map(([tag, entry]) => [tag, entry.component])) }));
}

export function resolveCompatibilityRecord(context, key) {
  const id = compatibilityKey(key);
  return context?.records?.[id] ?? context?.records?.[context.aliases?.[id]] ?? null;
}

export function compatibilityExposure(context, kind, name) {
  return [...(context?.exposure?.[kind]?.[name] ?? [])];
}
