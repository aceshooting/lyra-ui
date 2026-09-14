import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* Captured on the HOST, where this component declares no --lr-icon-button-color of its own, so
       each var() reads whatever an ancestor theme wrapper set and falls back to this button's own
       quiet resting tone only when nothing did. The trigger rule below then re-declares the public
       token from the capture. Declaring the quiet tone directly on the trigger would shadow the
       inherited value instead of falling back to it -- the exact trap the library's
       component-scoped-theme-input convention exists to avoid. */
    --_lr-copy-button-color: var(--lr-icon-button-color, var(--lr-color-text-quiet));
    --_lr-copy-button-color-hover: var(
      --lr-icon-button-color-hover,
      var(--lr-icon-button-color, var(--lr-color-text))
    );
    --_lr-copy-button-color-active: var(
      --lr-icon-button-color-active,
      var(--lr-icon-button-color-hover, var(--lr-icon-button-color, var(--lr-color-text)))
    );
  }
  lr-tooltip {
    display: inline-flex;
  }
  slot:not([name]) {
    display: contents;
  }
  /* The trigger IS an lr-icon-button now, so the hit-area floor, the radius, the hover/press mixes
     and the focus ring all come from that one component instead of being re-derived here. What
     stays is this button's own resting foreground and its two outcome colours, expressed through
     the composed control's public token contract so a consumer setting --lr-icon-button-* on an
     ancestor reaches it exactly as it reaches a standalone icon button.
     Every selector matches with ~= rather than =, because the trigger's part list gains a state
     token (base base-error) while the feedback state is showing. */
  [part~='base'] {
    --lr-icon-button-color: var(--_lr-copy-button-color);
    --lr-icon-button-color-hover: var(--_lr-copy-button-color-hover);
    --lr-icon-button-color-active: var(--_lr-copy-button-color-active);
  }
  /* The outcome colours repaint the glyph while the composed control keeps its own hover/press
     background. The state token never appears without 'base' (the list is 'base base-success'), so
     both tokens are named in the selector: that makes these rules (0,2,0) against the resting
     rule's (0,1,0), and the outcome wins on SPECIFICITY rather than on source order. Written as a
     lone [part~='base-success'] they would tie at (0,1,0) and depend on staying below the resting
     rule -- a reorder of this sheet would then silently stop applying the success/error colour.
     Each re-points the hover and press colours too: keyboard activation raises :active with no
     :hover, and the failure colour must not be repainted away by either. */
  [part~='base'][part~='base-success'] {
    --lr-icon-button-color: var(--success-color, var(--lr-color-success));
    --lr-icon-button-color-hover: var(--success-color, var(--lr-color-success));
    --lr-icon-button-color-active: var(--success-color, var(--lr-color-success));
  }
  [part~='base'][part~='base-error'] {
    --lr-icon-button-color: var(--error-color, var(--lr-color-danger));
    --lr-icon-button-color-hover: var(--error-color, var(--lr-color-danger));
    --lr-icon-button-color-active: var(--error-color, var(--lr-color-danger));
  }
  [part~='copy-icon'],
  [part~='success-icon'],
  [part~='error-icon'] {
    display: inline-flex;
  }
  [part~='copy-icon'] svg,
  [part~='success-icon'] svg,
  [part~='error-icon'] svg {
    display: block;
  }
  /* The outcome is announced, not shown: the button is icon-only, so the status text exists for
     assistive technology alone. Same clipped-1px pattern lr-pagination's live region uses. */
  [part='feedback'] {
    position: absolute;
    inline-size: var(--lr-size-1px);
    block-size: var(--lr-size-1px);
    padding: 0;
    margin: var(--lr-size-neg-1px);
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
`;
