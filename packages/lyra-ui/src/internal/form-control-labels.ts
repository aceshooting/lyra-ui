import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { deepActiveElementIn } from './active-element.js';
import { collectComposedFocusTargets } from './focus-navigation.js';
import { registerFormControlLabelSupport, type LyraElement } from './lyra-element.js';

/**
 * How an external `<label>` activation reaches a control.
 *
 * `'focus'` is the native text/select-like behaviour: clicking the label moves focus to the
 * control and nothing else happens. `'activate'` is the native toggle/button-like behaviour:
 * focus moves *and* the control's own activation runs exactly once (a checkbox toggles, a
 * `type="submit"` button submits).
 *
 * A closed literal union rather than an `enum`: `enum` is nominal, so a consumer could not write
 * the string form, and it would ship a runtime object against the tree-shaking budget.
 */
export type ExternalLabelActivation = 'focus' | 'activate';

/**
 * Opt-in hook a control implements when its label activation is *not* inferable from the role its
 * own shadow root exposes.
 *
 * Roles carry the answer for every toggle (`checkbox`/`switch`/`radio` all activate), but a plain
 * `<button>` does not: `<lr-button>` and `<lr-icon-button>` must run their submit/reset behaviour
 * on a label click, while `<lr-color-picker>`'s and `<lr-select>`'s triggers are also `<button>`s
 * and must merely take focus — opening a popup from a label click is not what any native control
 * does. Guessing from the tag name would encode the component list in the bridge; the symbol lets
 * the two controls that differ say so themselves.
 */
export const EXTERNAL_LABEL_ACTIVATION = Symbol('lr-external-label-activation');

/** A control that declares its own {@linkcode ExternalLabelActivation}. */
interface ExternalLabelActivationHost {
  /** @internal */
  [EXTERNAL_LABEL_ACTIVATION](): ExternalLabelActivation;
}

/** Internal transactions used when the form control host itself owns the role and focus.
 *
 * Most controls put their semantic owner in shadow DOM, where the label bridge can distinguish an
 * authored host `aria-label` from the internal target it manages. Host-owned controls cannot make
 * that distinction from the attribute alone: their generated fallback, an external-label bridge
 * name, and an authored override all occupy the same attribute. This protocol lets the component
 * identify authored input and lets bridge writes pass through the component's own observation
 * guard. It also makes release an explicit transaction, so a component can stop protecting the
 * external name even when an author replaced the attribute before release ran.
 */
export type ExternalLabelHostSemanticOperation =
  | { readonly type: 'has-authored-name' }
  | { readonly type: 'apply'; readonly name: string }
  | {
      readonly type: 'release';
      readonly appliedName: string;
      readonly hadPrevious: boolean;
      readonly previous: string | null;
    };

/** Opt-in protocol for a form control whose host owns its role, name, and focus. */
export const EXTERNAL_LABEL_HOST_SEMANTICS = Symbol('lr-external-label-host-semantics');

/** A host-owned semantic control participating in the guarded label-name protocol. */
export interface ExternalLabelHostSemanticOwner {
  /** @internal */
  [EXTERNAL_LABEL_HOST_SEMANTICS](
    operation: ExternalLabelHostSemanticOperation,
  ): boolean | void;
}

/**
 * The `ElementInternals` each form-associated control attached, keyed by the control.
 *
 * A `WeakMap` rather than a field on the shared base class: an instance field is inherited by all
 * 283 components and would be published into `custom-elements.json` for every one of them, and this
 * is infrastructure state that belongs to the bridge, not public surface of every element in the
 * library. Weak keys mean a discarded control is still collectable.
 */
const attachedInternals = new WeakMap<HTMLElement, ElementInternals>();

/** Records the internals a control just attached. Called from the one place every attachment
 *  spelling bottoms out in. @internal */
export function captureFormInternals(host: HTMLElement, internals: ElementInternals): void {
  attachedInternals.set(host, internals);
}

/** The host surface {@linkcode ExternalLabelController} reads. Every member is optional because
 *  the same controller serves controls built on the `FormAssociated` mixin, controls that drive
 *  `ElementInternals` directly, and any environment whose DOM stops short of `attachInternals()`
 *  altogether. */
export interface ExternalLabelHost extends HTMLElement {
  readonly renderRoot?: DocumentFragment | HTMLElement;
  readonly effectiveDisabled?: boolean;
  readonly disabled?: boolean;
}

/**
 * Roles whose owner is the *composite* — the element the external name belongs on even though
 * focus lands on one of its children. `<lr-time-input>` renders `role="group"` around three
 * `role="spinbutton"` segments and `<lr-radio-group>` renders `role="radiogroup"` around slotted
 * radios; naming the segment or the first radio would attach the field's name to one of its parts.
 */
const COMPOSITE_ROLE_SELECTOR = '[role="radiogroup"],[role="group"],[role="grid"],[role="tree"]';

