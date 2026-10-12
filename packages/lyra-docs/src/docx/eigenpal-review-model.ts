import type { ReviewModelInput, ReviewItem, ReviewRevisionItem, ReviewCommentItem } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode, OoxmlPart } from '@docx-editor.dev/core/store';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const REVIEW_MODEL_LIMITS = Object.freeze({ nodes: 30000, characters: 1000000, depth: 64, parts: 64, items: 1000 });
type Limits = typeof REVIEW_MODEL_LIMITS;
export type EigenpalReviewDependencies = Pick<typeof import('@docx-editor.dev/core/store'),
  'collectReviewItems' | 'collectRevisionSites' | 'commentsOfPart' | 'commentAnchorsOfStory' | 'threadStateOfPart' |
  'commentBodyText' | 'reviewItemKey' | 'commentPartNameOf' | 'commentsExtendedPartNameOf' | 'stylesPartOf'>;
interface Scan {
  readonly parents: ReadonlyMap<OoxmlNode, OoxmlElement | null>;
}
export interface LyraReviewDerivation {
  readonly items: readonly ReviewItem[];
  readonly truncated: boolean;
  readonly trackingSupported: boolean;
  readonly hasUnsupported: boolean;
}
const refused: LyraReviewDerivation = Object.freeze({ items: Object.freeze([]), truncated: true, trackingSupported: false, hasUnsupported: true });

function attribute(node: OoxmlElement, name: string): string | undefined {
  return node.attributes.find(attribute => attribute.namespaceUri === W && attribute.localName === name)?.value;
}
function identity(part: OoxmlPart, node: OoxmlElement): string {
  return JSON.stringify([part.name, attribute(node, 'id'), attribute(node, 'author'), attribute(node, 'date')]);
}
function element(node: OoxmlNode, name: string): boolean {
  return node.kind !== 'textValue' && node.namespaceUri === W && node.localName === name;
}

/** Bound the complete input before calling public store readers, including comments and styles. */
function scan(parts: readonly OoxmlPart[], limits: Limits): Scan | null {
  if (parts.length > limits.parts) return null;
  let nodes = 0, characters = 0;
  const parents = new Map<OoxmlNode, OoxmlElement | null>();
  for (const part of parts) {
    const stack: { node: OoxmlNode; parent: OoxmlElement | null; depth: number }[] = [{ node: part.root, parent: null, depth: 0 }];
    while (stack.length) {
      const { node, parent, depth } = stack.pop()!;
      if (++nodes > limits.nodes || depth > limits.depth || parents.has(node)) return null;
      parents.set(node, parent);
      if (node.kind === 'textValue') characters += node.value.length;
      else {
        if (node.children.length > limits.nodes - nodes || node.attributes.length > limits.nodes) return null;
        for (const a of node.attributes) characters += a.value.length;
        for (let index = node.children.length - 1; index >= 0; index--) stack.push({ node: node.children[index]!, parent: node, depth: depth + 1 });
      }
      if (characters > limits.characters) return null;
    }
  }
  return { parents };
}

function simpleRun(node: OoxmlNode): boolean {
  return node.kind !== 'textValue' && element(node, 'r') && node.children.every(child => element(child, 'rPr') ||
    (child.kind !== 'textValue' && ['t', 'delText', 'tab', 'br'].some(name => element(child, name)) && child.children.every(text => text.kind === 'textValue')));
}
function simpleWrapper(node: OoxmlElement): boolean {
  return node.namespaceUri === W && (node.localName === 'ins' || node.localName === 'del') &&
    node.children.length > 0 && node.children.every(simpleRun);
}
function simpleBody(part: OoxmlPart): boolean {
  if (!element(part.root, 'document')) return false;
  const bodies = part.root.children.filter(node => element(node, 'body'));
  if (bodies.length !== 1 || part.root.children.length !== 1) return false;
  const body = bodies[0] as OoxmlElement;
  return body.children.some(node => element(node, 'p')) && body.children.every(node => element(node, 'sectPr') || (node.kind !== 'textValue' && element(node, 'p') && node.children.every(child =>
    element(child, 'pPr') || simpleRun(child) || (child.kind !== 'textValue' && simpleWrapper(child)) ||
    ['bookmarkStart', 'bookmarkEnd', 'commentRangeStart', 'commentRangeEnd'].some(name => element(child, name)) ||
    (child.kind !== 'textValue' && element(child, 'r') && child.children.every(value => element(value, 'rPr') || element(value, 'commentReference'))))));
}

