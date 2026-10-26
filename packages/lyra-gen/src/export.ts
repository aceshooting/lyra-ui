import type { JsonValue, LyraGenCatalog, LyraGenNode, LyraGenResult, LyraGenView } from './types.js';
import { validateView } from './runtime.js';
import { dataComponents } from './catalogs/data.js';

export interface DashboardPublicComponent {
  readonly tag: string;
  /** Exact public registration entry, supplied from the reviewed component documentation. */
  readonly import?: string;
  readonly properties: readonly string[];
}
export interface DashboardExportPolicy {
  /** Trusted mapping to documented public tags and properties. */
  readonly components: Readonly<Record<string, DashboardPublicComponent>>;
  /** Each literal needs host approval; runtime state and data references are never serialized. */
  readonly allowProperty: (node: LyraGenNode, name: string, value: JsonValue) => boolean;
  readonly allowText: (node: LyraGenNode, text: string) => boolean;
  readonly maxNodes?: number;
  readonly maxBytes?: number;
}
export interface DashboardTemplateExport { readonly code: string; readonly imports: readonly string[] }
const structuralTags = new Set(['div', 'span', 'p', 'section', 'article', 'header', 'footer', 'h1', 'h2', 'h3', 'ul', 'ol', 'li']);
const forbiddenProperty = /^(?:on|innerHTML$|outerHTML$|textContent$|srcdoc$)|(?:password|credential|secret|token|authorization|cookie)/i;
function referenceOrSecret(value: JsonValue, depth = 0): boolean {
  if (depth > 32) return true;
  if (Array.isArray(value)) return value.some(item => referenceOrSecret(item, depth + 1));
  if (value !== null && typeof value === 'object') return Object.entries(value).some(([key, item]) => key === '$ref' || key === '__proto__' || key === 'constructor' || forbiddenProperty.test(key) || referenceOrSecret(item, depth + 1));
  return typeof value === 'number' && !Number.isFinite(value);
}
function expression(value: JsonValue): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
const layoutStyles = `
  [data-gen-type] { min-inline-size: 0; max-inline-size: 100%; }
  :where([data-gen-type='stack'], [data-gen-type='form']) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-m);
  }
  :where([data-gen-type='row']) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-m);
  }
`;

// Fixed public-table adapter. Generated documents supply only the schema-checked column literals.
const tableColumnsHelper = `function dashboardTableColumns(columns) {
  return columns.map(column => ({ ...column, cell: row => {
    if (row === null || typeof row !== 'object') return '';
    const descriptor = Object.getOwnPropertyDescriptor(row, column.key);
    const value = descriptor && 'value' in descriptor ? descriptor.value : null;
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
  } }));
}`;