/**
 * Elements that can own an accessible name inside a control's own shadow root, used only as the
 * last resort before giving up. Deliberately excludes `[tabindex="-1"]` nodes: a programmatically
 * focusable-only node (a stepper button, a mirror input) is never the control's role owner.
 */
const SEMANTIC_TARGET_SELECTOR = [
  'input:not([type="hidden"]):not([tabindex="-1"])',
  'textarea:not([tabindex="-1"])',
  'select:not([tabindex="-1"])',
  'button:not([tabindex="-1"])',
  '[role]:not([tabindex="-1"])',
].join(',');

/** Roles whose native counterpart activates (not merely focuses) when its label is clicked. */
const ACTIVATING_ROLES = new Set(['checkbox', 'switch', 'radio', 'menuitemcheckbox', 'menuitemradio']);

const MAX_ASSOCIATION_CANDIDATES_PER_MUTATION = 2_048;
const MAX_ASSOCIATION_REFRESHES_PER_TASK = 256;

interface AssociationSubscription {
  readonly host: HTMLElement;
  readonly listener: () => void;
  id: string;
  implicitLabels: HTMLLabelElement[];
  fallbackGeneration: number;
  active: boolean;
}

interface AssociationRootObservation {
  readonly subscriptions: Set<AssociationSubscription>;
  readonly subscriptionsById: Map<string, Set<AssociationSubscription>>;
  readonly implicitSubscriptionsByLabel: WeakMap<HTMLLabelElement, Set<AssociationSubscription>>;
  readonly subscriptionsByHost: WeakMap<HTMLElement, AssociationSubscription>;
  readonly pending: Set<AssociationSubscription>;
  readonly observer?: MutationObserver;
  readonly ownerWindow: Window | null;
  cancelContinuation?: () => void;
  fallbackIterator?: SetIterator<AssociationSubscription>;
  fallbackGeneration: number;
}

interface AssociationRootSubscription {
  update(labels: readonly HTMLLabelElement[]): void;
  disconnect(): void;
}

/**
 * One association observer per document/shadow root, shared by every FACE control in that root.
 *
 * `ElementInternals.labels` is live but has no change event. Watching only the labels that are
 * associated *now* cannot discover the first label added later, and cannot see an associated label
 * being removed from its parent. A single root observer closes that platform gap without installing
 * one document-wide observer per control. It wakes subscribers only for mutations that can change
 * label membership; text within an already-associated label remains the small per-label observer's
 * responsibility.
 */
const associationRootObservations = new WeakMap<Node, AssociationRootObservation>();

/** DOM-brand checks based on node shape rather than this realm's constructors. */
function isLabelElement(node: EventTarget | null): node is HTMLLabelElement {
  return (
    node !== null &&
    'nodeType' in node &&
    (node as Node).nodeType === 1 &&
    'localName' in node &&
    node.localName === 'label'
  );
}

function isHtmlElement(node: Node): node is HTMLElement {
  return node.nodeType === 1 && 'focus' in node && 'style' in node;
}

function isShadowRootNode(node: Node | null | undefined): node is ShadowRoot {
  return node?.nodeType === 11 && 'host' in node;
}

/** Whether `label` names `host` in the DOM tree *right now*.
 *
 * Some engines update `ElementInternals.labels` only when mutation observers deliver. Label click
 * handling runs before that checkpoint, so relying on the otherwise-live list can activate the
 * control a `for` attribute named one mutation ago. Resolve the simple platform association rule
 * structurally here; `getElementById()` also preserves the first-match rule for duplicate IDs. */
function isCurrentlyAssociatedLabel(label: HTMLLabelElement, host: HTMLElement): boolean {
  const root = host.getRootNode();
  if (label.getRootNode() !== root) return false;
  if (!label.hasAttribute('for')) {
    const control = 'control' in label ? label.control : undefined;
    return control === undefined || control === null ? label.contains(host) : control === host;
  }
  const id = label.htmlFor;
  if (id === '') return false;
  if ('getElementById' in root && typeof root.getElementById === 'function') {
    return root.getElementById(id) === host;
  }
  if (!('querySelectorAll' in root) || typeof root.querySelectorAll !== 'function') return false;
  return [...root.querySelectorAll('[id]')].find((candidate) => candidate.id === id) === host;
}

function addSubscriptionById(observation: AssociationRootObservation, subscription: AssociationSubscription): void {
  if (!subscription.id) return;
  const subscribers = observation.subscriptionsById.get(subscription.id) ?? new Set<AssociationSubscription>();
  subscribers.add(subscription);
  observation.subscriptionsById.set(subscription.id, subscribers);
}

function removeSubscriptionById(
  observation: AssociationRootObservation,
  subscription: AssociationSubscription,
): void {
  if (!subscription.id) return;
  const subscribers = observation.subscriptionsById.get(subscription.id);
  subscribers?.delete(subscription);
  if (subscribers?.size === 0) observation.subscriptionsById.delete(subscription.id);
}

