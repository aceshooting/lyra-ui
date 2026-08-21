import { composedParentElement, deepActiveElementIn } from './active-element.js';
import { isAriaTrue } from './accessibility-visibility.js';
import { asciiWhitespaceTokens } from './ascii-whitespace.js';
import { imageMapImageFor, isHtmlElement, isSvgElement } from './dom-guards.js';

const DEFAULT_FOCUS_MAX_DEPTH = 256;
const DEFAULT_FOCUS_MAX_NODES = 10_000;
const MAX_CONFIGURED_FOCUS_LIMIT = 100_000;

const ARIA_WIDGET_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'grid',
  'gridcell',
  'link',
  'listbox',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'radiogroup',
  'scrollbar',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'tablist',
  'textbox',
  'tree',
  'treegrid',
  'treeitem',
]);

// Role processing uses the first recognized concrete role, rather than treating a later widget
// token as a fallback after an already-valid structural role such as `note`.
const ARIA_NON_WIDGET_ROLES = new Set([
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'blockquote',
  'caption',
  'cell',
  'code',
  'columnheader',
  'comment',
  'complementary',
  'contentinfo',
  'definition',
  'deletion',
  'dialog',
  'directory',
  'document',
  'emphasis',
  'feed',
  'figure',
  'form',
  'generic',
  'group',
  'heading',
  'img',
  'image',
  'insertion',
  'list',
  'listitem',
  'log',
  'main',
  'marquee',
  'mark',
  'math',
  'meter',
  'navigation',
  'none',
  'note',
  'paragraph',
  'presentation',
  'progressbar',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'search',
  'sectionfooter',
  'sectionheader',
  'status',
  'strong',
  'subscript',
  'suggestion',
  'superscript',
  'table',
  'tabpanel',
  'term',
  'time',
  'timer',
  'toolbar',
  'tooltip',
]);

type BrowserFocusElement = HTMLElement | SVGElement;

type ComposedFocusMode = 'programmatic' | 'tabbable';
type FocusTraversalTruncationReason = 'depth' | 'nodes';

export interface ComposedFocusCollectionOptions {
  /** Includes managed/native actions at `tabindex=-1`, or only sequential Tab stops. */
  mode?: ComposedFocusMode;
  /** Whether an Element root can itself be returned. Defaults to true. */
  includeRoot?: boolean;
  /** Maximum composed descendant depth. */
  maxDepth?: number;
  /** Total element-work ceiling, shared across slots and open shadow roots. */
  maxNodes?: number;
  /** Skips composed-ancestor validation for the supplied root only. */
  skipRootAncestorValidation?: boolean;
}

export interface ComposedFocusCollectionResult {
  elements: HTMLElement[];
  truncated: boolean;
  truncationReasons: readonly FocusTraversalTruncationReason[];
  visitedElements: number;
}

export interface ComposedFocusRepairSnapshot {
  readonly activeElement: Element;
  readonly candidate: HTMLElement;
  readonly document: Document;
  readonly owner: Element;
}

interface RenderedElementState {
  display: string | undefined;
  subtreeUnavailable: boolean;
  visibility: string | undefined;
}

interface ElementWork {
  ancestorsAvailable: boolean;
  depth: number;
  element: Element;
  kind: 'element';
  scope: NavigationScope;
  workCharged?: boolean;
}

interface ElementChildrenWork {
  ancestorsAvailable: boolean;
  children: ArrayLike<Element>;
  depth: number;
  index: number;
  kind: 'children';
  scope: NavigationScope;
}

interface SlotChildrenWork {
  ancestorsAvailable: boolean;
  candidates: ArrayLike<Node>;
  depth: number;
  fallback: HTMLCollection;
  foundAssigned: boolean;
  index: number;
  kind: 'slot';
  scope: NavigationScope;
  slot: HTMLSlotElement;
}

type ElementTraversalWork = ElementWork | ElementChildrenWork | SlotChildrenWork;

