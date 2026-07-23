import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './schema-viewer.styles.js';

export interface JsonSchemaNode {
  $ref?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode | JsonSchemaNode[];
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  examples?: unknown[];
  oneOf?: JsonSchemaNode[];
  anyOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
  [key: string]: unknown;
}
export interface SchemaValidationIssue {
  path: string;
  message: string;
  severity?: 'error' | 'warning' | 'info';
}
export interface LyraSchemaViewerEventMap {
  'lr-schema-select': CustomEvent<{ path: string; schema: JsonSchemaNode }>;
}

interface SchemaRenderBudget {
  remaining: number;
  truncated: boolean;
}

const MAX_RENDERED_SCHEMA_NODES = 500;
const MAX_SCHEMA_DEPTH = 100;

/**
 * `<lr-schema-viewer>` — a recursive, selectable JSON Schema inspector with required-state,
 * constraints, composition branches, `$ref` display, validation issues, cycle protection, and a
 * configurable depth ceiling. It does not resolve remote references or validate values.
 *
 * @customElement lr-schema-viewer
 * @event lr-schema-select - A schema node was activated. `detail: { path, schema }`.
 * @csspart base - The named schema region.
 * @csspart tree - The recursive schema tree.
 * @csspart node - One schema node.
 * @csspart node-selected - The selected schema node.
 * @csspart node-trigger - A schema-node activation button.
 * @csspart name - Property/branch name.
 * @csspart type - Schema type badge.
 * @csspart required - Required badge.
 * @csspart description - Caller-supplied schema description.
 * @csspart constraints - Recognized schema constraints.
 * @csspart issue - One caller-supplied validation issue.
 * @csspart limit - Resource-ceiling status shown when additional nodes are omitted.
 * @csspart empty - The empty state.
 * @cssprop [--lr-schema-viewer-selected-border=var(--lr-color-brand)] - Selected node branch.
 * @cssprop [--lr-schema-viewer-error-border=var(--lr-color-danger)] - Error issue border.
 * @cssprop [--lr-schema-viewer-error-bg=var(--lr-color-danger-quiet)] - Error issue background.
 * @cssprop [--lr-schema-viewer-warning-border=var(--lr-color-warning)] - Warning issue border.
 * @cssprop [--lr-schema-viewer-warning-bg=var(--lr-color-warning-quiet)] - Warning issue background.
 */
