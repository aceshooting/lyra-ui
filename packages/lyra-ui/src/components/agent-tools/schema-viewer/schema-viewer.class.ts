import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import '../../overlays/badge/badge.class.js';
import '../../overlays/empty/empty.class.js';
import { styles } from './schema-viewer.styles.js';
import { overallSemanticLabel } from '../semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_schemaViewerCircular, LYRA_DEFAULT_schemaViewerEmpty, LYRA_DEFAULT_schemaViewerIssueLimit, LYRA_DEFAULT_schemaViewerLabel, LYRA_DEFAULT_schemaViewerLimit, LYRA_DEFAULT_schemaViewerRequired, LYRA_DEFAULT_schemaViewerType } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface JsonSchemaNode {
  readonly $ref?: string;
  readonly type?: string | readonly string[];
  readonly title?: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchemaNode>>;
  readonly items?: JsonSchemaNode | readonly JsonSchemaNode[];
  readonly required?: readonly string[];
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly default?: unknown;
  readonly examples?: readonly unknown[];
  readonly oneOf?: readonly JsonSchemaNode[];
  readonly anyOf?: readonly JsonSchemaNode[];
  readonly allOf?: readonly JsonSchemaNode[];
  readonly [key: string]: unknown;
}
export interface SchemaValidationIssue {
  path: string;
  message: string;
  severity?: 'error' | 'warning' | 'info';
}
export interface LyraSchemaViewerEventMap {
  'lr-schema-select': CustomEvent<LyraEventDetailSnapshot<{ path: string; schema: JsonSchemaNode }>>;
}

interface SchemaRenderBudget {
  remaining: number;
  truncated: boolean;
}

const MAX_RENDERED_SCHEMA_NODES = 500;
const MAX_RENDERED_SCHEMA_ISSUES = 500;
const MAX_SCHEMA_DEPTH = 100;
const MAX_CONSTRAINT_VALUES = 50;
const MAX_CONSTRAINT_VALUE_CHARACTERS = 1_000;
const MAX_CONSTRAINT_OBJECT_NODES = 50;

function constraintValue(value: unknown): string {
  const seen = new Set<object>();
  let remaining = MAX_CONSTRAINT_OBJECT_NODES;
  const visit = (candidate: unknown, depth: number): string => {
    if (remaining-- <= 0) return '…';
    if (candidate === null) return 'null';
    if (typeof candidate === 'string') return JSON.stringify(candidate.slice(0, MAX_CONSTRAINT_VALUE_CHARACTERS));
    if (typeof candidate === 'number' || typeof candidate === 'boolean') return String(candidate);
    if (typeof candidate === 'bigint') return `${candidate.toString()}n`;
    if (candidate === undefined) return 'undefined';
    if (typeof candidate !== 'object') return String(candidate);
    if (seen.has(candidate)) return '[Circular]';
    if (depth >= 3) return Array.isArray(candidate) ? '[…]' : '{…}';
    seen.add(candidate);
    let result: string;
    if (Array.isArray(candidate)) {
      const values = candidate.slice(0, MAX_CONSTRAINT_VALUES).map((item) => visit(item, depth + 1));
      result = `[${values.join(', ')}${candidate.length > values.length ? ', …' : ''}]`;
    } else {
      const entries = Object.entries(candidate).slice(0, MAX_CONSTRAINT_VALUES);
      result = `{${entries.map(([key, item]) => `${JSON.stringify(key)}: ${visit(item, depth + 1)}`).join(', ')}${
        Object.keys(candidate).length > entries.length ? ', …' : ''
      }}`;
    }
    seen.delete(candidate);
    return result.slice(0, MAX_CONSTRAINT_VALUE_CHARACTERS);
  };
  return visit(value, 0);
}

function isReadonlyArray<Value>(
  value: Value | readonly Value[] | undefined,
): value is readonly Value[] {
  return Array.isArray(value);
}

