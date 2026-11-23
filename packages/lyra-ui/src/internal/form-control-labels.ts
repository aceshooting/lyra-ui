import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { isAriaTrue } from './aria-values.js';
import { deepActiveElementIn } from './active-element.js';
import { hasFocusExcludingAttributes, styleExcludesFocusSubtree } from './focus-candidates.js';
import { firstFormControlFocusTarget } from './form-control-focus-target.js';
import {
  registerFormControlLabelSupport,
  type LyraElement,
} from './lyra-element.js';
import { isShadowRootNode } from './dom-guards.js';

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
 * `<button>` does not: `<lr-button>` must run its submit/reset behaviour on a label click, while
 * `<lr-color-picker>`'s and `<lr-select>`'s triggers are also `<button>`s and must merely take focus
 * — opening a popup from a label click is not what any native control does. Guessing from the tag
 * name would encode the component list in the bridge; the symbol lets controls whose role is
 * ambiguous declare the right behavior themselves.
 */
const EXTERNAL_LABEL_ACTIVATION = Symbol('lr-external-label-activation');

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

/** One control's membership in its root's association observer. */
interface AssociationRootSubscription {
  update(labels: readonly HTMLLabelElement[]): void;
  disconnect(): void;
}


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

/** Whether `label` names `host` in the DOM tree *right now*.
 *
 * Some engines update `ElementInternals.labels` only when mutation observers deliver. Label click
 * handling runs before that checkpoint, so relying on the otherwise-live list can activate the
 * control a `for` attribute named one mutation ago. Resolve the simple platform association rule
 * structurally here; `getElementById()` also preserves the first-match rule for duplicate IDs. */
