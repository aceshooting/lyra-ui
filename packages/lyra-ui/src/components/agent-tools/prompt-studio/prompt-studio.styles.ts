import { css } from 'lit';

export const styles = css`
  :host { display: block; container-type: inline-size; contain-intrinsic-inline-size: var(--lr-size-20rem); }
  [part='base'] { display: flex; flex-direction: column; gap: var(--lr-space-m); }
  [part='toolbar'] { display: flex; flex-wrap: wrap; gap: var(--lr-space-s); align-items: center; }
  [part='toolbar'] h2 { min-inline-size: 0; flex: 1; margin: 0; font-size: var(--lr-font-size-lg); }
  [part='editor'] { display: grid; grid-template-columns: minmax(0, 2fr) minmax(var(--lr-size-12rem), 1fr); gap: var(--lr-space-m); }
  [part='messages'] { display: flex; flex-direction: column; gap: var(--lr-space-s); margin: 0 0 var(--lr-space-s); padding: 0; list-style: none; }
  [part='message'] { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: var(--lr-space-xs); align-items: start; }
  [part='message-actions'] { display: flex; flex-direction: column; gap: var(--lr-space-xs); }
  [part='message-role'], [part='message-content'], [part='variable'] input {
    min-block-size: var(--lr-icon-button-size);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
  }
  [part='message-content'] { min-block-size: var(--lr-size-6rem); padding: var(--lr-space-s); resize: vertical; }
  .message-role-wrapper { position: relative; display: inline-flex; align-items: center; }
  [part='message-role'] {
    appearance: none;
    padding-inline: var(--lr-space-s) var(--lr-space-l);
    cursor: pointer;
  }
  /* The select's popup list is still painted by the browser from these options; without an
     explicit surface/text pairing it falls back to UA colors (a white panel in dark themes). */
  [part='message-role'] option { background: var(--lr-color-surface); color: var(--lr-color-text); }
  /* appearance: none strips the native dropdown affordance, so this chevron -- matching
     av-player's [part='rate-select'] / image-viewer's [part='fit-control'] pattern -- replaces
     it; without one a visible, functional <select> would read as a plain bordered box. */
  .message-role-chevron {
    position: absolute;
    inset-inline-end: var(--lr-space-xs);
    display: inline-flex;
    color: var(--lr-color-text-quiet);
    line-height: var(--lr-line-height-none);
    pointer-events: none;
  }
  .message-role-chevron svg { transform: rotate(90deg); }
  /* no-pressed-state: these three are field surfaces, not push targets -- pointer-down on the
     textarea or the text input places a caret, and pointer-down on the role select hands the whole
     interaction to the UA's own native option list, which paints its own pressed feedback and holds
     it for as long as the popup is open. :focus-visible carries the affordance in all three cases. */
  :where([part='message-role'], [part='message-content']):hover:where(:not(:disabled)),
  :where([part='variable']) input:hover:where(:not(:disabled)) {
    border-color: var(--lr-prompt-studio-field-hover-border, var(--lr-color-brand));
  }
  [part='variables'], [part='versions'] { display: flex; flex-direction: column; gap: var(--lr-space-xs); }
  [part='variables'] h3, [part='preview'] h3 { margin: 0; font-size: var(--lr-font-size-m); }
  [part='variable'] { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--lr-space-xs); }
  [part='variable'] input { min-inline-size: 0; padding-inline: var(--lr-space-s); }
  [part='toolbar'] button, [part='move-message-up'], [part='move-message-down'], [part='remove-message'], [part='add-message'], [part='version'] {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    padding: var(--lr-space-xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  /* Keep the state pseudo-class outside :where(): it supplies the same specificity as each
     resting [part] selector, while the toolbar descendant retains its matching type specificity. */
  :where([part='toolbar']) button:hover:where(:not(:disabled)),
  :where([part='move-message-up'], [part='move-message-down'], [part='remove-message'], [part='add-message'], [part='version']):hover:where(:not(:disabled)) {
    background: var(--lr-color-surface-raised);
  }
  /* Pressed is the hovered tint pushed a further --lr-color-mix-active toward
     --lr-color-mix-partner (which follows the text colour), so it reads as a distinctly deeper step
     than hover in both light and dark themes rather than repeating it. */
  :where([part='toolbar']) button:active:where(:not(:disabled)),
  :where([part='move-message-up'], [part='move-message-down'], [part='remove-message'], [part='add-message'], [part='version']):active:where(:not(:disabled)) {
    background: color-mix(in oklab, var(--lr-color-surface-raised), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  [part='move-message-up'] { transform: rotate(-90deg); }
  [part='move-message-down'] { transform: rotate(90deg); }
  [part='version']:where([aria-pressed='true']) {
    border-color: var(--lr-prompt-studio-version-selected-border, var(--lr-color-brand));
    background: var(--lr-prompt-studio-version-selected-bg, var(--lr-color-brand-quiet));
    color: var(--lr-prompt-studio-version-selected-color, var(--lr-color-text));
  }
  /* Compose selected and pointer states without changing the part selector itself. */
  [part='version']:where([aria-pressed='true']):where(:hover:not(:disabled)) {
    background: var(
      --lr-prompt-studio-version-selected-hover-bg,
      color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-hover))
    );
  }
  [part='version']:where([aria-pressed='true']):where(:active:not(:disabled)) {
    background: color-mix(
      in oklab,
      var(
        --lr-prompt-studio-version-selected-hover-bg,
        color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-hover))
      ),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part='toolbar'] button:focus-visible, [part='move-message-up']:focus-visible, [part='move-message-down']:focus-visible, [part='remove-message']:focus-visible, [part='add-message']:focus-visible, [part='version']:focus-visible,
  [part='message-role']:focus-visible, [part='message-content']:focus-visible, [part='variable'] input:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color); outline-offset: var(--lr-focus-ring-offset);
  }
  button:disabled, textarea:disabled, input:disabled, select:disabled { cursor: not-allowed; opacity: var(--lr-opacity-disabled); }
  [part='preview'] { padding: var(--lr-space-m); border: var(--lr-border-width-thin) solid var(--lr-color-border); border-radius: var(--lr-radius); }
  [part='preview'] article { display: grid; grid-template-columns: var(--lr-size-6rem) minmax(0, 1fr); gap: var(--lr-space-s); padding-block: var(--lr-space-xs); }
  [part='preview'] pre { min-inline-size: 0; margin: 0; color: var(--lr-color-text); font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
  @container (max-inline-size: 40rem) { [part='editor'] { grid-template-columns: 1fr; } }
  @container (max-inline-size: 319.98px) {
    [part='message'], [part='variable'], [part='preview'] article { grid-template-columns: 1fr; }
    [part='message-actions'] { flex-direction: row; justify-self: end; }
    [part='remove-message'] { justify-self: end; }
  }
`;