interface NavigationScopeEntry {
  childScope?: NavigationScope;
  delegatesFocus?: boolean;
  order: number;
  suppressSequentialDescendants?: boolean;
  target?: BrowserFocusElement;
}

interface NavigationScope {
  entries: NavigationScopeEntry[];
  nextOrder: number;
}

interface ElementTraversalResult {
  elements: Element[];
  navigationScope: NavigationScope;
  reasons: Set<FocusTraversalTruncationReason>;
  visitedElements: number;
}

interface FocusTraversalContext {
  elementStates: Map<Element, RenderedElementState>;
  imageMapImages: Map<Element, HTMLImageElement | null>;
  maxDepth: number;
  maxNodes: number;
  reasons: Set<FocusTraversalTruncationReason>;
  workUnits: number;
}

function finiteFocusLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_CONFIGURED_FOCUS_LIMIT, Math.max(0, Math.floor(value!)));
}

function createFocusTraversalContext(
  options: Pick<ComposedFocusCollectionOptions, 'maxDepth' | 'maxNodes'>,
): FocusTraversalContext {
  return {
    elementStates: new Map<Element, RenderedElementState>(),
    imageMapImages: new Map<Element, HTMLImageElement | null>(),
    maxDepth: finiteFocusLimit(options.maxDepth, DEFAULT_FOCUS_MAX_DEPTH),
    maxNodes: finiteFocusLimit(options.maxNodes, DEFAULT_FOCUS_MAX_NODES),
    reasons: new Set<FocusTraversalTruncationReason>(),
    workUnits: 0,
  };
}

function renderedElementState(
  element: Element,
  imageMapImage: HTMLImageElement | null,
): RenderedElementState {
  let style: CSSStyleDeclaration | undefined;
  try {
    style = element.ownerDocument.defaultView?.getComputedStyle(element);
  } catch {
    // An adopted/detached node can temporarily have no style realm. Authored state still applies.
  }
  return {
    display: style?.display,
    subtreeUnavailable:
      element.hasAttribute('hidden') ||
      element.hasAttribute('inert') ||
      isAriaTrue(element.getAttribute('aria-hidden')) ||
      isAriaTrue(element.getAttribute('aria-disabled')) ||
      (!imageMapImage && (style?.display === 'none' || style?.contentVisibility === 'hidden')),
    visibility: style?.visibility,
  };
}

function consumeFocusWork(context: FocusTraversalContext): boolean {
  if (context.workUnits >= context.maxNodes) {
    context.reasons.add('nodes');
    return false;
  }
  context.workUnits += 1;
  return true;
}

function cachedRenderedElementState(
  context: FocusTraversalContext,
  element: Element,
): RenderedElementState {
  let state = context.elementStates.get(element);
  if (!state) {
    state = renderedElementState(element, cachedImageMapImage(context, element));
    context.elementStates.set(element, state);
  }
  return state;
}

function cachedImageMapImage(
  context: FocusTraversalContext,
  element: Element,
): HTMLImageElement | null {
  if (context.imageMapImages.has(element)) return context.imageMapImages.get(element)!;
  const image = imageMapImageFor(element, { consume: () => consumeFocusWork(context) });
  context.imageMapImages.set(element, image);
  return image;
}

function isClosedDetailsBranch(
  details: Element,
  branch: Element | null,
  context: FocusTraversalContext,
): boolean {
  if (details.localName !== 'details' || details.hasAttribute('open') || branch === null) return false;
  for (const child of details.children) {
    if (!consumeFocusWork(context)) return true;
    if (child.localName === 'summary') return child !== branch;
  }
  return true;
}

function composedAncestorsAvailable(
  element: Element,
  context: FocusTraversalContext,
): boolean {
  let branch: Element | null = element;
  let ancestor = composedParentElement(element);
  let depth = 0;
  while (ancestor) {
    if (!consumeFocusWork(context)) return false;
    const state = cachedRenderedElementState(context, ancestor);
    if (state.subtreeUnavailable || isClosedDetailsBranch(ancestor, branch, context)) return false;
    depth += 1;
    if (depth > context.maxDepth) {
      context.reasons.add('depth');
      return false;
    }
    branch = ancestor;
    ancestor = composedParentElement(ancestor);
  }
  return true;
}