/**
 * `<lr-schema-viewer>` — a recursive, selectable JSON Schema inspector with required-state,
 * constraints, composition branches, `$ref` display, validation issues, cycle protection, and a
 * configurable depth ceiling. It does not resolve remote references or validate values.
 *
 * Public schema records and issue collections take bounded, clone-owned readonly snapshots.
 * Create and reassign a new record or array after changes; mutating the assigned value does not
 * update the view.
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
 * @csspart issue-limit - Resource-ceiling status shown when additional validation issues are omitted.
 * @csspart empty - The empty state.
 * @cssprop [--lr-schema-viewer-selected-border=var(--lr-color-brand)] - Selected node branch.
 * @cssprop [--lr-schema-viewer-max-indent=var(--lr-size-12rem)] - Maximum visual indentation;
 *   complete JSON Pointer paths and selection semantics remain unchanged at deeper levels.
 * @cssprop [--lr-schema-viewer-error-border=var(--lr-color-danger)] - Error issue border.
 * @cssprop [--lr-schema-viewer-error-bg=var(--lr-color-danger-quiet)] - Error issue background.
 * @cssprop [--lr-schema-viewer-warning-border=var(--lr-color-warning)] - Warning issue border.
 * @cssprop [--lr-schema-viewer-warning-bg=var(--lr-color-warning-quiet)] - Warning issue background.
 * @cssprop [--lr-schema-viewer-info-border=var(--lr-color-brand)] - Info issue border.
 * @cssprop [--lr-schema-viewer-info-bg=var(--lr-color-brand-quiet)] - Info issue background.
 * @status stable
 * @since 7.0.0
 */