function updateSubscriptionId(
  observation: AssociationRootObservation,
  subscription: AssociationSubscription,
): void {
  const id = subscription.host.id;
  if (id === subscription.id) return;
  removeSubscriptionById(observation, subscription);
  subscription.id = id;
  addSubscriptionById(observation, subscription);
}

function addImplicitSubscription(
  observation: AssociationRootObservation,
  label: HTMLLabelElement,
  subscription: AssociationSubscription,
): void {
  const subscriptions = observation.implicitSubscriptionsByLabel.get(label) ?? new Set<AssociationSubscription>();
  subscriptions.add(subscription);
  observation.implicitSubscriptionsByLabel.set(label, subscriptions);
}

function removeImplicitSubscription(
  observation: AssociationRootObservation,
  label: HTMLLabelElement,
  subscription: AssociationSubscription,
): void {
  const subscriptions = observation.implicitSubscriptionsByLabel.get(label);
  subscriptions?.delete(subscription);
  if (subscriptions?.size === 0) observation.implicitSubscriptionsByLabel.delete(label);
}

function updateImplicitSubscriptions(
  observation: AssociationRootObservation,
  subscription: AssociationSubscription,
  labels: readonly HTMLLabelElement[],
): void {
  const next = labels.filter((label) => !label.hasAttribute('for'));
  for (const label of subscription.implicitLabels) {
    if (!next.includes(label)) removeImplicitSubscription(observation, label, subscription);
  }
  for (const label of next) {
    if (!subscription.implicitLabels.includes(label)) {
      addImplicitSubscription(observation, label, subscription);
    }
  }
  subscription.implicitLabels = next;
}

function hasAssociationRefreshes(observation: AssociationRootObservation): boolean {
  return observation.pending.size > 0 || observation.fallbackIterator !== undefined;
}

function cancelAssociationContinuation(observation: AssociationRootObservation): void {
  observation.cancelContinuation?.();
  observation.cancelContinuation = undefined;
}

function scheduleAssociationContinuation(observation: AssociationRootObservation): void {
  if (!hasAssociationRefreshes(observation) || observation.cancelContinuation !== undefined) return;
  const callback = () => {
    observation.cancelContinuation = undefined;
    drainAssociationRefreshes(observation);
  };
  if (observation.ownerWindow) {
    const handle = observation.ownerWindow.setTimeout(callback, 0);
    observation.cancelContinuation = () => observation.ownerWindow?.clearTimeout(handle);
  } else {
    const handle = globalThis.setTimeout(callback, 0);
    observation.cancelContinuation = () => globalThis.clearTimeout(handle);
  }
}

function refreshAssociationSubscription(
  observation: AssociationRootObservation,
  subscription: AssociationSubscription,
): void {
  if (!subscription.active) return;
  subscription.listener();
  if (observation.fallbackIterator) {
    subscription.fallbackGeneration = observation.fallbackGeneration;
  }
}

function drainTargetedAssociationRefreshes(observation: AssociationRootObservation): void {
  let remaining = MAX_ASSOCIATION_REFRESHES_PER_TASK;
  for (const subscription of observation.pending) {
    observation.pending.delete(subscription);
    refreshAssociationSubscription(observation, subscription);
    if (--remaining === 0) break;
  }
  scheduleAssociationContinuation(observation);
}

function drainAssociationRefreshes(observation: AssociationRootObservation): void {
  let remaining = MAX_ASSOCIATION_REFRESHES_PER_TASK;
  for (const subscription of observation.pending) {
    observation.pending.delete(subscription);
    refreshAssociationSubscription(observation, subscription);
    if (--remaining === 0) break;
  }
  while (remaining > 0 && observation.fallbackIterator) {
    const next = observation.fallbackIterator.next();
    if (next.done) {
      observation.fallbackIterator = undefined;
      break;
    }
    if (next.value.active && next.value.fallbackGeneration !== observation.fallbackGeneration) {
      next.value.listener();
      next.value.fallbackGeneration = observation.fallbackGeneration;
    }
    remaining--;
  }
  scheduleAssociationContinuation(observation);
}

function notifyAssociationSubscriptions(
  observation: AssociationRootObservation,
  subscriptions: Iterable<AssociationSubscription>,
  fallbackAll = false,
): void {
  if (fallbackAll) {
    const continuationPending = observation.cancelContinuation !== undefined;
    observation.pending.clear();
    observation.fallbackGeneration++;
    observation.fallbackIterator = observation.subscriptions.values();
    for (const subscription of subscriptions) {
      if (subscription.active) observation.pending.add(subscription);
    }
    if (continuationPending) drainTargetedAssociationRefreshes(observation);
    else drainAssociationRefreshes(observation);
    return;
  }
  for (const subscription of subscriptions) {
    if (subscription.active) observation.pending.add(subscription);
  }
  // Mutation observers registered later in the same root must see the refreshed accessible name.
  // A continuation may already be draining a conservative all-control fallback, but a small,
  // precisely indexed mutation remains synchronous and is marked so that fallback will not read
  // the same control twice.
  drainTargetedAssociationRefreshes(observation);
}