function isRenderedFocusCandidate(
  context: FocusTraversalContext,
  element: Element,
  state: RenderedElementState,
): boolean {
  const imageMapImage = cachedImageMapImage(context, element);
  if (isHtmlElement(element) && element.localName === 'area' && !imageMapImage) return false;
  if (imageMapImage) {
    const imageState = cachedRenderedElementState(context, imageMapImage);
    return composedAncestorsAvailable(imageMapImage, context) &&
      !imageState.subtreeUnavailable &&
      isRenderedFocusCandidate(context, imageMapImage, imageState);
  }
  if (!element.isConnected || state.visibility === 'hidden' || state.visibility === 'collapse') return false;
  const candidate = element as Element & {
    checkVisibility?: (options?: { contentVisibilityAuto?: boolean }) => boolean;
  };
  if (typeof candidate.checkVisibility === 'function') {
    try {
      return candidate.checkVisibility({ contentVisibilityAuto: true });
    } catch {
      return false;
    }
  }
  return element.getClientRects().length > 0;
}

function hasAriaWidgetRole(element: Element): boolean {
  for (const token of asciiWhitespaceTokens(element.getAttribute('role'))) {
    const role = token.toLowerCase();
    if (ARIA_WIDGET_ROLES.has(role)) return true;
    if (ARIA_NON_WIDGET_ROLES.has(role)) return false;
  }
  return false;
}

function isNativeAction(element: BrowserFocusElement): boolean {
  if (isSvgElement(element)) {
    return element.localName === 'a' && (
      element.hasAttribute('href') ||
      element.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')
    );
  }
  switch (element.localName) {
    case 'a':
      return element.hasAttribute('href');
    case 'area': {
      if (!element.hasAttribute('href')) return false;
      let ancestor = element.parentElement;
      for (let depth = 0; ancestor && depth <= DEFAULT_FOCUS_MAX_DEPTH; depth += 1) {
        if (ancestor.localName === 'map') return true;
        ancestor = ancestor.parentElement;
      }
      return false;
    }
    case 'audio':
    case 'video':
      return element.hasAttribute('controls');
    case 'button':
    case 'embed':
    case 'iframe':
    case 'select':
    case 'textarea':
      return true;
    case 'object': {
      const data = element.getAttribute('data');
      return data !== null && data.trim() !== '';
    }
    case 'input':
      return (element as HTMLInputElement).type !== 'hidden';
    case 'summary':
      return element.matches('details > summary:first-of-type');
    default: {
      // `isContentEditable` is inherited. Only an element that explicitly establishes an editing
      // host is an independent semantic action; ordinary descendants belong to that same action.
      return element.hasAttribute('contenteditable') &&
        element.isContentEditable &&
        !element.parentElement?.isContentEditable;
    }
  }
}

function isBrowserFocusElement(element: Element): element is BrowserFocusElement {
  return isHtmlElement(element) || isSvgElement(element);
}

function isShadowRoot(root: Element | ShadowRoot): root is ShadowRoot {
  return root.nodeType === 11 && 'host' in root;
}

/** Realm-neutral classification of native actions and elements carrying an ARIA widget role. */
export function isSemanticActionElement(element: Element): element is HTMLElement {
  return isBrowserFocusElement(element) && (isNativeAction(element) || hasAriaWidgetRole(element));
}

/**
 * Realm-neutral classification of semantic actions and authored sequential focus stops. A plain
 * `tabindex="-1"` remains programmatically focusable without becoming an action; native and ARIA
 * actions retain their semantics when a roving owner assigns `-1`.
 */
export function isActionableElement(element: Element): element is HTMLElement {
  return isSemanticActionElement(element) ||
    (isBrowserFocusElement(element) && element.hasAttribute('tabindex') && element.tabIndex >= 0);
}

