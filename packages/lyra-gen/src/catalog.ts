import type { LyraGenCatalog, LyraGenComponent, LyraGenResult } from './types.js';
import { createCatalog as createCatalogDefinition, initialCatalog as builtInCatalog } from './catalogs/examples.js';
import { catalogPresetRoles } from './catalogs/presets.js';
import type { LyraGenCatalogPresetName } from './catalogs/presets.js';
export { catalogPresetNames, catalogPresetRoles } from './catalogs/presets.js';
export type { LyraGenCatalogPresetName } from './catalogs/presets.js';
import { answerBlockComponents } from './catalogs/blocks.js';
import { dashboardComponents } from './catalogs/dashboard.js';
export { dashboardRoleNames } from './catalogs/dashboard.js';
import { mapComponents, type LyraGenMapOptions } from './catalogs/geo.js';
import { mcpAppActions, mcpAppComponents, type LyraGenMcpAppOptions } from './catalogs/mcp.js';
export type { LyraGenMcpAppOptions, LyraGenMcpAppResource } from './catalogs/mcp.js';
export { mcpToolCallAction } from './catalogs/mcp.js';
export type { LyraGenMapOptions, LyraGenMapRegions } from './catalogs/geo.js';

/** Create a trusted host catalog. Generated content must never construct this definition. */
export function createCatalog(definition: LyraGenCatalog): LyraGenCatalog {
  return createCatalogDefinition(definition);
}

/** A reviewed, bounded subset of Lyra APIs, independent of the complete component inventory. */
export const initialCatalog: LyraGenCatalog = builtInCatalog;

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
    const optional = new Set(definition.optionalChildren);
    const selected = definition.children.filter(child => Object.hasOwn(components, child));
    for (const child of definition.children) if (!Object.hasOwn(components, child) && !optional.has(child)) diagnostics.push({ code: 'catalog.dependency', path: `/components/${role}/children`, message: `Role ${role} requires selected child role ${child}.`, severity: 'error' });
    // An unselected optional child becomes unavailable, so generated content cannot place it here.
    if (selected.length !== definition.children.length) components[role] = { ...definition, children: selected, optionalChildren: selected.filter(child => optional.has(child)) };
  }
  const actions = Object.fromEntries(actionNames.filter(name => {
    if (catalog.actions && Object.hasOwn(catalog.actions, name)) return true;
    diagnostics.push({ code: 'catalog.action', path: '/actions', message: `Unknown catalog action: ${name}`, severity: 'error' });
    return false;
  }).map(name => [name, catalog.actions![name]!]));
  if (diagnostics.length) return { ok: false, diagnostics };
  return { ok: true, value: createCatalog({ id: catalog.id, version: catalog.version, components, actions, ...(catalog.queries ? { queries: catalog.queries } : {}), ...(catalog.fieldPolicy ? { fieldPolicy: catalog.fieldPolicy } : {}) }), diagnostics: [] };
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

export const chatCatalog = /* @__PURE__ */ reviewedPreset('chat');
export const formsCatalog = /* @__PURE__ */ reviewedPreset('forms');
export const dataCatalog = /* @__PURE__ */ reviewedPreset('data');
export const retrievalCatalog = /* @__PURE__ */ reviewedPreset('retrieval');
/** Generic operation status, metrics and messages; actions still require explicit host definitions. */
export const agentOpsCatalog = /* @__PURE__ */ reviewedPreset('agent-ops');
export const catalogPresets: Readonly<Record<LyraGenCatalogPresetName, LyraGenCatalog>> = /* @__PURE__ */ Object.freeze({
  chat: chatCatalog, forms: formsCatalog, data: dataCatalog, retrieval: retrievalCatalog, 'agent-ops': agentOpsCatalog,
});

/**
 * Opt-in overlay adding the composite answer blocks `kpi-row`, `comparison` and `steps` and the
 * read-only `stepper` primitive they expand into. The result has id `<base id>+blocks` and the base
 * version; `stat` always accepts `deltaPercent` and `goodDirection`, even over a custom base that
 * omits them. The base catalog is not modified. Throws a `TypeError` when the base lacks `row`, `stat` or `table`, or already defines
 * a block or `stepper` role.
 */
