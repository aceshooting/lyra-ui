import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { ref } from 'lit/directives/ref.js';
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
} from './resolve.js';
import { type LyraWidgetTypeRegistry } from './registry.js';
import { DEFAULT_WIDGET_TYPE_REGISTRY } from './default-registry.js';

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

interface ActionHandlerState {
  event: string;
  handler: EventListener;
}

interface BindingHandlerState {
  event: string;
  handler: EventListener;
}

function normalizedRenderError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error('lr-widget-renderer: document resolution failed');
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
 * survive a streamed document update. Each unchanged resolved mapped node also reuses its template
 * and ref callback, avoiding redundant property assignments and listener detach/attach cycles on
 * unrelated renderer updates.
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

  private readonly warned = new Set<string>();
  private warningScope?: {
    root: LyraWidgetNode | null;
    registry: LyraWidgetTypeRegistry;
  };
  private readonly actionHandlers = new WeakMap<
    HTMLElement,
    ActionHandlerState
  >();
  private readonly bindingHandlers = new WeakMap<
    HTMLElement,
    BindingHandlerState[]
  >();
  private readonly assignedProps = new WeakMap<HTMLElement, Set<string>>();
  private readonly initialProps = new WeakMap<
    HTMLElement,
    Map<string, unknown>
  >();
  private readonly mappedTemplates = new WeakMap<
    ResolvedElement,
    TemplateResult
  >();

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
        let root: LyraWidgetNode | null = null;
        if (widgetDocument !== null) {
          if (widgetDocument.version !== '2') {
            throw new Error('lr-widget-renderer: unsupported document version');
          }
          root = widgetDocument.root;
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
          bindingState: this.bindingState,
        });
        if (widgetDocument !== null && next === null) {
          throw new Error(
            'lr-widget-renderer: document resolved to nothing renderable'
          );
        }
        this.resolved = next;
      } catch (error) {
        this.resolved = null;
        this.emit('lr-render-error', {
          error: normalizedRenderError(error),
        });
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

  private syncActionHandler(el: HTMLElement, node: ResolvedElement): void {
    const existing = this.actionHandlers.get(el);
    if (existing) {
      el.removeEventListener(existing.event, existing.handler);
      this.actionHandlers.delete(el);
    }
    if (node.actionEvent) {
      const handler: EventListener = (e) => {
        e.stopPropagation();
        if (node.actionId !== undefined) {
          this.emit('lr-widget-action', {
            actionId: node.actionId,
            payload: node.payload,
            nodeId: node.nodeId!,
            nodeKey: node.nodeKey,
            nodePath: node.nodePath,
          });
        }
      };
      el.addEventListener(node.actionEvent, handler);
      this.actionHandlers.set(el, { event: node.actionEvent, handler });
    }
  }

  private syncBindingHandlers(el: HTMLElement, node: ResolvedElement): void {
    for (const existing of this.bindingHandlers.get(el) ?? []) {
      el.removeEventListener(existing.event, existing.handler);
    }
    const states: BindingHandlerState[] = [];
    for (const binding of node.bindings) {
      if (!binding.event) continue;
      const handler: EventListener = (event) => {
        event.stopPropagation();
        const detail = (event as CustomEvent<unknown>).detail;
        const hasDetailValue =
          detail !== null &&
          typeof detail === 'object' &&
          Object.hasOwn(detail, 'value');
        const value = hasDetailValue
          ? (detail as { value: unknown }).value
          : (el as unknown as Record<string, unknown>)[binding.prop];
        this.emit('lr-widget-state-change', {
          path: binding.path,
          value,
          nodeId: node.nodeId!,
          nodeKey: node.nodeKey,
          nodePath: node.nodePath,
          prop: binding.prop,
        });
      };
      el.addEventListener(binding.event, handler);
      states.push({ event: binding.event, handler });
    }
    this.bindingHandlers.set(el, states);
  }

  private syncMappedElement(el: HTMLElement, node: ResolvedElement): void {
    const previousKeys = this.assignedProps.get(el) ?? new Set<string>();
    const initialValues =
      this.initialProps.get(el) ?? new Map<string, unknown>();
    const nextKeys = new Set(Object.keys(node.props));
    for (const key of previousKeys) {
      if (!nextKeys.has(key)) {
        (el as unknown as Record<string, unknown>)[key] =
          initialValues.get(key);
      }
    }
    for (const [k, v] of Object.entries(node.props)) {
      if (!initialValues.has(k)) {
        initialValues.set(k, (el as unknown as Record<string, unknown>)[k]);
      }
      (el as unknown as Record<string, unknown>)[k] = v;
    }
    this.assignedProps.set(el, nextKeys);
    this.initialProps.set(el, initialValues);
    this.syncActionHandler(el, node);
    this.syncBindingHandlers(el, node);
  }

  private cleanupMappedElement(el: HTMLElement): void {
    const action = this.actionHandlers.get(el);
    if (action) el.removeEventListener(action.event, action.handler);
    this.actionHandlers.delete(el);
    for (const binding of this.bindingHandlers.get(el) ?? []) {
      el.removeEventListener(binding.event, binding.handler);
    }
    this.bindingHandlers.delete(el);
  }

  /** Ref callbacks are ignored by Lit SSR and attach only during browser render/hydration. */
  private mappedElementRef(node: ResolvedElement): (element?: Element) => void {
    let attached: HTMLElement | undefined;
    return (element?: Element): void => {
      if (!element) {
        if (attached) this.cleanupMappedElement(attached);
        attached = undefined;
        return;
      }
      attached = element as HTMLElement;
      this.syncMappedElement(attached, node);
    };
  }

  /** Declarative dynamic tag path: serializable on the server, stable under hydration and keyed
   * by the same identity as client-only property/listener attachment. Memoizing by the resolved
   * node object also keeps the ref callback stable until that node is actually re-resolved. */
  private renderMapped(node: ResolvedElement): TemplateResult {
    const cached = this.mappedTemplates.get(node);
    if (cached) return cached;
    const mappedTag = unsafeStatic(node.tag!);
    const rendered = staticHtml`<${mappedTag}
      data-widget-node-key=${node.nodeKey}
      data-widget-node-path=${node.nodePath}
      slot=${node.slot ?? nothing}
      ${ref(this.mappedElementRef(node))}
    >${repeat(
      node.children,
      (child) => this.renderIdentity(child),
      (child) => this.renderChildValue(child)
    )}</${mappedTag}>`;
    this.mappedTemplates.set(node, rendered);
    return rendered;
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
