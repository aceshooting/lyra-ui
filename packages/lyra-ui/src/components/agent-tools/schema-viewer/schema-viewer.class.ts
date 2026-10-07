import { snapshotStructuredData, isSnapshotArrayIndex as isArrayIndex, type SnapshotStructure } from '../../../internal/structured-snapshot.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
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
  'lr-schema-select': CustomEvent<
    LyraEventDetailSnapshot<{ schemaPath: string; schema: JsonSchemaNode }>
  >;
}

interface SchemaRenderBudget {
  remaining: number;
  truncated: boolean;
  /**
   * Every node path along the chain from the schema root to a resolvable `selectedPath`
   * (inclusive), reserved ahead of the ordinary depth-first walk so a controlled selection
   * landing outside the first `MAX_RENDERED_SCHEMA_NODES` DFS-visited nodes still renders. Empty
   * when there is no selection, or it doesn't resolve to a real, in-bounds node.
   */
  reservedPaths: ReadonlySet<string>;
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
    if (typeof candidate === 'string')
      return JSON.stringify(
        candidate.slice(0, MAX_CONSTRAINT_VALUE_CHARACTERS)
      );
    if (typeof candidate === 'number' || typeof candidate === 'boolean')
      return String(candidate);
    if (typeof candidate === 'bigint') return `${candidate.toString()}n`;
    if (candidate === undefined) return 'undefined';
    if (typeof candidate !== 'object') return String(candidate);
    if (seen.has(candidate)) return '[Circular]';
    if (depth >= 3) return Array.isArray(candidate) ? '[…]' : '{…}';
    seen.add(candidate);
    let result: string;
    if (Array.isArray(candidate)) {
      const values = candidate
        .slice(0, MAX_CONSTRAINT_VALUES)
        .map((item) => visit(item, depth + 1));
      result = `[${values.join(', ')}${
        candidate.length > values.length ? ', …' : ''
      }]`;
    } else {
      const entries = Object.entries(candidate).slice(0, MAX_CONSTRAINT_VALUES);
      result = `{${entries
        .map(
          ([key, item]) => `${JSON.stringify(key)}: ${visit(item, depth + 1)}`
        )
        .join(', ')}${
        Object.keys(candidate).length > entries.length ? ', …' : ''
      }}`;
    }
    seen.delete(candidate);
    return result.slice(0, MAX_CONSTRAINT_VALUE_CHARACTERS);
  };
  return visit(value, 0);
}

function isReadonlyArray<Value>(
  value: Value | readonly Value[] | undefined
): value is readonly Value[] {
  return Array.isArray(value);
}

/** Structural maps and tuples are containers, while their children consume schema nodes.
 * Their depth follows schema nesting rather than counting the intervening map/array twice. */
function schemaStructure(depth: number): SnapshotStructure {
  return {
    shape: 'record',
    depth,
    child: (key, value) => {
      const structural = key === 'properties' || key === 'items' || key === 'allOf' || key === 'anyOf' || key === 'oneOf';
      if (structural && depth >= MAX_SCHEMA_DEPTH) return undefined;
      if (key === 'properties') return {
        shape: 'record', depth: depth + 1, container: false,
        child: () => schemaStructure(depth + 1),
      };
      let array = false;
      try { array = Array.isArray(value); } catch { /* The walker rejects revoked proxies. */ }
      if (key === 'allOf' || key === 'anyOf' || key === 'oneOf' || (key === 'items' && array)) return {
        shape: 'array', depth: depth + 1, container: false,
        child: (index) => isArrayIndex(index) ? schemaStructure(depth + 1) : { depth: depth + 1 },
      };
      if (key === 'items') return schemaStructure(depth + 1);
      return { depth: depth + 1 };
    },
  };
}

function snapshotSchema(value: unknown): JsonSchemaNode | null {
  const snapshot = snapshotStructuredData(value, {
    profile: 'schema', structure: schemaStructure(0),
  });
  return (snapshot.value as JsonSchemaNode | undefined) ?? null;
}

