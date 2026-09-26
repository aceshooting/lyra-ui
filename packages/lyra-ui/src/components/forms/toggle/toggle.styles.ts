import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    max-inline-size: 100%;
  }

  /* An owning group projects its tier without rewriting the toggle's own size: explicit inherit
     beats the local ladder default and reads the group host's already-resolved knobs, including
     its coarse-pointer floor. Leaving the group removes the private marker and restores the
     toggle's own tier. */
  :host([data-lr-group-size]) {
    --lr-form-control-height: inherit;
    --lr-form-control-font-size: inherit;
    --lr-form-control-padding-inline: inherit;
    --lr-form-control-padding-block: inherit;
    --lr-form-control-gap: inherit;
    --lr-form-control-radius: inherit;
  }

  [part~='button'] {
    --_lr-toggle-border-default: transparent;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--lr-toggle-gap, var(--lr-form-control-gap));
    /* WCAG 2.5.8: the whole button is the target, and both axes keep a 1.5rem floor so even an
       empty 2xs tier stays conformant. The inline floor also makes an icon-only toggle square. */
    min-block-size: max(var(--lr-form-control-height), var(--lr-size-1-5rem));
    min-inline-size: max(var(--lr-form-control-height), var(--lr-size-1-5rem));
    max-inline-size: 100%;
    margin: 0;
    padding-block: 0;
    padding-inline: var(--lr-toggle-padding-inline, var(--lr-space-s));
    /* Plain keeps a transparent border so geometry is identical across appearances, and the
       boundary becomes a system colour under forced colours. */
    border: var(--lr-border-width-thin) solid
      var(--lr-toggle-border-color, var(--_lr-toggle-border-default));
    border-radius: var(--lr-toggle-radius, var(--lr-form-control-radius));
    background: var(--lr-toggle-background, transparent);
    color: var(--lr-toggle-color, var(--lr-color-text));
    font: inherit;
    font-size: var(--lr-form-control-font-size);
    font-weight: var(--lr-font-weight-medium);
    line-height: var(--lr-line-height-snug);
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }

  /* A control boundary, not a decorative edge (WCAG 1.4.11), so it keeps the full border token. */
  [part~='button'][data-appearance='outlined'] {
    --_lr-toggle-border-default: var(--lr-color-border);
  }

  /* The loud border is the pressed state's 3:1 indicator; a quiet fill alone would not meet
     WCAG 1.4.11 against the surface. */
  :host([pressed]) [part~='button'] {
    z-index: var(--lr-layer-content);
    background: var(--lr-toggle-pressed-background, var(--lr-color-fill-quiet));
    color: var(--lr-toggle-pressed-color, var(--lr-color-on-quiet));
    border-color: var(--lr-toggle-pressed-border-color, var(--lr-color-border-loud));
  }

  :where([part~='button']):not(:disabled):hover {
    background: var(
      --lr-toggle-hover-background,
      color-mix(in oklab, var(--lr-toggle-background, transparent), var(--lr-color-mix-partner) var(--lr-color-mix-hover))
    );
  }

  :where([part~='button']):not(:disabled):active {
    background: color-mix(
      in oklab,
      var(--lr-toggle-hover-background, var(--lr-toggle-background, transparent)),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  :host([pressed]) :where([part~='button']):not(:disabled):hover {
    background: color-mix(
      in oklab,
      var(--lr-toggle-hover-background, var(--lr-toggle-pressed-background, var(--lr-color-fill-quiet))),
      var(--lr-color-mix-partner) var(--lr-color-mix-hover)
    );
  }

  :host([pressed]) :where([part~='button']):not(:disabled):active {
    background: color-mix(
      in oklab,
      var(--lr-toggle-hover-background, var(--lr-toggle-pressed-background, var(--lr-color-fill-quiet))),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }

  /* The ring sits one layer above a pressed neighbour, whose joined border overlaps this one. */
  [part~='button']:focus-visible {
    z-index: calc(var(--lr-layer-content) + 1);
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  /* The host is not form-associated, so :host(:disabled) can never match; the native button can. */
  [part~='button']:disabled {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  /* Joined runs are measured by the owning group from real geometry, so a separated, wrapped or
     vertically stacked toggle keeps all four corners. Logical properties mirror under RTL. */
  [part~='button'][data-run='start'] {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  [part~='button'][data-run='middle'] {
    border-radius: 0;
  }

  [part~='button'][data-run='end'] {
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  [part~='button'][data-run='middle'],
  [part~='button'][data-run='end'] {
    margin-inline-start: calc(-1 * var(--lr-border-width-thin));
  }

  [part='label'] {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [part='start'],
  [part='end'] {
    display: inline-flex;
    align-items: center;
    flex: none;
    min-inline-size: 0;
    max-inline-size: 40%;
    overflow: hidden;
  }

  /* A slot is itself an element child, so :empty never identifies an unassigned wrapper; the
     slot-presence controller reflects real emptiness through hidden instead. */
  [part='start'][hidden],
  [part='end'][hidden] {
    display: none;
  }

  /* Last, so each rule here is at least as specific as the one it overrides. Pressed states keep
     system colours under the pointer, unpressed hover and press get outline affordances because
     the user agent replaces their backgrounds, and disabled reads as GrayText at full opacity. */
  @media (forced-colors: active) {
    :where([part~='button']):not(:disabled):hover {
      outline: var(--lr-border-width-thin) dashed Highlight;
      outline-offset: var(--lr-size-neg-1px);
    }

    :where([part~='button']):not(:disabled):active {
      outline: var(--lr-border-width-medium) double Highlight;
    }

    :host([pressed]) [part~='button'],
    :host([pressed]) [part~='button']:is(:hover, :active) {
      forced-color-adjust: none;
      background-color: Highlight;
      color: HighlightText;
      border-color: Highlight;
    }

    [part~='button']:disabled,
    :host([pressed]) [part~='button']:disabled {
      forced-color-adjust: none;
      background-color: Canvas;
      color: GrayText;
      border-color: GrayText;
      opacity: 1;
    }

    :host([pressed]) [part~='button']:disabled {
      outline: var(--lr-border-width-medium) solid GrayText;
      outline-offset: var(--lr-size-neg-1px);
    }
  }
`;
