import type { LyraGenCatalog, LyraGenComponent, LyraGenResult } from './types.js';
import { assertComponentContentPolicy, snapshotFieldPolicy } from './content-policy.js';
import { catalogPresetRoles } from './catalogs/presets.js';
import type { LyraGenCatalogPresetName } from './catalogs/presets.js';
export { catalogPresetNames, catalogPresetRoles } from './catalogs/presets.js';
export type { LyraGenCatalogPresetName } from './catalogs/presets.js';
import { reviewedExamples } from './catalogs/examples.js';
import { formComponents } from './catalogs/forms.js';
import { conversationComponents } from './catalogs/conversation.js';
import { dataComponents } from './catalogs/data.js';
import { retrievalComponents } from './catalogs/retrieval.js';
import { answerBlockComponents } from './catalogs/blocks.js';
import { appearance, boolean, choice, documentation, label, size, string, variant } from './catalogs/shared.js';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Create a trusted host catalog. Generated content must never construct this definition. */
export function createCatalog(definition: LyraGenCatalog): LyraGenCatalog {
  if (!definition.id.trim() || !definition.version.trim()) throw new TypeError('Catalog id and version are required.');
  if (Object.keys(definition.components).length === 0) throw new TypeError('A catalog must contain at least one reviewed role.');
  const fieldPolicy = snapshotFieldPolicy(definition);
  const components: Record<string, LyraGenComponent> = Object.create(null) as Record<string, LyraGenComponent>;
  for (const [role, component] of Object.entries(definition.components)) {
    assertComponentContentPolicy(component);
    if (!/^[a-z][a-z0-9-]*$/.test(role)) throw new TypeError(`Invalid catalog role: ${role}`);
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(component.tag)) throw new TypeError(`Invalid trusted tag: ${component.tag}`);
    for (const key of Object.keys(component.properties)) {
      if (/^(?:on|innerHTML$|outerHTML$|srcdoc$|style$|className$|constructor$|prototype$|__proto__$)/i.test(key)) throw new TypeError(`Unsafe catalog property: ${key}`);
    }
    if (component.accessibleName?.required && !(component.accessibleName.text && component.text) && !component.accessibleName.properties?.some(key => Object.hasOwn(component.properties, key))) throw new TypeError(`Missing accessible name source for ${role}`);
    for (const key of component.required ?? []) if (!(key in component.properties)) throw new TypeError(`Unknown required property ${role}.${key}`);
    for (const [key, binding] of Object.entries(component.bindings ?? {})) {
      if (!(key in component.properties) || !(binding.property in component.properties)) throw new TypeError(`Unknown binding property ${role}.${key}`);
    }
    components[role] = component;
  }
  for (const [role, component] of Object.entries(components)) {
    if (Array.isArray(component.children)) for (const child of component.children) {
      if (!Object.hasOwn(components, child)) throw new TypeError(`Missing child role ${role}.${child}`);
    }
  }
  return freeze({ ...definition, components, ...(fieldPolicy ? { fieldPolicy } : {}) });
}

const structuralComponents: Readonly<Record<string, LyraGenComponent>> = {
  stack: { tag: 'div', properties: {}, children: true, description: 'Group related content vertically.' },
  row: { tag: 'div', properties: {}, children: true, description: 'Group a short row of related content; the renderer controls responsive wrapping.' },
  text: { tag: 'p', properties: {}, text: true, description: 'Plain text, never interpreted as HTML.' },
  heading: { tag: 'h2', properties: {}, text: true, accessibleName: { required: true, text: true } },
  card: { tag: 'lr-card', properties: { appearance }, children: true, slots: ['', 'header', 'footer', 'actions'], load: () => import('@aceshooting/lyra-ui/components/lr-card.js'), documentation: documentation('lr-card') },
  badge: { tag: 'lr-badge', properties: { variant, appearance, size, pill: boolean }, text: true, load: () => import('@aceshooting/lyra-ui/components/lr-badge.js'), documentation: documentation('lr-badge') },
  alert: { tag: 'lr-alert', properties: { variant, open: boolean, closable: boolean }, text: true, children: ['text', 'button'], slots: [''], load: () => import('@aceshooting/lyra-ui/components/lr-alert.js'), documentation: documentation('lr-alert') },
  empty: { tag: 'lr-empty', properties: { heading: label, description: string(1024), size }, required: ['heading'], children: ['button'], slots: ['actions'], load: () => import('@aceshooting/lyra-ui/components/lr-empty.js'), documentation: documentation('lr-empty') },
  skeleton: { tag: 'lr-skeleton', properties: { label, shape: choice('rect', 'circle', 'text'), effect: choice('none', 'pulse', 'sheen') }, load: () => import('@aceshooting/lyra-ui/components/lr-skeleton.js'), documentation: documentation('lr-skeleton') },
  stat: { tag: 'lr-stat', properties: { label, value: string(256), unit: string(64), caption: string(512), variant }, required: ['label', 'value'], load: () => import('@aceshooting/lyra-ui/components/lr-stat.js'), documentation: documentation('lr-stat') },
};