export function answerBlocksCatalog(base: LyraGenCatalog = initialCatalog): LyraGenCatalog {
  return createCatalog({ ...base, id: `${base.id}+blocks`, version: base.version, components: { ...base.components, ...answerBlockComponents(base) } });
}

/**
 * Opt-in overlay adding the reviewed live-dashboard roles: metrics (`gauge`, `sparkline`,
 * `progress-bar`, `progress-ring`, `budget-meter`, `number-ticker`, `funnel`, `poll-status`),
 * structure (`tabs` with `tab` and `tab-panel`, `details`, `timeline` with `timeline-item`) and
 * charts (`series-chart`, `treemap`, `sankey`, `word-cloud`). The result has id
 * `<base id>+dashboard` and the base version; the base catalog is not modified. Throws a `TypeError`
 * when the base already defines one of the added roles.
 */
export function dashboardCatalog(base: LyraGenCatalog = initialCatalog): LyraGenCatalog {
  return createCatalog({ ...base, id: `${base.id}+dashboard`, version: base.version, components: { ...base.components, ...dashboardComponents(base) } });
}

/**
 * Layout, metric, chart and driving-control roles a live dashboard answer needs, with no actions.
 * The full overlay is a reviewed pool larger than one prompt budget; prompt with a preset like this
 * one, or `subsetCatalog()` it to the roles a request needs.
 */
export const liveDashboardRoles: readonly string[] = Object.freeze([
  'stack', 'row', 'text', 'heading', 'card', 'badge', 'alert', 'empty', 'skeleton', 'stat', 'table', 'chart', 'slider', 'switch', 'select', 'option',
  'gauge', 'sparkline', 'progress-bar', 'progress-ring', 'budget-meter', 'number-ticker', 'funnel', 'poll-status',
  'tabs', 'tab', 'tab-panel', 'details', 'series-chart', 'heatmap', 'data-grid', 'time-range', 'filter-bar',
  'format-number', 'relative-time', 'callout', 'tag',
]);

/** The dashboard overlay narrowed to `liveDashboardRoles`; id `lyra-reviewed+dashboard/live`. */
export const liveDashboardCatalog: LyraGenCatalog = /* @__PURE__ */ (() => {
  const overlay = dashboardCatalog();
  const selected = subsetCatalog(overlay, liveDashboardRoles);
  if (!selected.ok) throw new TypeError('The live dashboard preset has an invalid role dependency.');
  return createCatalog({ ...selected.value, id: `${overlay.id}/live` });
})();

/**
 * Opt-in overlay adding the `map` role over a host-owned basemap: generated content supplies only a
 * label, camera (`center`, `zoom`) and at most 500 labelled markers; `options.mapStyle` is assigned by
 * the trusted adapter and is never part of the prompt or the generated schema. The result has id
 * `<base id>+map`. Throws a `TypeError` without a style or when the base already defines `map`.
 */
export function mapCatalog(base: LyraGenCatalog, options: LyraGenMapOptions): LyraGenCatalog {
  return createCatalog({ ...base, id: `${base.id}+map`, version: base.version, components: { ...base.components, ...mapComponents(base, options) } });
}

/**
 * Opt-in overlay adding a sandboxed `mcp-app` role (id `<base id>+mcp-app`). The host reviews every
 * resource, sandbox setting and allowed tool; generated content only picks a resource id, a label and
 * bounded input, and app tool requests surface as a confirmed `mcp-tool-call` action for the host.
 */
export function mcpAppCatalog(base: LyraGenCatalog, options: LyraGenMcpAppOptions): LyraGenCatalog {
  return createCatalog({ ...base, id: `${base.id}+mcp-app`, version: base.version, components: { ...base.components, ...mcpAppComponents(base, options) }, actions: { ...base.actions, ...mcpAppActions(options) } });
}
