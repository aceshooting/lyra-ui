import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { directive, type ElementPart } from 'lit/directive.js';
import { AsyncDirective } from 'lit/async-directive.js';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './widget-renderer.styles.js';
import {
  resolveTree,
  type LyraWidgetDocument,
  type ResolvedNode,
  type ResolvedElement,
  type LyraWidgetNode,
} from '../../../internal/widget-document.js';
import type { LyraWidgetTypeRegistry } from '../../../internal/widget-type-registry.js';
import { DEFAULT_WIDGET_TYPE_REGISTRY } from '../../../internal/widget-default-registry.js';

// `unsafeStatic()` must return the SAME StaticValue instance for the same tag string on every
// render -- Lit's static-html caches a call site's expanded template by that instance's identity,
// not its text, so creating a fresh StaticValue per render (one mapped tag can recur across many
// nodes and re-renders) corrupts that cache. The registry bounds this to a small, finite tag set.
const mappedTagCache = new Map<string, ReturnType<typeof unsafeStatic>>();
function cachedMappedTag(tag: string): ReturnType<typeof unsafeStatic> {
  let value = mappedTagCache.get(tag);
  if (!value) {
    value = unsafeStatic(tag);
    mappedTagCache.set(tag, value);
  }
  return value;
}

const GAP_TOKEN: Record<string, string> = {
  s: 'var(--lr-space-s)',
  m: 'var(--lr-space-m)',
  l: 'var(--lr-space-l)',
};
const JUSTIFY_VALUE: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
};
const ALIGN_VALUE: Record<string, string> = {
  start: 'flex-start',
  'flex-start': 'flex-start',
  center: 'center',
  end: 'flex-end',
  'flex-end': 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
  'self-start': 'self-start',
  'self-end': 'self-end',
  'first baseline': 'first baseline',
  'last baseline': 'last baseline',
  normal: 'normal',
};

function sanitizeAlignValue(value: string): string | undefined {
  return ALIGN_VALUE[value.trim().toLowerCase()];
}

type WidgetEventHandler = (event: Event, node: ResolvedElement, current: () => boolean) => void;

function mappedEvents(node: ResolvedElement): Set<string> {
  const events = new Set<string>();
  if (node.actionEvent) events.add(node.actionEvent);
  for (const binding of node.bindings) if (binding.event) events.add(binding.event);
  return events;
}

class MappedWidget extends AsyncDirective {
  private element!: HTMLElement;
  private node!: ResolvedElement;
  private synced?: ResolvedElement;
  private handle!: WidgetEventHandler;
  private current!: () => boolean;
  private events = new Set<string>();
  private readonly defaults = new Map<string, unknown>();

  override render(_node: ResolvedElement, _handle: WidgetEventHandler, _current: () => boolean): typeof nothing {
    return nothing;
  }

  override update(part: ElementPart, [node, handle, current]: Parameters<MappedWidget['render']>): typeof nothing {
    this.element = part.element as HTMLElement;
    this.node = node;
    this.handle = handle;
    this.current = current;
    if (this.isConnected) this.syncElement();
    return nothing;
  }

  private syncElement(): void {
    const { element, node } = this;
    if (node === this.synced) return;
    const target = element as unknown as Record<string, unknown>;
    const previous = this.synced?.props;
    this.synced = node;
    for (const key of Object.keys(previous ?? {})) {
      if (!Object.hasOwn(node.props, key)) target[key] = this.defaults.get(key);
    }
    for (const [key, value] of Object.entries(node.props)) {
      if (!this.defaults.has(key)) this.defaults.set(key, target[key]);
      if (!previous || !Object.hasOwn(previous, key) || !Object.is(previous[key], value)) target[key] = value;
    }
    const next = mappedEvents(node);
    for (const event of this.events) if (!next.has(event)) element.removeEventListener(event, this.onEvent);
    for (const event of next) if (!this.events.has(event)) element.addEventListener(event, this.onEvent);
    this.events = next;
  }