/** Whether a genuine HTML element can currently receive focus through its composed branch. */
export function isComposedFocusAvailable(
  element: Element,
  options: Pick<ComposedFocusCollectionOptions, 'maxDepth' | 'maxNodes'> = {},
): element is HTMLElement {
  if (!isBrowserFocusElement(element)) return false;
  const context = createFocusTraversalContext(options);
  if (!consumeFocusWork(context) || !composedAncestorsAvailable(element, context)) return false;
  const state = cachedRenderedElementState(context, element);
  if (state.subtreeUnavailable || element.matches(':disabled')) return false;
  return isRenderedFocusCandidate(context, element, state);
}

function composedContains(
  container: Element,
  candidate: Element | null,
  maxDepth = DEFAULT_FOCUS_MAX_DEPTH,
): boolean {
  let current = candidate;
  let depth = 0;
  while (current) {
    if (current === container) return true;
    if (depth >= maxDepth) return false;
    current = composedParentElement(current);
    depth += 1;
  }
  return false;
}

/** Captures a repair only when deep focus is currently inside the branch about to disappear. */
export function captureComposedFocusRepair(
  owner: Element,
  candidate: HTMLElement | null,
): ComposedFocusRepairSnapshot | null {
  if (!candidate || candidate.ownerDocument !== owner.ownerDocument) return null;
  const activeElement = deepActiveElementIn(owner.ownerDocument);
  if (!activeElement || !composedContains(owner, activeElement)) return null;
  return { activeElement, candidate, document: owner.ownerDocument, owner };
}

/**
 * Applies a captured repair unless focus moved to a newer external target. Body/document fallback
 * after removal is treated as the captured focus disappearing, not as an intentional new target.
 */
export function applyComposedFocusRepair(
  snapshot: ComposedFocusRepairSnapshot,
  candidateOverride: HTMLElement | null = snapshot.candidate,
): boolean {
  const { document: ownerDocument, owner } = snapshot;
  const candidate = candidateOverride;
  if (!candidate) return false;
  if (candidate.ownerDocument !== ownerDocument || !isComposedFocusAvailable(candidate)) return false;
  const current = deepActiveElementIn(ownerDocument);
  const lostWithBranch = current === null || current === ownerDocument.body || current === ownerDocument.documentElement;
  if (current !== snapshot.activeElement && !composedContains(owner, current) && !lostWithBranch) return false;
  candidate.focus();
  const repaired = deepActiveElementIn(ownerDocument);
  return repaired === candidate || composedContains(candidate, repaired);
}