export class LyraSchemaViewer extends LyraElement<LyraSchemaViewerEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) schema: JsonSchemaNode | null = null;
  @property({ attribute: false }) issues: SchemaValidationIssue[] = [];
  @property({ attribute: 'selected-path' }) selectedPath = '';
  /** Requested nesting depth, clamped to 100 to keep recursive template construction stack-safe. */
  @property({ type: Number, attribute: 'max-depth' }) maxDepth = 20;
  @property() label = '';

  private pointerSegment(value: string): string {
    return value.replace(/~/g, '~0').replace(/\//g, '~1');
  }

  private constraints(schema: JsonSchemaNode): string[] {
    const keys = [
      'format',
      'pattern',
      'minimum',
      'maximum',
      'minLength',
      'maxLength',
      'minItems',
      'maxItems',
      'minProperties',
      'maxProperties',
    ];
    const rows = keys.flatMap((key) => (schema[key] == null ? [] : [`${key}: ${String(schema[key])}`]));
    if (schema.enum) rows.push(`enum: ${schema.enum.map(String).join(', ')}`);
    if (schema.$ref) rows.push(`$ref: ${schema.$ref}`);
    return rows;
  }

  private renderNode(
    name: string,
    schema: JsonSchemaNode,
    path: string,
    required: boolean,
    depth: number,
    ancestors: Set<object>,
    budget: SchemaRenderBudget,
  ): TemplateResult | typeof nothing {
    if (budget.remaining <= 0) {
      budget.truncated = true;
      return nothing;
    }
    budget.remaining--;
    const selected = path === this.selectedPath;
    if (ancestors.has(schema)) {
      return html`<li part="node"><span part="description">${this.localize('schemaViewerCircular')}</span></li>`;
    }
    const nextAncestors = new Set(ancestors).add(schema);
    const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type ?? (schema.properties ? 'object' : '');
    const constraints = this.constraints(schema);
    const issues = this.issues.filter((issue) => issue.path === path);
    const children: Array<{ name: string; node: JsonSchemaNode; path: string; required: boolean }> = [];
    const addChild = (child: { name: string; node: JsonSchemaNode; path: string; required: boolean }): boolean => {
      if (children.length >= budget.remaining) {
        budget.truncated = true;
        return false;
      }
      children.push(child);
      return true;
    };
    if (depth < finiteCount(this.maxDepth, 20, MAX_SCHEMA_DEPTH)) {
      const properties = schema.properties ?? {};
      for (const key in properties) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) continue;
        const node = properties[key];
        if (!node) continue;
        if (!addChild({
          name: key,
          node,
          path: `${path}/properties/${this.pointerSegment(key)}`,
          required: schema.required?.includes(key) ?? false,
        })) break;
      }
      for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
        const nodes = schema[keyword] ?? [];
        for (let index = 0; index < nodes.length; index++) {
          const node = nodes[index];
          if (!node || !addChild({
            name: `${keyword}[${index}]`,
            node,
            path: `${path}/${keyword}/${index}`,
            required: false,
          })) break;
        }
      }
      if (schema.items && !Array.isArray(schema.items)) {
        addChild({ name: 'items', node: schema.items, path: `${path}/items`, required: false });
      }
    }
    const nodePart = selected ? 'node node-selected' : 'node';
    return html`
      <li part=${nodePart}>
        <button
          part="node-trigger"
          type="button"
          data-path=${path}
          aria-pressed=${selected ? 'true' : 'false'}
          @click=${() => this.emit('lr-schema-select', { path, schema })}
        >
          <strong part="name">${name}</strong>
          ${type
            ? html`<lr-badge part="type" variant="neutral">${this.localize('schemaViewerType', undefined, { type })}</lr-badge>`
            : nothing}
          ${required ? html`<lr-badge part="required" variant="danger">${this.localize('schemaViewerRequired')}</lr-badge>` : nothing}
        </button>
        ${schema.description ? html`<p part="description">${schema.description}</p>` : nothing}
        ${constraints.length ? html`<ul part="constraints">${constraints.map((row) => html`<li>${row}</li>`)}</ul>` : nothing}
        ${issues.map(
          (issue) => html`<p part="issue" data-severity=${issue.severity ?? 'error'}>${issue.message}</p>`,
        )}
        ${children.length
          ? html`<ul>${children.map((child) =>
              this.renderNode(child.name, child.node, child.path, child.required, depth + 1, nextAncestors, budget),
            )}</ul>`
          : nothing}
      </li>
    `;
  }

  override render(): TemplateResult {
    const label = this.getAttribute('aria-label') || this.label || this.localize('schemaViewerLabel');
    if (!this.schema || typeof this.schema !== 'object') {
      return html`<section part="base" aria-label=${label}>
        <lr-empty part="empty" heading=${this.localize('schemaViewerEmpty')}></lr-empty>
      </section>`;
    }
    const budget: SchemaRenderBudget = { remaining: MAX_RENDERED_SCHEMA_NODES, truncated: false };
    const tree = this.renderNode(this.schema.title || '$', this.schema, '', false, 0, new Set(), budget);
    return html`
      <section part="base" aria-label=${label}>
        <ul part="tree">
          ${tree}
        </ul>
        ${budget.truncated
          ? html`<p part="limit" role="status">${this.localize('schemaViewerLimit', undefined, {
                count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_SCHEMA_NODES),
              })}</p>`
          : nothing}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-schema-viewer': LyraSchemaViewer;
  }
}