interface AssociationCandidates {
  readonly ids: Set<string>;
  readonly implicitLabels: Set<HTMLLabelElement>;
  truncated: boolean;
  work: number;
}

function isLabelableElement(element: Element): boolean {
  if (element.localName === 'input') return (element as HTMLInputElement).type !== 'hidden';
  if (
    element.localName === 'button' ||
    element.localName === 'meter' ||
    element.localName === 'output' ||
    element.localName === 'progress' ||
    element.localName === 'select' ||
    element.localName === 'textarea'
  ) {
    return true;
  }
  return (
    element.localName.includes('-') && (element.constructor as { formAssociated?: boolean }).formAssociated === true
  );
}

function collectAssociationElement(element: Element, result: AssociationCandidates): boolean {
  const id = element.getAttribute('id');
  if (id) result.ids.add(id);
  if (isLabelElement(element) && element.hasAttribute('for')) {
    if (element.htmlFor) result.ids.add(element.htmlFor);
  }
  return isLabelableElement(element);
}

/** Returns the next node in a subtree without allocating a walker or a descendant array. */
function nextAssociationNode(root: Node, current: Node): Node | null {
  if (current.firstChild) return current.firstChild;
  let cursor: Node | null = current;
  while (cursor && cursor !== root) {
    if (cursor.nextSibling) return cursor.nextSibling;
    cursor = cursor.parentNode;
  }
  return null;
}

function collectAssociationCandidates(node: Node, result: AssociationCandidates): boolean {
  let containsLabelable = false;
  let current: Node | null = node;
  while (current) {
    if (result.work >= MAX_ASSOCIATION_CANDIDATES_PER_MUTATION) {
      result.truncated = true;
      break;
    }
    result.work++;
    if (current.nodeType === 1) {
      containsLabelable = collectAssociationElement(current as Element, result) || containsLabelable;
    }
    current = nextAssociationNode(node, current);
  }
  return containsLabelable;
}

function containingImplicitLabel(node: Node): HTMLLabelElement | null {
  if (isLabelElement(node)) return node.hasAttribute('for') ? null : node;
  if (node.nodeType !== 1 || !('closest' in node)) return null;
  const label = (node as Element).closest('label');
  return label && !label.hasAttribute('for') ? label : null;
}

function collectFirstImplicitSubscription(
  observation: AssociationRootObservation,
  label: HTMLLabelElement,
  candidates: AssociationCandidates,
  affected: Set<AssociationSubscription>,
): void {
  let current: Node | null = label.firstChild;
  while (current) {
    if (candidates.work >= MAX_ASSOCIATION_CANDIDATES_PER_MUTATION) {
      candidates.truncated = true;
      return;
    }
    candidates.work++;
    if (
      current.nodeType === 1 &&
      (isLabelableElement(current as Element) ||
        observation.subscriptionsByHost.has(current as HTMLElement))
    ) {
      const subscription = observation.subscriptionsByHost.get(current as HTMLElement);
      if (subscription) affected.add(subscription);
      return;
    }
    current = nextAssociationNode(label, current);
  }
}

function affectedAssociationSubscriptions(
  observation: AssociationRootObservation,
  mutations: readonly MutationRecord[],
): { readonly subscriptions: Set<AssociationSubscription>; readonly fallbackAll: boolean } {
  const affected = new Set<AssociationSubscription>();
  const candidates: AssociationCandidates = {
    ids: new Set<string>(),
    implicitLabels: new Set<HTMLLabelElement>(),
    truncated: false,
    work: 0,
  };

  const addIndexedCandidates = (): void => {
    for (const id of candidates.ids) {
      for (const subscription of observation.subscriptionsById.get(id) ?? []) affected.add(subscription);
    }
    for (const label of candidates.implicitLabels) {
      for (const subscription of observation.implicitSubscriptionsByLabel.get(label) ?? []) {
        affected.add(subscription);
      }
    }
  };

  for (const mutation of mutations) {
    if (candidates.work >= MAX_ASSOCIATION_CANDIDATES_PER_MUTATION) {
      candidates.truncated = true;
      break;
    }
    candidates.work++;
    if (mutation.type === 'attributes') {
      const target = mutation.target as Element;
      if (mutation.attributeName === 'id') {
        const oldId = mutation.oldValue ?? '';
        const id = target.getAttribute('id') ?? '';
        if (oldId) candidates.ids.add(oldId);
        if (id) candidates.ids.add(id);
        const hostSubscription = observation.subscriptionsByHost.get(target as HTMLElement);
        if (hostSubscription) {
          affected.add(hostSubscription);
          updateSubscriptionId(observation, hostSubscription);
        }
      } else if (mutation.attributeName === 'for' && isLabelElement(target)) {
        const oldFor = mutation.oldValue;
        if (oldFor) candidates.ids.add(oldFor);
        if (target.htmlFor) candidates.ids.add(target.htmlFor);
        for (const subscription of observation.implicitSubscriptionsByLabel.get(target) ?? []) {
          affected.add(subscription);
        }
        if (!target.hasAttribute('for')) candidates.implicitLabels.add(target);
      } else if (mutation.attributeName === 'type' && target.localName === 'input') {
        const label = containingImplicitLabel(target);
        if (label) candidates.implicitLabels.add(label);
      }
      continue;
    }
    let changedLabelableShape = false;
    for (const node of mutation.addedNodes) {
      changedLabelableShape = collectAssociationCandidates(node, candidates) || changedLabelableShape;
      if (candidates.truncated) break;
    }
    if (!candidates.truncated) {
      for (const node of mutation.removedNodes) {
        changedLabelableShape = collectAssociationCandidates(node, candidates) || changedLabelableShape;
        if (candidates.truncated) break;
      }
    }
    if (changedLabelableShape) {
      const label = containingImplicitLabel(mutation.target);
      if (label) candidates.implicitLabels.add(label);
    }
    if (candidates.truncated) break;
  }

  addIndexedCandidates();
  if (candidates.truncated) return { subscriptions: affected, fallbackAll: true };
  for (const label of candidates.implicitLabels) {
    collectFirstImplicitSubscription(observation, label, candidates, affected);
    if (candidates.truncated) return { subscriptions: affected, fallbackAll: true };
  }
  return { subscriptions: affected, fallbackAll: false };
}

