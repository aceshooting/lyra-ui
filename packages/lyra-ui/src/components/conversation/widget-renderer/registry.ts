/**
 * `<lr-widget-renderer>`'s type registry -- a type-keyed `Map` of allowlisted widget types plus
 * `register*()`/`getDefault*Registry()` accessors, mirroring `tool-result-view/registry.ts`'s shape.
 * No `load()`/lazy-loading here: unlike a tool renderer, a widget type definition is pure
 * configuration data (a tag name, a prop allowlist, forced props, a slot allowlist) rather than a
 * function that might pull in a heavy dependency, so there's nothing worth code-splitting.
 */

export interface WidgetTypeDefinition {
  /** The `lr-` tag to render (resolved through `tag()`, prefix-aware). Absent only for the three
   *  built-in structural types (`text`/`row`/`col`), which are never looked up in this registry. */
  tag?: string;
  /** Prop allowlist: name -> required primitive type. A prop absent here, or whose runtime `typeof`
   *  doesn't match, is skipped -- never assigned. */
  props?: Record<string, 'string' | 'number' | 'boolean'>;
  /** Always applied, after the allowlist filter, and never overridable by `WidgetNode.props`. */
  forcedProps?: Record<string, unknown>;
  /** Allowlisted child `slot` names. A child's `slot` not in this list renders unslotted (default
   *  slot), never dropped as a node. Defaults to no named slots allowed. */
  slots?: string[];
  /** The native/custom DOM event on the rendered tag that arms `lr-widget-action` when the node
   *  also sets `actionId`. */
  action?: { event: string };
  /** Optional controlled-state event mapping for allowlisted props. A node may bind such a prop
   *  with `{ $bind: '/json/pointer' }`; the renderer emits `lr-widget-state-change` when the
   *  configured event fires, but never mutates the supplied state itself. */
  bindings?: Record<string, { event: string }>;
}

export type WidgetTypeRegistry = Map<string, WidgetTypeDefinition>;

/** The module-level registry `<lr-widget-renderer>` dispatches against by default. */
const defaultRegistry: WidgetTypeRegistry = new Map();

/** Registers (or overwrites) the type definition for `type` in the default registry. */
export function registerWidgetType(type: string, def: WidgetTypeDefinition): void {
  defaultRegistry.set(type, def);
}

/** The module-level default registry `registerWidgetType()` writes to. */
export function getDefaultWidgetTypeRegistry(): WidgetTypeRegistry {
  return defaultRegistry;
}

/** @internal Test-only: empties the default registry so one test's registrations can't leak into
 *  the next. Not re-exported from the root barrel -- mirrors `clearToolRenderers()`. */
export function clearWidgetTypes(): void {
  defaultRegistry.clear();
}