/** Original comment threading policy: only explicit parent links establish a thread. */
function commentItems(input: ReviewModelInput, parts: readonly OoxmlPart[], deps: EigenpalReviewDependencies): ReviewCommentItem[] {
  const { commentsOfPart, threadStateOfPart, commentAnchorsOfStory } = deps;
  if (!input.commentsPart) return [];
  const comments = commentsOfPart(input.commentsPart);
  const states = input.commentsExtendedPart ? threadStateOfPart(input.commentsExtendedPart) : new Map();
  const anchors = parts.flatMap(commentAnchorsOfStory);
  const anchorIndex = new Map<string, typeof anchors>();
  for (const anchor of anchors) anchorIndex.set(anchor.commentId, [...(anchorIndex.get(anchor.commentId) ?? []), anchor]);
  const ids = new Map<string, number>(), paragraphs = new Map<string, string[]>();
  for (const comment of comments) {
    ids.set(comment.id, (ids.get(comment.id) ?? 0) + 1);
    if (comment.paraId) paragraphs.set(comment.paraId, [...(paragraphs.get(comment.paraId) ?? []), comment.id]);
  }
  const parents = new Map<string, string>(), invalid = new Set<string>();
  for (const comment of comments) {
    if (ids.get(comment.id) !== 1) { invalid.add(comment.id); continue; }
    const state = comment.paraId ? states.get(comment.paraId) : undefined;
    const parentIds = state?.parentParaId ? paragraphs.get(state.parentParaId) : undefined;
    const parent = parentIds?.length === 1 ? parentIds[0] : comment.parentCommentId;
    if (state?.parentParaId && parentIds?.length !== 1) invalid.add(comment.id);
    if (parent) {
      if (parent === comment.id || ids.get(parent) !== 1 || (comment.parentCommentId && parent !== comment.parentCommentId)) invalid.add(comment.id);
      else parents.set(comment.id, parent);
    }
  }
  for (const comment of comments) {
    const path = new Set<string>();
    let at: string | undefined = comment.id;
    while (at) {
      if (path.has(at) || invalid.has(at)) { for (const id of path) invalid.add(id); break; }
      path.add(at); at = parents.get(at);
    }
  }
  return comments.map((comment, index) => {
    const found = anchorIndex.get(comment.id) ?? [];
    const parentId = invalid.has(comment.id) ? undefined : parents.get(comment.id);
    let inherited = found, at = parentId;
    while (inherited.length === 0 && at && !invalid.has(at)) { inherited = anchorIndex.get(at) ?? []; at = parents.get(at); }
    const anchor = inherited.length === 1 ? inherited[0] : undefined;
    const orphaned = invalid.has(comment.id) || !anchor || anchor.orphaned || found.length > 1;
    let id = comment.id;
    if (ids.get(comment.id) !== 1) { id = `lyra-ambiguous-${index}`; while (ids.has(id)) id = `_${id}`; }
    return {
      kind: 'comment', id, comment,
      range: !orphaned && anchor ? { partName: anchor.partName, start: anchor.start, end: anchor.end } : null,
      resolved: Boolean(comment.paraId && states.get(comment.paraId)?.done), orphaned,
      ...(parentId ? { parentId } : {}),
      replyIds: invalid.has(comment.id) ? [] : comments.filter(candidate => !invalid.has(candidate.id) && parents.get(candidate.id) === comment.id).map(candidate => candidate.id),
    };
  });
}

/** Public Apache store readers own offsets; Lyra owns bounds and the supported review grammar. */
export function deriveLyraReview(input: ReviewModelInput, deps: EigenpalReviewDependencies, requested: Partial<Record<keyof Limits, number>> = {}): LyraReviewDerivation {
  const { collectReviewItems, collectRevisionSites } = deps;
  const limits = Object.fromEntries(Object.entries(REVIEW_MODEL_LIMITS).map(([key, ceiling]) => [key,
    Number.isSafeInteger(requested[key as keyof Limits]) ? Math.max(0, Math.min(ceiling, requested[key as keyof Limits]!)) : ceiling])) as unknown as Limits;
  const stories = [input.storyPart, ...(input.furnitureParts ?? []).filter(part => part !== input.storyPart)];
  const parts = [...new Set([...stories, ...[input.stylesPart, input.commentsPart, input.commentsExtendedPart].filter((part): part is OoxmlPart => Boolean(part))])];
  const scanned = scan(parts, limits);
  if (!scanned) return refused;
  if (input.commentsPart && deps.commentsOfPart(input.commentsPart).length > limits.items) return refused;
  const sites = [...stories, ...(input.stylesPart ? [input.stylesPart] : [])].flatMap(part => collectRevisionSites(part).map(site => ({ part, site })));
  const counts = new Map<string, number>();
  for (const { part, site } of sites) { const key = identity(part, site.node); counts.set(key, (counts.get(key) ?? 0) + 1); }
  const allowed = new Set<string>();
  for (const { part, site } of sites) {
    const key = identity(part, site.node), parent = scanned.parents.get(site.node);
    const container = parent ? scanned.parents.get(parent) : null;
    if (part === input.storyPart && parent && element(parent, 'p') && container && element(container, 'body') && !site.refused && !site.paragraphMark && !site.propertyChange &&
      site.nesting === 0 && simpleWrapper(site.node) && counts.get(key) === 1 &&
      attribute(site.node, 'id') && attribute(site.node, 'author')) allowed.add(key);
  }
  const revisions = [...collectReviewItems({ storyPart: input.storyPart, furnitureParts: input.furnitureParts, stylesPart: input.stylesPart }),
    ...(input.commentsPart ? collectReviewItems({ storyPart: input.commentsPart }).filter(item => item.kind === 'revision').map(item => ({ ...item, ranges: [], readOnly: true })) : [])]
    .filter((item): item is ReviewRevisionItem => item.kind === 'revision').map(item => {
      const range = item.ranges[0];
      const supported = !item.readOnly && item.addresses.length === 1 && item.ranges.length === 1 &&
        (item.revisionKind === 'insert' || item.revisionKind === 'delete') && range?.partName === input.storyPart.name &&
        range.start.paragraphId === range.end.paragraphId && allowed.has(JSON.stringify([range.partName, item.address.id, item.address.author, item.address.date]));
      // Keep core's dispatch identity for supported decisions; copy only at the public report boundary.
      return supported ? item : { ...item, readOnly: true };
    });
  const comments = commentItems(input, stories, deps);
  const items = [...revisions, ...comments];
  const truncated = items.length > limits.items;
  const hasUnsupported = revisions.some(item => item.readOnly) || comments.some(item => item.orphaned);
  return Object.freeze({ items: Object.freeze(items.slice(0, limits.items)), truncated, hasUnsupported,
    trackingSupported: !truncated && !hasUnsupported && stories.length === 1 && simpleBody(input.storyPart) });
}
