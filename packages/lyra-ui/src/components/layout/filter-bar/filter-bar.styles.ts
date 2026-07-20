import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
  }
  [part='controls'] {
    display: flex;
    flex-wrap: wrap;
    /* end (not center/stretch): every composed control (lr-select/lr-combobox/lr-date-input/
       lr-input) renders its own label above its own field, so aligning to the field row's own
       baseline keeps the reset button (no label above it) sitting flush with the fields beside
       it. */
    align-items: flex-end;
    gap: var(--lr-space-s);
  }
  [part='filter-control'] {
    flex: 1 1 var(--lr-size-12rem);
    min-inline-size: 0;
  }
  [part='reset-button'] {
    flex: 0 0 auto;
  }
  [part='status'] {
    flex: 0 0 auto;
  }
  [part='active-filters'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-xs);
  }
  /* lr-chip has no disabled property of its own to bind ?disabled to (unlike every other
     composed control in this component) -- the chip itself is un-rendered as \`removable\` while
     the filter bar is disabled (see render()), so there is no clickable remove affordance left to
     gate; this only supplies the same dimmed visual treatment every other disabled sub-control
     gets. Shared library-wide disabled-state token -- see lr-checkbox/lr-select/lr-menu-item. */
  :host([disabled]) [part='chip'] {
    opacity: var(--lr-opacity-disabled);
  }
`;
