import {
  acquireAriaDescription,
  type AriaDescriptionLease,
} from './aria-controls.js';
import {
  asciiWhitespaceTokens,
  isSingleAsciiWhitespaceToken,
} from './ascii-whitespace.js';
import { highestReachableWindow } from './a11y.js';

type OwnedAriaAttributes = Readonly<Record<string, string | null | undefined>>;

export interface AriaOwnershipContribution {
  /** Whole-value ARIA attributes. A later owner wins; release reveals the previous owner/baseline. */
  attributes?: OwnedAriaAttributes;
  /** Elements controlled by the semantic target; relationships compose across owners. */
  controls?: readonly Element[];
  /** Elements describing the semantic target; relationships compose across owners. */
  descriptions?: readonly Element[];
}

export interface AriaOwnershipLease {
  readonly target: HTMLElement | null;
  /** Retargets after render/replacement and replaces this owner's complete contribution. */
  update(target: HTMLElement | null, contribution: AriaOwnershipContribution): void;
  /** Restores every live target baseline. Calling more than once is harmless. */
  release(): void;
}

interface AttributeBaseline {
  had: boolean;
  value: string | null;
}

interface OwnedAttributeState {
  baseline: AttributeBaseline;
  lastApplied: AttributeBaseline;
}

interface AttributeOwnerRecord {
  values: Map<string, string>;
}

interface AttributeTargetState {
  attributes: Map<string, OwnedAttributeState>;
  leases: Map<symbol, AttributeOwnerRecord>;
  observer?: MutationObserver;
  observerDocument?: Document;
  target: HTMLElement;
}

interface FixedAttributeLease {
  update(attributes: OwnedAriaAttributes): void;
  release(): void;
}

const ATTRIBUTE_TARGETS = Symbol.for('@aceshooting/lyra-ui.aria-attribute-targets.v1');
type AttributeTargetsHost = typeof globalThis & {
  [ATTRIBUTE_TARGETS]?: WeakMap<HTMLElement, AttributeTargetState>;
};
const fallbackAttributeTargets = new WeakMap<HTMLElement, AttributeTargetState>();

function sharedAttributeTargets(): WeakMap<HTMLElement, AttributeTargetState> {
  const host = (typeof window === 'undefined'
    ? globalThis
    : highestReachableWindow(window)) as AttributeTargetsHost;
  const existing = host[ATTRIBUTE_TARGETS];
  if (existing) return existing;
  const targets = new WeakMap<HTMLElement, AttributeTargetState>();
  try {
    Object.defineProperty(host, ATTRIBUTE_TARGETS, {
      configurable: false,
      enumerable: false,
      value: targets,
      writable: false,
    });
    return host[ATTRIBUTE_TARGETS] ?? targets;
  } catch {
    return fallbackAttributeTargets;
  }
}

const attributeTargets = sharedAttributeTargets();

function attributeSnapshot(target: HTMLElement, name: string): AttributeBaseline {
  return { had: target.hasAttribute(name), value: target.getAttribute(name) };
}

function sameAttribute(first: AttributeBaseline, second: AttributeBaseline): boolean {
  return first.had === second.had && first.value === second.value;
}

function normalizedAttributes(attributes: OwnedAriaAttributes | undefined): Map<string, string> {
  const result = new Map<string, string>();
  for (const [name, value] of Object.entries(attributes ?? {})) {
    if (!name.toLowerCase().startsWith('aria-') || value === null || value === undefined) continue;
    result.set(name.toLowerCase(), String(value));
  }
  return result;
}

function adoptExternalAttributes(
  state: AttributeTargetState,
  forcedNames: ReadonlySet<string> = new Set(),
): boolean {
  let changed = false;
  for (const [name, owned] of state.attributes) {
    const current = attributeSnapshot(state.target, name);
    if (sameAttribute(current, owned.lastApplied) && !forcedNames.has(name)) continue;
    owned.baseline = current;
    changed = true;
  }
  return changed;
}