/** A reviewed, bounded subset of Lyra APIs, independent of the complete component inventory. */
export const initialCatalog = createCatalog({
  id: 'lyra-reviewed',
  version: '1',
  components: Object.fromEntries(Object.entries({ ...structuralComponents, ...formComponents, ...conversationComponents, ...dataComponents, ...retrievalComponents }).map(([role, component]) => {
    const metadata = reviewedExamples[role];
    if (!metadata) throw new TypeError(`Missing reviewed example for ${role}`);
    return [role, { ...component, ...(component.bindings ? { fieldPurpose: 'general' as const } : {}), useWhen: metadata.useWhen, examples: [metadata.example] }];
  })),
});

/** Narrow a catalog deliberately; unknown roles and missing child dependencies are refused. */
export function subsetCatalog(catalog: LyraGenCatalog, roles: readonly string[], actionNames: readonly string[] = []): LyraGenResult<LyraGenCatalog> {
  const diagnostics: { code: string; path: string; message: string; severity: 'error' }[] = [];
  if (!roles.length) return { ok: false, diagnostics: [{ code: 'catalog.empty', path: '/components', message: 'Select at least one catalog role.', severity: 'error' }] };
  const components: Record<string, LyraGenComponent> = Object.create(null) as Record<string, LyraGenComponent>;
  for (const role of roles) {
    if (!Object.hasOwn(catalog.components, role)) diagnostics.push({ code: 'catalog.role', path: '/components', message: `Unknown catalog role: ${role}`, severity: 'error' });
    else components[role] = catalog.components[role]!;
  }
  for (const [role, definition] of Object.entries(components)) if (Array.isArray(definition.children)) {
    for (const child of definition.children) if (!Object.hasOwn(components, child)) diagnostics.push({ code: 'catalog.dependency', path: `/components/${role}/children`, message: `Role ${role} requires selected child role ${child}.`, severity: 'error' });
  }
  const actions = Object.fromEntries(actionNames.filter(name => {
    if (catalog.actions && Object.hasOwn(catalog.actions, name)) return true;
    diagnostics.push({ code: 'catalog.action', path: '/actions', message: `Unknown catalog action: ${name}`, severity: 'error' });
    return false;
  }).map(name => [name, catalog.actions![name]!]));
  if (diagnostics.length) return { ok: false, diagnostics };
  return { ok: true, value: createCatalog({ id: catalog.id, version: catalog.version, components, actions, ...(catalog.fieldPolicy ? { fieldPolicy: catalog.fieldPolicy } : {}) }), diagnostics: [] };
}

/** Select a reviewed request preset; action authority is empty unless the host names source actions. */
export function selectCatalogPreset(name: LyraGenCatalogPresetName, source: LyraGenCatalog = initialCatalog, actionNames: readonly string[] = []): LyraGenResult<LyraGenCatalog> {
  if (!Object.hasOwn(catalogPresetRoles, name)) return { ok: false, diagnostics: [{ code: 'catalog.preset', path: '', message: 'Unknown reviewed catalog preset.', severity: 'error' }] };
  const selected = subsetCatalog(source, catalogPresetRoles[name], actionNames);
  if (!selected.ok) return selected;
  return { ok: true, value: createCatalog({ ...selected.value, id: `${source.id}/${name}` }), diagnostics: selected.diagnostics };
}

function reviewedPreset(name: LyraGenCatalogPresetName): LyraGenCatalog {
  const selected = selectCatalogPreset(name);
  if (!selected.ok) throw new TypeError(`Reviewed preset ${name} has an invalid role dependency.`);
  return selected.value;
}

export const chatCatalog = reviewedPreset('chat');
export const formsCatalog = reviewedPreset('forms');
export const dataCatalog = reviewedPreset('data');
export const retrievalCatalog = reviewedPreset('retrieval');
/** Generic operation status, metrics and messages; actions still require explicit host definitions. */
export const agentOpsCatalog = reviewedPreset('agent-ops');
export const catalogPresets: Readonly<Record<LyraGenCatalogPresetName, LyraGenCatalog>> = Object.freeze({
  chat: chatCatalog, forms: formsCatalog, data: dataCatalog, retrieval: retrievalCatalog, 'agent-ops': agentOpsCatalog,
});

/**
 * Opt-in overlay adding the composite answer blocks `kpi-row`, `comparison` and `steps` and the
 * read-only `stepper` primitive they expand into. The result has id `<base id>+blocks` and the base
 * version; `stat` additionally accepts `deltaPercent` and `goodDirection`. The base catalog is not
 * modified. Throws a `TypeError` when the base lacks `row`, `stat` or `table`, or already defines
 * a block or `stepper` role.
 */
export function answerBlocksCatalog(base: LyraGenCatalog = initialCatalog): LyraGenCatalog {
  return createCatalog({ ...base, id: `${base.id}+blocks`, version: base.version, components: { ...base.components, ...answerBlockComponents(base) } });
}
