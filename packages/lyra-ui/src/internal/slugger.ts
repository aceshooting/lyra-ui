/**
 * GitHub-slugger-style heading-id generation, shared by `<lr-markdown>` and
 * `<lr-docx-viewer>` so their heading ids/outline trees can never drift apart. Algorithm: lower-
 * case the plain heading text, strip every character that is not a Unicode letter (`\p{L}`), mark
 * (`\p{M}`), number (`\p{N}`), space, hyphen, or underscore, trim, then collapse whitespace runs to
 * a single hyphen. An emoji/punctuation-only heading yields an empty string -- the caller decides
 * what that means for anchoring (typically: no `id` is stamped, and the heading can't be
 * fragment-addressed).
 */
function baseSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N} _-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Dedupes slugs across one document parse: the first occurrence of a base slug keeps it bare, each
 * repeat appends `-1`, `-2`, ... incrementing until an unused candidate is found (so a real heading
 * that happens to already read e.g. "Overview 1" is never silently collided with). Scoped per
 * instance -- create one per parse/render pass, never share one across documents.
 */
export class Slugger {
  private readonly used = new Set<string>();

  slug(text: string): string {
    const base = baseSlug(text);
    if (base === '') return '';
    if (!this.used.has(base)) {
      this.used.add(base);
      return base;
    }
    let index = 1;
    let candidate = `${base}-${index}`;
    while (this.used.has(candidate)) {
      index++;
      candidate = `${base}-${index}`;
    }
    this.used.add(candidate);
    return candidate;
  }
}
