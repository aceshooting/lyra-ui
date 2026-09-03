import {
  asciiWhitespaceTokens,
  isSingleAsciiWhitespaceToken,
} from './ascii-whitespace.js';
import { highestReachableWindow } from './a11y.js';
import {
  registerDescriptionBaselineUpdater,
  resolveIdReferencesIn,
} from './aria-reflection.js';

export {
  syncAriaControlsElements,
  syncAriaDescribedByElements,
} from './aria-reflection.js';

/** What a described element looked like before a transient description was applied to it. */
export interface AppliedDescription {
  readonly target: HTMLElement;
  readonly had: boolean;
  readonly value: string | null;
  /** Whether the element-reference list (rather than the serialized attribute) carries the link. */
  readonly assigned: boolean;
  /** Replaces the descriptions owned by this one handle without disturbing any peer handle. */
  update(descriptions: readonly Element[]): void;
  /** Releases only this handle's relationships. Calling it more than once is harmless. */
  release(): void;
}

/** An IDREF relationship that can be projected from a host onto its semantic owner. */
export type ResolvedAriaRelationship = 'aria-describedby' | 'aria-labelledby';

type ElementReferenceProperty = 'ariaDescribedByElements' | 'ariaLabelledByElements';
type RelationshipPosition = 'after' | 'before';

interface RelationshipDefinition {
  readonly attribute: ResolvedAriaRelationship;
  readonly property: ElementReferenceProperty;
}

const DESCRIPTION_RELATIONSHIP: RelationshipDefinition = {
  attribute: 'aria-describedby',
  property: 'ariaDescribedByElements',
};
const LABEL_RELATIONSHIP: RelationshipDefinition = {
  attribute: 'aria-labelledby',
  property: 'ariaLabelledByElements',
};

interface AttributeRelationshipBaseline {
  readonly had: boolean;
  readonly kind: 'attribute';
  readonly value: string | null;
}

interface ElementRelationshipBaseline {
  readonly elements: readonly Element[];
  readonly kind: 'elements';
}

type RelationshipBaseline = AttributeRelationshipBaseline | ElementRelationshipBaseline;

interface RelationshipSnapshot {
  readonly elements: readonly Element[] | null;
  readonly had: boolean;
  readonly value: string | null;
}

interface RelationshipLeaseRecord {
  elements: readonly Element[];
  position: RelationshipPosition;
}

interface RelationshipOwnershipState {
  baseline: RelationshipBaseline;
  lastApplied: RelationshipSnapshot;
  lastAppliedDocument: Document;
  /** Projected endpoints that were resolvable when the last relationship was written. */
  lastAppliedResolvability: ReadonlyMap<Element, boolean>;
  lastAppliedRoot: Node;
  /** Serialized baseline IDs that did not resolve when the last relationship was written. */
  lastAppliedUnresolvedBaselineIds: readonly string[];
  leases: Map<symbol, RelationshipLeaseRecord>;
  observer?: MutationObserver;
  observerDocument?: Document;
  observerElements: readonly Element[];
  observerGeneration: number;
  observerRoot?: Node;
  target: HTMLElement;
  writing: number;
}

type RelationshipOwnership = WeakMap<HTMLElement, RelationshipOwnershipState>;
type RelationshipOwnershipHost = typeof globalThis & Record<PropertyKey, unknown>;

// Keep the established current-source registry key so query-imported copies compose. This module
// deliberately does not inspect or adapt any foreign registry schema.
const DESCRIPTION_OWNERSHIP = Symbol.for('@aceshooting/lyra-ui.aria-description-ownership.v1');
const LABEL_OWNERSHIP = Symbol.for('@aceshooting/lyra-ui.aria-label-ownership.v1');
const fallbackDescriptionOwnership: RelationshipOwnership = new WeakMap();
const fallbackLabelOwnership: RelationshipOwnership = new WeakMap();

