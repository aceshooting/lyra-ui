import type { DocxEditorInstance, EditorModule, ReviewModelInput, ReviewItem, ReviewRevisionItem, ReviewCommentItem, ExecResult } from '@docx-editor.dev/core';
import type { OoxmlPart, OoxmlPackage } from '@docx-editor.dev/core/store';
import type { DocxResult, DocxCommandAvailability } from './types.js';
import { DOCX_REVIEW_LIMITS, normalizeDocxReviewAction } from './review-types.js';
import type { DocxReviewAction, DocxReviewDecision, DocxReviewItem, DocxReviewReport } from './review-types.js';

import { deriveLyraReview, REVIEW_MODEL_LIMITS } from './eigenpal-review-model.js';
import type { EigenpalReviewDependencies, LyraReviewDerivation } from './eigenpal-review-model.js';

const failure = (code: 'unsupported' | 'stale-revision' | 'destroyed' = 'unsupported'): DocxResult<void> => ({ ok: false, code });
const success = (): DocxResult<void> => ({ ok: true, value: undefined });
const converted = (result: ExecResult): DocxResult<void> => result.ok ? success() : failure();


/** The public construction-time capability seam; no commercial package is loaded. */
export function createLyraReviewModule(deps: EigenpalReviewDependencies): EditorModule {
  type PartReview = { items: readonly ReviewItem[]; paragraphs?: ReadonlyMap<string, readonly ReviewRevisionItem[]> };
  const partReviews = new WeakMap<OoxmlPart, PartReview>();
  const combinedReviews = new WeakMap<OoxmlPart, { parts: readonly (OoxmlPart | undefined)[]; items: readonly ReviewItem[] }>();
  const emptyParagraph: readonly ReviewRevisionItem[] = Object.freeze([]);
  const partReview = (part: OoxmlPart): PartReview => {
    let result = partReviews.get(part);
    if (!result) { result = { items: deriveLyraReview({ storyPart: part }, deps).items }; partReviews.set(part, result); }
    return result;
  };
  const collect = (input: ReviewModelInput): readonly ReviewItem[] => {
    const furniture = input.furnitureParts ?? [];
    if (!input.stylesPart && !input.commentsPart && !input.commentsExtendedPart && furniture.length === 0) return partReview(input.storyPart).items;
    // Keep one bounded combination per live main part; callback input objects and arrays may be recreated.
    if (furniture.length > REVIEW_MODEL_LIMITS.parts) return deriveLyraReview(input, deps).items;
    const parts = [input.stylesPart, input.commentsPart, input.commentsExtendedPart, ...furniture];
    const cached = combinedReviews.get(input.storyPart);
    if (cached && cached.parts.length === parts.length && parts.every((part, index) => part === cached.parts[index])) return cached.items;
    const items = deriveLyraReview(input, deps).items;
    combinedReviews.set(input.storyPart, { parts, items });
    return items;
  };
  const paragraphItems = (part: OoxmlPart, paragraphId: string): readonly ReviewRevisionItem[] => {
    const cached = partReview(part);
    if (!cached.paragraphs) {
      const paragraphs = new Map<string, ReviewRevisionItem[]>();
      for (const item of cached.items) {
        if (item.kind !== 'revision' || item.ranges.length === 0) continue;
        const id = item.ranges[0]!.start.paragraphId;
        if (!item.ranges.every(range => range.start.paragraphId === id && range.end.paragraphId === id)) continue;
        const items = paragraphs.get(id);
        if (items) items.push(item); else paragraphs.set(id, [item]);
      }
      cached.paragraphs = new Map([...paragraphs].map(([id, items]) => [id, Object.freeze(items)]));
    }
    return cached.paragraphs.get(paragraphId) ?? emptyParagraph;
  };
  return { id: 'lyra-review', review: {
    displayModes: ['proposed', 'all-markup', 'original'],
    collectReviewItems: collect,
    revisionItemsOfParagraph: paragraphItems,
  } };
}

interface EigenpalReviewItem extends Omit<DocxReviewItem, 'id' | 'parentId'> {
  readonly token: object;
  readonly parentToken?: object;
}
export interface EigenpalReviewReport extends Omit<DocxReviewReport, 'revision' | 'items'> { readonly items: readonly EigenpalReviewItem[] }
/** The adapter supplies its existing settlement, selection-lease and ownership transaction guards. */
export interface EigenpalReviewGates {
  navigate(run: () => DocxResult<void>): DocxResult<void>;
  mutate(run: () => DocxResult<void>): DocxResult<void>;
  guard(): DocxResult<void>;
}
function clipped(text: string, limit: number): string {
  let end = Math.min(limit, text.length);
  if (end < text.length && /[\ud800-\udbff]/.test(text[end - 1] ?? '')) end--;
  return text.slice(0, end);
}
function inputOf(editor: DocxEditorInstance, deps: EigenpalReviewDependencies): { input: ReviewModelInput; pkg: OoxmlPackage; revision: number } | null {
  const { stylesPartOf, commentPartNameOf, commentsExtendedPartNameOf } = deps;
  const session = editor.surface?.session;
  if (!session) return null;
  const pkg = session.currentPackage(), main = pkg.parts.get(pkg.mainDocumentPart);
  if (!main) return null;
  return { pkg, revision: session.packageRevision(), input: { storyPart: main,
    furnitureParts: session.storyParts().filter(part => part !== main), stylesPart: stylesPartOf(pkg),
    commentsPart: pkg.parts.get(commentPartNameOf(pkg, main.name)), commentsExtendedPart: pkg.parts.get(commentsExtendedPartNameOf(pkg, main.name)) } };
}