/** Produces a static Lit module from individually approved public literals, without effects or snapshots. */
export function exportLyraTemplate(view: LyraGenView, catalog: LyraGenCatalog, policy: DashboardExportPolicy): LyraGenResult<DashboardTemplateExport> {
  const validated = validateView(view, catalog);
  if (!validated.ok) return validated;
  view = validated.value;
  const diagnostics: { code: string; path: string; message: string; severity: 'error' | 'warning' }[] = [];
  const imports = new Set<string>();
  const ids = new Set<string>();
  const ancestors = new Set<LyraGenNode>();
  const maxNodes = policy.maxNodes ?? 1000;
  const maxBytes = policy.maxBytes ?? 262144;
  let count = 0;
  let tableAdapter = false;
  if (![maxNodes, maxBytes].every(value => Number.isSafeInteger(value) && value > 0) || view.version !== '1' || catalog.id !== view.catalog.id || catalog.version !== view.catalog.version) return { ok: false, diagnostics: [{ code: 'export.contract', path: '', message: 'Unsupported export contract or catalog.', severity: 'error' }] };
  const error = (path: string, message: string): never => { diagnostics.push({ code: 'export.rejected', path, message, severity: 'error' }); throw new Error('Export rejected'); };
  const render = (node: LyraGenNode, path: string, depth: number): string => {
    if (++count > maxNodes || depth > 64 || ancestors.has(node) || !node.id || ids.has(node.id)) return error(path, 'Invalid identity or export budget exceeded.');
    ancestors.add(node);
    ids.add(node.id);
    const component = catalog.components[node.type];
    const approved = policy.components[node.type];
    if (!component || !approved || approved.tag !== component.tag) return error(path, 'Component is not approved for public export.');
    const preparesTable = component.tag === 'lr-table' && component.prepareProperties === dataComponents['table']?.prepareProperties;
    if (preparesTable && Array.isArray(node.props?.['columns']) && node.props['columns'].some(column => column !== null && typeof column === 'object' && !Array.isArray(column) && column['format'] !== undefined)) return error(path, 'Formatted table columns require a host locale and cannot be statically exported.');
    if (component.prepareProperties && !preparesTable) return error(path, 'This trusted property adapter has no qualified static export.');
    const custom = /^lr-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(approved.tag);
    if (!custom && !structuralTags.has(approved.tag)) return error(path, 'Unsafe element tag.');
    if (custom) {
      const expected = `@aceshooting/lyra-ui/components/${approved.tag}.js`;
      if (approved.import !== expected) return error(path, 'A public granular registration import is required.');
      imports.add(expected);
    } else if (approved.import) return error(path, 'Structural elements cannot supply imports.');
    const properties: string[] = [];
    const exportedProperties = new Set<string>();
    for (const [name, value] of Object.entries(node.props ?? {})) {
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name) || forbiddenProperty.test(name) || !Object.hasOwn(component.properties, name) || !approved.properties.includes(name)) return error(`${path}/props/${name}`, 'Property is not a documented exportable member.');
      if (referenceOrSecret(value) || !policy.allowProperty(node, name, value)) {
        diagnostics.push({ code: 'export.redacted', path: `${path}/props/${name}`, message: 'Property omitted by export policy.', severity: 'warning' });
        continue;
      }
      if (/(?:href|src|url)$/i.test(name) && typeof value === 'string' && !/^(?:https?:\/\/|\/[^/]|#|\.\.?\/)/i.test(value)) return error(`${path}/props/${name}`, 'Unsafe URL value.');
      const literal = preparesTable && name === 'columns' ? `dashboardTableColumns(${expression(value)})` : expression(value);
      if (preparesTable && name === 'columns') tableAdapter = true;
      properties.push(` .${name}=\${${literal}}`);
      exportedProperties.add(name);
    }
    for (const name of component.required ?? []) {
      if (!properties.some(property => property.startsWith(` .${name}=`))) return error(path, 'Required property cannot be exported after redaction or binding removal.');
    }
    const slot = node.slot === undefined || node.slot === '' ? '' : /^[a-zA-Z][\w-]*$/.test(node.slot) ? ` slot="${node.slot}"` : error(`${path}/slot`, 'Unsafe slot name.');
    const text = node.text !== undefined && policy.allowText(node, node.text) ? `\${${expression(node.text)}}` : '';
    if (component.accessibleName?.required && !((component.accessibleName.text && node.text?.trim() && text) || component.accessibleName.properties?.some(name => exportedProperties.has(name) && typeof node.props?.[name] === 'string' && (node.props[name] as string).trim()))) return error(path, 'Accessible name cannot be exported after redaction.');
    if (node.text && !text) diagnostics.push({ code: 'export.redacted', path: `${path}/text`, message: 'Text omitted by export policy.', severity: 'warning' });
    if (node.action || node.bindings) diagnostics.push({ code: 'export.effects-omitted', path, message: 'Host actions and runtime bindings require application wiring.', severity: 'warning' });
    const children = (node.children ?? []).map((child, index) => render(child, `${path}/children/${index}`, depth + 1)).join('');
    ancestors.delete(node);
    const layout = ` data-gen-type=\${${expression(node.type)}}`;
    return `<${approved.tag}${layout}${slot}${properties.join('')}>${text}${children}</${approved.tag}>`;
  };
  try {
    const template = render(view.root, '/root', 0);
    const sortedImports = [...imports].sort();
    const code = `import { css, html } from 'lit';\n${sortedImports.map(specifier => `import '${specifier}';`).join('\n')}\n\n${tableAdapter ? `${tableColumnsHelper}\n\n` : ''}export const dashboardStyles = css\`${layoutStyles}\`;\n\nexport const dashboardTemplate = html\`${template}\`;\n`;
    if (new TextEncoder().encode(code).byteLength > maxBytes) return error('', 'Export byte budget exceeded.');
    return { ok: true, value: { code, imports: sortedImports }, diagnostics };
  } catch {
    if (!diagnostics.some(diagnostic => diagnostic.severity === 'error')) diagnostics.push({ code: 'export.rejected', path: '', message: 'Export input or host policy failed.', severity: 'error' });
    return { ok: false, diagnostics };
  }
}
