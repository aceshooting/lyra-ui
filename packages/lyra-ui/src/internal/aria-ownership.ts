import {
  acquireAriaControls,
  acquireAriaDescription,
  type AriaControlsLease,
  type AriaDescriptionLease,
} from './aria-controls.js';
import { sharedRealmRegistry } from './a11y.js';

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
const fallbackAttributeTargets = new WeakMap<HTMLElement, AttributeTargetState>();

const attributeTargets = sharedRealmRegistry(
  ATTRIBUTE_TARGETS,
  () => new WeakMap<HTMLElement, AttributeTargetState>(),
  fallbackAttributeTargets,
);

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

/** Exposes a private controlled descendant through the nearest host visible to the owner. */
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
  let controls: AriaControlsLease | undefined;
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
      if (controls) controls.update(nextControls.map(control => exposedControlTarget(target!, control)));
      else controls = acquireAriaControls(target, nextControls.map(control => exposedControlTarget(target!, control)));
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
