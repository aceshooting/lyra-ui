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

type DescribedByElementsTarget = HTMLElement & { ariaDescribedByElements: Element[] | null };

interface AttributeDescriptionBaseline {
  readonly had: boolean;
  readonly kind: 'attribute';
  readonly value: string | null;
}

interface ElementDescriptionBaseline {
  readonly elements: readonly Element[];
  readonly kind: 'elements';
}

type DescriptionBaseline = AttributeDescriptionBaseline | ElementDescriptionBaseline;

interface DescriptionSnapshot {
  readonly elements: readonly Element[] | null;
  readonly had: boolean;
  readonly value: string | null;
}

interface DescriptionLeaseRecord {
  descriptions: readonly Element[];
}

interface DescriptionOwnershipState {
  baseline: DescriptionBaseline;
  lastApplied: DescriptionSnapshot;
  leases: Map<symbol, DescriptionLeaseRecord>;
  observer?: MutationObserver;
  observerDocument?: Document;
  target: HTMLElement;
}

const DESCRIPTION_OWNERSHIP = Symbol.for('@aceshooting/lyra-ui.aria-description-ownership.v1');
type DescriptionOwnershipHost = typeof globalThis & {
  [DESCRIPTION_OWNERSHIP]?: WeakMap<HTMLElement, DescriptionOwnershipState>;
};
const fallbackDescriptionOwnership = new WeakMap<HTMLElement, DescriptionOwnershipState>();

function sharedDescriptionOwnership(): WeakMap<HTMLElement, DescriptionOwnershipState> {
  const host = (typeof window === 'undefined'
    ? globalThis
    : highestReachableWindow(window)) as DescriptionOwnershipHost;
  const existing = host[DESCRIPTION_OWNERSHIP];
  if (existing) return existing;
  const ownership = new WeakMap<HTMLElement, DescriptionOwnershipState>();
  try {
    Object.defineProperty(host, DESCRIPTION_OWNERSHIP, {
      configurable: false,
      enumerable: false,
      value: ownership,
      writable: false,
    });
    return host[DESCRIPTION_OWNERSHIP] ?? ownership;
  } catch {
    return fallbackDescriptionOwnership;
  }
}

const descriptionOwnership = sharedDescriptionOwnership();

function reflectedDescriptionElements(target: HTMLElement): readonly Element[] | null {
  if (!('ariaDescribedByElements' in target)) return null;
  try {
    const reflected = (target as DescribedByElementsTarget).ariaDescribedByElements;
    return reflected === null ? null : [...reflected];
  } catch {
    return null;
  }
}

function descriptionSnapshot(target: HTMLElement): DescriptionSnapshot {
  return {
    elements: reflectedDescriptionElements(target),
    had: target.hasAttribute('aria-describedby'),
    value: target.getAttribute('aria-describedby'),
  };
}

function sameElements(first: readonly Element[] | null, second: readonly Element[] | null): boolean {
  if (first === null || second === null) return first === second;
  return first.length === second.length && first.every((element, index) => element === second[index]);
}

function sameDescriptionSnapshot(first: DescriptionSnapshot, second: DescriptionSnapshot): boolean {
  return first.had === second.had && first.value === second.value && sameElements(first.elements, second.elements);
}

function baselineFromSnapshot(snapshot: DescriptionSnapshot): DescriptionBaseline {
  // Assigning `ariaDescribedByElements` clears the serialized attribute to the empty string. An
  // empty attribute plus a non-null reflected list is therefore the portable explicit-list signal.
  // A genuinely authored empty attribute is observably equivalent and is restored as empty too.
  if (snapshot.value === '' && snapshot.elements !== null) {
    return { elements: snapshot.elements, kind: 'elements' };
  }
  return { had: snapshot.had, kind: 'attribute', value: snapshot.value };
}

function baselineElements(state: DescriptionOwnershipState): Element[] {
  if (state.baseline.kind === 'elements') return [...state.baseline.elements];
  return resolveIdReferencesIn(state.target.getRootNode(), state.baseline.value);
}

function ownedDescriptions(state: DescriptionOwnershipState): Element[] {
  const descriptions: Element[] = [];
  const seen = new Set<Element>();
  for (const lease of state.leases.values()) {
    for (const description of lease.descriptions) {
      if (seen.has(description)) continue;
      seen.add(description);
      descriptions.push(description);
    }
  }
  return descriptions;
}

