import type { LyraElement } from './lyra-element.js';
import { buildQuoteAnchor, scopeFromElement } from './text-quote.js';
import {
  DocumentAnchorTargetBase,
  type DocumentAnchorTargetHooks,
  type LyraAnchorTarget,
  type LyraAnchorTargetEventMap,
} from './anchor-target-base.js';
import type { LyraAnchor } from '../components/viewers/document-viewer/anchors.js';

export {
  DocumentAnchorTargetBase,
  HIGHLIGHT_CANDIDATE_LIMIT,
  HIGHLIGHT_SNAPSHOT_LIMIT,
  prioritizedHighlightCandidates,
} from './anchor-target-base.js';
export type { DocumentAnchorTargetHooks, LyraAnchorTarget, LyraAnchorTargetEventMap } from './anchor-target-base.js';
export { observeTextSelection, type TextSelectionObserverOptions } from './text-selection-observer.js';

type PublicConstructor<T> = new (...args: never[]) => T;
type InternalMixinConstructor<T> = new (...args: any[]) => T;
type MixedConstructor<Base extends PublicConstructor<object>, Added> = Base & (
  new (...args: ConstructorParameters<Base>) => InstanceType<Base> & Added
);

/**
 * The text-capable anchor-target mixin: everything `DocumentAnchorTargetBase` adds, with
 * `computeSelectionAnchor(range, text)` defaulting to a `text-quote` anchor built from the whole
 * render root's text via `internal/text-quote.ts` (a viewer with a narrower/paginated content root,
 * e.g. pdf, overrides it for a page-scoped scope). Viewers that never anchor text selections adopt
 * `DocumentAnchorTargetBase` instead and keep the quote engine out of their module graph.
 *
 * Per-viewer hooks a subclass overrides: `applyAnchor(anchor)` (default declines everything) and
 * `computeSelectionAnchor(range, text)`. Named protected hook declarations keep subclass overrides
 * and super calls visible without exposing the mixin's private state in its constructor return type.
 */
/** @internal Source-only overload preserving subclass statics and protected members. */
export function DocumentAnchorTarget<
  T extends InternalMixinConstructor<LyraElement<LyraAnchorTargetEventMap>>,
>(
  Base: T,
): T & InternalMixinConstructor<LyraAnchorTarget & DocumentAnchorTargetHooks & { renderAnchorLiveRegion(): unknown }>;
/** Public, declaration-safe mixin signature. */
export function DocumentAnchorTarget<
  T extends PublicConstructor<LyraElement<LyraAnchorTargetEventMap>>,
>(
  Base: T,
): MixedConstructor<T, LyraAnchorTarget & DocumentAnchorTargetHooks & { renderAnchorLiveRegion(): unknown }>;
export function DocumentAnchorTarget(
  Base: InternalMixinConstructor<LyraElement<LyraAnchorTargetEventMap>>,
): InternalMixinConstructor<LyraElement<LyraAnchorTargetEventMap> & LyraAnchorTarget & {
  renderAnchorLiveRegion(): unknown;
}> {
  class DocumentAnchorTargetElement extends DocumentAnchorTargetBase(Base) {
    protected static readonly immutableEventDetails = Object.freeze([
      'lr-text-select',
    ]);

    /** Per-viewer hook building a `LyraAnchor` from an ended selection. Default: a `text-quote`
     *  anchor from the whole render root's rendered text. */
    protected override computeSelectionAnchor(range: Range, _text: string): LyraAnchor | null {
      const scope = scopeFromElement(this.renderRoot as unknown as Element);
      return buildQuoteAnchor(range, scope);
    }
  }
  return DocumentAnchorTargetElement;
}
