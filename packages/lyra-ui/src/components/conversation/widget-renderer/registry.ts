/** A primitive property type accepted from an authored widget document. */
export type WidgetPropType = "string" | "number" | "boolean";

/** Semantic interaction classification, independent of event and binding plumbing. */
export type WidgetInteraction = "none" | "control";

/** One allowlisted mapped widget type. Structural `text`/`row`/`col` nodes are not registered. */
export interface WidgetTypeDefinition {
  /** Required custom-element render target. */
  readonly tag: string;
  /** Prop allowlist: name -> required primitive type. */
  readonly props?: Readonly<Record<string, WidgetPropType>>;
  /** Always applied after the authored allowlist and never overridable by document input. */
  readonly forcedProps?: Readonly<Record<string, unknown>>;
  /** Allowlisted child slot names. */
  readonly slots?: readonly string[];
  /** Whether this element is semantically a control for nested-control content-model checks. */
  readonly interaction: WidgetInteraction;
  /** Event that emits `lr-widget-action` when a node also supplies `actionId`. */
  readonly action?: Readonly<{ event: string }>;
  /** Controlled-state event mappings for allowlisted props. */
  readonly bindings?: Readonly<Record<string, Readonly<{ event: string }>>>;
}

const WIDGET_TYPE_REGISTRY_BRAND: unique symbol = Symbol(
  "LyraWidgetTypeRegistry"
);

/** Immutable type-keyed registry snapshot accepted by each `<lr-widget-renderer>` instance. */
export interface WidgetTypeRegistry
  extends ReadonlyMap<string, Readonly<WidgetTypeDefinition>> {
  readonly [WIDGET_TYPE_REGISTRY_BRAND]: true;
}

const CUSTOM_ELEMENT_NAME = /^[a-z][.0-9_a-z]*-[\-.0-9_a-z]*$/;
const RESERVED_CUSTOM_ELEMENT_NAMES = new Set([
  "annotation-xml",
  "color-profile",
  "font-face",
  "font-face-format",
  "font-face-name",
  "font-face-src",
  "font-face-uri",
  "missing-glyph",
]);
const SAFE_PROPERTY_NAME = /^[A-Za-z_$][\w$]*$/;
const FORBIDDEN_PROPERTIES = new Set([
  "__proto__",
  "constructor",
  "innerHTML",
  "outerHTML",
  "prototype",
]);
const STRUCTURAL_WIDGET_TYPES = new Set(["col", "row", "text"]);

function registryTypeKey(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim()
  ) {
    throw new TypeError(
      "A widget type key must be a nonempty string without surrounding whitespace."
    );
  }
  if (STRUCTURAL_WIDGET_TYPES.has(value)) {
    throw new TypeError(
      `Structural widget type "${value}" cannot be registered.`
    );
  }
  return value;
}

function eventName(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim()
  ) {
    throw new TypeError(`A widget ${label} must be a nonempty event name.`);
  }
  return value;
}

function propertyName(value: string): string {
  if (
    !SAFE_PROPERTY_NAME.test(value) ||
    FORBIDDEN_PROPERTIES.has(value) ||
    value.toLowerCase().startsWith("on")
  ) {
    throw new TypeError(
      `Widget property "${value}" is not a safe assignable property name.`
    );
  }
  return value;
}

function freezeProps(
  value: unknown
): Readonly<Record<string, WidgetPropType>> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("A widget props allowlist must be an object.");
  }
  const out: Record<string, WidgetPropType> = {};
  for (const [key, type] of Object.entries(value)) {
    propertyName(key);
    if (type !== "string" && type !== "number" && type !== "boolean") {
      throw new TypeError(
        `Widget property "${key}" has an invalid primitive type.`
      );
    }
    out[key] = type;
  }
  return Object.freeze(out);
}

function freezeForcedProps(
  value: unknown
): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Widget forcedProps must be an object.");
  }
  const out: Record<string, unknown> = {};
  for (const [key, forced] of Object.entries(value)) {
    propertyName(key);
    out[key] = forced;
  }
  return Object.freeze(out);
}

function freezeBindings(
  value: unknown,
  props: Readonly<Record<string, WidgetPropType>> | undefined
): Readonly<Record<string, Readonly<{ event: string }>>> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Widget bindings must be an object.");
  }
  const out: Record<string, Readonly<{ event: string }>> = {};
  for (const [key, binding] of Object.entries(value)) {
    propertyName(key);
    if (!props?.[key]) {
      throw new TypeError(
        `Widget binding "${key}" must name an allowlisted property.`
      );
    }
    if (
      typeof binding !== "object" ||
      binding === null ||
      Array.isArray(binding)
    ) {
      throw new TypeError(`Widget binding "${key}" must be an object.`);
    }
    out[key] = Object.freeze({
      event: eventName(
        (binding as { event?: unknown }).event,
        `binding for "${key}"`
      ),
    });
  }
  return Object.freeze(out);
}