function sharedRelationshipOwnership(
  key: symbol,
  fallback: RelationshipOwnership,
): RelationshipOwnership {
  const host = (typeof window === 'undefined'
    ? globalThis
    : highestReachableWindow(window)) as RelationshipOwnershipHost;
  const existing = host[key] as RelationshipOwnership | undefined;
  if (existing) return existing;
  try {
    Object.defineProperty(host, key, {
      configurable: false,
      enumerable: false,
      value: fallback,
      writable: false,
    });
    return (host[key] as RelationshipOwnership | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

const descriptionOwnership = sharedRelationshipOwnership(
  DESCRIPTION_OWNERSHIP,
  fallbackDescriptionOwnership,
);
const labelOwnership = sharedRelationshipOwnership(LABEL_OWNERSHIP, fallbackLabelOwnership);

function relationshipDefinition(relationship: ResolvedAriaRelationship): RelationshipDefinition {
  return relationship === 'aria-describedby' ? DESCRIPTION_RELATIONSHIP : LABEL_RELATIONSHIP;
}

function relationshipOwnership(relationship: ResolvedAriaRelationship): RelationshipOwnership {
  return relationship === 'aria-describedby' ? descriptionOwnership : labelOwnership;
}

function reflectedRelationshipElements(
  target: HTMLElement,
  definition: RelationshipDefinition,
): readonly Element[] | null {
  if (!(definition.property in target)) return null;
  try {
    const reflected = Reflect.get(target, definition.property) as Iterable<Element> | null;
    return reflected === null ? null : [...reflected];
  } catch {
    return null;
  }
}

function relationshipSnapshot(
  target: HTMLElement,
  definition: RelationshipDefinition,
): RelationshipSnapshot {
  return {
    elements: reflectedRelationshipElements(target, definition),
    had: target.hasAttribute(definition.attribute),
    value: target.getAttribute(definition.attribute),
  };
}

function setLastApplied(
  state: RelationshipOwnershipState,
  definition: RelationshipDefinition,
): void {
  state.lastApplied = relationshipSnapshot(state.target, definition);
  state.lastAppliedDocument = state.target.ownerDocument;
  state.lastAppliedResolvability = new Map(
    projectedRelationshipElements(state)
      .map((element) => [element, isIdResolvableFromTarget(state.target, element)]),
  );
  state.lastAppliedRoot = state.target.getRootNode();
  state.lastAppliedUnresolvedBaselineIds = state.baseline.kind === 'attribute'
    ? [...asciiWhitespaceTokens(state.baseline.value)]
      .filter((id) => !isIdResolvableIdFromTarget(state.target, id))
    : [];
}

function sameElements(first: readonly Element[] | null, second: readonly Element[] | null): boolean {
  if (first === null || second === null) return first === second;
  return first.length === second.length && first.every((element, index) => element === second[index]);
}

function sameRelationshipSnapshot(first: RelationshipSnapshot, second: RelationshipSnapshot): boolean {
  return first.had === second.had && first.value === second.value &&
    sameElements(first.elements, second.elements);
}

function baselineFromSnapshot(snapshot: RelationshipSnapshot): RelationshipBaseline {
  // Assigning an element-reference property leaves the serialized attribute empty. Preserve that
  // explicit list rather than trying to serialize references that may cross a shadow boundary.
  if (snapshot.value === '' && snapshot.elements !== null) {
    return { elements: snapshot.elements, kind: 'elements' };
  }
  return { had: snapshot.had, kind: 'attribute', value: snapshot.value };
}

function baselineElements(state: RelationshipOwnershipState): Element[] {
  if (state.baseline.kind === 'elements') return [...state.baseline.elements];
  try {
    return resolveIdReferencesIn(state.target.getRootNode(), state.baseline.value);
  } catch {
    return [];
  }
}

function relationshipElements(
  state: RelationshipOwnershipState,
  position: RelationshipPosition,
): Element[] {
  const elements: Element[] = [];
  const seen = new Set<Element>();
  for (const record of state.leases.values()) {
    if (record.position !== position) continue;
    for (const element of record.elements) {
      if (seen.has(element)) continue;
      seen.add(element);
      elements.push(element);
    }
  }
  return elements;
}

function projectedRelationshipElements(state: RelationshipOwnershipState): Element[] {
  const elements: Element[] = [];
  const seen = new Set<Element>();
  for (const element of [
    ...relationshipElements(state, 'before'),
    ...baselineElements(state),
    ...relationshipElements(state, 'after'),
  ]) {
    if (seen.has(element)) continue;
    seen.add(element);
    elements.push(element);
  }
  return elements;
}

function managedRelationshipElements(state: RelationshipOwnershipState): Element[] {
  const elements: Element[] = [];
  const seen = new Set<Element>();
  for (const element of [
    ...baselineElements(state),
    ...relationshipElements(state, 'before'),
    ...relationshipElements(state, 'after'),
  ]) {
    if (seen.has(element)) continue;
    seen.add(element);
    elements.push(element);
  }
  return elements;
}

function isIdResolvableFromTarget(target: HTMLElement, element: Element): boolean {
  if (!isSingleAsciiWhitespaceToken(element.id)) return false;
  try {
    const root = target.getRootNode();
    return 'getElementById' in root &&
      (root as Document | ShadowRoot).getElementById(element.id) === element;
  } catch {
    return false;
  }
}

function isIdResolvableIdFromTarget(target: HTMLElement, id: string): boolean {
  if (!isSingleAsciiWhitespaceToken(id)) return false;
  try {
    const root = target.getRootNode();
    return 'getElementById' in root &&
      (root as Document | ShadowRoot).getElementById(id) !== null;
  } catch {
    return false;
  }
}

function setReflectedRelationshipElements(
  state: RelationshipOwnershipState,
  definition: RelationshipDefinition,
  elements: readonly Element[] | null,
): boolean {
  try {
    state.writing += 1;
    return Reflect.set(
      state.target,
      definition.property,
      elements === null ? null : [...elements],
    );
  } catch {
    return false;
  } finally {
    state.writing -= 1;
  }
}

function serializedRelationshipIds(
  state: RelationshipOwnershipState,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string): void => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const element of relationshipElements(state, 'before')) {
    if (isIdResolvableFromTarget(state.target, element)) add(element.id);
  }
  if (state.baseline.kind === 'attribute') {
    for (const id of asciiWhitespaceTokens(state.baseline.value)) add(id);
  } else {
    for (const element of state.baseline.elements) {
      if (isIdResolvableFromTarget(state.target, element)) add(element.id);
    }
  }
  for (const element of relationshipElements(state, 'after')) {
    if (isIdResolvableFromTarget(state.target, element)) add(element.id);
  }
  return ids;
}

function applyLatestRelationshipOwnership(
  state: RelationshipOwnershipState,
  definition: RelationshipDefinition,
  ownership: RelationshipOwnership,
): void {
  if (ownership.get(state.target) !== state) return;
  applyRelationshipOwnership(state, definition);
}

function applyRelationshipOwnership(
  state: RelationshipOwnershipState,
  definition: RelationshipDefinition,
): void {
  const before = relationshipElements(state, 'before');
  const after = relationshipElements(state, 'after');
  if (before.length === 0 && after.length === 0) {
    restoreRelationshipBaseline(state, definition);
    return;
  }

  const elements = projectedRelationshipElements(state);
  const canReflect = definition.property in state.target;
  const needsElementReferences = state.baseline.kind === 'elements' ||
    [...before, ...after].some((element) => !isIdResolvableFromTarget(state.target, element));
  if (canReflect && needsElementReferences &&
    setReflectedRelationshipElements(state, definition, elements)) {
    setLastApplied(state, definition);
    return;
  }

  if (canReflect && state.lastApplied.value === '') {
    setReflectedRelationshipElements(state, definition, null);
  }
  const ids = serializedRelationshipIds(state);
  try {
    state.writing += 1;
    if (ids.length > 0) {
      state.target.setAttribute(definition.attribute, ids.join(' '));
    } else if (state.baseline.kind === 'attribute' && state.baseline.had) {
      state.target.setAttribute(definition.attribute, '');
    } else {
      state.target.removeAttribute(definition.attribute);
    }
  } finally {
    state.writing -= 1;
  }
  setLastApplied(state, definition);
}

function restoreRelationshipBaseline(
  state: RelationshipOwnershipState,
  definition: RelationshipDefinition,
): void {
  if (state.baseline.kind === 'elements' && definition.property in state.target &&
    setReflectedRelationshipElements(state, definition, state.baseline.elements)) {
    setLastApplied(state, definition);
    return;
  }

  if (definition.property in state.target && state.lastApplied.value === '') {
    setReflectedRelationshipElements(state, definition, null);
  }
  try {
    state.writing += 1;
    if (state.baseline.kind === 'attribute' && state.baseline.had) {
      state.target.setAttribute(definition.attribute, state.baseline.value ?? '');
    } else {
      state.target.removeAttribute(definition.attribute);
    }
  } finally {
    state.writing -= 1;
  }
  setLastApplied(state, definition);
}

function adoptExternalRelationshipBaseline(
  state: RelationshipOwnershipState,
  definition: RelationshipDefinition,
  force = false,
): boolean {
  if (state.writing > 0) return false;
  const current = relationshipSnapshot(state.target, definition);
  if (!force && sameRelationshipSnapshot(current, state.lastApplied)) return false;
  if (!force && current.had === state.lastApplied.had && current.value === state.lastApplied.value) {
    try {
      if (state.target.ownerDocument !== state.lastAppliedDocument ||
        state.target.getRootNode() !== state.lastAppliedRoot) {
        // A detach/adoption can alter native reflected lists without an author relationship write.
        // Keep the previously observed author baseline rather than promoting this structural view.
        return false;
      }
      if (state.lastAppliedUnresolvedBaselineIds.some((id) =>
        isIdResolvableIdFromTarget(state.target, id))) {
        // Resolving an existing raw IDREF changes native reflection without replacing the authored
        // serialized baseline.
        return false;
      }
      for (const [element, wasResolvable] of state.lastAppliedResolvability) {
        if (wasResolvable && !isIdResolvableFromTarget(state.target, element)) {
          // Native element-reference reflection can drop a projected endpoint when it moves out
          // of this target's root. That is structural fallout, not an author replacement for the
          // baseline that should survive release.
          return false;
        }
      }
    } catch {
      return false;
    }
  }
  state.baseline = baselineFromSnapshot(current);
  return true;
}

function sameElementLists(first: readonly Element[], second: readonly Element[]): boolean {
  return first.length === second.length && first.every((element, index) => element === second[index]);
}

function clearRelationshipObserver(
  state: RelationshipOwnershipState,
  observer: MutationObserver | undefined = state.observer,
): void {
  if (state.observer === observer) {
    state.observerGeneration += 1;
    state.observer = undefined;
    state.observerDocument = undefined;
    state.observerRoot = undefined;
    state.observerElements = [];
  }
  try {
    observer?.disconnect();
  } catch {
    // A native observer may already have been torn down by an adopted document.
  }
}

function processRelationshipRecords(
  state: RelationshipOwnershipState,
  definition: RelationshipDefinition,
  ownership: RelationshipOwnership,
  records: readonly MutationRecord[],
): void {
  if (ownership.get(state.target) !== state || records.length === 0) return;
  const targetChanged = records.some((record) => record.target === state.target &&
    record.type === 'attributes' && record.attributeName === definition.attribute);
  if (targetChanged) adoptExternalRelationshipBaseline(state, definition, true);
  if (state.leases.size > 0 || targetChanged) {
    applyLatestRelationshipOwnership(state, definition, ownership);
    observeRelationshipOwnership(state, definition, ownership, true);
  }
}

function drainRelationshipObserver(
  state: RelationshipOwnershipState,
  definition: RelationshipDefinition,
  ownership: RelationshipOwnership,
): void {
  const observer = state.observer;
  if (!observer) return;
  let records: MutationRecord[];
  try {
    records = observer.takeRecords();
  } catch {
    clearRelationshipObserver(state, observer);
    return;
  }
  processRelationshipRecords(state, definition, ownership, records);
}

function observeRelationshipOwnership(
  state: RelationshipOwnershipState,
  definition: RelationshipDefinition,
  ownership: RelationshipOwnership,
  force = false,
): void {
  if (ownership.get(state.target) !== state || state.leases.size === 0) return;
  let ownerDocument: Document;
  let root: Node;
  try {
    ownerDocument = state.target.ownerDocument;
    root = state.target.getRootNode();
  } catch {
    return;
  }
  const elements = managedRelationshipElements(state);
  if (!force && state.observer && state.observerDocument === ownerDocument &&
    state.observerRoot === root && sameElementLists(state.observerElements, elements)) {
    return;
  }

  const previousObserver = state.observer;
  const generation = state.observerGeneration + 1;
  state.observerGeneration = generation;
  state.observer = undefined;
  state.observerDocument = undefined;
  state.observerRoot = undefined;
  state.observerElements = [];
  try {
    previousObserver?.disconnect();
  } catch {
    // The next owner-realm observer remains authoritative even if the previous one rejects.
  }

  let Observer: typeof MutationObserver | undefined;
  try {
    Observer = ownerDocument.defaultView?.MutationObserver;
  } catch {
    return;
  }
  if (!Observer || ownership.get(state.target) !== state || state.leases.size === 0 ||
    state.observerGeneration !== generation) return;

  let observer: MutationObserver;
  try {
    observer = new Observer((records) => {
      if (state.observer !== observer || state.observerGeneration !== generation ||
        ownership.get(state.target) !== state) return;
      processRelationshipRecords(state, definition, ownership, records);
    });
  } catch {
    return;
  }
  if (ownership.get(state.target) !== state || state.leases.size === 0 ||
    state.observerGeneration !== generation) {
    try {
      observer.disconnect();
    } catch {
      // Nothing is owned by this discarded candidate.
    }
    return;
  }

  state.observer = observer;
  state.observerDocument = ownerDocument;
  state.observerRoot = root;
  state.observerElements = elements;
  try {
    observer.observe(state.target, {
      attributes: true,
      attributeFilter: [definition.attribute],
    });
    for (const element of elements) {
      if (element === state.target) continue;
      observer.observe(element, { attributes: true, attributeFilter: ['id'] });
    }
  } catch {
    clearRelationshipObserver(state, observer);
  }
}

interface FixedRelationshipLease {
  readonly target: HTMLElement;
  update(elements: readonly Element[]): void;
  release(): void;
}

function acquireFixedRelationship(
  target: HTMLElement,
  elements: readonly Element[],
  definition: RelationshipDefinition,
  position: RelationshipPosition,
): FixedRelationshipLease {
  const ownership = relationshipOwnership(definition.attribute);
  let state = ownership.get(target);
  if (!state) {
    const initial = relationshipSnapshot(target, definition);
    state = {
      baseline: baselineFromSnapshot(initial),
      lastApplied: initial,
      lastAppliedDocument: target.ownerDocument,
      lastAppliedResolvability: new Map(),
      lastAppliedRoot: target.getRootNode(),
      lastAppliedUnresolvedBaselineIds: [],
      leases: new Map(),
      observerElements: [],
      observerGeneration: 0,
      target,
      writing: 0,
    };
    ownership.set(target, state);
  } else {
    drainRelationshipObserver(state, definition, ownership);
    adoptExternalRelationshipBaseline(state, definition);
  }

  const token = Symbol(`aria-${definition.attribute}-owner`);
  const record: RelationshipLeaseRecord = { elements: [...elements], position };
  state.leases.set(token, record);
  applyLatestRelationshipOwnership(state, definition, ownership);
  observeRelationshipOwnership(state, definition, ownership, true);
  let active = true;

  return {
    target,
    update(nextElements) {
      if (!active || ownership.get(target) !== state) return;
      drainRelationshipObserver(state!, definition, ownership);
      adoptExternalRelationshipBaseline(state!, definition);
      record.elements = [...nextElements];
      applyLatestRelationshipOwnership(state!, definition, ownership);
      observeRelationshipOwnership(state!, definition, ownership, true);
    },
    release() {
      if (!active) return;
      active = false;
      if (ownership.get(target) !== state) return;
      drainRelationshipObserver(state!, definition, ownership);
      adoptExternalRelationshipBaseline(state!, definition);
      state!.leases.delete(token);
      applyLatestRelationshipOwnership(state!, definition, ownership);
      if (state!.leases.size === 0) {
        clearRelationshipObserver(state!);
        ownership.delete(target);
      } else {
        observeRelationshipOwnership(state!, definition, ownership, true);
      }
    },
  };
}

function updateExternalDescriptionBaseline(target: HTMLElement, update: () => void): void {
  const state = descriptionOwnership.get(target);
  if (!state) {
    update();
    return;
  }
  drainRelationshipObserver(state, DESCRIPTION_RELATIONSHIP, descriptionOwnership);
  adoptExternalRelationshipBaseline(state, DESCRIPTION_RELATIONSHIP);
  update();
  adoptExternalRelationshipBaseline(state, DESCRIPTION_RELATIONSHIP);
  applyLatestRelationshipOwnership(state, DESCRIPTION_RELATIONSHIP, descriptionOwnership);
  observeRelationshipOwnership(state, DESCRIPTION_RELATIONSHIP, descriptionOwnership, true);
}

registerDescriptionBaselineUpdater(updateExternalDescriptionBaseline);

/** A composable ownership handle for one producer's contribution to `aria-describedby`. */
export interface AriaDescriptionLease {
  readonly target: HTMLElement;
  update(descriptions: readonly Element[]): void;
  release(): void;
}

/**
 * Owns a set of description elements without overwriting author relationships or peer owners.
 * Serialized and reflected-element baselines are restored exactly; later author writes become the
 * baseline that remains after the final lease releases.
 */
export function acquireAriaDescription(
  target: HTMLElement,
  descriptions: readonly Element[],
): AriaDescriptionLease {
  return acquireFixedRelationship(
    target,
    descriptions,
    DESCRIPTION_RELATIONSHIP,
    'after',
  );
}

/** A host IDREF relationship projected onto a replaceable semantic owner. */
export interface ResolvedAriaRelationshipLease {
  readonly host: HTMLElement;
  readonly relationship: ResolvedAriaRelationship;
  readonly target: HTMLElement | null;
  /** Retargets after render-path replacement and refreshes reconnect/adoption ownership. */
  update(target: HTMLElement | null): void;
  /** Restores the current target baseline and stops observing the host relationship. */
  release(): void;
}

interface ResolvedRelationshipState {
  active: boolean;
  fixed?: FixedRelationshipLease;
  host: HTMLElement;
  observer?: MutationObserver;
  observerDocument?: Document;
  observerGeneration: number;
  observerRoot?: Node;
  observerWatchesRoot: boolean;
  relationship: ResolvedAriaRelationship;
  target: HTMLElement | null;
}

function clearResolvedRelationshipObserver(state: ResolvedRelationshipState): void {
  const observer = state.observer;
  state.observerGeneration += 1;
  state.observer = undefined;
  state.observerDocument = undefined;
  state.observerRoot = undefined;
  state.observerWatchesRoot = false;
  try {
    observer?.disconnect();
  } catch {
    // An observer from an adopted realm is no longer authoritative.
  }
}

function resolvedRelationshipElements(state: ResolvedRelationshipState): Element[] {
  try {
    return resolveIdReferencesIn(
      state.host.getRootNode(),
      state.host.getAttribute(state.relationship),
    );
  } catch {
    return [];
  }
}

function refreshResolvedRelationship(state: ResolvedRelationshipState): void {
  if (!state.active || !state.target || !state.fixed) return;
  state.fixed.update(resolvedRelationshipElements(state));
}

function observeResolvedRelationship(state: ResolvedRelationshipState): void {
  if (!state.active) return;
  let ownerDocument: Document;
  let root: Node;
  try {
    ownerDocument = state.host.ownerDocument;
    root = state.host.getRootNode();
  } catch {
    return;
  }
  const watchesRoot = root !== state.host &&
    !asciiWhitespaceTokens(state.host.getAttribute(state.relationship)).next().done;
  if (state.observer && state.observerDocument === ownerDocument &&
    state.observerRoot === root && state.observerWatchesRoot === watchesRoot) return;

  const previousObserver = state.observer;
  const generation = state.observerGeneration + 1;
  state.observerGeneration = generation;
  state.observer = undefined;
  state.observerDocument = undefined;
  state.observerRoot = undefined;
  state.observerWatchesRoot = false;
  try {
    previousObserver?.disconnect();
  } catch {
    // Rebinding below is sufficient for ordinary adoption/reconnect lifecycle work.
  }

  let Observer: typeof MutationObserver | undefined;
  try {
    Observer = ownerDocument.defaultView?.MutationObserver;
  } catch {
    return;
  }
  if (!Observer || !state.active || state.observerGeneration !== generation) return;
  let observer: MutationObserver;
  try {
    observer = new Observer(() => {
      if (!state.active || state.observer !== observer ||
        state.observerGeneration !== generation) return;
      refreshResolvedRelationship(state);
      observeResolvedRelationship(state);
    });
  } catch {
    return;
  }
  if (!state.active || state.observerGeneration !== generation) {
    try {
      observer.disconnect();
    } catch {
      // The candidate was never published.
    }
    return;
  }
  state.observer = observer;
  state.observerDocument = ownerDocument;
  state.observerRoot = root;
  state.observerWatchesRoot = watchesRoot;
  try {
    observer.observe(state.host, {
      attributes: true,
      attributeFilter: [state.relationship],
    });
    if (watchesRoot) {
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['id'],
        childList: true,
        subtree: true,
      });
    }
  } catch {
    clearResolvedRelationshipObserver(state);
  }
}