function traverseComposedElements(
  root: Element | ShadowRoot,
  options: ComposedFocusCollectionOptions,
  include: (
    element: Element,
    available: boolean,
    state: RenderedElementState,
    context: FocusTraversalContext,
  ) => boolean,
): ElementTraversalResult {
  const context = createFocusTraversalContext(options);
  const { maxDepth, maxNodes } = context;
  const elements: Element[] = [];
  const stack: ElementTraversalWork[] = [];
  const visited = new Set<Element>();
  const navigationScope: NavigationScope = { entries: [], nextOrder: 0 };

  if (maxNodes === 0) {
    context.reasons.add('nodes');
    return {
      elements,
      navigationScope,
      reasons: context.reasons,
      visitedElements: 0,
    };
  }

  const schedule = (
    element: Element,
    depth: number,
    ancestorsAvailable: boolean,
    scope: NavigationScope,
    workCharged = false,
  ): void => {
    if (depth > maxDepth) {
      context.reasons.add('depth');
      return;
    }
    stack.push({ ancestorsAvailable, depth, element, kind: 'element', scope, workCharged });
  };

  const scheduleChildren = (
    children: ArrayLike<Element>,
    depth: number,
    ancestorsAvailable: boolean,
    scope: NavigationScope,
  ): void => {
    if (children.length === 0) return;
    if (depth > maxDepth) {
      context.reasons.add('depth');
      return;
    }
    // Keep only one sibling cursor on the work stack. This preserves composed pre-order under a
    // tight node ceiling without eagerly allocating or reserving the whole budget for a wide list.
    stack.push({ ancestorsAvailable, children, depth, index: 0, kind: 'children', scope });
  };

  const scheduleSlotChildren = (
    slot: HTMLSlotElement,
    depth: number,
    ancestorsAvailable: boolean,
    scope: NavigationScope,
  ): void => {
    if (depth > maxDepth) {
      context.reasons.add('depth');
      return;
    }
    const slotRoot = slot.getRootNode();
    const candidates = slotRoot.nodeType === 11 && 'host' in slotRoot
      ? (slotRoot as ShadowRoot).host.childNodes
      : [];
    stack.push({
      ancestorsAvailable,
      candidates,
      depth,
      fallback: slot.children,
      foundAssigned: false,
      index: 0,
      kind: 'slot',
      scope,
      slot,
    });
  };

  const scheduleComposedChildren = (
    element: Element,
    depth: number,
    ancestorsAvailable: boolean,
    scope: NavigationScope,
  ): void => {
    if (element.localName === 'slot' && isHtmlElement(element)) {
      scheduleSlotChildren(element as HTMLSlotElement, depth, ancestorsAvailable, scope);
      return;
    }
    if (element.localName === 'details' && !element.hasAttribute('open')) {
      for (const child of element.children) {
        if (!consumeFocusWork(context)) return;
        if (child.localName === 'summary') {
          schedule(child, depth, ancestorsAvailable, scope, true);
          return;
        }
      }
      return;
    }
    scheduleChildren(element.shadowRoot?.children ?? element.children, depth, ancestorsAvailable, scope);
  };

  if (isShadowRoot(root)) {
    const shadowRoot = root;
    const ancestorsAvailable = options.skipRootAncestorValidation ||
      composedAncestorsAvailable(shadowRoot.host, context);
    const hostStateAvailable = consumeFocusWork(context) &&
      !cachedRenderedElementState(context, shadowRoot.host).subtreeUnavailable;
    scheduleChildren(shadowRoot.children, 0, ancestorsAvailable && hostStateAvailable, navigationScope);
  } else if (options.includeRoot === false) {
    const ancestorsAvailable = options.skipRootAncestorValidation ||
      composedAncestorsAvailable(root, context);
    const ownAvailable = consumeFocusWork(context) &&
      !cachedRenderedElementState(context, root).subtreeUnavailable;
    scheduleComposedChildren(root, 0, ancestorsAvailable && ownAvailable, navigationScope);
  } else {
    const ancestorsAvailable = options.skipRootAncestorValidation ||
      composedAncestorsAvailable(root, context);
    schedule(root, 0, ancestorsAvailable, navigationScope);
  }

  while (stack.length > 0) {
    const work = stack.pop()!;
    if (work.kind === 'slot') {
      if (work.index >= work.candidates.length) {
        if (!work.foundAssigned) {
          scheduleChildren(work.fallback, work.depth, work.ancestorsAvailable, work.scope);
        }
        continue;
      }
      if (!consumeFocusWork(context)) {
        stack.length = 0;
        break;
      }
      const node = work.candidates[work.index];
      const assigned = Boolean(
        node && (node as Node & { assignedSlot?: HTMLSlotElement | null }).assignedSlot === work.slot,
      );
      stack.push({
        ...work,
        foundAssigned: work.foundAssigned || assigned,
        index: work.index + 1,
      });
      if (node?.nodeType === 1 && assigned) {
        schedule(node as Element, work.depth, work.ancestorsAvailable, work.scope, true);
      }
      continue;
    }
    if (work.kind === 'children') {
      if (work.index >= work.children.length) continue;
      const element = work.children[work.index];
      stack.push({ ...work, index: work.index + 1 });
      if (element) schedule(element, work.depth, work.ancestorsAvailable, work.scope);
      continue;
    }
    if (visited.has(work.element)) continue;
    if (!work.workCharged && !consumeFocusWork(context)) {
      stack.length = 0;
      break;
    }
    visited.add(work.element);
    const state = cachedRenderedElementState(context, work.element);
    const available = work.ancestorsAvailable && !state.subtreeUnavailable;
    const included = include(work.element, available, state, context);
    if (included) elements.push(work.element);
    if (!available) continue;

    const childScopeOwner = work.element.shadowRoot ||
      (work.element.localName === 'slot' && isHtmlElement(work.element));
    if (childScopeOwner) {
      const childScope: NavigationScope = { entries: [], nextOrder: 0 };
      work.scope.entries.push({
        childScope,
        delegatesFocus: Boolean(work.element.shadowRoot?.delegatesFocus),
        order: work.scope.nextOrder++,
        suppressSequentialDescendants:
          work.element.hasAttribute('tabindex') && (work.element as HTMLElement | SVGElement).tabIndex < 0,
        target: included && isBrowserFocusElement(work.element) ? work.element : undefined,
      });
      scheduleComposedChildren(work.element, work.depth + 1, true, childScope);
      continue;
    }
    if (included && isBrowserFocusElement(work.element)) {
      work.scope.entries.push({
        order: work.scope.nextOrder++,
        target: work.element,
      });
    }
    scheduleComposedChildren(work.element, work.depth + 1, true, work.scope);
  }

  return {
    elements,
    navigationScope,
    reasons: context.reasons,
    visitedElements: visited.size,
  };
}