  private readonly onEvent = (event: Event): void => this.handle(event, this.node, this.current);

  protected override disconnected(): void {
    for (const event of this.events) this.element.removeEventListener(event, this.onEvent);
  }

  protected override reconnected(): void {
    for (const event of this.events) this.element.addEventListener(event, this.onEvent);
    this.syncElement();
  }
}

const mappedWidget = directive(MappedWidget);

const DOCUMENT_RESOLUTION_FAILED_MESSAGE =
  'lr-widget-renderer: document resolution failed';

function normalizedRenderError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(DOCUMENT_RESOLUTION_FAILED_MESSAGE);
}

/** Sentinel for a `document.version`/`document.root` read that cannot be trusted: the key is
 * absent from the assigned document. A throwing accessor lands here too -- `LyraElement`'s owned-
 * collection snapshot (`snapshotDataRecord` in `internal/lyra-element.ts`) clones an assigned
 * `document` by walking its enumerable own keys and skipping any whose descriptor has no `value`
 * (i.e. an accessor), so a hostile `get version()`/`get root()` is silently dropped rather than
 * invoked -- it never gets the chance to throw. By the time `willUpdate` reads `this.document`,
 * that omission is indistinguishable from a document that never had the field. Both must fail the
 * same way as any other unusable document instead of surfacing as a more specific -- and here
 * misleading -- structural complaint (`unsupported document version`, a missing root treated as
 * legitimately empty). */
const DOCUMENT_FIELD_UNREADABLE = Symbol(
  'lr-widget-renderer:document-field-unreadable'
);

function readDocumentField(
  document: object,
  key: 'version' | 'root'
): unknown {
  try {
    return Object.hasOwn(document, key)
      ? Reflect.get(document, key)
      : DOCUMENT_FIELD_UNREADABLE;
  } catch {
    return DOCUMENT_FIELD_UNREADABLE;
  }
}

export interface LyraWidgetRendererEventMap {
  'lr-widget-action': CustomEvent<{
    actionId: string;
    payload: unknown;
    nodeId: string;
    nodeKey: string;
    nodePath: string;
  }>;
  'lr-render-error': CustomEvent<{ error: Error }>;
  'lr-widget-state-change': CustomEvent<{
    path: string;
    value: unknown;
    nodeId: string;
    nodeKey: string;
    nodePath: string;
    prop: string;
  }>;
}

/**
 * `<lr-widget-renderer>` — renders an agent-streamed declarative JSON widget tree through an
 * allowlisted `type -> lyra tag` registry (see `registry.ts`/`resolve.ts` for the allowlist
 * enforcement itself; this class only turns an already-resolved tree into declarative templates).
 * Mapped custom-element tags and children are serializable during SSR and keyed identically during
 * hydration. Primitive mapped props remain property-only by contract: the server emits the stable
 * element/child shell, then hydration assigns props without converting them into attributes. Lit's
 * keyed reconciliation reuses the mapped element so focus, scroll position, and internal state
 * survive a streamed document update. Unchanged properties and event subscriptions are retained across binding updates.
 *
 * The version-two `document` is the sole tree source. An allowlisted prop value shaped as
 * `{ $bind: '/json/pointer', fallback?: primitive }` reads from the explicit `bindingState`
 * property; a registry `bindings` entry names the control event that requests a change.
 * The renderer reports that request through `lr-widget-state-change` and never mutates caller state.
 * Unknown-type and disallowed-prop warnings deduplicate within the effective root/registry
 * generation. Binding-state-only re-resolution remains quiet, while replacing the document root
 * or registry releases its prior warning keys before resolving the new generation.
 * A malformed root or nested node fails closed: the prior rendered tree is cleared and exactly one
 * `lr-render-error` describes the rejected update.
 * The normal `widget-renderer.js` registration entry installs the eight mapped custom elements.
 * Every renderer owns an explicit immutable registry value, defaulting to the frozen built-in
 * registry. A lean consumer imports this side-effect-free class module, defines the renderer,
 * imports only its mapped registrations, and assigns a registry made by
 * `createWidgetTypeRegistry()`.
 *
 * @customElement lr-widget-renderer
 * @event lr-widget-action - `detail: { actionId, payload, nodeId, nodeKey, nodePath }` — the single bubbling action channel.
 * @event lr-render-error - `detail: { error }` — the root or one of its nested nodes was structurally unusable.
 * @event lr-widget-state-change - A bound control requested a controlled state update. `detail: { path, value, nodeId, nodeKey, nodePath, prop }`; the caller must apply the next `bindingState` value.
 * @csspart base - The root wrapper (`display: contents` — adds no layout box of its own).
 * @csspart row - A built-in `row` node.
 * @csspart col - A built-in `col` node.
 * @csspart text - A built-in `text` node.
 * @status stable
 * @since 4.0.0
 */
