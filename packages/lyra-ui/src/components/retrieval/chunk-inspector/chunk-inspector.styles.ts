import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  /* Two rendering paths, one presentation. Below \`virtualize-at\` a chunk row lands in this
     component's own shadow root, where [part~='x'] matches it; above it the same row template
     becomes <lr-virtual-list>'s .renderItem and lands in *that* shadow root, out of reach of any
     selector scoped here. lr-virtual-list::part(x) crosses exactly that one boundary, so every
     row-level part needs both selectors -- the pairing <lr-ingestion-queue> uses for its dual-path
     rows.

     Row state rides on an extra part *token* (chunk-current, score-fill-danger, ...) rather than
     the row's own attribute: Shadow Parts forbids an attribute selector after ::part(), so
     ::part(chunk)[aria-current='true'] is invalid CSS and the whole rule drops. ::part() matches
     the part-name list, so a second token costs nothing and reaches consumer stylesheets too. The
     mirrored attributes (aria-current, data-tone, data-clamped) stay on the elements: they carry
     the semantics, and a bare [part~=] selector here can still use them. */
  [part~='chunk'],
  lr-virtual-list::part(chunk) {
    display: flex;
    flex-direction: column;
    gap: var(--lr-size-2px);
    padding-block: var(--lr-space-s);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part~='chunk-current'],
  lr-virtual-list::part(chunk-current) {
    background: var(--lr-chunk-inspector-current-bg, var(--lr-color-brand-quiet));
  }
  [part~='score'],
  lr-virtual-list::part(score) {
    display: flex;
    align-items: center;
    gap: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    font-variant-numeric: tabular-nums;
  }
  /* text-quiet on brand-quiet is ~4.24:1, under the WCAG AA 4.5:1 floor for normal-size text,
     though it passes against the plain non-current background. Same fix as lr-attachment-chip's
     [part='size'], lr-chat-message's [part='footer'] and lr-conversation-item's
     [part='excerpt']/[part='timestamp']: full-strength text color once current, and overridable in
     pair with --lr-chunk-inspector-current-bg so a consumer restyling one arm keeps the ratio. MUST
     stay after the base score rule above -- equal specificity, so source order alone decides. */
  [part~='score-current'],
  lr-virtual-list::part(score-current) {
    color: var(--lr-chunk-inspector-current-color, var(--lr-color-text));
  }
  [part~='score-bar'],
  lr-virtual-list::part(score-bar) {
    flex: 1 1 auto;
    max-inline-size: var(--lr-size-6rem);
    block-size: var(--lr-size-4px);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border);
    overflow: hidden;
  }
  [part~='score-fill'],
  lr-virtual-list::part(score-fill) {
    display: block;
    block-size: 100%;
    background: var(--lr-color-text-quiet);
  }
  [part~='score-fill-success'],
  lr-virtual-list::part(score-fill-success) {
    background: var(--lr-color-success);
  }
  [part~='score-fill-warning'],
  lr-virtual-list::part(score-fill-warning) {
    background: var(--lr-color-warning);
  }
  [part~='score-fill-danger'],
  lr-virtual-list::part(score-fill-danger) {
    background: var(--lr-color-danger);
  }
  [part~='open-button'],
  lr-virtual-list::part(open-button) {
    display: block;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-weight: var(--lr-font-weight-medium);
    text-align: start;
    cursor: pointer;
  }
  [part~='open-button']:hover,
  lr-virtual-list::part(open-button):hover {
    color: var(--lr-color-brand);
    text-decoration: underline;
  }
  /* Hover already owns the underline, so the press adds a surface. This is transparent-backed link
     chrome, so a wash mixed from that transparent base is the only thing that reads as "held down"
     without repainting the brand-colored label. */
  [part~='open-button']:active,
  lr-virtual-list::part(open-button):active {
    color: var(--lr-color-brand);
    text-decoration: underline;
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part~='open-button']:focus-visible,
  lr-virtual-list::part(open-button):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  [part~='title'],
  lr-virtual-list::part(title) {
    font: inherit;
  }
  /* chunk.text is arbitrary consumer content and may genuinely be RTL prose. isolate -- not
     plaintext, never a forced dir="ltr" -- keeps the paragraph's edge punctuation from being
     reordered by the host direction while per-paragraph bidi detection still runs for real RTL
     content; without it, under dir="rtl" a trailing period ("...Curie in 1898.") jumps to the front
     of the line. Chromium and Firefox default block boxes to unicode-bidi: isolate (the HTML "bidi
     rendering" UA rules), masking it there; WebKit does not, so this is only visible cross-engine
     -- see this component's own dir="rtl" test. */
  [part~='text'],
  lr-virtual-list::part(text) {
    margin: 0;
    color: var(--lr-color-text);
    font-size: var(--lr-font-size-sm);
    overflow-wrap: anywhere;
    unicode-bidi: isolate;
  }
  [part~='text-clamped'],
  lr-virtual-list::part(text-clamped) {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  [part~='toggle'],
  lr-virtual-list::part(toggle) {
    align-self: flex-start;
    box-sizing: border-box;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: 0;
    border: none;
    background: transparent;
    color: var(--lr-color-brand);
    font: inherit;
    font-size: var(--lr-font-size-xs);
    cursor: pointer;
  }
  [part~='toggle']:hover,
  lr-virtual-list::part(toggle):hover {
    text-decoration: underline;
  }
  [part~='toggle']:active,
  lr-virtual-list::part(toggle):active {
    text-decoration: underline;
    background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part~='toggle']:focus-visible,
  lr-virtual-list::part(toggle):focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
`;