function isOverflowingTabStop(element: HTMLElement): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const { overflowX, overflowY } = view.getComputedStyle(element);
  if (overflowX === 'scroll' || overflowY === 'scroll') return true;
  if (overflowY === 'auto' && element.scrollHeight > element.clientHeight) return true;
  return overflowX === 'auto' && element.scrollWidth > element.clientWidth;
}

function isTabbableCandidate(element: BrowserFocusElement): boolean {
  if (element.hasAttribute('tabindex')) {
    if (element.tabIndex >= 0) return true;
    return isHtmlElement(element) && !isNativeAction(element) && isOverflowingTabStop(element);
  }
  // Editing hosts have a `tabIndex` IDL value of -1 even when they participate in sequential
  // navigation. A nested editing host is omitted unless it opts in with an authored tabindex.
  if (
    isHtmlElement(element) &&
    element.hasAttribute('contenteditable') &&
    element.isContentEditable
  ) {
    return !element.parentElement?.isContentEditable;
  }
  return isNativeAction(element);
}

function collapseRadioGroups(elements: BrowserFocusElement[]): BrowserFocusElement[] {
  interface RadioGroup {
    checked?: HTMLInputElement;
    first: HTMLInputElement;
  }
  const byRoot = new Map<Node, Map<HTMLFormElement | null, Map<string, RadioGroup>>>();
  for (const element of elements) {
    if (!isHtmlElement(element) || element.localName !== 'input') continue;
    const input = element as HTMLInputElement;
    if (input.type !== 'radio' || input.name === '') continue;
    const root = input.getRootNode();
    let byForm = byRoot.get(root);
    if (!byForm) {
      byForm = new Map();
      byRoot.set(root, byForm);
    }
    let byName = byForm.get(input.form);
    if (!byName) {
      byName = new Map();
      byForm.set(input.form, byName);
    }
    const group = byName.get(input.name);
    if (group) {
      if (input.checked && !group.checked) group.checked = input;
    } else {
      byName.set(input.name, { checked: input.checked ? input : undefined, first: input });
    }
  }
  const tabStops = new Set<HTMLInputElement>();
  for (const byForm of byRoot.values()) {
    for (const byName of byForm.values()) {
      for (const group of byName.values()) tabStops.add(group.checked ?? group.first);
    }
  }
  return elements.filter((element) => {
    if (!isHtmlElement(element) || element.localName !== 'input') return true;
    const input = element as HTMLInputElement;
    return input.type !== 'radio' || input.name === '' || tabStops.has(input);
  });
}

function navigationEntryTabIndex(entry: NavigationScopeEntry): number {
  return entry.target && entry.target.tabIndex > 0 ? entry.target.tabIndex : 0;
}