function observeAssociationRoot(host: HTMLElement, listener: () => void): AssociationRootSubscription {
  const root = host.getRootNode();
  let observation = associationRootObservations.get(root);
  if (!observation) {
    const Observer = host.ownerDocument.defaultView?.MutationObserver;
    const subscriptions = new Set<AssociationSubscription>();
    const subscriptionsById = new Map<string, Set<AssociationSubscription>>();
    const implicitSubscriptionsByLabel = new WeakMap<HTMLLabelElement, Set<AssociationSubscription>>();
    const subscriptionsByHost = new WeakMap<HTMLElement, AssociationSubscription>();
    const pending = new Set<AssociationSubscription>();
    const holder: { observation?: AssociationRootObservation } = {};
    const observer = Observer === undefined
      ? undefined
      : new Observer((mutations) => {
          const current = holder.observation;
          if (!current) return;
          const affected = affectedAssociationSubscriptions(current, mutations);
          notifyAssociationSubscriptions(current, affected.subscriptions, affected.fallbackAll);
        });
    observer?.observe(root, {
      attributes: true,
      attributeFilter: ['for', 'id', 'type'],
      attributeOldValue: true,
      childList: true,
      subtree: true,
    });
    observation = {
      subscriptions,
      subscriptionsById,
      implicitSubscriptionsByLabel,
      subscriptionsByHost,
      pending,
      observer,
      ownerWindow: host.ownerDocument.defaultView,
      fallbackGeneration: 0,
    };
    holder.observation = observation;
    associationRootObservations.set(root, observation);
  }
  const subscription: AssociationSubscription = {
    host,
    listener,
    id: host.id,
    implicitLabels: [],
    fallbackGeneration: -1,
    active: true,
  };
  observation.subscriptions.add(subscription);
  observation.subscriptionsByHost.set(host, subscription);
  addSubscriptionById(observation, subscription);
  return {
    update(labels) {
      if (!subscription.active) return;
      updateSubscriptionId(observation!, subscription);
      updateImplicitSubscriptions(observation!, subscription, labels);
    },
    disconnect() {
      if (!subscription.active) return;
      subscription.active = false;
      observation!.pending.delete(subscription);
      observation!.subscriptions.delete(subscription);
      observation!.subscriptionsByHost.delete(host);
      for (const label of subscription.implicitLabels) {
        removeImplicitSubscription(observation!, label, subscription);
      }
      subscription.implicitLabels = [];
      removeSubscriptionById(observation!, subscription);
      const current = associationRootObservations.get(root);
      if (!current || current.subscriptions.size > 0) return;
      current.observer?.disconnect();
      cancelAssociationContinuation(current);
      current.pending.clear();
      current.fallbackIterator = undefined;
      associationRootObservations.delete(root);
    },
  };
}

/** Whether `candidate` sits inside `host`'s composed subtree (crossing open shadow boundaries). */
function isComposedDescendant(host: Node, candidate: Node | null): boolean {
  let current: Node | null = candidate;
  while (current) {
    if (current === host) return true;
    if (current.parentNode) {
      current = current.parentNode;
      continue;
    }
    current = isShadowRootNode(current) ? current.host : null;
  }
  return false;
}

/**
 * The label elements associated with `host`.
 *
 * `ElementInternals.labels` is the platform's own answer for a form-associated custom element — it
 * already resolves both `<label for>` and an ancestor `<label>`, stays live as the document
 * changes, and needs no id at all for the implicit form. It is feature-detected rather than
 * assumed: a DOM shim's stand-in internals report an empty list, and an environment with no
 * `attachInternals()` has none, so the `label[for]` query is kept as the degraded path rather than
 * as the primary one.
 */
