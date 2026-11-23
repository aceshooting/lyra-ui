import { loadDompurify } from '../../../internal/dompurify-loader.js';

/**
 * Sanitizes the optional `html` of async combobox rows: the optional `dompurify` peer first, then
 * the passive-content pass. Resolves a map from each row to its non-blank sanitized markup, or
 * `null` when the peer is missing or unusable so the caller fails closed onto plain labels.
 *
 * This is the combobox's only route to the sanitizer peer. Keeping it in its own module lets the
 * optional-peer inventory credit the peer to a composing component only when that component
 * forwards an author-settable `source` to its `<lr-combobox>`: a composite that never hands the
 * combobox rows carrying `html` cannot reach this capability and does not inherit the peer.
 */
export async function sanitizeComboboxOptionHtml<Row extends { readonly html?: string }>(
  rows: readonly Row[],
  ownerDocument: Document,
  isStale: () => boolean
): Promise<Map<Row, string> | null | 'stale'> {
  const [sanitizer, passive] = await Promise.all([
    loadDompurify(),
    import('../../../internal/passive-markup.js'),
  ]);
  if (isStale()) return 'stale';
  if (!sanitizer) return null;
  const sanitized = new Map<Row, string>();
  const holder = ownerDocument.createElement('template');
  for (const row of rows) {
    if (row.html === undefined) continue;
    holder.content.replaceChildren(
      passive.sanitizePassiveMarkupFragment(sanitizer, row.html, ownerDocument, 'passive-document')
    );
    const clean = holder.innerHTML;
    // Markup that sanitizes to nothing visible keeps the plain label rather than a blank row.
    if (clean.trim() !== '') sanitized.set(row, clean);
  }
  return sanitized;
}
