import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-flex;
    /* This button's own default resting/hover/press glyph tone, set on the HOST for organization
       only -- neither reads --lr-icon-button-color* to redeclare that SAME name (the loop this
       fix removes). -color-hover and -color-active DO cross-reference a DIFFERENT, more-resting
       public tier each (the resting --lr-icon-button-color, and the hover one, respectively) so an
       ancestor override of just that tier still shapes the ones layered on top of it; that is safe
       because nothing here re-declares --lr-icon-button-color or -color-hover from these. The
       trigger rule below writes these onto lr-icon-button's own --_lr-icon-button-color-*-default
       tier (never the public --lr-icon-button-color* name), so an ancestor theme wrapper's own
       --lr-icon-button-* still wins: lr-icon-button's own stylesheet already checks the public
       token FIRST, ahead of any default a composing parent supplies. */
    --_lr-copy-button-color: var(--lr-color-text-quiet);
    --_lr-copy-button-color-hover: var(--lr-icon-button-color, var(--lr-color-text));
    --_lr-copy-button-color-active: var(
      --lr-icon-button-color-hover,
      var(--lr-icon-button-color, var(--lr-color-text))
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
     stays is this button's own resting foreground, expressed through lr-icon-button's private
     --_lr-icon-button-color*-default tier rather than the public token itself, so a consumer
     setting --lr-icon-button-* on an ancestor still reaches it exactly as it reaches a standalone
     icon button. The two outcome colours below stay on the public token directly (see their own
     comment): they are an unconditional state override, not a derived default.
     Every selector matches with ~= rather than =, because the trigger's part list gains a state
     token (base base-error) while the feedback state is showing. */
  [part~='base'] {
    --_lr-icon-button-color-default: var(--_lr-copy-button-color);
    --_lr-icon-button-color-hover-default: var(--_lr-copy-button-color-hover);
    --_lr-icon-button-color-active-default: var(--_lr-copy-button-color-active);
  }
  /* The outcome colours repaint the glyph while the composed control keeps its own hover/press
     background. Unlike the resting rule above (which only ever sets the PRIVATE
     --_lr-icon-button-color*-default tier), these declare the PUBLIC --lr-icon-button-color* token
     directly and unconditionally -- a direct declaration on this element always wins over the
     resting rule's default AND over whatever would otherwise be inherited from an ancestor, so an
     outcome colour is a hard override, not a themeable default: it wins regardless of selector
     specificity or source order relative to the resting rule (a different property is set by
     each), and it is not meant to be retunable by an ancestor's own --lr-icon-button-color* the way
     the resting tone is. The state token never appears without 'base' (the list is
     'base base-success'), so both tokens are named in the selector purely so a consumer's own
     ::part(base) rule still sees the same compound it always has.
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