/**
 * Resolves an authored host IDREF list in the host's root and owns its element-reference projection
 * onto a semantic target. Host references lead the target's pre-existing/generated relationship;
 * element identity is deduplicated and a release restores the target's exact current baseline.
 */
export function acquireResolvedAriaRelationship(
  host: HTMLElement,
  initialTarget: HTMLElement | null,
  relationship: ResolvedAriaRelationship,
): ResolvedAriaRelationshipLease {
  const state: ResolvedRelationshipState = {
    active: true,
    host,
    observerGeneration: 0,
    observerWatchesRoot: false,
    relationship,
    target: null,
  };
  const definition = relationshipDefinition(relationship);

  const update = (nextTarget: HTMLElement | null): void => {
    if (!state.active) return;
    if (state.target !== nextTarget) {
      const previousFixed = state.fixed;
      state.fixed = undefined;
      state.target = nextTarget;
      previousFixed?.release();
      if (nextTarget) {
        state.fixed = acquireFixedRelationship(
          nextTarget,
          resolvedRelationshipElements(state),
          definition,
          'before',
        );
      }
    } else {
      refreshResolvedRelationship(state);
    }
    observeResolvedRelationship(state);
  };

  const lease: ResolvedAriaRelationshipLease = {
    host,
    relationship,
    get target() {
      return state.target;
    },
    update,
    release() {
      if (!state.active) return;
      state.active = false;
      clearResolvedRelationshipObserver(state);
      const fixed = state.fixed;
      state.fixed = undefined;
      state.target = null;
      fixed?.release();
    },
  };
  update(initialTarget);
  return lease;
}

/**
 * Adds `description` to whatever already describes `target`, and returns the snapshot
 * `undescribeElement()` needs to put it back.
 */
export function describeElement(target: HTMLElement, description: Element): AppliedDescription {
  const had = target.hasAttribute('aria-describedby');
  const value = target.getAttribute('aria-describedby');
  const lease = acquireAriaDescription(target, [description]);
  return {
    get assigned() {
      return 'ariaDescribedByElements' in target && target.getAttribute('aria-describedby') === '' &&
        !isIdResolvableFromTarget(target, description);
    },
    had,
    release: lease.release,
    target,
    update: lease.update,
    value,
  };
}

/** Reverts `describeElement()`, restoring both the element-reference list and the attribute. */
export function undescribeElement(applied: AppliedDescription): void {
  applied.release();
}