function isIdResolvableFromTarget(target: HTMLElement, description: Element): boolean {
  if (!isSingleAsciiWhitespaceToken(description.id)) return false;
  const root = target.getRootNode();
  return 'getElementById' in root &&
    (root as Document | ShadowRoot).getElementById(description.id) === description;
}

function restoreDescriptionBaseline(state: DescriptionOwnershipState): void {
  const { target } = state;
  if (state.baseline.kind === 'elements' && 'ariaDescribedByElements' in target) {
    (target as DescribedByElementsTarget).ariaDescribedByElements = [...state.baseline.elements];
    state.lastApplied = descriptionSnapshot(target);
    return;
  }

  if ('ariaDescribedByElements' in target && state.lastApplied.value === '') {
    // Clear an owned explicit relationship before reinstating the serialized baseline.
    (target as DescribedByElementsTarget).ariaDescribedByElements = null;
  }
  if (state.baseline.kind === 'attribute' && state.baseline.had) {
    target.setAttribute('aria-describedby', state.baseline.value ?? '');
  } else {
    target.removeAttribute('aria-describedby');
  }
  state.lastApplied = descriptionSnapshot(target);
}

function applyDescriptionOwnership(state: DescriptionOwnershipState): void {
  const { target } = state;
  const owned = ownedDescriptions(state);
  if (owned.length === 0) {
    restoreDescriptionBaseline(state);
    return;
  }

  const useElementReferences = 'ariaDescribedByElements' in target &&
    (state.baseline.kind === 'elements' || owned.some((description) => !isIdResolvableFromTarget(target, description)));
  if (useElementReferences) {
    const combined: Element[] = [];
    const seen = new Set<Element>();
    for (const description of [...baselineElements(state), ...owned]) {
      if (seen.has(description)) continue;
      seen.add(description);
      combined.push(description);
    }
    (target as DescribedByElementsTarget).ariaDescribedByElements = combined;
    state.lastApplied = descriptionSnapshot(target);
    return;
  }

  const ids = state.baseline.kind === 'attribute'
    ? [...asciiWhitespaceTokens(state.baseline.value)]
    : baselineElements(state).map((description) => description.id).filter(Boolean);
  const combinedIds = new Set(ids);
  for (const description of owned) {
    if (description.id !== '') combinedIds.add(description.id);
  }
  if (combinedIds.size > 0) target.setAttribute('aria-describedby', [...combinedIds].join(' '));
  else if (state.baseline.kind === 'attribute' && state.baseline.had) target.setAttribute('aria-describedby', '');
  else target.removeAttribute('aria-describedby');
  state.lastApplied = descriptionSnapshot(target);
}

function adoptExternalDescriptionBaseline(
  state: DescriptionOwnershipState,
  allowElementOnlyChange = false,
  forceTargetMutation = false,
): boolean {
  const current = descriptionSnapshot(state.target);
  if (sameDescriptionSnapshot(current, state.lastApplied) && !forceTargetMutation) return false;
  if (
    !allowElementOnlyChange &&
    current.had === state.lastApplied.had &&
    current.value === state.lastApplied.value
  ) {
    // ID resolution and reflected lists collapse when either end of a relationship detaches or is
    // adopted. The serialized value did not change, so this is structural—not an author write.
    return false;
  }
  state.baseline = baselineFromSnapshot(current);
  return true;
}

function takePendingDescriptionTargetMutation(state: DescriptionOwnershipState): boolean {
  return state.observer?.takeRecords().some((record) => record.target === state.target) ?? false;
}