function takePendingAttributeMutations(state: AttributeTargetState): Set<string> {
  const names = new Set<string>();
  for (const record of state.observer?.takeRecords() ?? []) {
    if (record.target === state.target && record.attributeName) names.add(record.attributeName);
  }
  return names;
}

function applyOwnedAttributes(state: AttributeTargetState): void {
  const liveNames = new Set<string>();
  for (const lease of state.leases.values()) {
    for (const name of lease.values.keys()) liveNames.add(name);
  }
  for (const name of liveNames) {
    if (!state.attributes.has(name)) {
      const initial = attributeSnapshot(state.target, name);
      state.attributes.set(name, { baseline: initial, lastApplied: initial });
    }
  }

  for (const [name, owned] of state.attributes) {
    let generated: string | undefined;
    for (const lease of state.leases.values()) {
      const candidate = lease.values.get(name);
      if (candidate !== undefined) generated = candidate;
    }
    if (generated !== undefined) {
      if (state.target.getAttribute(name) !== generated) state.target.setAttribute(name, generated);
      owned.lastApplied = attributeSnapshot(state.target, name);
      continue;
    }
    if (owned.baseline.had) {
      if (state.target.getAttribute(name) !== owned.baseline.value || !state.target.hasAttribute(name)) {
        state.target.setAttribute(name, owned.baseline.value ?? '');
      }
    } else if (state.target.hasAttribute(name)) {
      state.target.removeAttribute(name);
    }
    owned.lastApplied = attributeSnapshot(state.target, name);
    state.attributes.delete(name);
  }
}

function observeOwnedAttributes(state: AttributeTargetState): void {
  const names = [...state.attributes.keys()];
  if (names.length === 0) {
    state.observer?.disconnect();
    return;
  }
  const ownerDocument = state.target.ownerDocument;
  const Observer = ownerDocument.defaultView?.MutationObserver;
  if (!Observer) return;
  if (state.observerDocument !== ownerDocument) {
    state.observer?.disconnect();
    state.observer = undefined;
    state.observerDocument = ownerDocument;
  }
  state.observer ??= new Observer((records) => {
    const forcedNames = new Set(
      records
        .filter((record) => record.target === state.target && record.attributeName)
        .map((record) => record.attributeName!),
    );
    if (!adoptExternalAttributes(state, forcedNames)) return;
    applyOwnedAttributes(state);
    observeOwnedAttributes(state);
  });
  state.observer.disconnect();
  state.observer.observe(state.target, { attributes: true, attributeFilter: names });
}

function acquireFixedAttributes(
  target: HTMLElement,
  attributes: OwnedAriaAttributes | undefined,
): FixedAttributeLease {
  let state = attributeTargets.get(target);
  if (!state) {
    state = { attributes: new Map(), leases: new Map(), target };
    attributeTargets.set(target, state);
  } else {
    adoptExternalAttributes(state, takePendingAttributeMutations(state));
  }
  const token = Symbol('aria-attribute-owner');
  const record: AttributeOwnerRecord = { values: normalizedAttributes(attributes) };
  state.leases.set(token, record);
  let active = true;
  applyOwnedAttributes(state);
  observeOwnedAttributes(state);

  return {
    update(nextAttributes) {
      if (!active) return;
      adoptExternalAttributes(state!, takePendingAttributeMutations(state!));
      record.values = normalizedAttributes(nextAttributes);
      applyOwnedAttributes(state!);
      observeOwnedAttributes(state!);
    },
    release() {
      if (!active) return;
      active = false;
      adoptExternalAttributes(state!, takePendingAttributeMutations(state!));
      state!.leases.delete(token);
      applyOwnedAttributes(state!);
      if (state!.leases.size === 0) {
        state!.observer?.disconnect();
        attributeTargets.delete(target);
      } else {
        observeOwnedAttributes(state!);
      }
    },
  };
}

type ControlsTarget = HTMLElement & { ariaControlsElements: Element[] | null };

type ControlsBaseline =
  | { had: boolean; kind: 'attribute'; value: string | null }
  | { elements: readonly Element[]; kind: 'elements' };

interface ControlsSnapshot {
  elements: readonly Element[] | null;
  had: boolean;
  value: string | null;
}

