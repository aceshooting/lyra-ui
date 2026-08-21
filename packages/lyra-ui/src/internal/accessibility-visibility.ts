import { composedParentElement } from './active-element.js';
import { asciiWhitespaceTokens } from './ascii-whitespace.js';
import { imageMapImageFor } from './dom-guards.js';

export { composedParentElement } from './active-element.js';

const NON_CONTENT_ELEMENTS = new Set(['script', 'style', 'template']);
const DEFAULT_ACCESSIBILITY_TEXT_MAX_CHARACTERS = 4_096;
const DEFAULT_ACCESSIBILITY_TEXT_MAX_DEPTH = 256;
const DEFAULT_ACCESSIBILITY_TEXT_MAX_NODES = 4_096;
const DEFAULT_ACCESSIBILITY_VISIBILITY_MAX_NODES = 512;
const MAX_CONFIGURED_ACCESSIBILITY_TEXT_LIMIT = 100_000;

type AccessibilityTextTruncationReason = 'ancestors' | 'characters' | 'depth' | 'nodes';

export interface ComposedAccessibilityTextOptions {
  /** Whether a top-level Text node starts visible. Element visibility is resolved from CSS. */
  inheritedTextVisible?: boolean;
  /** Total UTF-16 code-unit ceiling shared by every supplied root. */
  maxCharacters?: number;
  /** Maximum composed descendant depth. */
  maxDepth?: number;
  /** Total node-work ceiling shared by every supplied root and ARIA reference. */
  maxNodes?: number;
  /** Additional consumer-specific pruning, such as excluding actions from a toast message. */
  shouldPrune?: (element: Element) => boolean;
  /** Additional pruning that can also reject externally assigned Text nodes. */
  shouldPruneNode?: (node: Node) => boolean;
  /** Replaces the ordinary own-subtree exclusion predicate for presentation-owned fences. */
  isSubtreeExcluded?: (element: Element) => boolean;
  /** Stops initial composed-ancestor validation after this boundary is validated. */
  ancestorBoundary?: Element | null;
  /** Whether connected candidates must participate in rendered layout. Defaults to true. */
  requireRendered?: boolean;
  /** Skips composed-ancestor validation for supplied roots; their own authored state still applies. */
  skipRootAncestorValidation?: boolean;
}

export interface ComposedAccessibilityTextResult {
  labelReferenceRoots: ReadonlySet<Document | ShadowRoot>;
  referencedElements: ReadonlySet<Element>;
  text: string;
  /** Open roots actually entered by the bounded walk, suitable for live-text observation. */
  traversedShadowRoots: ReadonlySet<ShadowRoot>;
  truncated: boolean;
  truncationReasons: readonly AccessibilityTextTruncationReason[];
  visitedNodes: number;
}

interface AccessibilityElementState {
  display: string | undefined;
  subtreeExcluded: boolean;
  visibilityHidden: boolean;
}

/** `aria-hidden` is an ASCII case-insensitive true/false token in HTML. */
export function isAriaTrue(value: string | null): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function accessibilityElementState(
  element: Element,
  imageMapImage: HTMLImageElement | null = imageMapImageFor(element),
): AccessibilityElementState {
  let rendered: CSSStyleDeclaration | undefined;
  try {
    rendered = element.ownerDocument.defaultView?.getComputedStyle(element);
  } catch {
    // Detached/server realms may not expose computed style. Authored state remains authoritative.
  }
  const visibility = rendered?.visibility;
  return {
    display: rendered?.display,
    subtreeExcluded:
      element.hasAttribute('hidden') ||
      element.hasAttribute('inert') ||
      isAriaTrue(element.getAttribute('aria-hidden')) ||
      (!imageMapImage && (rendered?.display === 'none' || rendered?.contentVisibility === 'hidden')),
    visibilityHidden: visibility === 'hidden' || visibility === 'collapse',
  };
}

/**
 * Whether an element's authored or rendered state prunes it and all descendants from accessibility.
 * `aria-hidden` is an ASCII case-insensitive token, and rendered styles always come from the
 * element's owner realm.
 */