export function isCurrentlyAssociatedLabel(label: HTMLLabelElement, host: HTMLElement): boolean {
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

/** The `<label>` that is or contains `node`. */
function containingLabel(node: Node): HTMLLabelElement | null {
  if (isLabelElement(node)) return node;
  const element = node.nodeType === 1 ? node as Element : node.parentElement;
  const label = element?.closest('label');
  return isLabelElement(label ?? null) ? label! : null;
}

/** The surface of `external-label-association.ts` this module drives after loading it. */
interface IndexedLabelAssociation {
  observeIndexedLabelAssociations(host: HTMLElement, listener: () => void): AssociationRootSubscription;
  replayIndexedLabelAssociations(root: Node, records: readonly MutationRecord[], overflow: boolean): void;
}

/** The indexed observer once loaded; every later subscription uses it directly. */
let indexedLabelAssociation: IndexedLabelAssociation | undefined;
let indexedLabelAssociationLoad: Promise<void> | undefined;
const importIndexedLabelAssociationChunk = (): Promise<IndexedLabelAssociation> =>
  import('./external-label-association.js');
let importIndexedLabelAssociation = importIndexedLabelAssociationChunk;

/** Records a lean root retains for replay while the indexed observer loads. */
const MAX_LEAN_ASSOCIATION_RECORDS = 2_048;

/** What a root's lean association observer watches: the same records as the indexed one. */
const ASSOCIATION_OBSERVER_OPTIONS: MutationObserverInit = {
  attributes: true,
  attributeFilter: ['for', 'id', 'type'],
  attributeOldValue: true,
  childList: true,
  characterData: true,
  subtree: true,
};

interface LeanAssociationSubscription {
  readonly host: HTMLElement;
  readonly listener: () => void;
  labels: readonly HTMLLabelElement[];
  indexed?: AssociationRootSubscription;
}

interface LeanAssociationRoot {
  readonly root: Node;
  readonly subscriptions: Set<LeanAssociationSubscription>;
  observer?: MutationObserver;
  /** Records kept for replay once an association may exist; unset while none can. */
  pending?: MutationRecord[];
  overflow: boolean;
}

const leanAssociationRoots = new Map<Node, LeanAssociationRoot>();

/**
 * Whether a lean root's mutation batch could give one of its controls a label. Until then no
 * control in the root has one, so only a label appearing, a mutation inside a label, or an `id`
 * that is (or duplicates) a control's own can matter: a superset of what the indexed observer
 * would refresh for the same batch.
 */
function mayAssociateLabel(entry: LeanAssociationRoot, records: readonly MutationRecord[]): boolean {
  let ids: Set<string> | undefined;
  const isControlId = (id: string | null | undefined): boolean =>
    !!id && (ids ??= new Set([...entry.subscriptions].map(({ host }) => host.id))).has(id);
  for (const record of records) {
    if (containingLabel(record.target)) return true;
    if (record.type === 'attributes') {
      // `for`, and `type` on an input, matter only on or inside a label, handled above.
      if (record.attributeName === 'id' &&
        (isControlId(record.oldValue) || isControlId((record.target as Element).getAttribute('id')))) return true;
      continue;
    }
    for (const nodes of [record.addedNodes, record.removedNodes]) {
      for (const node of nodes) {
        if (node.nodeType !== 1) continue;
        const element = node as Element;
        if (isLabelElement(element) || element.querySelector('label') || isControlId(element.getAttribute('id'))) {
          return true;
        }
        for (const identified of element.querySelectorAll('[id]')) {
          if (isControlId(identified.getAttribute('id'))) return true;
        }
      }
    }
  }
  return false;
}

function queueLeanAssociationRecords(entry: LeanAssociationRoot, records: readonly MutationRecord[]): void {
  if (!entry.pending) {
    if (!mayAssociateLabel(entry, records)) return;
    entry.pending = [];
  }
  if (entry.pending.length + records.length > MAX_LEAN_ASSOCIATION_RECORDS) entry.overflow = true;
  else entry.pending.push(...records);
  void loadExternalLabelAssociation();
}

function migrateLeanAssociationRoot(entry: LeanAssociationRoot, indexed: IndexedLabelAssociation): void {
  leanAssociationRoots.delete(entry.root);
  const records = [...(entry.pending ?? []), ...(entry.observer?.takeRecords() ?? [])];
  entry.observer?.disconnect();
  for (const subscription of entry.subscriptions) {
    subscription.indexed = indexed.observeIndexedLabelAssociations(subscription.host, subscription.listener);
    subscription.indexed.update(subscription.labels);
  }
  indexed.replayIndexedLabelAssociations(entry.root, records, entry.overflow);
}

/**
 * Loads the indexed association observer and hands every lean root to it. Requested only once a
 * control has a label or a mutation could give it one. Lean roots keep buffering while it loads,
 * so a failed load is retried by the next such mutation and still replays everything seen.
 *
 * @internal
 */
export function loadExternalLabelAssociation(): Promise<void> {
  return (indexedLabelAssociationLoad ??= importIndexedLabelAssociation().then(
    (indexed) => {
      indexedLabelAssociation = indexed;
      for (const entry of [...leanAssociationRoots.values()]) migrateLeanAssociationRoot(entry, indexed);
    },
    () => {
      indexedLabelAssociationLoad = undefined;
    },
  ));
}

/** Whether the indexed association observer has replaced the lean one. @internal */
export function isExternalLabelAssociationIndexed(): boolean {
  return indexedLabelAssociation !== undefined;
}

/** Replaces (or, with no argument, restores) the indexed observer's loader. @internal */
export function __setExternalLabelAssociationLoaderForTesting(
  loader?: () => Promise<IndexedLabelAssociation>,
): void {
  importIndexedLabelAssociation = loader ?? importIndexedLabelAssociationChunk;
  indexedLabelAssociationLoad = undefined;
}

/**
 * Subscribes one control to its root's external-label association observer.
 *
 * A root starts with a lean observer that only recognizes mutations which could create a first
 * association. A control with a label, or such a mutation, loads the indexed observer, which then
 * replays the records seen meanwhile and refreshes exactly the controls they affect. A label that
 * is already associated when the control connects is applied by the control's own refresh, before
 * and independently of that load.
 */
export function observeExternalLabelAssociations(
  host: HTMLElement,
  listener: () => void,
): AssociationRootSubscription {
  if (indexedLabelAssociation) return indexedLabelAssociation.observeIndexedLabelAssociations(host, listener);
  const root = host.getRootNode();
  let entry = leanAssociationRoots.get(root);
  if (!entry) {
    const created: LeanAssociationRoot = { root, subscriptions: new Set(), overflow: false };
    const Observer = host.ownerDocument.defaultView?.MutationObserver;
    if (Observer) {
      created.observer = new Observer((records) => {
        if (leanAssociationRoots.get(root) === created) queueLeanAssociationRecords(created, records);
      });
      created.observer.observe(root, ASSOCIATION_OBSERVER_OPTIONS);
    }
    leanAssociationRoots.set(root, (entry = created));
  }
  const lean = entry;
  const subscription: LeanAssociationSubscription = { host, listener, labels: [] };
  lean.subscriptions.add(subscription);
  let active = true;
  return {
    update(labels) {
      if (!active) return;
      if (subscription.indexed) {
        subscription.indexed.update(labels);
        return;
      }
      subscription.labels = labels;
      if (labels.length === 0) return;
      lean.pending ??= [];
      void loadExternalLabelAssociation();
    },
    disconnect() {
      if (!active) return;
      active = false;
      if (subscription.indexed) {
        subscription.indexed.disconnect();
        return;
      }
      lean.subscriptions.delete(subscription);
      if (lean.subscriptions.size > 0 || leanAssociationRoots.get(root) !== lean) return;
      lean.observer?.disconnect();
      leanAssociationRoots.delete(root);
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

const LABEL_TEXT_MAX_DEPTH = 256;
const LABEL_TEXT_MAX_NODES = 4_096;
const NON_CONTENT_ELEMENTS = new Set(['script', 'style', 'template']);

/**
 * A label's accessible text, read the way the platform names a control from it: content hidden
 * from assistive technology (`hidden`, `inert`, `aria-hidden`, undisplayed) and non-content
 * elements drop out, a descendant's own `aria-label` and an image's `alt` stand in for its
 * content, and open shadow roots contribute what they render. `exclude`'s subtree is left out
 * wherever it appears. Only the label's content is filtered, so a hidden label still names its
 * control, and text runs are joined as they are, without inventing word breaks.
 */
function labelText(label: Element, exclude?: Node): string {
  let remaining = LABEL_TEXT_MAX_NODES;
  const read = (node: Node, depth: number): string => {
    if (node === exclude || depth > LABEL_TEXT_MAX_DEPTH || --remaining < 0) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    let children: ArrayLike<Node> = node.childNodes;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (NON_CONTENT_ELEMENTS.has(element.localName)) return '';
      if (element !== label) {
        // `hidden`/`inert` (the browser-order variant leaves ARIA to the explicit check below),
        // `aria-hidden`, and an undisplayed subtree.
        if (
          hasFocusExcludingAttributes(element, true) ||
          isAriaTrue(element.getAttribute('aria-hidden')) ||
          styleExcludesFocusSubtree(element.ownerDocument.defaultView?.getComputedStyle(element))
        ) return '';
        const ariaLabel = element.getAttribute('aria-label')?.trim();
        if (ariaLabel) return ariaLabel;
        const alternative = element.localName === 'img' || element.localName === 'area'
          ? element.getAttribute('alt')?.trim()
          : undefined;
        if (alternative) return alternative;
      }
      if (element.shadowRoot) children = element.shadowRoot.childNodes;
      else if (element.localName === 'slot') {
        const assigned = (element as HTMLSlotElement).assignedNodes({ flatten: true });
        if (assigned.length > 0) children = assigned;
      }
    } else if (node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
      return '';
    }
    let text = '';
    for (let index = 0; index < children.length; index += 1) text += read(children[index]!, depth + 1);
    return text;
  };
  return read(label, 0);
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
  private associationRootSubscription?: AssociationRootSubscription;
  /** The element currently carrying an applied name, and what it read before. */
  private applied?: { target: HTMLElement; name: string; had: boolean; previous: string | null };
  /** Guards the synthetic activation click against an implicit (ancestor) label re-entering. */
  private activating = false;

  constructor(private readonly host: ExternalLabelHost & ReactiveControllerHost) {}

  hostConnected(): void {
    this.associationRootSubscription?.disconnect();
    this.associationRootSubscription = observeExternalLabelAssociations(this.host, () => this.refresh());
    this.refresh();
  }

  hostUpdated(): void {
    this.refresh();
  }

  hostDisconnected(): void {
    this.release();
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
    }
    this.associationRootSubscription?.update(next);
    this.apply();
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
    return firstFormControlFocusTarget(this.host);
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

/**
 * Installs only the shared `ElementInternals` capture hook.
 *
 * This is the lean half of form-label support for a form-associated component that declares its
 * own `FORM_CONTROL_LABEL_FACTORY`. It deliberately leaves the generic factory untouched: a full
 * installer imported before or after this call therefore keeps serving every other control.
 *
 * @internal
 */
export function installFormControlInternalsCapture(): void {
  registerFormControlLabelSupport(captureFormInternals);
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