export class LyraWidgetRenderer extends LyraElement<LyraWidgetRendererEventMap> {
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = Object.freeze([
    'document',
  ]);

  static override styles = [LyraElement.styles, styles];

  /** Version-two declarative document. Assignment takes a bounded recursively frozen snapshot;
   * mutate a copy and reassign it to update. `null` renders an empty base. A malformed root or
   * nested node clears prior content and emits one `lr-render-error`. */
  @property({ attribute: false }) document: LyraWidgetDocument | null = null;

  /** Explicit controlled binding state. `null` is a real state value, never an absence sentinel. */
  @property({ attribute: false }) bindingState?: unknown;

  /** Immutable type registry owned by this renderer. Assign a snapshot returned by
   * `createWidgetTypeRegistry()` to override the built-ins without affecting another instance. */
  @property({ attribute: false }) registry: LyraWidgetTypeRegistry =
    DEFAULT_WIDGET_TYPE_REGISTRY;

  @state() private resolved: ResolvedNode | null = null;

  private ownsInteractions = () => false;
  private readonly warned = new Set<string>();
  private warningScope?: {
    root: LyraWidgetNode | null;
    registry: LyraWidgetTypeRegistry;
  };
  private failedDocument?: LyraWidgetDocument | null;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      !this.hasUpdated ||
      changed.has('document') ||
      changed.has('bindingState') ||
      changed.has('registry')
    ) {
      try {
        const registry = this.registry;
        const widgetDocument = this.document;
        const bindings = this.bindingState;
        this.ownsInteractions = () => this.document === widgetDocument && this.registry === registry &&
          Object.is(this.bindingState, bindings);
        let root: LyraWidgetNode | null = null;
        if (widgetDocument !== null) {
          const version = readDocumentField(widgetDocument, 'version');
          const rootField = readDocumentField(widgetDocument, 'root');
          if (
            version === DOCUMENT_FIELD_UNREADABLE ||
            rootField === DOCUMENT_FIELD_UNREADABLE
          ) {
            throw new Error(DOCUMENT_RESOLUTION_FAILED_MESSAGE);
          }
          if (version !== '2') {
            throw new Error('lr-widget-renderer: unsupported document version');
          }
          root = rootField as LyraWidgetNode;
        }
        if (
          this.warningScope?.root !== root ||
          this.warningScope.registry !== registry
        ) {
          this.warned.clear();
          this.warningScope = { root, registry };
        }
        const next = resolveTree(root, {
          registry,
          warned: this.warned,
          bindingState: bindings,
        });
        if (widgetDocument !== null && next === null) {
          throw new Error(
            'lr-widget-renderer: document resolved to nothing renderable'
          );
        }
        this.resolved = next;
        this.failedDocument = undefined;
      } catch (error) {
        this.resolved = null;
        if (this.failedDocument !== this.document) {
          this.failedDocument = this.document;
          const detail = { error: normalizedRenderError(error) };
          this.scheduleAfterUpdate(() => this.emit('lr-render-error', detail), 'render-error');
        }
      }
    }
  }

  private builtinStyle(node: ResolvedElement): Record<string, string> {
    const gap =
      typeof node.props['gap'] === 'string'
        ? GAP_TOKEN[node.props['gap']]
        : undefined;
    const align =
      typeof node.props['align'] === 'string'
        ? sanitizeAlignValue(node.props['align'])
        : undefined;
    const justifyRaw =
      typeof node.props['justify'] === 'string'
        ? node.props['justify']
        : undefined;
    const justify = justifyRaw ? JUSTIFY_VALUE[justifyRaw] : undefined;
    return {
      display: 'flex',
      'flex-direction': node.kind === 'builtin-row' ? 'row' : 'column',
      'flex-wrap': node.kind === 'builtin-row' ? 'wrap' : 'nowrap',
      ...(gap ? { gap } : {}),
      ...(align ? { 'align-items': align } : {}),
      ...(justify ? { 'justify-content': justify } : {}),
    };
  }

  private readonly handleMappedEvent: WidgetEventHandler = (event, node, current) => {
    event.stopPropagation();
    if (!current()) return;
    if (event.type === node.actionEvent && node.actionId !== undefined) {
      this.emit('lr-widget-action', {
        actionId: node.actionId,
        payload: node.payload,
        nodeId: node.nodeId!,
        nodeKey: node.nodeKey,
        nodePath: node.nodePath,
      });
    }
    for (const binding of node.bindings) {
      if (binding.event !== event.type || !current()) continue;
      const detail = (event as CustomEvent<unknown>).detail;
      const value = detail !== null && typeof detail === 'object' && Object.hasOwn(detail, 'value')
        ? (detail as { value: unknown }).value
        : (event.currentTarget as unknown as Record<string, unknown>)[binding.prop];
      if (!current()) return;
      this.emit('lr-widget-state-change', {
        path: binding.path,
        value,
        nodeId: node.nodeId!,
        nodeKey: node.nodeKey,
        nodePath: node.nodePath,
        prop: binding.prop,
      });
    }
  };

  private renderMapped(node: ResolvedElement): TemplateResult {
    const mappedTag = cachedMappedTag(node.tag!);
    return staticHtml`<${mappedTag}
      data-widget-node-key=${node.nodeKey}
      data-widget-node-path=${node.nodePath}
      slot=${node.slot ?? nothing}
      ${mappedWidget(node, this.handleMappedEvent, this.ownsInteractions)}
    >${repeat(
      node.children,
      (child) => this.renderIdentity(child),
      (child) => this.renderChildValue(child)
    )}</${mappedTag}>`;
  }

  private renderIdentity(node: ResolvedNode): string {
    return node.nodeKey;
  }

  private renderChildValue(node: ResolvedNode): unknown {
    if (node.kind === 'text') {
      return html`<span class="widget-text" slot=${node.slot ?? nothing}
        >${node.text}</span
      >`;
    }
    if (node.kind === 'mapped') {
      return this.renderMapped(node);
    }
    const part =
      node.kind === 'builtin-row'
        ? 'row'
        : node.kind === 'builtin-col'
        ? 'col'
        : 'text';
    return html`<div
      part=${part}
      style=${styleMap(this.builtinStyle(node))}
      slot=${node.slot ?? nothing}
    >
      ${node.kind === 'builtin-text' ? node.props['value'] ?? nothing : nothing}
      ${repeat(
        node.children,
        (child) => this.renderIdentity(child),
        (child) => this.renderChildValue(child)
      )}
    </div>`;
  }

  override render(): TemplateResult {
    return html`<div part="base">
      ${this.resolved ? this.renderChildValue(this.resolved) : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-widget-renderer': LyraWidgetRenderer;
  }
}