/** Validates and freezes one factory input definition. */
function validateWidgetTypeDefinition(
  value: unknown
): Readonly<WidgetTypeDefinition> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("A widget type definition must be an object.");
  }
  const candidate = value as Partial<WidgetTypeDefinition>;
  if (
    typeof candidate.tag !== "string" ||
    !CUSTOM_ELEMENT_NAME.test(candidate.tag) ||
    RESERVED_CUSTOM_ELEMENT_NAMES.has(candidate.tag)
  ) {
    throw new TypeError(
      "A widget type definition requires a valid custom-element tag."
    );
  }
  const props = freezeProps(candidate.props);
  const forcedProps = freezeForcedProps(candidate.forcedProps);
  const interaction = candidate.interaction;
  if (interaction !== "none" && interaction !== "control") {
    throw new TypeError(
      "Widget interaction must be either 'none' or 'control'."
    );
  }
  const action = candidate.action
    ? Object.freeze({ event: eventName(candidate.action.event, "action") })
    : undefined;
  const bindings = freezeBindings(candidate.bindings, props);
  if ((action || bindings) && interaction !== "control") {
    throw new TypeError(
      "A widget definition with actions or bindings must declare interaction: 'control'."
    );
  }
  let slots: readonly string[] | undefined;
  if (candidate.slots !== undefined) {
    if (!Array.isArray(candidate.slots)) {
      throw new TypeError("Widget slots must be an array.");
    }
    const unique = new Set<string>();
    for (const slot of candidate.slots) {
      if (typeof slot !== "string" || !slot || slot !== slot.trim()) {
        throw new TypeError(
          "Widget slot names must be nonempty strings without surrounding whitespace."
        );
      }
      if (unique.has(slot)) {
        throw new TypeError(`Duplicate widget slot name "${slot}".`);
      }
      unique.add(slot);
    }
    slots = Object.freeze([...unique]);
  }
  const validated = Object.freeze({
    tag: candidate.tag,
    ...(props ? { props } : {}),
    ...(forcedProps ? { forcedProps } : {}),
    ...(slots ? { slots } : {}),
    interaction,
    ...(action ? { action } : {}),
    ...(bindings ? { bindings } : {}),
  });
  return validated;
}

/** Read-only wrapper rather than a frozen `Map`, whose mutator methods remain callable. */
class ImmutableWidgetTypeRegistry implements WidgetTypeRegistry {
  readonly [WIDGET_TYPE_REGISTRY_BRAND] = true as const;
  readonly #entries: Map<string, Readonly<WidgetTypeDefinition>>;

  constructor(
    entries: Iterable<readonly [string, Readonly<WidgetTypeDefinition>]>
  ) {
    this.#entries = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: string): Readonly<WidgetTypeDefinition> | undefined {
    return this.#entries.get(key);
  }

  has(key: string): boolean {
    return this.#entries.has(key);
  }

  entries(): MapIterator<[string, Readonly<WidgetTypeDefinition>]> {
    return this.#entries.entries();
  }

  keys(): MapIterator<string> {
    return this.#entries.keys();
  }

  values(): MapIterator<Readonly<WidgetTypeDefinition>> {
    return this.#entries.values();
  }

  forEach(
    callbackfn: (
      value: Readonly<WidgetTypeDefinition>,
      key: string,
      map: WidgetTypeRegistry
    ) => void,
    thisArg?: unknown
  ): void {
    for (const [key, value] of this.#entries) {
      callbackfn.call(thisArg, value, key, this);
    }
  }

  [Symbol.iterator](): MapIterator<[string, Readonly<WidgetTypeDefinition>]> {
    return this.entries();
  }
}

/** Runtime guard for callers crossing an untyped boundary. Mutable structural `Map` values are
 * rejected rather than retained by a renderer and allowed to leak mutations between instances. */
export function isWidgetTypeRegistry(
  value: unknown
): value is WidgetTypeRegistry {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Partial<WidgetTypeRegistry>)[WIDGET_TYPE_REGISTRY_BRAND] ===
        true
  );
}

/** Creates an immutable, validated registry snapshot owned by the assigning renderer/consumer. */
export function createWidgetTypeRegistry(
  entries: Iterable<readonly [string, WidgetTypeDefinition]> = []
): WidgetTypeRegistry {
  const validated = new Map<string, Readonly<WidgetTypeDefinition>>();
  for (const [type, definition] of entries) {
    const key = registryTypeKey(type);
    if (validated.has(key)) {
      throw new TypeError(`Duplicate widget type key "${key}".`);
    }
    validated.set(key, validateWidgetTypeDefinition(definition));
  }
  return new ImmutableWidgetTypeRegistry(validated);
}
