import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='form-control-label'] {
    display: block;
    margin-block-end: var(--lyra-space-xs);
    font-size: 0.875rem;
    font-weight: 600;
  }
  /* :empty never matches here -- the part always contains a literal slot
     child element regardless of assigned/text content -- so real emptiness
     is tracked in JS (hasLabelSlot) and reflected via the hidden attribute
     instead (same fix as [part='hint']/[part='error'] below). Without this,
     the required-asterisk ::after below (which attaches to this box)
     renders a stray ' *' with nothing before it whenever label is unset. */
  [part='form-control-label'][hidden] {
    display: none;
  }
  :host([required]) [part='form-control-label']::after {
    content: ' *';
    color: var(--lyra-color-danger);
  }

  [part='combobox'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lyra-space-xs);
    inline-size: 100%;
    min-block-size: 2.5rem;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    background: var(--lyra-color-surface);
    cursor: text;
  }
  [part='combobox']:focus-within {
    border-color: var(--lyra-color-brand);
    outline: 2px solid transparent;
  }
  :host([disabled]) [part='combobox'] {
    /* was a literal 0.5; now the shared library-wide disabled-state token
       (still 0.5 by default fallback, so no visual change here). */
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }

  [part='tag'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-xs);
    padding: 0.1rem 0.4rem;
    font-size: 0.8125rem;
    background: var(--lyra-color-brand-quiet);
    color: var(--lyra-color-text);
    border-radius: var(--lyra-radius);
  }
  [part='tag__remove-button'] {
    border: none;
    background: none;
    cursor: pointer;
    color: inherit;
    padding: 0;
    line-height: 1;
    font-size: 1rem;
  }

  [part='combobox-input'] {
    flex: 1 1 6ch;
    min-inline-size: 4ch;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }

  [part='clear-button'],
  [part='expand-icon'] {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--lyra-color-text-quiet);
    padding: var(--lyra-space-xs);
    /* Real touch target in *both* dimensions (WCAG 2.2 SC 2.5.8 needs
       24x24 CSS px, not just height — min-block-size alone left these
       buttons ~21px wide). icon-button-size is
       the ceiling, but never grow past what the [part=combobox] row's own
       2.5rem min-block-size has room for once its own block padding is
       subtracted. */
    min-inline-size: min(var(--lyra-icon-button-size), 1.75rem);
    min-block-size: min(var(--lyra-icon-button-size), 1.75rem);
    line-height: 1;
  }
  [part='expand-icon'] svg {
    transform: rotate(90deg);
  }
  [part='clear-button']:focus-visible,
  [part='tag__remove-button']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }

  [part='listbox'] {
    position: fixed;
    z-index: 900;
    box-sizing: border-box;
    max-block-size: min(18rem, var(--lyra-positioner-available-block-size, 18rem));
    overflow-y: auto;
    inline-size: max-content;
    min-inline-size: min(12rem, var(--lyra-positioner-available-inline-size, 12rem));
    max-inline-size: min(92vw, 28rem, var(--lyra-positioner-available-inline-size, 100vw));
    padding: var(--lyra-space-xs);
    background: var(--lyra-color-surface);
    border: 1px solid var(--lyra-color-border);
    border-radius: var(--lyra-radius);
    box-shadow: var(--lyra-shadow);
    /* Closed state: invisible + slightly raised. visibility (not
       display:none) so opacity/transform can actually transition; hit-testing
       and a11y exposure stay off since this part is already position:fixed. */
    visibility: hidden;
    opacity: 0;
    transform: translateY(-0.25rem);
    transition:
      opacity var(--lyra-transition-fast),
      transform var(--lyra-transition-fast),
      visibility var(--lyra-transition-fast);
  }
  :host([open]) [part='listbox'] {
    visibility: visible;
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    [part='listbox'] {
      transition: none !important;
    }
  }

  [part='option'] {
    display: flex;
    flex-direction: column;
    align-items: start;
    inline-size: 100%;
    padding: var(--lyra-space-xs) var(--lyra-space-s);
    border: 1px solid transparent;
    border-radius: var(--lyra-radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  [part='option']:hover,
  [part='option'][data-active] {
    background: var(--lyra-color-brand-quiet);
  }
  [part='option'][aria-selected='true'] {
    border-color: var(--lyra-color-brand);
    color: var(--lyra-color-brand);
    font-weight: 600;
  }
  [part='option'][aria-disabled='true'] {
    /* was a literal 0.4; unified with the rest of the library's single
       disabled-state opacity token (intentionally changes 0.4 -> 0.5). */
    opacity: var(--lyra-opacity-disabled);
    cursor: not-allowed;
  }
  [part='option-dot'] {
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 50%;
    flex: 0 0 auto;
  }
  [part='option-label'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part='option-sub'] {
    font-size: 0.75rem;
    color: var(--lyra-color-text-quiet);
  }
  [part='option-overflow'],
  .loading {
    padding: var(--lyra-space-s) var(--lyra-space-m);
    font-size: 0.8125rem;
    color: var(--lyra-color-text-quiet);
  }

  .group-label {
    padding: var(--lyra-space-xs) var(--lyra-space-s) 0;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--lyra-color-text-quiet);
  }
  .empty {
    padding: var(--lyra-space-m);
    color: var(--lyra-color-text-quiet);
    font-size: 0.875rem;
  }
  [part='hint'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: 0.8125rem;
    color: var(--lyra-color-text-quiet);
  }
  /* :empty never matches here -- the part always contains a literal
     slot child element regardless of assigned/text content -- so real
     emptiness is tracked in JS (hasHintSlot/hasErrorSlot) and reflected via
     the hidden attribute instead (same fix as lyra-stat's icon/caption). */
  [part='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lyra-space-xs);
    font-size: 0.8125rem;
    color: var(--lyra-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }
`;