export function resolveExternalLabels(host: ExternalLabelHost): HTMLLabelElement[] {
  const native = attachedInternals.get(host)?.labels;
  if (native) {
    return Array.from(native)
      .filter(isLabelElement)
      .filter((label) => isCurrentlyAssociatedLabel(label, host));
  }
  const labels: HTMLLabelElement[] = [];
  const ancestor = host.closest('label');
  if (ancestor && isCurrentlyAssociatedLabel(ancestor, host)) labels.push(ancestor);
  const root = host.getRootNode();
  // This is intentionally a constant selector plus an exact property comparison, rather than an
  // interpolated selector that needs `CSS.escape()`: the fallback exists for partial DOMs that may
  // lack both `attachInternals()` and the global `CSS` namespace.
  if (host.id && 'querySelectorAll' in root) {
    for (const found of (root as Document | ShadowRoot).querySelectorAll('label[for]')) {
      if (
        isLabelElement(found) &&
        isCurrentlyAssociatedLabel(found, host) &&
        !labels.includes(found)
      ) {
        labels.push(found);
      }
    }
  }
  return labels;
}

/** A label's text with `exclude`'s subtree left out wherever it appears. */
function labelText(node: Node, exclude?: Node): string {
  if (node === exclude) return '';
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  let text = '';
  for (const child of node.childNodes) text += labelText(child, exclude);
  return text;
}

/**
 * The accessible name contributed by `labels`, joined the way multiple native labels are: each
 * label's own text, in document order, separated by a single space. Whitespace-only labels drop
 * out entirely so an empty `<label>` cannot blank a real one.
 *
 * `host` is excluded from the text, because an implicit label *wraps* the control it names —
 * `<label>Remember me <lr-checkbox>Yes</lr-checkbox></label>` names the checkbox "Remember me",
 * not "Remember me Yes". Reading the label's whole `textContent` would fold the control's own
 * content back into its name, which for a checkbox or a radio is precisely the text it already
 * renders.
 */
export function resolveExternalLabelText(
  labels: readonly HTMLLabelElement[],
  host?: Node,
): string {
  return labels
    .map((label) => labelText(label, host).trim())
    .filter((text) => text !== '')
    .join(' ');
}

/**
 * Bridges a native external `<label>` onto a form-associated custom element.
 *
 * A `<label for>` pointing at a custom element gives the platform *half* the relationship: the
 * browser resolves `ElementInternals.labels` and forwards a click to the host, but it can reach no
 * further. It cannot name the element inside the shadow root that actually owns the control's role
 * — an accessible name is only announced on the node the user is focused on, and that node is
 * never the host — and the forwarded host click lands on an element with no activation behaviour of
 * its own, so a label click focuses nothing and toggles nothing. Both halves are this controller's
 * job, for every form-associated control at once rather than once per component.
 *
 * The name is written straight onto the resolved target rather than routed through the component's
 * template, for two reasons: no control has to grow an `externalLabel` property and a template
 * binding for it, and the un-labelled value stays exactly what the component itself renders, so
 * removing the label restores it *synchronously* — a template round-trip would leave the stale name
 * in the accessibility tree until Lit's next update. Every write is snapshotted and reverted, and a
 * revert whose value no longer matches what was applied is abandoned rather than forced, so a
 * render that legitimately replaced the name (a host `aria-label` appearing) always wins.
 *
 * Host `aria-label` precedence is absolute: while the host carries one, the bridge applies nothing
 * and lets the component's own forwarding put the host's name on the target.
 */
export class ExternalLabelController implements ReactiveController {
  private labels: HTMLLabelElement[] = [];
  private labelObserver?: MutationObserver;
  private associationRootSubscription?: AssociationRootSubscription;
  /** The element currently carrying an applied name, and what it read before. */
  private applied?: { target: HTMLElement; name: string; had: boolean; previous: string | null };
  /** Guards the synthetic activation click against an implicit (ancestor) label re-entering. */
  private activating = false;

  constructor(private readonly host: ExternalLabelHost & ReactiveControllerHost) {}

  hostConnected(): void {
    this.associationRootSubscription?.disconnect();
    this.associationRootSubscription = observeAssociationRoot(this.host, () => this.refresh());
    this.refresh();
  }

  hostUpdated(): void {
    this.refresh();
  }

  hostDisconnected(): void {
    this.release();
    this.stopObservingLabels();
    this.associationRootSubscription?.disconnect();
    this.associationRootSubscription = undefined;
    for (const label of this.labels) label.removeEventListener('click', this.onLabelClick);
    this.labels = [];
  }

  /** Re-resolves the associated labels, re-arms observation, and re-applies the name. */
  private refresh(): void {
    const next = resolveExternalLabels(this.host);
    const changed =
      next.length !== this.labels.length || next.some((label, index) => label !== this.labels[index]);
    if (changed) {
      for (const label of this.labels) label.removeEventListener('click', this.onLabelClick);
      this.labels = next;
      for (const label of this.labels) label.addEventListener('click', this.onLabelClick);
      this.observeLabels();
    }
    this.associationRootSubscription?.update(next);
    this.apply();
  }