interface ControlsTargetState {
  baseline: ControlsBaseline;
  lastApplied: ControlsSnapshot;
  leases: Map<symbol, readonly Element[]>;
  observer?: MutationObserver;
  observerDocument?: Document;
  target: HTMLElement;
}

interface FixedControlsLease {
  update(controls: readonly Element[]): void;
  release(): void;
}

const CONTROLS_TARGETS = Symbol.for('@aceshooting/lyra-ui.aria-controls-targets.v1');
type ControlsTargetsHost = typeof globalThis & {
  [CONTROLS_TARGETS]?: WeakMap<HTMLElement, ControlsTargetState>;
};
const fallbackControlsTargets = new WeakMap<HTMLElement, ControlsTargetState>();

function sharedControlsTargets(): WeakMap<HTMLElement, ControlsTargetState> {
  const host = (typeof window === 'undefined'
    ? globalThis
    : highestReachableWindow(window)) as ControlsTargetsHost;
  const existing = host[CONTROLS_TARGETS];
  if (existing) return existing;
  const targets = new WeakMap<HTMLElement, ControlsTargetState>();
  try {
    Object.defineProperty(host, CONTROLS_TARGETS, {
      configurable: false,
      enumerable: false,
      value: targets,
      writable: false,
    });
    return host[CONTROLS_TARGETS] ?? targets;
  } catch {
    return fallbackControlsTargets;
  }
}

const controlsTargets = sharedControlsTargets();

function controlElements(target: HTMLElement): readonly Element[] | null {
  if (!('ariaControlsElements' in target)) return null;
  try {
    const elements = (target as ControlsTarget).ariaControlsElements;
    return elements === null ? null : [...elements];
  } catch {
    return null;
  }
}

function controlsSnapshot(target: HTMLElement): ControlsSnapshot {
  return {
    elements: controlElements(target),
    had: target.hasAttribute('aria-controls'),
    value: target.getAttribute('aria-controls'),
  };
}

function sameElements(first: readonly Element[] | null, second: readonly Element[] | null): boolean {
  if (first === null || second === null) return first === second;
  return first.length === second.length && first.every((element, index) => element === second[index]);
}

function sameControls(first: ControlsSnapshot, second: ControlsSnapshot): boolean {
  return first.had === second.had && first.value === second.value && sameElements(first.elements, second.elements);
}

function controlsBaseline(snapshot: ControlsSnapshot): ControlsBaseline {
  return snapshot.value === '' && snapshot.elements !== null
    ? { elements: snapshot.elements, kind: 'elements' }
    : { had: snapshot.had, kind: 'attribute', value: snapshot.value };
}

function resolveIds(target: HTMLElement, value: string | null): Element[] {
  if (!value) return [];
  const root = target.getRootNode();
  if (!('getElementById' in root)) return [];
  const result: Element[] = [];
  for (const id of asciiWhitespaceTokens(value)) {
    const element = (root as Document | ShadowRoot).getElementById(id);
    if (element) result.push(element);
  }
  return result;
}

/**
 * ARIA element reflection cannot point from an outer tree into a shadow-private descendant. In
 * that direction the controlled custom-element host is the narrowest exposed relationship target:
 * it owns the private popup/panel and remains resolvable by both reflection and serialized IDREFs.
 * Outward references, including a nested-shadow target pointing into an ancestor shadow root, are
 * supported and stay exact.
 */
function exposedControlTarget(target: HTMLElement, control: Element): Element {
  const targetCanReference = (candidate: Element): boolean => {
    const candidateRoot = candidate.getRootNode();
    let branch: Node = target;
    while (true) {
      const branchRoot = branch.getRootNode();
      if (branchRoot === candidateRoot) return true;
      if (branchRoot.nodeType !== 11 || !('host' in branchRoot)) return false;
      branch = (branchRoot as ShadowRoot).host;
    }
  };
  let exposed = control;
  let root = exposed.getRootNode();
  while (!targetCanReference(exposed) && root.nodeType === 11 && 'host' in root) {
    exposed = (root as ShadowRoot).host;
    root = exposed.getRootNode();
  }
  return exposed;
}