function flattenNavigationScope(
  scope: NavigationScope,
  mode: ComposedFocusMode,
  retainedTargets: ReadonlySet<BrowserFocusElement>,
): BrowserFocusElement[] {
  const orderedEntries = (candidate: NavigationScope): readonly NavigationScopeEntry[] =>
    mode === 'tabbable'
      ? [...candidate.entries].sort((first, second) => {
          const firstTabIndex = navigationEntryTabIndex(first);
          const secondTabIndex = navigationEntryTabIndex(second);
          if ((firstTabIndex > 0) !== (secondTabIndex > 0)) return firstTabIndex > 0 ? -1 : 1;
          if (firstTabIndex > 0 && firstTabIndex !== secondTabIndex) {
            return firstTabIndex - secondTabIndex;
          }
          return first.order - second.order;
        })
      : candidate.entries;

  type FlattenWork =
    | { kind: 'scope'; scope: NavigationScope }
    | { kind: 'target'; target: BrowserFocusElement };
  const flattened: BrowserFocusElement[] = [];
  const work: FlattenWork[] = [{ kind: 'scope', scope }];
  while (work.length > 0) {
    const current = work.pop()!;
    if (current.kind === 'target') {
      flattened.push(current.target);
      continue;
    }
    const entries = orderedEntries(current.scope);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]!;
      if (
        entry.childScope &&
        (mode !== 'tabbable' || !entry.suppressSequentialDescendants)
      ) {
        work.push({ kind: 'scope', scope: entry.childScope });
      }
      if (
        entry.target &&
        retainedTargets.has(entry.target) &&
        !entry.delegatesFocus
      ) {
        work.push({ kind: 'target', target: entry.target });
      }
    }
  }
  return flattened;
}

/**
 * Iteratively collects composed focus targets with a shared depth/node budget. Programmatic mode
 * retains native and ARIA-managed actions after a roving owner assigns `tabindex=-1`; tabbable mode
 * models sequential browser order, including one stop per native radio group.
 */
export function collectComposedFocusTargets(
  root: Element | ShadowRoot,
  options: ComposedFocusCollectionOptions = {},
): ComposedFocusCollectionResult {
  const mode = options.mode ?? 'tabbable';
  const traversed = traverseComposedElements(root, options, (candidate, available, state, context) => {
    if (!available || !isBrowserFocusElement(candidate) || candidate.matches(':disabled')) return false;
    if (!isRenderedFocusCandidate(context, candidate, state)) return false;
    if (mode === 'programmatic') return candidate.hasAttribute('tabindex') || isActionableElement(candidate);
    return (candidate.hasAttribute('tabindex') || isActionableElement(candidate)) && isTabbableCandidate(candidate);
  });
  const included = traversed.elements.filter(isBrowserFocusElement);
  const retained = new Set(included);
  // Keep the established HTMLElement[] surface for internal consumers. SVG anchors share the
  // focus()/tabIndex/id contract at runtime and are intentionally included in this browser-order
  // result even though lib.dom models them under SVGElement rather than HTMLElement.
  const orderedElements = flattenNavigationScope(
    traversed.navigationScope,
    mode,
    retained,
  );
  const elements = (mode === 'tabbable'
    ? collapseRadioGroups(orderedElements)
    : orderedElements) as HTMLElement[];
  return {
    elements,
    truncated: traversed.reasons.size > 0,
    truncationReasons: [...traversed.reasons],
    visitedElements: traversed.visitedElements,
  };
}

/** Internal companion used by overlay autofocus delegation with the same bounded traversal. */
export function collectComposedAutofocusElements(
  root: Element | ShadowRoot,
  options: Omit<ComposedFocusCollectionOptions, 'mode'> = {},
): ComposedFocusCollectionResult {
  const traversed = traverseComposedElements(root, options, (element, available) =>
    available && isHtmlElement(element) && element.hasAttribute('autofocus'));
  return {
    elements: traversed.elements as HTMLElement[],
    truncated: traversed.reasons.size > 0,
    truncationReasons: [...traversed.reasons],
    visitedElements: traversed.visitedElements,
  };
}