/** Revision-scoped opaque targets; none of the engine's identifiers escape this helper. */
export function createEigenpalReview(current: () => DocxEditorInstance, gates: EigenpalReviewGates, deps: EigenpalReviewDependencies) {
  const { reviewItemKey, commentBodyText } = deps;
  type Entry = { item: ReviewItem; key: string; editor: DocxEditorInstance; generation: number; revision: number; pkg: OoxmlPackage; epoch: number };
  let entries = new WeakMap<object, Entry>(), epoch = 0, disposed = false;
  let author: string | null = null;
  let cached: { pkg: OoxmlPackage; revision: number; report: LyraReviewDerivation } | null = null;
  const derive = (state: { pkg: OoxmlPackage; revision: number; input: ReviewModelInput }) => {
    if (!cached || cached.pkg !== state.pkg || cached.revision !== state.revision) cached = { pkg: state.pkg, revision: state.revision, report: deriveLyraReview(state.input, deps) };
    return cached.report;
  };
  const capture = () => { const editor = current(), state = inputOf(editor, deps); return state ? { editor, state, generation: editor.mountGeneration, epoch } : null; };
  const valid = (entry: { editor: DocxEditorInstance; generation: number; epoch: number; revision: number; pkg: OoxmlPackage }) =>
    !disposed && entry.epoch === epoch && current() === entry.editor && entry.editor.mountGeneration === entry.generation &&
    entry.editor.surface?.session.packageRevision() === entry.revision && entry.editor.surface.session.currentPackage() === entry.pkg;
  const find = (token: object) => { const entry = entries.get(token); return entry && valid(entry) ? entry : null; };
  const invalidate = () => { epoch++; entries = new WeakMap(); cached = null; };
  function operate(token: object, mutation: boolean, run: (entry: Entry) => DocxResult<void>): DocxResult<void> {
    if (disposed) return failure('destroyed');
    const entry = find(token); if (!entry) return failure('stale-revision');
    return (mutation ? gates.mutate : gates.navigate)(() => {
      const guarded = gates.guard(); if (!guarded.ok) return guarded;
      if (!valid(entry) || !entries.has(token)) return failure('stale-revision');
      const report = inputOf(entry.editor, deps); if (!report || derive(report).truncated) return failure();
      if (!valid(entry)) return failure('stale-revision');
      return run(entry);
    });
  }
  function query(): EigenpalReviewReport {
    const captured = !disposed ? capture() : null;
    if (!captured) return Object.freeze({ items: Object.freeze([]), truncated: false, hasUnsupported: false, trackingSupported: false, enabled: false, author });
    const { editor, state, generation } = captured, report = derive(state);
    const selected = report.items.slice(0, DOCX_REVIEW_LIMITS.items);
    const tokens = new Map<ReviewItem, object>(selected.map(item => [item, Object.freeze({})]));
    const commentTokens = new Map(selected.filter((item): item is ReviewCommentItem => item.kind === 'comment').map(item => [item.id, tokens.get(item)!]));
    const items: EigenpalReviewItem[] = selected.map(item => {
      const token = tokens.get(item)!;
      entries.set(token, { item, key: reviewItemKey(item), editor, generation, revision: state.revision, pkg: state.pkg, epoch });
      if (item.kind === 'comment') return Object.freeze({ token, kind: 'comment', text: clipped(commentBodyText(item.comment), DOCX_REVIEW_LIMITS.text),
        author: clipped(item.comment.author, DOCX_REVIEW_LIMITS.author), ...(item.comment.date ? { date: clipped(item.comment.date, 64) } : {}),
        resolved: item.resolved, ...(item.parentId && commentTokens.has(item.parentId) ? { parentToken: commentTokens.get(item.parentId)! } : {}),
        readOnly: item.orphaned, orphaned: item.orphaned, navigable: Boolean(item.range) });
      return Object.freeze({ token, kind: item.kind === 'revision' && !item.readOnly && (item.revisionKind === 'insert' || item.revisionKind === 'delete') ? item.revisionKind : 'unsupported',
        text: clipped(item.text, DOCX_REVIEW_LIMITS.text), author: clipped(item.kind === 'revision' ? item.author : '', DOCX_REVIEW_LIMITS.author),
        ...(item.kind === 'revision' && item.date ? { date: clipped(item.date, 64) } : {}), readOnly: item.kind !== 'revision' || item.readOnly,
        orphaned: item.kind !== 'revision' || !item.ranges.length, navigable: item.kind === 'revision' && item.ranges.length > 0 });
    });
    return Object.freeze({ items: Object.freeze(items), truncated: report.truncated || report.items.length > selected.length,
      hasUnsupported: report.hasUnsupported, trackingSupported: report.trackingSupported, enabled: editor.getEditingMode() === 'suggesting', author });
  }
  function writeComment(text: string, writer: string, token?: object): DocxResult<void> {
    const normalized = normalizeDocxReviewAction({ type: 'add-comment', text, author: writer });
    if (!normalized.ok) return normalized;
    if (token) return operate(token, true, entry => entry.item.kind !== 'comment' || entry.item.orphaned || entry.item.resolved ? failure() : converted(entry.editor.replyToReviewItem(entry.key, text, writer)));
    if (disposed) return failure('destroyed');
    const captured = capture(); if (!captured) return failure();
    const stamp = { ...captured, revision: captured.state.revision, pkg: captured.state.pkg };
    return gates.mutate(() => {
      const guarded = gates.guard(); if (!guarded.ok) return guarded;
      if (!valid(stamp)) return failure('stale-revision');
      if (derive(captured.state).truncated) return failure();
      if (!valid(stamp)) return failure('stale-revision');
      return converted(captured.editor.addComment(text, writer));
    });
  }
  return {
    query, invalidate,
    /** Advisory only; the adapter additionally checks selection, lifecycle and edit ownership. */
    can(action: DocxReviewAction, token?: object): DocxCommandAvailability {
      const normalized = normalizeDocxReviewAction(action);
      if (!normalized.ok) return { enabled: false, reason: normalized.code };
      if (disposed) return { enabled: false, reason: 'destroyed' };
      const captured = capture();
      if (!captured) return { enabled: false, reason: 'unsupported' };
      const report = derive(captured.state);
      if (report.truncated && !(action.type === 'track-changes' && !action.enabled)) return { enabled: false, reason: 'resource-limit' };
      if (action.type === 'add-comment') return { enabled: true };
      if (action.type === 'track-changes') return { enabled: !action.enabled || report.trackingSupported,
        ...(!action.enabled || report.trackingSupported ? {} : { reason: 'unsupported' as const }), active: captured.editor.getEditingMode() === 'suggesting' };
      const entry = token ? find(token) : null;
      if (!entry) return { enabled: false, reason: 'stale-revision' };
      const item = entry.item;
      const supported = action.type === 'reply-comment' ? item.kind === 'comment' && !item.orphaned && !item.resolved :
        item.kind === 'comment' ? !item.orphaned && ['resolve', 'reopen', 'delete'].includes(action.decision) :
        item.kind === 'revision' && !item.readOnly && ['accept', 'reject'].includes(action.decision);
      return supported ? { enabled: true } : { enabled: false, reason: 'unsupported' };
    },
    dispose() { disposed = true; invalidate(); author = null; },
    navigate(token: object) { return operate(token, false, entry => converted(entry.editor.setActiveReviewItem(entry.key, { reveal: 'nearest' }))); },
    addComment: (text: string, writer: string) => writeComment(text, writer),
    reply: (token: object, text: string, writer: string) => writeComment(text, writer, token),
    decide(token: object, decision: DocxReviewDecision): DocxResult<void> {
      return operate(token, true, entry => {
        const item = entry.item;
        if (item.kind === 'comment') {
          if (item.orphaned) return failure();
          if (decision === 'resolve' || decision === 'reopen') return converted(entry.editor.setCommentResolved(entry.key, decision === 'resolve'));
          if (decision === 'delete') return converted(entry.editor.deleteReviewItem(entry.key));
        } else if (item.kind === 'revision' && !item.readOnly) {
          if (decision === 'accept') return converted(entry.editor.acceptReviewItem(entry.key));
          if (decision === 'reject') return converted(entry.editor.rejectReviewItem(entry.key));
        }
        return failure();
      });
    },
    setTracking(enabled: boolean, writer: string): DocxResult<void> {
      const normalized = normalizeDocxReviewAction({ type: 'track-changes', enabled, author: writer });
      if (!normalized.ok) return normalized;
      if (disposed) return failure('destroyed');
      const captured = capture(); if (!captured) return failure();
      const stamp = { ...captured, revision: captured.state.revision, pkg: captured.state.pkg };
      return gates.mutate(() => {
        const guarded = gates.guard(); if (!guarded.ok) return guarded;
        if (!valid(stamp)) return failure('stale-revision');
        if (enabled && !derive(captured.state).trackingSupported) return failure();
        if (!valid(stamp)) return failure('stale-revision');
        captured.editor.setAuthor(writer); author = writer;
        const after = gates.guard(); if (!after.ok) return after;
        if (!valid(stamp)) return failure('stale-revision');
        const result = captured.editor.exec({ type: 'setEditingMode', mode: enabled ? 'suggesting' : 'editing' });
        return converted(result);
      });
    },
  };
}
