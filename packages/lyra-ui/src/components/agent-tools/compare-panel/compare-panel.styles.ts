import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
    --_lr-compare-panel-max-height: var(--lr-size-24rem);
  }

  [part="base"] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-direction: column;
    gap: var(--lr-space-m);
    color: var(--lr-color-text);
  }

  [part="prompt"] {
    padding: var(--lr-space-s) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface-raised);
  }
  [part="prompt"][hidden] {
    display: none;
  }

  [part="panes"] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    gap: var(--lr-space-m);
    align-items: stretch;
  }

  [part="pane-a"],
  [part="pane-b"] {
    flex: 1 1 0;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    padding: var(--lr-space-m);
    max-block-size: var(
      --lr-compare-panel-max-height,
      var(--_lr-compare-panel-max-height)
    );
    overflow-x: hidden;
    overflow-y: auto;
  }
  [part="pane-a"]:focus-visible,
  [part="pane-b"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(-1 * var(--lr-focus-ring-width));
  }

  [part="pane-header"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font-weight: var(--lr-font-weight-semibold);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    text-transform: uppercase;
    letter-spacing: var(--lr-size-0-02em);
  }

  [part="vote-bar"] {
    display: flex;
    min-inline-size: 0;
    max-inline-size: 100%;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
  }

  [part="vote-button"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
    font: inherit;
    font-size: var(--lr-font-size-sm);
    border-radius: var(--lr-radius-pill);
    padding: var(--lr-space-xs) var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    cursor: pointer;
    transition: background-color var(--lr-transition-fast),
      border-color var(--lr-transition-fast);
  }
  [part="vote-button"]:hover {
    background: var(--lr-color-brand-quiet);
  }
  /* Pressed pushes the hovered tint a further --lr-color-mix-active toward --lr-color-mix-partner,
     which follows the text colour, so it is a deeper step than hover in both themes, not a repeat.
     */
  [part="vote-button"]:active {
    background: color-mix(
      in oklab,
      var(--lr-color-brand-quiet),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  /* After the two arms above and at their own (0,2,0), so source order hands the cast vote its
     selected fill under the pointer -- the generic brand-quiet hover tint reads as unselected.
     Wrapping [data-selected] in :where() dropped this to (0,1,0) and inverted that: both pointer
     arms won and the documented --lr-compare-panel-selected-background vanished under the pointer.
     The held state is restored by the rule below, not by yielding here. */
  [part="vote-button"][data-selected] {
    background: var(
      --lr-compare-panel-selected-background,
      var(--lr-color-brand-quiet)
    );
    border-color: var(
      --lr-compare-panel-selected-border-color,
      var(--lr-color-brand)
    );
    color: var(--lr-compare-panel-selected-color, var(--lr-color-brand));
    font-weight: var(
      --lr-compare-panel-selected-font-weight,
      var(--lr-font-weight-semibold)
    );
  }
  /* The selected button's own held state, at (0,3,0) so it out-ranks the [data-selected] rule above.
     Re-clicking an already-voted button re-emits the cancelable lr-vote, which a host commonly
     answers by advancing to the next pair, so the press must land visibly; losing the hover tint
     there is the deliberate half of the trade. Mixes from --lr-compare-panel-selected-background so
     a retinted selection gets a deeper tier of itself, not the stock token. */
  [part="vote-button"][data-selected]:active {
    background: color-mix(
      in oklab,
      var(
        --lr-compare-panel-selected-background,
        var(--lr-color-brand-quiet)
      ),
      var(--lr-color-mix-partner) var(--lr-color-mix-active)
    );
  }
  [part="vote-button"]:disabled {
    opacity: var(--lr-opacity-disabled);
    cursor: not-allowed;
  }
  [part="vote-button"]:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }

  @container (max-inline-size: 639.98px) {
    [part="panes"] {
      flex-direction: column;
    }
  }
`;