export class LyraSchemaViewer extends LyraElement<LyraSchemaViewerEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(['schema', 'issues']);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    schemaViewerCircular: LYRA_DEFAULT_schemaViewerCircular,
    schemaViewerEmpty: LYRA_DEFAULT_schemaViewerEmpty,
    schemaViewerIssueLimit: LYRA_DEFAULT_schemaViewerIssueLimit,
    schemaViewerLabel: LYRA_DEFAULT_schemaViewerLabel,
    schemaViewerLimit: LYRA_DEFAULT_schemaViewerLimit,
    schemaViewerRequired: LYRA_DEFAULT_schemaViewerRequired,
    schemaViewerType: LYRA_DEFAULT_schemaViewerType,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-schema-select',
  ]);

  /** Clone-owned recursive schema snapshot. Reassign a new record after changing any branch. */
  @property({ attribute: false }) schema: JsonSchemaNode | null = null;
  @property({ attribute: false }) issues: readonly SchemaValidationIssue[] = [];
  /** Controlled JSON Pointer selection. `null` means no selection; the empty
   *  string is the valid JSON Pointer for the schema root. */
  @property({ attribute: 'selected-path' }) selectedPath: string | null = null;
  /** Requested nesting depth, clamped to 100 to keep recursive template construction stack-safe. */
  @property({ type: Number, attribute: 'max-depth' }) maxDepth = 20;
  @property() label = '';
  private announcementSink?: AnnouncementSink;
  private previousNodeLimitText = '';
  private previousIssueLimitText = '';
  private suppressNextLimitAnnouncement = true;

  private syncAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument) return;
    this.announcementSink?.release();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
    // A reconnected or adopted component first snapshots the limits already visible in its new
    // context. They are resting content, not fresh transitions caused after that connection.
    if (this.hasUpdated) {
      this.suppressNextLimitAnnouncement = true;
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.announcementSink?.release();
    this.announcementSink = undefined;
    this.suppressNextLimitAnnouncement = true;
  }

  protected override updated(_changed: PropertyValues<this>): void {
    super.updated(_changed);
    const nodeText = this.renderRoot.querySelector('[part="limit"]')?.textContent?.trim() ?? '';
    const issueText = this.renderRoot.querySelector('[part="issue-limit"]')?.textContent?.trim() ?? '';
    if (!this.suppressNextLimitAnnouncement) {
      if (nodeText && nodeText !== this.previousNodeLimitText) this.announcementSink?.announce(nodeText);
      if (issueText && issueText !== this.previousIssueLimitText) this.announcementSink?.announce(issueText);
    }
    this.previousNodeLimitText = nodeText;
    this.previousIssueLimitText = issueText;
    this.suppressNextLimitAnnouncement = false;
  }

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
    const rows = keys.flatMap((key) => (schema[key] == null ? [] : [`${key}: ${constraintValue(schema[key])}`]));
    if (schema.enum) {
      const values = schema.enum.slice(0, MAX_CONSTRAINT_VALUES).map(constraintValue);
      rows.push(`enum: [${values.join(', ')}${schema.enum.length > values.length ? ', …' : ''}]`);
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'const')) rows.push(`const: ${constraintValue(schema.const)}`);
    if (Object.prototype.hasOwnProperty.call(schema, 'default')) rows.push(`default: ${constraintValue(schema.default)}`);
    if (schema.examples) {
      const examples = schema.examples.slice(0, MAX_CONSTRAINT_VALUES).map(constraintValue);
      rows.push(`examples: [${examples.join(', ')}${schema.examples.length > examples.length ? ', …' : ''}]`);
    }
    if (schema.$ref) rows.push(`$ref: ${schema.$ref.slice(0, MAX_CONSTRAINT_VALUE_CHARACTERS)}`);
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
    issuesByPath: ReadonlyMap<string, readonly SchemaValidationIssue[]>,
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
    const type = isReadonlyArray(schema.type)
      ? schema.type.join(' | ')
      : schema.type ?? (schema.properties ? 'object' : '');
    const constraints = this.constraints(schema);
    const issues = issuesByPath.get(path) ?? [];
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
      if (isReadonlyArray(schema.items)) {
        for (let index = 0; index < schema.items.length; index++) {
          const node = schema.items[index];
          if (!node || !addChild({ name: `items[${index}]`, node, path: `${path}/items/${index}`, required: false })) break;
        }
      } else if (schema.items) {
        addChild({ name: 'items', node: schema.items, path: `${path}/items`, required: false });
      }
    }
    const nodePart = selected ? 'node node-selected' : 'node';
    return html`
      <li part=${nodePart} style=${`--_lr-schema-depth:${depth}`}>
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
              this.renderNode(
                child.name,
                child.node,
                child.path,
                child.required,
                depth + 1,
                nextAncestors,
                budget,
                issuesByPath,
              ),
            )}</ul>`
          : nothing}
      </li>
    `;
  }

  override render(): TemplateResult {
    const label = overallSemanticLabel(this, this.label || this.localize('schemaViewerLabel'));
    if (!this.schema || typeof this.schema !== 'object') {
      return html`<section part="base" aria-label=${label ?? nothing}>
        <lr-empty part="empty" heading=${this.localize('schemaViewerEmpty')}></lr-empty>
      </section>`;
    }
    const budget: SchemaRenderBudget = { remaining: MAX_RENDERED_SCHEMA_NODES, truncated: false };
    const issuesByPath = new Map<string, SchemaValidationIssue[]>();
    const visibleIssueCount = Math.min(this.issues.length, MAX_RENDERED_SCHEMA_ISSUES);
    for (let index = 0; index < visibleIssueCount; index++) {
      const issue = this.issues[index];
      if (!issue) continue;
      const pathIssues = issuesByPath.get(issue.path) ?? [];
      pathIssues.push(issue);
      issuesByPath.set(issue.path, pathIssues);
    }
    const tree = this.renderNode(
      this.schema.title || '$',
      this.schema,
      '',
      false,
      0,
      new Set(),
      budget,
      issuesByPath,
    );
    return html`
      <section part="base" aria-label=${label ?? nothing}>
        <ul part="tree">
          ${tree}
        </ul>
        ${budget.truncated
          ? html`<p part="limit">${this.localize('schemaViewerLimit', undefined, {
                count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_SCHEMA_NODES),
              })}</p>`
          : nothing}
        ${this.issues.length > MAX_RENDERED_SCHEMA_ISSUES
          ? html`<p part="issue-limit">${this.localize('schemaViewerIssueLimit', undefined, {
                count: getNumberFormat(this.effectiveLocale).format(MAX_RENDERED_SCHEMA_ISSUES),
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
