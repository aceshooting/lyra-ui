import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    color: var(--lr-color-warning);
    /* The 'm' step reproduces the fixed symbol size this component had before the size property
       existed; every other step of the shared six-step ladder changes this private default. An
       unset size and size="m" resolve identically, while an inherited or direct public size stays
       authoritative. A type ramp, not the shared --lr-form-control-* ladder: a rating has no
       control box for text, only glyphs whose size IS the control. */
    --_lr-rating-size: var(--symbol-size, var(--lr-font-size-xl));
  }
  :host([data-effective-size="2xs"]) {
    --_lr-rating-size: var(--symbol-size, var(--lr-font-size-sm));
  }
  :host([data-effective-size="xs"]) {
    --_lr-rating-size: var(--symbol-size, var(--lr-font-size-m));
  }
  :host([data-effective-size="s"]) {
    --_lr-rating-size: var(--symbol-size, var(--lr-font-size-lg));
  }
  :host([data-effective-size="m"]) {
    --_lr-rating-size: var(--symbol-size, var(--lr-font-size-xl));
  }
  :host([data-effective-size="l"]) {
    --_lr-rating-size: var(--symbol-size, var(--lr-font-size-2xl));
  }
  :host([data-effective-size="xl"]) {
    --_lr-rating-size: var(--symbol-size, var(--lr-font-size-3xl));
  }
  /* justify-content pairs with the min-inline-size hit-area floor below: a low-max rating (a
     single star, say) is narrower than that floor, and the default (normal => flex-start) would
     push the stars against the leading edge of an otherwise centred control. A no-op once the
     stars fill the floor. */
  [part~="base"] {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: var(--lr-rating-gap, var(--symbol-spacing, var(--lr-space-xs)));
    min-inline-size: var(--lr-icon-button-size);
    max-inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
  }
  /* Pointer cursor only while the rating is settable: readonly or disabled it is not editable by
     click/drag, so an unconditional cursor: pointer would cue an interaction setValue()
     (rating.class.ts) refuses. :disabled not [disabled], because only the former tracks an
     ancestor <fieldset disabled>, which formDisabledCallback() honours without writing the host's
     own attribute. */
  :host(:not(:disabled):not([readonly])) [part~="base"] {
    cursor: pointer;
  }
  :host(:focus-visible) [part~="base"] {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* The mouse-user counterpart of the :focus-visible outline above, mirroring lr-checkbox's and
     lr-radio's [part~='base']:hover pattern. Gated on :host(:not(:disabled):not([readonly])) like
     the pointer-cursor rule above: a readonly rating stays focusable (rating.class.ts's tabindex)
     but is neither settable nor hoverable. A same-selector [part='star']:hover:not(:disabled)
     could express neither state -- the star is a span, so :disabled never matches, and readonly
     lives on the host. */
  :host(:not(:disabled):not([readonly])) [part~="base"]:hover [part="star"] {
    color: var(
      --lr-rating-empty-color,
      var(--symbol-color, var(--lr-color-border-strong))
    );
  }
  /* Pressing commits a value, so the pressed cue is on the star under the pointer, not the whole
     row -- the row-wide hover cue says settable, this one says which. */
  :host(:not(:disabled):not([readonly])) [part~="base"]:active [part="star"] {
    color: var(
      --lr-rating-active-color,
      color-mix(
        in oklab,
        var(
          --lr-rating-empty-color,
          var(--symbol-color, var(--lr-color-border-strong))
        ),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part="star"] {
    position: relative;
    display: inline-flex;
    flex: 1 1 var(--lr-rating-size, var(--_lr-rating-size));
    min-inline-size: 0;
    max-inline-size: var(--lr-rating-size, var(--_lr-rating-size));
    overflow: hidden;
    color: var(
      --lr-rating-empty-color,
      var(--symbol-color, var(--lr-color-border))
    );
    font-size: var(--lr-rating-size, var(--_lr-rating-size));
    line-height: var(--lr-line-height-none);
  }
  [part="star"] svg {
    display: block;
    max-inline-size: 100%;
  }
  [part="star"] [aria-hidden="true"] {
    display: inline-flex;
    inline-size: 100%;
    max-inline-size: 100%;
    overflow: hidden;
  }
  [part="star"] [aria-hidden="true"] > * {
    max-inline-size: 100%;
  }
  /* white-space keeps a consumer getSymbol() glyph at its natural width inside the
     percentage-wide overlay, so overflow: hidden clips it mid-symbol -- the partial fill --
     instead of reflowing it. */
  [part="star-fill"] {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    block-size: 100%;
    overflow: hidden;
    white-space: nowrap;
    color: var(
      --lr-rating-fill,
      var(--symbol-color-active, var(--lr-color-warning))
    );
  }
  :host(:disabled) [part~="base"] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }
  :host([readonly]) [part~="base"] {
    cursor: default;
  }
`;
