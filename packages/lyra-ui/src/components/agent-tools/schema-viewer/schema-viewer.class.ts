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
export interface LyraJsonSchemaViewerEventMap {
  'lr-schema-select': CustomEvent<LyraEventDetailSnapshot<{ schemaPath: string; schema: JsonSchemaNode }>>;
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

function isSchemaRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Node-count ceiling for the caller-owned schema snapshot below, mirroring `LyraElement`'s own
 *  generic per-assignment collection budget -- generous enough that a legitimately wide schema
 *  never notices it, while still bounding a truly pathological caller. */
const SCHEMA_SNAPSHOT_NODE_LIMIT = 50_000;

/**
 * Bounded, cycle-safe, depth-clamped clone of a caller-supplied schema tree, run in place of
 * `LyraElement`'s generic `ownedCollectionProperties` snapshot. That generic machinery treats every
 * nested value uniformly and abandons the *entire* assignment the moment its own depth ceiling is
 * crossed anywhere in the tree (a `properties`/node pair costs it two levels per schema level, so a
 * schema nested only a little past that ceiling collapses the whole viewer to an empty object) --
 * defeating the bounded, partially-rendered tree `renderNode()`'s own `maxDepth` clamp already
 * promises for a hostile request. This clone keeps an identity-preserving `seen` cache (so a
 * genuinely circular schema freezes into an equally circular snapshot, exactly as `renderNode()`'s
 * ancestor check expects) but stops descending at `MAX_SCHEMA_DEPTH` -- the deepest depth any
 * `maxDepth` request can ever reach -- so a far deeper caller schema is bounded here, once, before
 * assignment, rather than being carried in full on every future render.
 */
function snapshotSchemaNode(
  value: unknown,
  depth: number,
  seen: Map<object, JsonSchemaNode>,
  budget: { remaining: number },
): JsonSchemaNode | undefined {
  if (!isSchemaRecord(value)) return undefined;
  const cached = seen.get(value);
  if (cached) return cached;
  if (budget.remaining <= 0) return undefined;
  budget.remaining--;
  const output: Record<string, unknown> = { ...value };
  seen.set(value, output as JsonSchemaNode);
  delete output['properties'];
  delete output['items'];
  delete output['allOf'];
  delete output['anyOf'];
  delete output['oneOf'];
  // The shallow `{ ...value }` spread above keeps every other keyword's original array reference
  // (`type`, `enum`, `required`, ...) -- the recursive rebuild below only replaces the five schema-
  // composition keys deleted above. `Object.freeze(output)` at the end of this function is itself
  // shallow and only protects output's own property slots, not what they still point to, so a
  // caller mutating their original array after assignment (e.g. `schema.type.push(...)`) would
  // otherwise reach straight through into this "detached" snapshot. Detach and freeze each
  // surviving array field too.
  for (const key in output) {
    if (!Object.prototype.hasOwnProperty.call(output, key)) continue;
    const fieldValue = output[key];
    if (Array.isArray(fieldValue)) output[key] = Object.freeze([...fieldValue]);
  }
  if (depth < MAX_SCHEMA_DEPTH) {
    const properties = (value as JsonSchemaNode).properties;
    if (isSchemaRecord(properties)) {
      const nextProperties: Record<string, JsonSchemaNode> = {};
      for (const key in properties) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) continue;
        if (budget.remaining <= 0) break;
        const child = snapshotSchemaNode(properties[key], depth + 1, seen, budget);
        if (child) nextProperties[key] = child;
      }
      output['properties'] = nextProperties;
    }
    for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
      const nodes = (value as JsonSchemaNode)[keyword];
      if (!isReadonlyArray(nodes)) continue;
      const next: JsonSchemaNode[] = [];
      for (const node of nodes) {
        if (budget.remaining <= 0) break;
        const child = snapshotSchemaNode(node, depth + 1, seen, budget);
        if (child) next.push(child);
      }
      output[keyword] = next;
    }
    const items = (value as JsonSchemaNode).items;
    if (isReadonlyArray(items)) {
      const next: JsonSchemaNode[] = [];
      for (const node of items) {
        if (budget.remaining <= 0) break;
        const child = snapshotSchemaNode(node, depth + 1, seen, budget);
        if (child) next.push(child);
      }
      output['items'] = next;
    } else if (isSchemaRecord(items)) {
      const child = snapshotSchemaNode(items, depth + 1, seen, budget);
      if (child) output['items'] = child;
    }
  }
  return Object.freeze(output) as JsonSchemaNode;
}

/** Bounded, clone-owned root entry point for {@link snapshotSchemaNode}. */
function snapshotSchema(value: unknown): JsonSchemaNode | null {
  return (
    snapshotSchemaNode(value, 0, new Map<object, JsonSchemaNode>(), {
      remaining: SCHEMA_SNAPSHOT_NODE_LIMIT,
    }) ?? null
  );
}

/**
 * `<lr-json-schema-viewer>` — a recursive, selectable JSON Schema inspector with required-state,
 * constraints, composition branches, `$ref` display, validation issues, cycle protection, and a
 * configurable depth ceiling. It does not resolve remote references or validate values.
 *
 * Public schema records and issue collections take bounded, clone-owned readonly snapshots.
 * Create and reassign a new record or array after changes; mutating the assigned value does not
 * update the view.
 *
 * @customElement lr-json-schema-viewer
 * @event lr-schema-select - A schema node was activated. `detail: { schemaPath, schema }`.
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
 * @since 9.0.0
 */
export class LyraJsonSchemaViewer extends LyraElement<LyraJsonSchemaViewerEventMap> {
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

  protected static override readonly ownedCollectionProperties = Object.freeze(['issues']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-schema-select',
  ]);

  private schemaValue: JsonSchemaNode | null = null;

  /** Clone-owned recursive schema snapshot. Reassign a new record after changing any branch.
   *  Bounded and depth-clamped by {@link snapshotSchemaNode} rather than `LyraElement`'s generic
   *  `ownedCollectionProperties` machinery -- see that function for why. A runtime non-array
   *  `required` keyword is treated as absent. */
  @property({ attribute: false })
  get schema(): JsonSchemaNode | null {
    return this.schemaValue;
  }
  set schema(value: JsonSchemaNode | null) {
    const previous = this.schemaValue;
    this.schemaValue = snapshotSchema(value);
    this.requestUpdate('schema', previous);
  }
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
          required: Array.isArray(schema.required) && schema.required.includes(key),
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
          @click=${() => this.emit('lr-schema-select', { schemaPath: path, schema })}
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
    'lr-json-schema-viewer': LyraJsonSchemaViewer;
  }
}
