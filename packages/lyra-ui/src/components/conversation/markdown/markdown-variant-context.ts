import { MarkdownParserController, type MarkdownKatexState } from './markdown-shared.js';
import type { MarkdownRuntimeBase } from './markdown-base.class.js';

/** Shared per-tag state. The two concrete tags deliberately keep separate parser defaults,
 * connected-instance sets, and KaTeX resolution state while sharing one lifecycle implementation. */
export interface MarkdownVariantContext {
  readonly tag: 'lr-markdown' | 'lr-markdown-core';
  readonly connectedInstances: Set<MarkdownRuntimeBase>;
  readonly sharedParser: MarkdownParserController;
  readonly katexState: MarkdownKatexState;
}

export function createMarkdownVariantContext(
  tag: MarkdownVariantContext['tag'],
  katexState: MarkdownKatexState
): MarkdownVariantContext {
  return {
    tag,
    connectedInstances: new Set(),
    sharedParser: new MarkdownParserController(),
    katexState,
  };
}