  /**
   * Watches only the labels this control is actually associated with for text/subtree changes. The
   * shared association-root observer handles `for`/`id` changes and label insertion/removal, while
   * this smaller observer avoids waking every FACE control when one label's prose changes.
   */
  private observeLabels(): void {
    this.stopObservingLabels();
    const Observer = this.host.ownerDocument.defaultView?.MutationObserver;
    if (this.labels.length === 0 || Observer === undefined) return;
    const observer = new Observer(() => this.refresh());
    for (const label of this.labels) {
      observer.observe(label, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
    this.labelObserver = observer;
  }

  private stopObservingLabels(): void {
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
  }

  /** Whether label activation is currently barred — the control's own `disabled` or an ancestor
   *  `<fieldset disabled>`. `:disabled` is the authority (it is the only selector that tracks
   *  fieldset cascading), with the component's own flags consulted for a DOM that does not match
   *  a form-associated custom element against it. */
  private get barred(): boolean {
    if (typeof this.host.matches === 'function' && this.host.matches(':disabled')) return true;
    return Boolean(this.host.effectiveDisabled ?? this.host.disabled);
  }

  /** The element that owns the control's role — where the external name belongs. */
  private resolveNameTarget(focusTarget: HTMLElement | null): HTMLElement | null {
    if (this.hostSemanticOwner) return this.host;
    const root = this.ownRoot;
    if (!root) return focusTarget;

    // 1. A composite that contains the focus target owns the name for all of its parts.
    if (focusTarget) {
      for (const composite of root.querySelectorAll(COMPOSITE_ROLE_SELECTOR)) {
        if (isHtmlElement(composite) && isComposedDescendant(composite, focusTarget)) {
          return composite;
        }
      }
    }

    // 2. The node the user's focus lands on, when this control renders it itself.
    if (focusTarget && focusTarget.getRootNode() === root) return focusTarget;

    // 3. Otherwise the outermost node of this control's own tree on the way down to the focus
    //    target — a nested component's host, or a slotted child. Naming that element keeps the
    //    write inside a boundary this control owns, where no other component's render can clear it.
    const owned = focusTarget ? this.outermostOwnedAncestor(focusTarget) : null;
    if (owned) return owned;

    // 4. Nothing focusable is reachable yet; fall back to whatever semantic node this control
    //    renders first, then to the focus target itself.
    const semantic = root.querySelector(SEMANTIC_TARGET_SELECTOR);
    return semantic && isHtmlElement(semantic) ? semantic : focusTarget;
  }

  /** The outermost ancestor of `node` that this control renders itself or hosts as a slotted
   *  child, walking the composed tree up to (but never including) the host. */
  private outermostOwnedAncestor(node: HTMLElement): HTMLElement | null {
    const root = this.ownRoot;
    let owned: HTMLElement | null = null;
    let current: Node | null = node;
    while (current && current !== this.host) {
      if (isHtmlElement(current)) {
        const parentRoot = current.getRootNode();
        if (parentRoot === root || current.parentNode === this.host) owned = current;
      }
      if (current.parentNode) {
        current = current.parentNode;
      } else {
        current = isShadowRootNode(current) ? current.host : null;
      }
    }
    return owned;
  }

  private get ownRoot(): ShadowRoot | null {
    const root = this.host.renderRoot;
    return isShadowRootNode(root) ? root : this.host.shadowRoot;
  }

  private resolveFocusTarget(): HTMLElement | null {
    if (this.hostSemanticOwner) return this.host;
    return collectComposedFocusTargets(this.host).elements[0] ?? null;
  }

  /** Host-owned semantic controls opt in with a symbol so the protocol cannot accidentally become
   * a reflected/public component member. */
  private get hostSemanticOwner(): ExternalLabelHostSemanticOwner | null {
    const candidate = this.host as Partial<ExternalLabelHostSemanticOwner>;
    return typeof candidate[EXTERNAL_LABEL_HOST_SEMANTICS] === 'function'
      ? (candidate as ExternalLabelHostSemanticOwner)
      : null;
  }

  private hostHasAuthoredName(owner: ExternalLabelHostSemanticOwner): boolean {
    return owner[EXTERNAL_LABEL_HOST_SEMANTICS]({ type: 'has-authored-name' }) === true;
  }

  /** How a label click reaches this control. */
  private resolveActivation(focusTarget: HTMLElement | null): ExternalLabelActivation {
    const declared = (this.host as Partial<ExternalLabelActivationHost>)[EXTERNAL_LABEL_ACTIVATION];
    if (typeof declared === 'function') return declared.call(this.host);
    // Role-inferred activation is deliberately restricted to a target this control renders itself.
    // A group's focus target belongs to a *member* (`<lr-radio-group>` lands on its first radio),
    // and selecting that member because the group's label was clicked would be a destructive
    // answer to a request that native markup only ever answers with focus.
    if (!focusTarget || focusTarget.getRootNode() !== this.ownRoot) return 'focus';
    const role = focusTarget.getAttribute('role');
    return role && ACTIVATING_ROLES.has(role) ? 'activate' : 'focus';
  }

  /** Applies (or withdraws) the external name on the current role owner. */
  private apply(): void {
    const hostOwner = this.hostSemanticOwner;
    if (
      (hostOwner && this.hostHasAuthoredName(hostOwner)) ||
      (!hostOwner && this.host.hasAttribute('aria-label'))
    ) {
      // Host `aria-label` wins over any computed internal name; the component's own forwarding
      // already puts it on the target, so the bridge must not compete with it.
      this.release();
      return;
    }
    const name = resolveExternalLabelText(this.labels, this.host);
    if (name === '') {
      this.release();
      return;
    }
    // Steady state: the name is already where it belongs. Returning here is what keeps this off
    // the hot path — `apply()` runs after *every* render, and resolving the target walks the
    // control's whole composed subtree, which a drag-driven control (`<lr-slider>` emits `input`
    // per pointermove) would otherwise pay for on every frame.
    const settled = this.applied;
    if (
      settled &&
      settled.name === name &&
      settled.target.isConnected &&
      settled.target.getAttribute('aria-label') === name
    ) {
      return;
    }
    const target = this.resolveNameTarget(this.resolveFocusTarget());
    if (!target) return;
    if (this.applied && this.applied.target !== target) this.release();
    if (!this.applied) {
      this.applied = {
        target,
        name,
        had: target.hasAttribute('aria-label'),
        previous: target.getAttribute('aria-label'),
      };
    }
    if (target === this.host && hostOwner) {
      hostOwner[EXTERNAL_LABEL_HOST_SEMANTICS]({ type: 'apply', name });
    } else if (target.getAttribute('aria-label') !== name) {
      target.setAttribute('aria-label', name);
    }
    this.applied.name = name;
  }

  /**
   * Puts the target's own name back.
   *
   * Only when the attribute still reads what was applied: a component that re-rendered a *different*
   * name in the meantime (the host gained an `aria-label`) has stated the newer truth, and restoring
   * the stale snapshot over it would be the bridge overruling the control it is helping.
   */
  private release(): void {
    const applied = this.applied;
    this.applied = undefined;
    if (!applied) return;
    const { target, name, had, previous } = applied;
    const hostOwner = target === this.host ? this.hostSemanticOwner : null;
    if (hostOwner) {
      hostOwner[EXTERNAL_LABEL_HOST_SEMANTICS]({
        type: 'release',
        appliedName: name,
        hadPrevious: had,
        previous,
      });
      return;
    }
    if (target.getAttribute('aria-label') !== name) return;
    if (had) target.setAttribute('aria-label', previous ?? '');
    else target.removeAttribute('aria-label');
  }

  private readonly onLabelClick = (event: Event): void => {
    if (this.activating || this.barred) return;
    // Mutation observers deliver after the current task. Recheck synchronously so a label whose
    // `for` changed immediately before `.click()` cannot activate the control it used to name in
    // the small window before the association observer refreshes its listener set.
    const source = event.currentTarget;
    if (!source || !isLabelElement(source) || !isCurrentlyAssociatedLabel(source, this.host)) {
      this.refresh();
      return;
    }
    // The native rule: a label whose own click originated inside its labeled control does not
    // re-activate it. Without this an implicit `<label><lr-checkbox>…</label>` would toggle twice —
    // once from the user's click and once from the forwarded one — and recurse besides.
    if (event.composedPath().includes(this.host)) return;

    // Label activation is a default action: a listener anywhere later in this click's propagation
    // may cancel it. A microtask observes the event's final `defaultPrevented` state instead of
    // activating eagerly from whichever label listener happened to be registered first.
    queueMicrotask(() => {
      if (event.defaultPrevented || !this.host.isConnected || this.barred) return;
      if (!isCurrentlyAssociatedLabel(source, this.host)) {
        this.refresh();
        return;
      }
      const focusTarget = this.resolveFocusTarget();
      const activation = this.resolveActivation(focusTarget);

      this.activating = true;
      try {
        this.host.focus();
        if (!isComposedDescendant(this.host, deepActiveElementIn(this.host.ownerDocument))) {
          focusTarget?.focus();
        }
        if (activation === 'activate') focusTarget?.click();
      } finally {
        this.activating = false;
      }
    });
  };
}

let supportInstalled = false;

/**
 * Installs the two form-control hooks used by `LyraElement`.
 *
 * Callers deliberately use this value import instead of relying on a bare module import: package
 * tree-shaking metadata is then free to classify this module as otherwise side-effect-free without
 * erasing the form-label contract from a production component bundle.
 *
 * @internal
 */
export function installFormControlLabelSupport(): void {
  if (supportInstalled) return;
  supportInstalled = true;
  registerFormControlLabelSupport(
    captureFormInternals,
    (host: LyraElement<any>) => new ExternalLabelController(host),
  );
}
