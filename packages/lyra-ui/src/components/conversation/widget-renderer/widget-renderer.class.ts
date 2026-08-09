import {
  html,
  nothing,
  render,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { styles } from "./widget-renderer.styles.js";
import {
  resolveTree,
  type LyraWidgetDocument,
  type ResolvedNode,
  type ResolvedElement,
  type WidgetNode,
} from "./resolve.js";
import {
  getDefaultWidgetTypeRegistry,
  type WidgetTypeRegistry,
} from "./registry.js";

const GAP_TOKEN: Record<string, string> = {
  s: "var(--lr-space-s)",
  m: "var(--lr-space-m)",
  l: "var(--lr-space-l)",
};
const JUSTIFY_VALUE: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
};
const ALIGN_VALUE: Record<string, string> = {
  start: "flex-start",
  "flex-start": "flex-start",
  center: "center",
  end: "flex-end",
  "flex-end": "flex-end",
  stretch: "stretch",
  baseline: "baseline",
  "self-start": "self-start",
  "self-end": "self-end",
  "first baseline": "first baseline",
  "last baseline": "last baseline",
  normal: "normal",
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

export interface LyraWidgetRendererEventMap {
  "lr-widget-action": CustomEvent<{ actionId: string; payload: unknown }>;
  "lr-render-error": CustomEvent<{ error: unknown }>;
  "lr-widget-state-change": CustomEvent<{
    path: string;
    value: unknown;
    nodeId: string;
    prop: string;
  }>;
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
 * A versioned `document` may supply both the root tree and controlled binding state. An allowlisted
 * prop value shaped as `{ $bind: '/json/pointer', fallback?: primitive }` reads from `state` (or
 * `document.state`); a registry `bindings` entry names the control event that requests a change.
 * The renderer reports that request through `lr-widget-state-change` and never mutates caller state.
 * Unknown-type and disallowed-prop warnings deduplicate within the effective root/registry
 * generation. State-only re-resolution of that root remains quiet, while replacing the streamed
 * root or registry releases its prior arbitrary warning keys before resolving the new generation.
 * A malformed root or nested node fails closed: the prior rendered tree is cleared and exactly one
 * `lr-render-error` describes the rejected update.
 * The normal `widget-renderer.js` registration entry also installs the eight-component default
 * registry. A lean custom-registry consumer instead imports this side-effect-free class module,
 * calls `defineElement('widget-renderer', LyraWidgetRenderer)`, imports only its mapped component
 * registrations, and assigns the per-instance `registry` property.
 *
 * @customElement lr-widget-renderer
 * @event lr-widget-action - `detail: { actionId, payload }` — the single bubbling action channel.
 * @event lr-render-error - `detail: { error }` — the root or one of its nested nodes was structurally unusable.
 * @event lr-widget-state-change - A bound control requested a controlled state update. `detail: { path, value, nodeId, prop }`; the caller must apply the next `state` value.
 * @csspart base - The root wrapper (`display: contents` — adds no layout box of its own).
 * @csspart row - A built-in `row` node.
 * @csspart col - A built-in `col` node.
 * @csspart text - A built-in `text` node.
 * @status stable
 * @since 4.0.0
 */
export class LyraWidgetRenderer extends LyraElement<LyraWidgetRendererEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The declarative widget tree to render. `null` (the default) renders an empty base. A malformed
   * root or nested node clears prior content and emits one `lr-render-error`. */
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
  private warningScope?: {
    root: WidgetNode | null;
    registry: WidgetTypeRegistry;
  };
  private readonly elements = new Map<string, HTMLElement>();
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

  protected override willUpdate(changed: PropertyValues): void {
    if (
      !this.hasUpdated ||
      changed.has("tree") ||
      changed.has("document") ||
      changed.has("state") ||
      changed.has("registry")
    ) {
      const registry = this.registry ?? getDefaultWidgetTypeRegistry();
      const root = this.document?.root ?? this.tree;
      if (
        this.warningScope?.root !== root ||
        this.warningScope.registry !== registry
      ) {
        this.warned.clear();
        this.warningScope = { root, registry };
      }
      if (this.document !== null && this.document.version !== "1") {
        this.resolved = null;
        this.emit("lr-render-error", {
          error: new Error("lr-widget-renderer: unsupported document version"),
        });
        return;
      }
      let next: ResolvedNode | null;
      try {
        next = resolveTree(root, {
          registry,
          warned: this.warned,
          state: this.state ?? this.document?.state,
        });
      } catch (error) {
        this.resolved = null;
        this.emit("lr-render-error", {
          error:
            error instanceof Error
              ? error
              : new Error("lr-widget-renderer: tree resolution failed"),
        });
        return;
      }
      if (root != null && next === null) {
        this.emit("lr-render-error", {
          error: new Error(
            "lr-widget-renderer: tree resolved to nothing renderable"
          ),
        });
      }
      this.resolved = next;
    }
  }

  protected override updated(): void {
    this.pruneElementCache();
  }

  private collectMappedKeys(node: ResolvedNode | null, out: Set<string>): void {
    if (!node || node.kind === "text") return;
    if (node.kind === "mapped") out.add(node.identityKey);
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
    const gap =
      typeof node.props["gap"] === "string"
        ? GAP_TOKEN[node.props["gap"]]
        : undefined;
    const align =
      typeof node.props["align"] === "string"
        ? sanitizeAlignValue(node.props["align"])
        : undefined;
    const justifyRaw =
      typeof node.props["justify"] === "string"
        ? node.props["justify"]
        : undefined;
    const justify = justifyRaw ? JUSTIFY_VALUE[justifyRaw] : undefined;
    return {
      display: "flex",
      "flex-direction": node.kind === "builtin-row" ? "row" : "column",
      "flex-wrap": node.kind === "builtin-row" ? "wrap" : "nowrap",
      ...(gap ? { gap } : {}),
      ...(align ? { "align-items": align } : {}),
      ...(justify ? { "justify-content": justify } : {}),
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
          this.emit("lr-widget-action", {
            actionId: node.actionId,
            payload: node.payload,
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
        const detailValue =
          detail && typeof detail === "object" && "value" in detail
            ? (detail as { value: unknown }).value
            : undefined;
        const value =
          detailValue ??
          (el as unknown as Record<string, unknown>)[binding.prop];
        this.emit("lr-widget-state-change", {
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
    const existing = this.elements.get(node.identityKey);
    const el =
      existing && existing.tagName.toLowerCase() === node.tag
        ? existing
        : document.createElement(node.tag);
    if (el !== existing) this.elements.set(node.identityKey, el);
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
    const slotValue = node.slot ?? "";
    if (el.getAttribute("slot") !== slotValue) {
      if (slotValue) el.setAttribute("slot", slotValue);
      else el.removeAttribute("slot");
    }
    this.syncActionHandler(el, node);
    this.syncBindingHandlers(el, node);
    render(
      html`${repeat(
        node.children,
        (child) => this.renderIdentity(child),
        (child) => this.renderChildValue(child)
      )}`,
      el,
      {
        host: this,
      }
    );
    return el;
  }

  private renderIdentity(node: ResolvedNode): string {
    return node.kind === "text" ? `text:${node.key}` : node.identityKey;
  }

  private renderChildValue(node: ResolvedNode): unknown {
    if (node.kind === "text") {
      return html`<span class="widget-text" slot=${node.slot ?? nothing}
        >${node.text}</span
      >`;
    }
    if (node.kind === "mapped") {
      return this.getOrCreateElement(node) ?? nothing;
    }
    const part =
      node.kind === "builtin-row"
        ? "row"
        : node.kind === "builtin-col"
        ? "col"
        : "text";
    return html`<div
      part=${part}
      style=${styleMap(this.builtinStyle(node))}
      slot=${node.slot ?? nothing}
    >
      ${node.kind === "builtin-text" ? node.props["value"] ?? nothing : nothing}
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
    "lr-widget-renderer": LyraWidgetRenderer;
  }
}