function observeDescriptionOwnership(state: DescriptionOwnershipState): void {
  const ownerDocument = state.target.ownerDocument;
  const Observer = ownerDocument.defaultView?.MutationObserver;
  if (!Observer) return;
  if (state.observerDocument !== ownerDocument) {
    state.observer?.disconnect();
    state.observer = undefined;
    state.observerDocument = ownerDocument;
  }
  state.observer ??= new Observer((records) => {
    const targetChanged = records.some((record) => record.target === state.target);
    const descriptionChanged = records.some((record) => record.target !== state.target);
    const externalTargetChange = targetChanged && adoptExternalDescriptionBaseline(state, true, true);
    // Our own reflected/serialized writes also enqueue attribute records. If the relationship still
    // equals `lastApplied`, do no work so those notifications cannot start an observer feedback loop.
    if (!externalTargetChange && !descriptionChanged) return;
    applyDescriptionOwnership(state);
    observeDescriptionOwnership(state);
  });
  state.observer.disconnect();
  state.observer.observe(state.target, {
    attributes: true,
    attributeFilter: ['aria-describedby'],
  });
  for (const description of ownedDescriptions(state)) {
    state.observer.observe(description, { attributes: true, attributeFilter: ['id'] });
  }
}

function updateExternalDescriptionBaseline(target: HTMLElement, update: () => void): void {
  const state = descriptionOwnership.get(target);
  if (state) {
    const targetMutation = takePendingDescriptionTargetMutation(state);
    adoptExternalDescriptionBaseline(state, targetMutation, targetMutation);
  }
  const before = state ? descriptionSnapshot(target) : undefined;
  update();
  if (!state) return;
  const after = descriptionSnapshot(target);
  // A dangling serialized relationship deliberately leaves reflection untouched. Do not mistake
  // that no-op for an external replacement and promote our own currently applied relationship to
  // the baseline, or releasing the lease would leak its description permanently.
  if (!before || !sameDescriptionSnapshot(after, before)) {
    state.baseline = baselineFromSnapshot(after);
  }
  applyDescriptionOwnership(state);
  observeDescriptionOwnership(state);
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
 * Serialized and reflected-element baselines are restored exactly; late external writes become the
 * new baseline and are merged while the lease remains active.
 */
export function acquireAriaDescription(
  target: HTMLElement,
  descriptions: readonly Element[],
): AriaDescriptionLease {
  let state = descriptionOwnership.get(target);
  if (!state) {
    const initial = descriptionSnapshot(target);
    state = {
      baseline: baselineFromSnapshot(initial),
      lastApplied: initial,
      leases: new Map(),
      target,
    };
    descriptionOwnership.set(target, state);
  } else {
    const targetMutation = takePendingDescriptionTargetMutation(state);
    adoptExternalDescriptionBaseline(state, targetMutation, targetMutation);
  }

  const token = Symbol('aria-description-owner');
  const record: DescriptionLeaseRecord = { descriptions: [...descriptions] };
  state.leases.set(token, record);
  let active = true;

  const lease: AriaDescriptionLease = {
    target,
    update(nextDescriptions) {
      if (!active) return;
      const targetMutation = takePendingDescriptionTargetMutation(state!);
      adoptExternalDescriptionBaseline(state!, targetMutation, targetMutation);
      record.descriptions = [...nextDescriptions];
      applyDescriptionOwnership(state!);
      observeDescriptionOwnership(state!);
    },
    release() {
      if (!active) return;
      active = false;
      const targetMutation = takePendingDescriptionTargetMutation(state!);
      adoptExternalDescriptionBaseline(state!, targetMutation, targetMutation);
      state!.leases.delete(token);
      applyDescriptionOwnership(state!);
      if (state!.leases.size === 0) {
        state!.observer?.disconnect();
        descriptionOwnership.delete(target);
      } else {
        observeDescriptionOwnership(state!);
      }
    },
  };

  applyDescriptionOwnership(state);
  observeDescriptionOwnership(state);
  return lease;
}

/**
 * Adds `description` to whatever already describes `target`, and returns the snapshot
 * `undescribeElement()` needs to put it back.
 *
 * An ID reference only resolves inside the referring node's own root, so a description element
 * living in one tree cannot be pointed at from a control inside a shadow root. The reflected
 * `ariaDescribedByElements` property carries an element reference across that boundary, so prefer
 * it whenever the browser exposes it -- feature-detected, because it only reaches the platform
 * gradually. The serialized attribute is still written first: it is the whole relationship on
 * browsers without the property, and assigning the property afterwards clears it
 * (`getAttribute('aria-describedby') === ''`) exactly as the reflected-element contract specifies.
 * Existing relationships are carried into the assigned list rather than replaced -- a control such
 * as `<lr-select>`'s internal trigger already points at its own hint and error text, and dropping
 * those to add a tooltip would trade one lost description for another.
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