/**
 * `<lr-json-schema-viewer>` — a recursive, selectable JSON Schema inspector with required-state,
 * constraints, composition branches, `$ref` display, validation issues, cycle protection, and a
 * configurable depth ceiling. It does not resolve remote references or validate values.
 *
 * Public schema records and issue collections take bounded, clone-owned readonly snapshots.
 * Schema records recursively copy supported own data fields without invoking accessors; unsupported
 * or unsafe branches are omitted while valid siblings remain. Create and reassign a new record or
 * array after changes; mutating the assigned value does not update the view.
 *
 * @customElement lr-json-schema-viewer
 * The tree is one tab stop; ArrowUp/ArrowDown and Home/End move between node triggers.
 *
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
 * @cssprop [--lr-json-schema-viewer-selected-border=var(--lr-color-brand)] - Selected node branch.
 * @cssprop [--lr-json-schema-viewer-max-indent=var(--lr-size-12rem)] - Maximum visual indentation;
 *   complete JSON Pointer paths and selection semantics remain unchanged at deeper levels.
 * @cssprop [--lr-json-schema-viewer-error-border=var(--lr-color-danger)] - Error issue border.
 * @cssprop [--lr-json-schema-viewer-error-bg=var(--lr-color-danger-quiet)] - Error issue background.
 * @cssprop [--lr-json-schema-viewer-warning-border=var(--lr-color-warning)] - Warning issue border.
 * @cssprop [--lr-json-schema-viewer-warning-bg=var(--lr-color-warning-quiet)] - Warning issue background.
 * @cssprop [--lr-json-schema-viewer-info-border=var(--lr-color-brand)] - Info issue border.
 * @cssprop [--lr-json-schema-viewer-info-bg=var(--lr-color-brand-quiet)] - Info issue background.
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
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'issues',
  ]);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-schema-select',
  ]);
  private schemaValue: JsonSchemaNode | null = null;
  /** Last caller-assigned schema: a parent re-committing the same binding is not a change. */
  private lastSchemaInput: unknown = null;
  private focusStopPath: string | null = null;

  /** Clone-owned recursive schema snapshot. Reassign a new record after changing any branch.
   *  Bounded and depth-clamped by {@link snapshotSchemaNode}; a malformed branch is omitted
   *  without discarding admitted siblings. A runtime non-array `required` keyword is absent. */
  @property({ attribute: false })
  get schema(): JsonSchemaNode | null {
    return this.schemaValue;
  }
  set schema(value: JsonSchemaNode | null) {
    if (value === this.schemaValue || value === this.lastSchemaInput) return;
    this.lastSchemaInput = value;
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
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private previousNodeLimitText = '';
  private previousIssueLimitText = '';
  private suppressNextLimitAnnouncement = true;

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnected or adopted component first snapshots the limits already visible in its new
    // context. They are resting content, not fresh transitions caused after that connection.
    if (this.hasUpdated) {
      this.suppressNextLimitAnnouncement = true;
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.suppressNextLimitAnnouncement = true;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.announcements.adopted();
  }

  protected override updated(_changed: PropertyValues<this>): void {
    super.updated(_changed);
    this.syncFocusStop();
    const nodeText =
      this.renderRoot.querySelector('[part="limit"]')?.textContent?.trim() ??
      '';
    const issueText =
      this.renderRoot
        .querySelector('[part="issue-limit"]')
        ?.textContent?.trim() ?? '';
    if (!this.suppressNextLimitAnnouncement) {
      if (nodeText && nodeText !== this.previousNodeLimitText)
        this.announcements.announcePolite(nodeText);
      if (issueText && issueText !== this.previousIssueLimitText)
        this.announcements.announcePolite(issueText);
    }
    this.previousNodeLimitText = nodeText;
    this.previousIssueLimitText = issueText;
    this.suppressNextLimitAnnouncement = false;
  }

  private nodeTriggers(): HTMLElement[] {
    return Array.from(this.renderRoot.querySelectorAll<HTMLElement>('[part~="node-trigger"]'));
  }

  /** The tab stop: the last focused trigger, else the selected node, else the root. */
  private syncFocusStop(): void {
    const triggers = this.nodeTriggers();
    const stop =
      triggers.find((trigger) => trigger.dataset['path'] === this.focusStopPath) ??
      triggers.find((trigger) => trigger.dataset['path'] === this.selectedPath) ??
      triggers[0];
    for (const trigger of triggers) trigger.tabIndex = trigger === stop ? 0 : -1;
  }

  private onTreeFocusIn = (event: FocusEvent): void => {
    const trigger = (event.target as Element | null)?.closest<HTMLElement>('[part~="node-trigger"]');
    if (!trigger) return;
    this.focusStopPath = trigger.dataset['path'] ?? null;
    this.syncFocusStop();
  };

  private onTreeKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const triggers = this.nodeTriggers();
    const current = (event.target as Element | null)?.closest<HTMLElement>('[part~="node-trigger"]');
    const index = current ? triggers.indexOf(current) : -1;
    if (index < 0) return;
    const target =
      event.key === 'ArrowDown' ? triggers[Math.min(triggers.length - 1, index + 1)]
        : event.key === 'ArrowUp' ? triggers[Math.max(0, index - 1)]
          : event.key === 'Home' ? triggers[0]
            : event.key === 'End' ? triggers[triggers.length - 1]
              : undefined;
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  private pointerSegment(value: string): string {
    return value.replace(/~/g, '~0').replace(/\//g, '~1');
  }

  private decodePointerSegment(segment: string): string {
    return segment.replace(/~1/g, '/').replace(/~0/g, '~');
  }

  /**
   * Walks `this.selectedPath`'s JSON Pointer segments through `this.schema`, following the same
   * `properties`/`allOf`/`anyOf`/`oneOf`/`items` traversal `renderNode()`'s child collection uses
   * and the same `maxDepth` bound, to resolve the full ancestor chain from the schema root down to
   * the selected node. Returns every path along that chain (root first) when the selection
   * resolves to a real, in-bounds node; an empty set when there is no selection, it doesn't
   * resolve, or it lies past `maxDepth` -- nothing to reserve, matching prior behavior.
   */
  private resolvedSelectionPathChain(): ReadonlySet<string> {
    const selectedPath = this.selectedPath;
    const root = this.schema;
    if (selectedPath == null || !root || typeof root !== 'object') return new Set();
    if (selectedPath === '') return new Set(['']);
    if (!selectedPath.startsWith('/')) return new Set();

    const segments = selectedPath.split('/').slice(1);
    const maxDepth = finiteCount(this.maxDepth, 20, MAX_SCHEMA_DEPTH);
    const chain = new Set<string>(['']);
    const visited = new Set<object>([root]);
    let node: JsonSchemaNode = root;
    let path = '';
    let depth = 0;
    let index = 0;

    while (index < segments.length) {
      if (depth >= maxDepth) return new Set();
      const kind = segments[index];
      let next: JsonSchemaNode | undefined;
      let nextPath: string | undefined;
      let consumed = 0;
      if (kind === 'properties') {
        const keySegment = segments[index + 1];
        if (keySegment !== undefined) {
          const candidate = node.properties?.[this.decodePointerSegment(keySegment)];
          if (candidate) {
            next = candidate;
            nextPath = `${path}/properties/${keySegment}`;
            consumed = 2;
          }
        }
      } else if (kind === 'allOf' || kind === 'anyOf' || kind === 'oneOf') {
        const idxSegment = segments[index + 1];
        if (idxSegment !== undefined && isArrayIndex(idxSegment)) {
          const list = node[kind];
          const candidate = Array.isArray(list) ? list[Number(idxSegment)] : undefined;
          if (candidate) {
            next = candidate;
            nextPath = `${path}/${kind}/${idxSegment}`;
            consumed = 2;
          }
        }
      } else if (kind === 'items') {
        if (isReadonlyArray(node.items)) {
          const idxSegment = segments[index + 1];
          if (idxSegment !== undefined && isArrayIndex(idxSegment)) {
            const candidate = node.items[Number(idxSegment)];
            if (candidate) {
              next = candidate;
              nextPath = `${path}/items/${idxSegment}`;
              consumed = 2;
            }
          }
        } else if (node.items) {
          next = node.items;
          nextPath = `${path}/items`;
          consumed = 1;
        }
      }
      if (!next || nextPath === undefined || visited.has(next)) return new Set();
      visited.add(next);
      node = next;
      path = nextPath;
      chain.add(path);
      depth += 1;
      index += consumed;
    }
    return path === selectedPath ? chain : new Set();
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
    const rows = keys.flatMap((key) =>
      schema[key] == null ? [] : [`${key}: ${constraintValue(schema[key])}`]
    );
    if (schema.enum) {
      const values = schema.enum
        .slice(0, MAX_CONSTRAINT_VALUES)
        .map(constraintValue);
      rows.push(
        `enum: [${values.join(', ')}${
          schema.enum.length > values.length ? ', …' : ''
        }]`
      );
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'const'))
      rows.push(`const: ${constraintValue(schema.const)}`);
    if (Object.prototype.hasOwnProperty.call(schema, 'default'))
      rows.push(`default: ${constraintValue(schema.default)}`);
    if (schema.examples) {
      const examples = schema.examples
        .slice(0, MAX_CONSTRAINT_VALUES)
        .map(constraintValue);
      rows.push(
        `examples: [${examples.join(', ')}${
          schema.examples.length > examples.length ? ', …' : ''
        }]`
      );
    }
    if (schema.$ref)
      rows.push(
        `$ref: ${schema.$ref.slice(0, MAX_CONSTRAINT_VALUE_CHARACTERS)}`
      );
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
    issuesByPath: ReadonlyMap<string, readonly SchemaValidationIssue[]>
  ): TemplateResult | typeof nothing {
    // A node reserved by `budget.reservedPaths` (the selected node and its ancestor chain, see
    // `resolvedSelectionPathChain()`) always renders, bypassing the shared budget entirely --
    // `render()` already subtracted the reservation from `budget.remaining` up front, so the total
    // rendered node count stays within MAX_RENDERED_SCHEMA_NODES.
    const reserved = budget.reservedPaths.has(path);
    if (!reserved) {
      if (budget.remaining <= 0) {
        budget.truncated = true;
        return nothing;
      }
      budget.remaining--;
    }
    const selected = path === this.selectedPath;
    if (ancestors.has(schema)) {
      return html`<li part="node">
        <span part="description">${this.localize('schemaViewerCircular')}</span>
      </li>`;
    }
    const nextAncestors = new Set(ancestors).add(schema);
    const type = isReadonlyArray(schema.type)
      ? schema.type.join(' | ')
      : schema.type ?? (schema.properties ? 'object' : '');
    const constraints = this.constraints(schema);
    const issues = issuesByPath.get(path) ?? [];
    const children: Array<{
      name: string;
      node: JsonSchemaNode;
      path: string;
      required: boolean;
    }> = [];
    // When this node itself sits on the reserved selection chain but isn't the selected leaf, one
    // of its children continues that chain and must be admitted regardless of the shared budget --
    // keep scanning past an exhausted budget until that reserved child is found (or the candidate
    // list runs out), instead of breaking on the first budget-exceeded child like the ordinary case.
    let pendingReservedChild = budget.reservedPaths.has(path) && path !== this.selectedPath;
    const addChild = (child: {
      name: string;
      node: JsonSchemaNode;
      path: string;
      required: boolean;
    }): boolean => {
      if (pendingReservedChild && budget.reservedPaths.has(child.path)) {
        pendingReservedChild = false;
        children.push(child);
        return true;
      }
      if (children.length >= budget.remaining) {
        budget.truncated = true;
        return pendingReservedChild;
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
        if (
          !addChild({
            name: key,
            node,
            path: `${path}/properties/${this.pointerSegment(key)}`,
            required:
              Array.isArray(schema.required) && schema.required.includes(key),
          })
        )
          break;
      }
      for (const keyword of ['allOf', 'anyOf', 'oneOf'] as const) {
        const nodes = schema[keyword] ?? [];
        for (const key of Object.keys(nodes)) {
          if (!isArrayIndex(key)) continue;
          const index = Number(key);
          const node = nodes[index];
          if (!node) continue;
          if (
            !addChild({
              name: `${keyword}[${index}]`,
              node,
              path: `${path}/${keyword}/${index}`,
              required: false,
            })
          )
            break;
        }
      }
      if (isReadonlyArray(schema.items)) {
        for (const key of Object.keys(schema.items)) {
          if (!isArrayIndex(key)) continue;
          const index = Number(key);
          const node = schema.items[index];
          if (!node) continue;
          if (
            !addChild({
              name: `items[${index}]`,
              node,
              path: `${path}/items/${index}`,
              required: false,
            })
          )
            break;
        }
      } else if (schema.items) {
        addChild({
          name: 'items',
          node: schema.items,
          path: `${path}/items`,
          required: false,
        });
      }
    }
    const nodePart = selected ? 'node node-selected' : 'node';
    return html`
      <li part=${nodePart} style=${`--_lr-schema-depth:${depth}`}>
        <button
          part="node-trigger"
          type="button"
          tabindex="-1"
          data-path=${path}
          aria-pressed=${selected ? 'true' : 'false'}
          @click=${() =>
            this.emit('lr-schema-select', { schemaPath: path, schema })}
        >
          <strong part="name">${name}</strong>
          ${type
            ? html`<lr-badge part="type" variant="neutral"
                >${this.localize('schemaViewerType', undefined, {
                  type,
                })}</lr-badge
              >`
            : nothing}
          ${required
            ? html`<lr-badge part="required" variant="danger"
                >${this.localize('schemaViewerRequired')}</lr-badge
              >`
            : nothing}
        </button>
        ${schema.description
          ? html`<p part="description">${schema.description}</p>`
          : nothing}
        ${constraints.length
          ? html`<ul part="constraints">
              ${constraints.map((row) => html`<li>${row}</li>`)}
            </ul>`
          : nothing}
        ${issues.map(
          (issue) =>
            html`<p part="issue" data-severity=${issue.severity ?? 'error'}>
              ${issue.message}
            </p>`
        )}
        ${children.length
          ? html`<ul>
              ${children.map((child) =>
                this.renderNode(
                  child.name,
                  child.node,
                  child.path,
                  child.required,
                  depth + 1,
                  nextAncestors,
                  budget,
                  issuesByPath
                )
              )}
            </ul>`
          : nothing}
      </li>
    `;
  }

  override render(): TemplateResult {
    const label = overallSemanticLabel(
      this,
      this.label || this.localize('schemaViewerLabel')
    );
    if (!this.schema || typeof this.schema !== 'object') {
      return html`<section part="base" aria-label=${label ?? nothing}>
        <lr-empty
          part="empty"
          heading=${this.localize('schemaViewerEmpty')}
        ></lr-empty>
      </section>`;
    }
    const reservedPaths = this.resolvedSelectionPathChain();
    const budget: SchemaRenderBudget = {
      remaining: Math.max(0, MAX_RENDERED_SCHEMA_NODES - reservedPaths.size),
      truncated: false,
      reservedPaths,
    };
    const issuesByPath = new Map<string, SchemaValidationIssue[]>();
    const visibleIssueCount = Math.min(
      this.issues.length,
      MAX_RENDERED_SCHEMA_ISSUES
    );
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
      issuesByPath
    );
    return html`
      <section part="base" aria-label=${label ?? nothing}>
        <ul part="tree" @focusin=${this.onTreeFocusIn} @keydown=${this.onTreeKeyDown}>${tree}</ul>
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
