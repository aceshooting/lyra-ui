/**
 * Localized label helpers shared by `<lyra-code-block>` and
 * `<lyra-code-block-core>`. Both components render an otherwise-identical
 * header/body, and pulling just the `this.localize()` call sites out into
 * one place keeps their i18n behavior from silently drifting apart the way
 * it previously did between the two.
 */

/** Matches `LyraElement.localize()`'s signature so either component's bound
 *  method can be passed straight through. */
export type LyraLocalizeFn = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;

/** The collapse/expand header toggle button's `aria-label`. */
export function codeBlockToggleLabel(localize: LyraLocalizeFn, collapsed: boolean): string {
  return collapsed ? localize('expandCode') : localize('collapseCode');
}

/** The copy-to-clipboard header button's `aria-label`. */
export function codeBlockCopyLabel(localize: LyraLocalizeFn, justCopied: boolean): string {
  return justCopied ? localize('copiedToClipboard') : localize('copyCode');
}

/** The `[part="body"]` region's `aria-label`: the filename when set, else a
 *  language-aware "Code" region label. */
export function codeBlockBodyLabel(localize: LyraLocalizeFn, filename: string, language: string): string {
  return filename || (language ? localize('codeRegionWithLanguage', undefined, { language }) : localize('codeRegion'));
}