function ownedControls(state: ControlsTargetState): Element[] {
  const result: Element[] = [];
  const seen = new Set<Element>();
  for (const controls of state.leases.values()) {
    for (const control of controls) {
      const exposed = exposedControlTarget(state.target, control);
      if (seen.has(exposed)) continue;
      seen.add(exposed);
      result.push(exposed);
    }
  }
  return result;
}

function baseControls(state: ControlsTargetState): Element[] {
  return state.baseline.kind === 'elements'
    ? [...state.baseline.elements]
    : resolveIds(state.target, state.baseline.value);
}

function controlResolvable(target: HTMLElement, control: Element): boolean {
  if (!isSingleAsciiWhitespaceToken(control.id)) return false;
  const root = target.getRootNode();
  return 'getElementById' in root &&
    (root as Document | ShadowRoot).getElementById(control.id) === control;
}

function restoreControls(state: ControlsTargetState): void {
  const { target } = state;
  if (state.baseline.kind === 'elements' && 'ariaControlsElements' in target) {
    (target as ControlsTarget).ariaControlsElements = [...state.baseline.elements];
  } else {
    if ('ariaControlsElements' in target && state.lastApplied.value === '') {
      (target as ControlsTarget).ariaControlsElements = null;
    }
    if (state.baseline.kind === 'attribute' && state.baseline.had) {
      target.setAttribute('aria-controls', state.baseline.value ?? '');
    } else {
      target.removeAttribute('aria-controls');
    }
  }
  state.lastApplied = controlsSnapshot(target);
}

function applyControls(state: ControlsTargetState): void {
  const owned = ownedControls(state);
  if (owned.length === 0) {
    restoreControls(state);
    return;
  }
  const useElements = 'ariaControlsElements' in state.target &&
    (state.baseline.kind === 'elements' || owned.some((control) => !controlResolvable(state.target, control)));
  if (useElements) {
    const combined: Element[] = [];
    const seen = new Set<Element>();
    for (const control of [...baseControls(state), ...owned]) {
      if (seen.has(control)) continue;
      seen.add(control);
      combined.push(control);
    }
    (state.target as ControlsTarget).ariaControlsElements = combined;
    state.lastApplied = controlsSnapshot(state.target);
    return;
  }
  const ids = state.baseline.kind === 'attribute'
    ? [...asciiWhitespaceTokens(state.baseline.value)]
    : baseControls(state).map((control) => control.id).filter(Boolean);
  const combined = new Set(ids);
  for (const control of owned) if (control.id !== '') combined.add(control.id);
  if (combined.size > 0) state.target.setAttribute('aria-controls', [...combined].join(' '));
  else state.target.removeAttribute('aria-controls');
  state.lastApplied = controlsSnapshot(state.target);
}

function adoptExternalControls(
  state: ControlsTargetState,
  allowElementOnlyChange = false,
  forceTargetMutation = false,
): boolean {
  const current = controlsSnapshot(state.target);
  if (sameControls(current, state.lastApplied) && !forceTargetMutation) return false;
  if (
    !allowElementOnlyChange &&
    current.had === state.lastApplied.had &&
    current.value === state.lastApplied.value
  ) {
    // Reflection can lose resolved elements solely because a target/control detached or moved to a
    // different root. Do not turn that structural collapse into the authored release baseline.
    return false;
  }
  state.baseline = controlsBaseline(current);
  return true;
}

function takePendingControlsTargetMutation(state: ControlsTargetState): boolean {
  return state.observer?.takeRecords().some((record) => record.target === state.target) ?? false;
}

function observeControls(state: ControlsTargetState): void {
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
    const idChanged = records.some((record) => record.target !== state.target);
    if (!(targetChanged && adoptExternalControls(state, true, true)) && !idChanged) return;
    applyControls(state);
    observeControls(state);
  });
  state.observer.disconnect();
  state.observer.observe(state.target, { attributes: true, attributeFilter: ['aria-controls'] });
  for (const control of ownedControls(state)) {
    state.observer.observe(control, { attributes: true, attributeFilter: ['id'] });
  }
}

