import { html, nothing, type TemplateResult } from 'lit';

export interface InertPresentationOptions {
  /** Existing public part token(s) carried by the visual wrapper. */
  part?: string;
  /** Whether this wrapper currently owns presentation-only content. Defaults to true. */
  presentation?: boolean;
  /** Whether the existing visual wrapper is currently absent from layout. */
  hidden?: boolean;
}

/**
 * Renders the standard wrapper for consumer-supplied presentation content.
 *
 * The content remains visible, but `inert` suppresses focus and activation through flattened
 * slots and nested shadow trees while `aria-hidden` removes the same subtree from the
 * accessibility tree. Real consumer actions must be rendered outside this wrapper.
 */
export function renderInertPresentation(
  content: unknown,
  options: Readonly<InertPresentationOptions> = {},
): TemplateResult {
  const presentation = options.presentation ?? true;
  return html`<span
    part=${options.part ?? nothing}
    aria-hidden=${presentation ? 'true' : nothing}
    ?inert=${presentation}
    ?hidden=${options.hidden ?? false}
  >${content}</span>`;
}