export function isAccessibilitySubtreeExcluded(element: Element): boolean {
  return accessibilityElementState(element).subtreeExcluded;
}

/** Whether an element's own text is visibility-hidden; descendants may override this in CSS. */
export function isAccessibilityVisibilityHidden(element: Element): boolean {
  return accessibilityElementState(element).visibilityHidden;
}

/** Whether an element itself is excluded; use the subtree predicate when recursively extracting. */
export function isAccessibilityExcluded(element: Element): boolean {
  return isAccessibilitySubtreeExcluded(element) || isAccessibilityVisibilityHidden(element);
}

/** Attributes on a content node that can change the accessible text it contributes. */
const CONTENT_NODE_ATTRIBUTES = [
  'alt',
  'aria-hidden',
  'aria-label',
  'aria-labelledby',
  'class',
  'hidden',
  'id',
  'inert',
  'open',
  'style',
];
/** The subset of the above that matters on a composed *ancestor*: an ancestor cannot lend the
 *  subtree its own `aria-label`, it can only hide or reveal it. */
const ANCESTOR_ATTRIBUTES = ['aria-hidden', 'class', 'hidden', 'inert', 'open', 'style'];

function observeAccessibleTextNode(
  observer: MutationObserver,
  node: Node,
  extraAttributes: readonly string[],
): void {
  if (node.nodeType === 3) {
    observer.observe(node, { characterData: true });
    return;
  }
  if (node.nodeType !== 1) return;
  observer.observe(node, {
    attributes: true,
    attributeFilter: [...new Set([...CONTENT_NODE_ATTRIBUTES, ...extraAttributes])],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

/**
 * Observes a host's label content, assigned nodes, and composed ancestors for accessible text.
 *
 * `extraAttributes` widens the *content-node* filter only (never the ancestor filter, which cannot
 * lend a subtree its own name and only hides or reveals it). A component whose label text is drawn
 * from one specific slot -- `<lr-chip>` and `<lr-tag>` both read the default slot and deliberately
 * exclude the decorative `icon`/`start`/`end` ones -- passes `'slot'`, so a light-DOM child's own
 * slot reassignment is a second, independent trigger alongside the `slotchange` those components
 * also listen for. Components whose accessible text does not depend on slot assignment pass nothing
 * and keep the narrower filter, so widening it here changes nothing for them.
 */
export function bindAccessibleTextObserver(
  observer: MutationObserver | undefined,
  host: Element,
  extraAttributes: readonly string[] = [],
): void {
  if (!observer) return;
  observer.disconnect();
  observeAccessibleTextNode(observer, host, extraAttributes);
  let ancestor = composedParentElement(host);
  while (ancestor) {
    observer.observe(ancestor, { attributes: true, attributeFilter: ANCESTOR_ATTRIBUTES });
    ancestor = composedParentElement(ancestor);
  }
  for (const slot of host.querySelectorAll<HTMLSlotElement>('slot')) {
    for (const assigned of slot.assignedNodes({ flatten: true })) {
      observeAccessibleTextNode(observer, assigned, extraAttributes);
    }
  }
}

/** Extracts accessible, visible text through slots while respecting exclusion and visibility state. */
function finiteTextLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_CONFIGURED_ACCESSIBILITY_TEXT_LIMIT, Math.max(0, Math.floor(value!)));
}

function isNodeValue(value: unknown): value is Node {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  try {
    return typeof (value as Node).nodeType === 'number' && typeof (value as Node).getRootNode === 'function';
  } catch {
    return false;
  }
}

type TextWork =
  | { kind: 'text'; value: string }
  | {
      available: boolean;
      depth: number;
      index: number;
      inheritedTextVisible: boolean;
      kind: 'nodes';
      nodes: ArrayLike<Node>;
      referenced: boolean;
    }
  | {
      available: boolean;
      candidates: ArrayLike<Node>;
      depth: number;
      fallback: ArrayLike<Node>;
      foundAssigned: boolean;
      index: number;
      inheritedTextVisible: boolean;
      kind: 'slot';
      referenced: boolean;
      slot: HTMLSlotElement;
    }
  | {
      available: boolean;
      depth: number;
      inheritedTextVisible: boolean;
      kind: 'node';
      node: Node;
      referenced: boolean;
      workCharged?: boolean;
    };

interface AccessibilityTextContext {
  ancestorBoundary: Element | null;
  elementStates: Map<Element, AccessibilityElementState>;
  excludedElements: Map<Element, boolean>;
  isSubtreeExcluded?: (element: Element) => boolean;
  imageMapImages: Map<Element, HTMLImageElement | null>;
  labelReferenceRoots: Set<Document | ShadowRoot>;
  maxCharacters: number;
  maxDepth: number;
  maxNodes: number;
  output: string[];
  outputLength: number;
  reasons: Set<AccessibilityTextTruncationReason>;
  referencedElements: Set<Element>;
  requireRendered: boolean;
  shouldPrune?: (element: Element) => boolean;
  shouldPruneNode?: (node: Node) => boolean;
  stack: TextWork[];
  traversedShadowRoots: Set<ShadowRoot>;
  visited: Set<Node>;
  visitedNodes: number;
  workUnits: number;
}

function consumeNodeWork(context: AccessibilityTextContext): boolean {
  if (context.workUnits >= context.maxNodes) {
    context.reasons.add('nodes');
    return false;
  }
  context.workUnits += 1;
  return true;
}

function cachedElementState(
  context: AccessibilityTextContext,
  element: Element,
): AccessibilityElementState {
  let state = context.elementStates.get(element);
  if (!state) {
    state = accessibilityElementState(element, cachedImageMapImage(context, element));
    context.elementStates.set(element, state);
  }
  return state;
}

function cachedImageMapImage(
  context: AccessibilityTextContext,
  element: Element,
): HTMLImageElement | null {
  if (context.imageMapImages.has(element)) return context.imageMapImages.get(element)!;
  const image = imageMapImageFor(element, { consume: () => consumeNodeWork(context) });
  context.imageMapImages.set(element, image);
  return image;
}

function cachedSubtreeExcluded(context: AccessibilityTextContext, element: Element): boolean {
  if (context.excludedElements.has(element)) return context.excludedElements.get(element)!;
  const excluded = context.isSubtreeExcluded
    ? context.isSubtreeExcluded(element)
    : cachedElementState(context, element).subtreeExcluded;
  context.excludedElements.set(element, excluded);
  return excluded;
}

function addLabelReferenceRoot(context: AccessibilityTextContext, node: Node): void {
  const root = node.getRootNode();
  if (root.nodeType === 9 || (root.nodeType === 11 && 'host' in root)) {
    context.labelReferenceRoots.add(root as Document | ShadowRoot);
  }
}

function appendBoundedText(context: AccessibilityTextContext, value: string): void {
  if (value === '') return;
  if (context.outputLength >= context.maxCharacters) {
    context.reasons.add('characters');
    context.stack.length = 0;
    return;
  }
  const remaining = context.maxCharacters - context.outputLength;
  if (value.length > remaining) {
    context.output.push(value.slice(0, remaining));
    context.outputLength += remaining;
    context.reasons.add('characters');
    context.stack.length = 0;
    return;
  }
  context.output.push(value);
  context.outputLength += value.length;
}

interface ComposedAncestorState {
  available: boolean;
  inheritedTextVisible: boolean;
}

function composedAncestorState(
  context: AccessibilityTextContext,
  node: Node,
): ComposedAncestorState {
  const slottable = node as Node & { assignedSlot?: HTMLSlotElement | null };
  let branch: Element | null = node.nodeType === 1
    ? node as Element
    : slottable.assignedSlot ?? node.parentElement;
  let ancestor =
    node.nodeType === 1
      ? composedParentElement(node as Element)
      : slottable.assignedSlot ?? node.parentElement;
  let depth = 0;
  let inheritedTextVisible = true;
  let firstAncestor = true;
  while (ancestor) {
    if (!consumeNodeWork(context)) return { available: false, inheritedTextVisible };
    const state = cachedElementState(context, ancestor);
    if (firstAncestor) {
      inheritedTextVisible = !state.visibilityHidden;
      firstAncestor = false;
    }
    const excluded = cachedSubtreeExcluded(context, ancestor);
    if (excluded || isClosedDetailsContentBranchBounded(context, ancestor, branch)) {
      return { available: false, inheritedTextVisible };
    }
    if (ancestor === context.ancestorBoundary) return { available: true, inheritedTextVisible };
    depth += 1;
    if (depth > context.maxDepth) {
      context.reasons.add('ancestors');
      return { available: false, inheritedTextVisible };
    }
    branch = ancestor;
    ancestor = composedParentElement(ancestor);
  }
  return { available: true, inheritedTextVisible };
}

function scheduleNode(
  context: AccessibilityTextContext,
  node: Node,
  depth: number,
  inheritedTextVisible: boolean,
  referenced: boolean,
  available: boolean,
  workCharged = false,
): boolean {
  if (depth > context.maxDepth) {
    context.reasons.add('depth');
    return false;
  }
  context.stack.push({
    available,
    depth,
    inheritedTextVisible,
    kind: 'node',
    node,
    referenced,
    workCharged,
  });
  return true;
}

function scheduleNodeList(
  context: AccessibilityTextContext,
  nodes: ArrayLike<Node>,
  depth: number,
  inheritedTextVisible: boolean,
  referenced: boolean,
  available: boolean,
): void {
  if (nodes.length === 0) return;
  if (depth > context.maxDepth) {
    context.reasons.add('depth');
    return;
  }
  // A lazy sibling cursor preserves composed pre-order under a tight budget. Eagerly reserving one
  // node for every sibling can otherwise starve the first sibling's text descendants and return an
  // empty/non-prefix projection from a wide label.
  context.stack.push({
    available,
    depth,
    index: 0,
    inheritedTextVisible,
    kind: 'nodes',
    nodes,
    referenced,
  });
}

function scheduleRenderedChildNodes(
  context: AccessibilityTextContext,
  element: Element,
  depth: number,
  inheritedTextVisible: boolean,
  referenced: boolean,
  available: boolean,
): void {
  if (element.localName === 'slot') {
    const slot = element as HTMLSlotElement;
    const root = slot.getRootNode();
    const candidates = root.nodeType === 11 && 'host' in root
      ? (root as ShadowRoot).host.childNodes
      : [];
    if (depth > context.maxDepth) {
      if (candidates.length > 0 || slot.childNodes.length > 0) context.reasons.add('depth');
      return;
    }
    context.stack.push({
      available,
      candidates,
      depth,
      fallback: slot.childNodes,
      foundAssigned: false,
      index: 0,
      inheritedTextVisible,
      kind: 'slot',
      referenced,
      slot,
    });
    return;
  }
  if (element.localName === 'details' && !element.hasAttribute('open')) {
    for (const child of element.children) {
      if (!consumeNodeWork(context)) return;
      if (child.localName === 'summary') {
        scheduleNode(
          context,
          child,
          depth,
          inheritedTextVisible,
          referenced,
          available,
          true,
        );
        return;
      }
    }
    return;
  }
  const shadowRoot = element.shadowRoot;
  const childNodes = shadowRoot?.childNodes ?? element.childNodes;
  // Empty open roots still need observation so later inserted accessible text is detected. A
  // non-empty root beyond the depth ceiling was not entered and must not broaden observation.
  if (shadowRoot && (childNodes.length === 0 || depth <= context.maxDepth)) {
    context.traversedShadowRoots.add(shadowRoot);
  }
  scheduleNodeList(
    context,
    childNodes,
    depth,
    inheritedTextVisible,
    referenced,
    available,
  );
}

interface LabelledByResult {
  authoritative: boolean;
  elements: Element[];
}

function labelledByElements(
  context: AccessibilityTextContext,
  element: Element,
): LabelledByResult {
  const value = element.getAttribute('aria-labelledby');
  if (value === null) return { authoritative: false, elements: [] };
  addLabelReferenceRoot(context, element);
  const root = element.getRootNode() as Document | ShadowRoot;
  const canResolveSerialized = typeof root.getElementById === 'function';

  const serializedReferences: Element[] = [];
  let sawSerializedToken = false;
  for (const id of asciiWhitespaceTokens(value, () => consumeNodeWork(context))) {
    sawSerializedToken = true;
    if (!consumeNodeWork(context)) return { authoritative: true, elements: serializedReferences };
    const reference = canResolveSerialized ? root.getElementById(id) : null;
    if (reference) serializedReferences.push(reference);
  }
  // A non-empty serialized relationship is resolved token-by-token so the browser's reflected
  // getter cannot first allocate every referenced element outside the caller's remaining budget.
  if (sawSerializedToken) {
    return { authoritative: serializedReferences.length > 0, elements: serializedReferences };
  }

  // An assigned element-reference relationship serializes as an empty attribute. Do not invoke its
  // potentially materializing getter after the caller has exhausted the shared work ceiling.
  if (context.workUnits >= context.maxNodes || !consumeNodeWork(context)) {
    context.reasons.add('nodes');
    return { authoritative: true, elements: [] };
  }
  // Leave at least one unit for the first returned relationship before invoking a getter whose
  // native FrozenArray result is necessarily created as one value.
  if (context.workUnits >= context.maxNodes) {
    context.reasons.add('nodes');
    return { authoritative: true, elements: [] };
  }
  try {
    const ElementConstructor = element.ownerDocument.defaultView?.Element;
    const descriptor = ElementConstructor
      ? Object.getOwnPropertyDescriptor(ElementConstructor.prototype, 'ariaLabelledByElements')
      : undefined;
    const reflected = typeof descriptor?.get === 'function'
      ? descriptor.get.call(element) as readonly Element[] | null | undefined
      : undefined;
    if (reflected?.length) {
      const result: Element[] = [];
      for (let index = 0; index < reflected.length; index += 1) {
        if (!consumeNodeWork(context)) break;
        const reference = reflected[index];
        if (!reference || reference.nodeType !== 1) continue;
        result.push(reference);
        addLabelReferenceRoot(context, reference);
      }
      return { authoritative: true, elements: result };
    }
  } catch {
    // An overridden reflected getter is consumer code. An empty serialized relationship has no
    // usable fallback references.
  }
  return { authoritative: false, elements: [] };
}

function isRenderedAccessibilityBranch(
  context: AccessibilityTextContext,
  element: Element,
  display: string | undefined,
): boolean {
  const imageMapImage = cachedImageMapImage(context, element);
  if (imageMapImage) {
    return isRenderedAccessibilityBranch(
      context,
      imageMapImage,
      cachedElementState(context, imageMapImage).display,
    );
  }
  if (!element.isConnected || display === 'contents') return true;
  const candidate = element as Element & {
    checkVisibility?: (options?: { contentVisibilityAuto?: boolean }) => boolean;
  };
  if (typeof candidate.checkVisibility !== 'function') return true;
  try {
    return candidate.checkVisibility({ contentVisibilityAuto: true });
  } catch {
    return false;
  }
}

function processAccessibilityTextWork(context: AccessibilityTextContext): void {
  while (context.stack.length > 0) {
    const work = context.stack.pop()!;
    if (work.kind === 'text') {
      appendBoundedText(context, work.value);
      continue;
    }
    if (work.kind === 'slot') {
      if (work.index >= work.candidates.length) {
        if (!work.foundAssigned) {
          scheduleNodeList(
            context,
            work.fallback,
            work.depth,
            work.inheritedTextVisible,
            work.referenced,
            work.available,
          );
        }
        continue;
      }
      if (!consumeNodeWork(context)) {
        context.stack.length = 0;
        break;
      }
      const node = work.candidates[work.index];
      const assigned = Boolean(node && (node as Node & { assignedSlot?: HTMLSlotElement | null }).assignedSlot === work.slot);
      context.stack.push({
        ...work,
        foundAssigned: work.foundAssigned || assigned,
        index: work.index + 1,
      });
      if (node && assigned) {
        scheduleNode(
          context,
          node,
          work.depth,
          work.inheritedTextVisible,
          work.referenced,
          work.available,
          true,
        );
        if (work.foundAssigned) context.stack.push({ kind: 'text', value: ' ' });
      }
      continue;
    }
    if (work.kind === 'nodes') {
      if (work.index >= work.nodes.length) continue;
      const node = work.nodes[work.index];
      if (!node) continue;
      context.stack.push({ ...work, index: work.index + 1 });
      scheduleNode(
        context,
        node,
        work.depth,
        work.inheritedTextVisible,
        work.referenced,
        work.available,
      );
      if (work.index > 0) context.stack.push({ kind: 'text', value: ' ' });
      continue;
    }
    if (context.visited.has(work.node)) continue;
    if (!work.workCharged && !consumeNodeWork(context)) {
      context.stack.length = 0;
      break;
    }
    context.visited.add(work.node);
    context.visitedNodes += 1;
    if (!work.referenced && context.shouldPruneNode?.(work.node)) continue;

    if (work.node.nodeType === 3) {
      if (work.referenced || (work.available && work.inheritedTextVisible)) {
        appendBoundedText(context, work.node.textContent ?? '');
      }
      continue;
    }
    if (work.node.nodeType === 11) {
      if ('host' in work.node) context.traversedShadowRoots.add(work.node as ShadowRoot);
      scheduleNodeList(
        context,
        work.node.childNodes,
        work.depth + 1,
        work.inheritedTextVisible,
        work.referenced,
        work.available,
      );
      continue;
    }
    if (work.node.nodeType !== 1) continue;

    const element = work.node as Element;
    if (NON_CONTENT_ELEMENTS.has(element.localName) || context.shouldPrune?.(element)) continue;
    const state = cachedElementState(context, element);
    const excluded = cachedSubtreeExcluded(context, element);
    const available = work.referenced || (work.available && !excluded);
    if (!available) continue;
    if (
      !work.referenced &&
      context.requireRendered &&
      !isRenderedAccessibilityBranch(context, element, state.display)
    ) continue;
    const ownTextVisible = work.referenced || !state.visibilityHidden;

    const labelledBy = ownTextVisible
      ? labelledByElements(context, element)
      : { authoritative: false, elements: [] };
    if (labelledBy.elements.length > 0) {
      for (const reference of labelledBy.elements) context.referencedElements.add(reference);
      scheduleNodeList(
        context,
        labelledBy.elements,
        work.depth + 1,
        true,
        true,
        true,
      );
      continue;
    }
    if (labelledBy.authoritative) continue;

    const ariaLabel = ownTextVisible ? element.getAttribute('aria-label') : null;
    if (ariaLabel?.trim()) {
      appendBoundedText(context, ariaLabel.trim());
      continue;
    }
    if (ownTextVisible && (element.localName === 'img' || element.localName === 'area')) {
      const alt = element.getAttribute('alt');
      if (alt?.trim()) {
        appendBoundedText(context, alt.trim());
        continue;
      }
    }

    scheduleRenderedChildNodes(
      context,
      element,
      work.depth + 1,
      ownTextVisible,
      work.referenced,
      available,
    );
  }
}

function normalizedTextOptions(
  options: boolean | ComposedAccessibilityTextOptions | undefined,
): Required<Pick<ComposedAccessibilityTextOptions, 'inheritedTextVisible' | 'maxCharacters' | 'maxDepth' | 'maxNodes'>> &
  Omit<ComposedAccessibilityTextOptions, 'inheritedTextVisible' | 'maxCharacters' | 'maxDepth' | 'maxNodes'> {
  const resolved = typeof options === 'boolean' ? { inheritedTextVisible: options } : options ?? {};
  return {
    ...resolved,
    inheritedTextVisible: resolved.inheritedTextVisible ?? true,
    maxCharacters: finiteTextLimit(resolved.maxCharacters, DEFAULT_ACCESSIBILITY_TEXT_MAX_CHARACTERS),
    maxDepth: finiteTextLimit(resolved.maxDepth, DEFAULT_ACCESSIBILITY_TEXT_MAX_DEPTH),
    maxNodes: finiteTextLimit(resolved.maxNodes, DEFAULT_ACCESSIBILITY_TEXT_MAX_NODES),
  };
}

/**
 * Iteratively extracts a bounded accessible name/text projection through slots and open shadow
 * roots. The result reports every ceiling it reached so authoritative-name, announcement and
 * typeahead consumers can degrade deliberately instead of treating a silent prefix as complete.
 */
export function composedAccessibilityTextResult(
  input: Node | Iterable<Node>,
  options?: boolean | ComposedAccessibilityTextOptions,
): ComposedAccessibilityTextResult {
  const resolved = normalizedTextOptions(options);
  const context: AccessibilityTextContext = {
    ancestorBoundary: resolved.ancestorBoundary ?? null,
    elementStates: new Map<Element, AccessibilityElementState>(),
    excludedElements: new Map<Element, boolean>(),
    imageMapImages: new Map<Element, HTMLImageElement | null>(),
    isSubtreeExcluded: resolved.isSubtreeExcluded,
    labelReferenceRoots: new Set<Document | ShadowRoot>(),
    maxCharacters: resolved.maxCharacters,
    maxDepth: resolved.maxDepth,
    maxNodes: resolved.maxNodes,
    output: [],
    outputLength: 0,
    reasons: new Set<AccessibilityTextTruncationReason>(),
    referencedElements: new Set<Element>(),
    requireRendered: resolved.requireRendered !== false,
    shouldPrune: resolved.shouldPrune,
    shouldPruneNode: resolved.shouldPruneNode,
    stack: [],
    traversedShadowRoots: new Set<ShadowRoot>(),
    visited: new Set<Node>(),
    visitedNodes: 0,
    workUnits: 0,
  };

  if (context.maxNodes === 0) {
    context.reasons.add('nodes');
    return {
      labelReferenceRoots: context.labelReferenceRoots,
      referencedElements: context.referencedElements,
      text: '',
      traversedShadowRoots: context.traversedShadowRoots,
      truncated: true,
      truncationReasons: [...context.reasons],
      visitedNodes: 0,
    };
  }

  const roots: Iterable<Node> = isNodeValue(input) ? [input] : input;
  let rootCount = 0;
  for (const root of roots) {
    if (!isNodeValue(root)) continue;
    if (context.workUnits >= context.maxNodes) {
      context.reasons.add('nodes');
      break;
    }
    if (rootCount > 0) appendBoundedText(context, ' ');
    if (context.reasons.has('characters')) break;
    const ancestorState = resolved.skipRootAncestorValidation
      ? { available: true, inheritedTextVisible: true }
      : composedAncestorState(context, root);
    scheduleNode(
      context,
      root,
      0,
      resolved.inheritedTextVisible && ancestorState.inheritedTextVisible,
      false,
      ancestorState.available,
    );
    processAccessibilityTextWork(context);
    rootCount += 1;
    if (context.reasons.has('characters')) break;
    if (context.reasons.has('nodes') && context.workUnits >= context.maxNodes) break;
  }

  return {
    labelReferenceRoots: context.labelReferenceRoots,
    referencedElements: context.referencedElements,
    text: context.output.join(''),
    traversedShadowRoots: context.traversedShadowRoots,
    truncated: context.reasons.size > 0,
    truncationReasons: [...context.reasons],
    visitedNodes: context.visitedNodes,
  };
}

export function composedAccessibilityText(
  input: Node | Iterable<Node>,
  options?: boolean | ComposedAccessibilityTextOptions,
): string {
  return composedAccessibilityTextResult(input, options).text;
}

/** Compatibility name used by progress/chip/spinner label projections. */
export function composedAccessibleVisibleText(node: Node): string {
  return composedAccessibilityText(node);
}

/** Whether `branch` is pruned as non-summary content of a closed native details element. */
function isClosedDetailsContentBranchWithin(
  details: Element,
  branch: Element | null,
  consume: () => boolean,
): boolean {
  if (details.localName !== 'details' || details.hasAttribute('open') || branch === null) return false;

  let summary: Element | null = null;
  for (const child of details.children) {
    if (!consume()) return true;
    if (child.localName === 'summary') {
      summary = child;
      break;
    }
  }
  return branch !== summary;
}

function isClosedDetailsContentBranchBounded(
  context: AccessibilityTextContext,
  details: Element,
  branch: Element | null,
): boolean {
  if (details.localName !== 'details' || details.hasAttribute('open') || branch === null) return false;
  for (const child of details.children) {
    if (!consumeNodeWork(context)) return true;
    if (child.localName === 'summary') return child !== branch;
  }
  return true;
}

/**
 * Whether an element is connected and exposed by its own state and every composed ancestor.
 *
 * Document-level live regions do not inherit visibility from the component that publishes into
 * them. Announcement producers use this before writing to a shared sink. `ignorePresentation`
 * only skips a known component-owned, non-semantic presentation fence; it must not select
 * author-provided content.
 */
export function isAccessibilityVisible(
  element: Element,
  options: {
    ignorePresentation?: (candidate: Element) => boolean;
    maxDepth?: number;
    maxNodes?: number;
  } = {},
): boolean {
  if (!element.isConnected) return false;

  const maxDepth = finiteTextLimit(options.maxDepth, DEFAULT_ACCESSIBILITY_TEXT_MAX_DEPTH);
  const maxNodes = finiteTextLimit(options.maxNodes, DEFAULT_ACCESSIBILITY_VISIBILITY_MAX_NODES);
  let workUnits = 0;
  const consume = (): boolean => {
    if (workUnits >= maxNodes) return false;
    workUnits += 1;
    return true;
  };
  let current: Element | null = element;
  let composedChild: Element | null = null;
  let depth = 0;
  let targetState: AccessibilityElementState | undefined;
  let renderedSource: Element = element;
  while (current) {
    if (depth > maxDepth || !consume()) return false;
    const imageMapImage = imageMapImageFor(current, { consume });
    const state = accessibilityElementState(
      current,
      imageMapImage,
    );
    if (current === element) {
      targetState = state;
      renderedSource = imageMapImage ?? element;
    }
    if (!options.ignorePresentation?.(current)) {
      if (state.subtreeExcluded) return false;
      if (isClosedDetailsContentBranchWithin(current, composedChild, consume)) return false;
      if (current === element && state.visibilityHidden) return false;
    }
    composedChild = current;
    current = composedParentElement(current);
    depth += 1;
  }

  // An area/map has no independent rendered box on every engine. Its accessibility exposure is
  // tied to the associated image, whose own authored/composed branch must still be validated.
  if (renderedSource !== element) {
    current = renderedSource;
    composedChild = null;
    depth = 0;
    while (current) {
      if (depth > maxDepth || !consume()) return false;
      const state = accessibilityElementState(
        current,
        imageMapImageFor(current, { consume }),
      );
      if (current === renderedSource) targetState = state;
      if (!options.ignorePresentation?.(current)) {
        if (state.subtreeExcluded) return false;
        if (isClosedDetailsContentBranchWithin(current, composedChild, consume)) return false;
        if (current === renderedSource && state.visibilityHidden) return false;
      }
      composedChild = current;
      current = composedParentElement(current);
      depth += 1;
    }
  }

  const targetDisplay = targetState?.display;
  // Browsers report every `display: contents` element as false from `checkVisibility()` because it
  // owns no CSS box, even when its semantic role is present in the accessibility tree. The
  // authored/CSS ancestor walk above (including closed-details branches) is the strongest
  // portable distinction available for that case. In particular, a skipped
  // `content-visibility:auto` subtree is only observable through `checkVisibility()` when the
  // queried source generates a box.
  if (targetDisplay === 'contents') return true;

  const visibilityTarget = renderedSource as Element & {
    checkVisibility?: (options?: { contentVisibilityAuto?: boolean }) => boolean;
  };
  if (!consume()) return false;
  try {
    return typeof visibilityTarget.checkVisibility === 'function'
      ? visibilityTarget.checkVisibility({ contentVisibilityAuto: true })
      : true;
  } catch {
    return false;
  }
}