function acquireFixedControls(target: HTMLElement, controls: readonly Element[]): FixedControlsLease {
  let state = controlsTargets.get(target);
  if (!state) {
    const initial = controlsSnapshot(target);
    state = {
      baseline: controlsBaseline(initial),
      lastApplied: initial,
      leases: new Map(),
      target,
    };
    controlsTargets.set(target, state);
  } else {
    const targetMutation = takePendingControlsTargetMutation(state);
    adoptExternalControls(state, targetMutation, targetMutation);
  }
  const token = Symbol('aria-controls-owner');
  state.leases.set(token, [...controls]);
  let active = true;
  applyControls(state);
  observeControls(state);
  return {
    update(nextControls) {
      if (!active) return;
      const targetMutation = takePendingControlsTargetMutation(state!);
      adoptExternalControls(state!, targetMutation, targetMutation);
      state!.leases.set(token, [...nextControls]);
      applyControls(state!);
      observeControls(state!);
    },
    release() {
      if (!active) return;
      active = false;
      const targetMutation = takePendingControlsTargetMutation(state!);
      adoptExternalControls(state!, targetMutation, targetMutation);
      state!.leases.delete(token);
      applyControls(state!);
      if (state!.leases.size === 0) {
        state!.observer?.disconnect();
        controlsTargets.delete(target);
      } else {
        observeControls(state!);
      }
    },
  };
}

/**
 * Owns the generated ARIA state of a replaceable semantic target. The controller delegates
 * description/control element relationships to composable leases and whole-value attributes to a
 * last-owner-wins stack, while treating any late external write as the baseline to restore.
 */
export function acquireAriaOwnership(
  initialTarget: HTMLElement | null,
  initialContribution: AriaOwnershipContribution,
): AriaOwnershipLease {
  let active = true;
  let target: HTMLElement | null = null;
  let targetDocument: Document | null = null;
  let attributes: FixedAttributeLease | undefined;
  let controls: FixedControlsLease | undefined;
  let descriptions: AriaDescriptionLease | undefined;

  const detach = (): void => {
    descriptions?.release();
    descriptions = undefined;
    controls?.release();
    controls = undefined;
    attributes?.release();
    attributes = undefined;
    target = null;
    targetDocument = null;
  };

  const apply = (nextTarget: HTMLElement | null, contribution: AriaOwnershipContribution): void => {
    if (!active) return;
    if (target !== nextTarget) {
      detach();
      target = nextTarget;
      targetDocument = nextTarget?.ownerDocument ?? null;
    } else if (nextTarget !== null && targetDocument !== nextTarget.ownerDocument) {
      // Keep each fixed lease's insertion order across adoption. Their update paths recreate
      // owner-realm observers without turning an older whole-value owner into the newest owner.
      targetDocument = nextTarget.ownerDocument;
    }
    if (!target) return;

    const nextAttributes = normalizedAttributes(contribution.attributes);
    if (nextAttributes.size > 0) {
      if (attributes) attributes.update(contribution.attributes ?? {});
      else attributes = acquireFixedAttributes(target, contribution.attributes);
    } else {
      attributes?.release();
      attributes = undefined;
    }

    const nextControls = contribution.controls ?? [];
    if (nextControls.length > 0) {
      if (controls) controls.update(nextControls);
      else controls = acquireFixedControls(target, nextControls);
    } else {
      controls?.release();
      controls = undefined;
    }

    const nextDescriptions = contribution.descriptions ?? [];
    if (nextDescriptions.length > 0) {
      if (descriptions) descriptions.update(nextDescriptions);
      else descriptions = acquireAriaDescription(target, nextDescriptions);
    } else {
      descriptions?.release();
      descriptions = undefined;
    }
  };

  const lease: AriaOwnershipLease = {
    get target() {
      return target;
    },
    update: apply,
    release() {
      if (!active) return;
      active = false;
      detach();
    },
  };
  apply(initialTarget, initialContribution);
  return lease;
}
