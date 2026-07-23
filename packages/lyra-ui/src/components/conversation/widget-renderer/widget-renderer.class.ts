import { html, nothing, render, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './widget-renderer.styles.js';
import {
  resolveTree,
  type LyraWidgetDocument,
  type ResolvedNode,
  type ResolvedElement,
  type WidgetNode,
} from './resolve.js';
import { getDefaultWidgetTypeRegistry, type WidgetTypeRegistry } from './registry.js';

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

interface ActionHandlerState {
  event: string;
  handler: EventListener;
}

interface BindingHandlerState {
  event: string;
  handler: EventListener;
}

export interface LyraWidgetRendererEventMap {
  'lr-widget-action': CustomEvent<{ actionId: string; payload: unknown }>;
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-widget-state-change': CustomEvent<{ path: string; value: unknown; nodeId: string; prop: string }>;
}

/**
 * `<lr-widget-renderer>` — renders an agent-streamed declarative JSON widget tree through an
 * allowlisted `type -> lyra tag` registry (see `registry.ts`/`resolve.ts` for the allowlist
 * enforcement itself; this class only turns an already-resolved tree into DOM). A mapped node's
 * real element is created via `document.createElement()` with every prop assigned as a plain JS
 * property (never `setAttribute`, never `innerHTML`), and reused by key across a re-resolve so a
 * mapped widget's own internal state (an open `<details>`, focus, scroll position) survives a
 * streamed `tree` update. Built-in `row`/`col`/`text` structural nodes render through ordinary
 * nested `html` templates instead.
 *
 * @customElement lr-widget-renderer
 * @event lr-widget-action - `detail: { actionId, payload }` — the single bubbling action channel.
 * @event lr-render-error - `detail: { error }` — the root value was structurally unusable.
 * @event lr-widget-state-change - A bound control requested a controlled state update.
 * @csspart base - The root wrapper (`display: contents` — adds no layout box of its own).
 * @csspart row - A built-in `row` node.
 * @csspart col - A built-in `col` node.
 * @csspart text - A built-in `text` node.
 */
export class LyraWidgetRenderer extends LyraElement<LyraWidgetRendererEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The declarative widget tree to render. `null` (the default) renders an empty base. */
  @property({ attribute: false }) tree: WidgetNode | null = null;

  /** Versioned document form. Takes precedence over `tree` and supplies optional binding state. */
  @property({ attribute: false }) document: LyraWidgetDocument | null = null;

  /** Controlled binding state override. Falls back to `document.state`. */
  @property({ attribute: false }) state?: unknown;

  /** Per-instance type registry to resolve against instead of the module-level default one
   *  (`getDefaultWidgetTypeRegistry()`, populated by `registerDefaultWidgetTypes()`). */
  @property({ attribute: false }) registry?: WidgetTypeRegistry;

  @state() private resolved: ResolvedNode | null = null;

  private readonly warned = new Set<string>();
  private readonly elements = new Map<string, HTMLElement>();
  private readonly actionHandlers = new WeakMap<HTMLElement, ActionHandlerState>();
  private readonly bindingHandlers = new WeakMap<HTMLElement, BindingHandlerState[]>();

  protected override willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated || changed.has('tree') || changed.has('document') || changed.has('state') || changed.has('registry')) {
      const registry = this.registry ?? getDefaultWidgetTypeRegistry();
      const root = this.document?.root ?? this.tree;
      const next = resolveTree(root, {
        registry,
        warned: this.warned,
        state: this.state ?? this.document?.state,
      });
      if (root != null && next === null) {
        this.emit('lr-render-error', {
          error: new Error('lr-widget-renderer: tree resolved to nothing renderable'),
        });
      }
      this.resolved = next;
    }
  }

  protected override updated(): void {
    this.pruneElementCache();
  }

  private collectMappedKeys(node: ResolvedNode | null, out: Set<string>): void {
    if (!node || node.kind === 'text') return;
    if (node.kind === 'mapped') out.add(node.key);
    for (const child of node.children) this.collectMappedKeys(child, out);
  }

  /** Removes cached elements (and their action listeners) for keys no longer present in the
   *  current `resolved` tree, so a long-lived streaming session doesn't grow this cache without
   *  bound. */
  private pruneElementCache(): void {
    const live = new Set<string>();
    this.collectMappedKeys(this.resolved, live);
    for (const [key, el] of this.elements) {
      if (live.has(key)) continue;
      const state = this.actionHandlers.get(el);
      if (state) el.removeEventListener(state.event, state.handler);
      for (const binding of this.bindingHandlers.get(el) ?? []) {
        el.removeEventListener(binding.event, binding.handler);
      }
      this.elements.delete(key);
    }
  }

  private builtinStyle(node: ResolvedElement): Record<string, string> {
    const gap = typeof node.props['gap'] === 'string' ? GAP_TOKEN[node.props['gap']] : undefined;
    const align = typeof node.props['align'] === 'string' ? node.props['align'] : undefined;
    const justifyRaw = typeof node.props['justify'] === 'string' ? node.props['justify'] : undefined;
    const justify = justifyRaw ? JUSTIFY_VALUE[justifyRaw] : undefined;
    return {
      display: 'flex',
      'flex-direction': node.kind === 'builtin-row' ? 'row' : 'column',
      ...(gap ? { gap } : {}),
      ...(align ? { 'align-items': align } : {}),
      ...(justify ? { 'justify-content': justify } : {}),
    };
  }

  private syncActionHandler(el: HTMLElement, node: ResolvedElement): void {
    const existing = this.actionHandlers.get(el);
    if (existing && existing.event !== node.actionEvent) {
      el.removeEventListener(existing.event, existing.handler);
      this.actionHandlers.delete(el);
    }
    if (node.actionEvent && !this.actionHandlers.has(el)) {
      const handler: EventListener = (e) => {
        e.stopPropagation();
        if (node.actionId !== undefined) {
          this.emit('lr-widget-action', { actionId: node.actionId, payload: node.payload });
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
        const detail = (event as CustomEvent<unknown>).detail;
        const detailValue =
          detail && typeof detail === 'object' && 'value' in detail
            ? (detail as { value: unknown }).value
            : undefined;
        const value = detailValue ?? (el as unknown as Record<string, unknown>)[binding.prop];
        this.emit('lr-widget-state-change', {
          path: binding.path,
          value,
          nodeId: node.key,
          prop: binding.prop,
        });
      };
      el.addEventListener(binding.event, handler);
      states.push({ event: binding.event, handler });
    }
    this.bindingHandlers.set(el, states);
  }

  /** Creates (or reuses, keyed by `node.key`) the real DOM element for a `mapped` node. Every prop
   *  is assigned as a plain JS property -- never `setAttribute`, never `innerHTML`. The element's
   *  own children are rendered into it via a nested `render()` call, so Lit's diffing still governs
   *  one level down; reusing the same element instance across a streamed `tree` update is what lets
   *  a mapped widget's own internal state (an open `<details>`, focus, scroll) survive
   *  re-resolution. */
  private getOrCreateElement(node: ResolvedElement): HTMLElement | null {
    if (!node.tag) return null;
    const existing = this.elements.get(node.key);
    const el = existing && existing.tagName.toLowerCase() === node.tag ? existing : document.createElement(node.tag);
    if (el !== existing) this.elements.set(node.key, el);
    for (const [k, v] of Object.entries(node.props)) {
      (el as unknown as Record<string, unknown>)[k] = v;
    }
    const slotValue = node.slot ?? '';
    if (el.getAttribute('slot') !== slotValue) {
      if (slotValue) el.setAttribute('slot', slotValue);
      else el.removeAttribute('slot');
    }
    this.syncActionHandler(el, node);
    this.syncBindingHandlers(el, node);
    render(html`${repeat(node.children, (c) => c.key, (c) => this.renderChildValue(c))}`, el, { host: this });
    return el;
  }

  private renderChildValue(node: ResolvedNode): unknown {
    if (node.kind === 'text') {
      return node.slot ? html`<span slot=${node.slot}>${node.text}</span>` : node.text;
    }
    if (node.kind === 'mapped') {
      return this.getOrCreateElement(node) ?? nothing;
    }
    const part = node.kind === 'builtin-row' ? 'row' : node.kind === 'builtin-col' ? 'col' : 'text';
    return html`<div part=${part} style=${styleMap(this.builtinStyle(node))} slot=${node.slot ?? nothing}>
      ${node.kind === 'builtin-text' ? node.props['value'] ?? nothing : nothing}
      ${repeat(node.children, (c) => c.key, (c) => this.renderChildValue(c))}
    </div>`;
  }

  override render(): TemplateResult {
    return html`<div part="base">${this.resolved ? this.renderChildValue(this.resolved) : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-widget-renderer': LyraWidgetRenderer;
  }
}
