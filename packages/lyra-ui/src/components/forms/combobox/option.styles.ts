import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }

  [part~='base'] {
    box-sizing: border-box;
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    align-items: center;
    gap: var(--lr-space-xs);
    min-block-size: max(var(--lr-form-control-height), var(--lr-size-24px));
    padding-block: var(--lr-form-control-padding-block);
    padding-inline: var(--lr-form-control-padding-inline);
    border-radius: var(--lr-form-control-radius);
    color: var(--lr-color-text);
    font: inherit;
    font-size: var(--lr-form-control-font-size);
    line-height: var(--lr-line-height-snug);
  }

  :host(:state(hover)) [part~='base'],
  [part~='base']:hover {
    background: var(--lr-option-hover-bg, var(--lr-color-brand-quiet));
  }

  /* Same shape as the current-qualified :active arm below, same reason: the plain hover rule above
     and :host(:state(current)) [part~='base'] are both (0,3,0), and the later one swallowed hover
     on the current option -- the row a roving-tabindex listbox leaves under the pointer. These
     arms are (0,4,0) so they out-rank it, and precede the :active block so a press still beats
     hover. Invisible with the default tokens (both fall back to --lr-color-brand-quiet), visible
     once a consumer retints --lr-option-hover-bg alone. */
  :host(:state(current):state(hover)) [part~='base'],
  :host(:state(current)) [part~='base']:hover {
    background: var(--lr-option-hover-bg, var(--lr-color-brand-quiet));
  }

  /* The second selector is not redundant: a mousedown focuses a focusable option, turning the host
     'current' on focusin, and :host(:state(current)) [part~='base'] below is (0,3,0) while a bare
     [part~='base']:active is only (0,2,0). Without the current-qualified arm -- (0,4,0), so it
     wins wherever it sits -- the current background swallowed the pressed one on every press an
     option receives in a roving-tabindex listbox. The two disabled :active rules below are also
     (0,4,0) and come later, so they still clear this background when disabled. */
  [part~='base']:active,
  :host(:state(current)) [part~='base']:active {
    background: var(
      --lr-option-active-bg,
      color-mix(
        in oklab,
        var(--lr-option-hover-bg, var(--lr-color-brand-quiet)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }

  :host(:state(current)) [part~='base'] {
    background: var(--lr-option-current-bg, var(--lr-color-brand-quiet));
    color: var(--lr-option-current-color, var(--current-text-color, var(--lr-color-text)));
  }

  :host(:state(selected)) [part~='base'] {
    font-weight: var(--lr-option-selected-font-weight, var(--lr-font-weight-semibold));
  }

  :host(:state(disabled)) [part~='base'],
  :host([disabled]) [part~='base'] {
    opacity: var(--lr-opacity-disabled);
  }

  :host(:state(disabled)) [part~='base']:hover,
  :host([disabled]) [part~='base']:hover {
    background: none;
  }

  :host(:state(disabled)) [part~='base']:active,
  :host([disabled]) [part~='base']:active {
    background: none;
  }

  [part~='checked-icon'],
  [part~='start'],
  [part~='end'] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: var(--lr-space-xs);
    line-height: var(--lr-line-height-none);
  }

  [part~='start'],
  [part~='end'] {
    flex: 0 1 40%;
    min-inline-size: 0;
    max-inline-size: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part~='checked-icon'] {
    color: var(--lr-option-checked-icon-color, var(--lr-color-brand));
  }

  [part~='checked-icon'][hidden],
  [part~='start'][hidden],
  [part~='end'][hidden] {
    display: none;
  }

  [part~='label'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
