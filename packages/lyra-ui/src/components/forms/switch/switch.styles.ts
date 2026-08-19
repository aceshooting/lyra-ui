import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    max-inline-size: 100%;
    /* Component-local geometry knobs on :host so each instance can tune its own. A fully-rounded
       pill/thumb needs a radius well past --lr-radius's 0.375rem default, so it lives here rather
       than bent onto that shared token. Both track dimensions ride the shared size ladder
       (internal/sizes.styles.ts): half the tier's control height, inline size at the control's
       long-standing 1.8:1 ratio -- at "m", exactly the 1.25rem x 2.25rem it shipped with. */
    --_lr-switch-track-block-size: calc(var(--lr-form-control-height) * 0.5);
    --_lr-switch-track-inline-size: calc(
      var(--lr-switch-track-block-size, var(--_lr-switch-track-block-size)) *
        1.8
    );
    --_lr-switch-thumb-offset: var(--lr-size-2px);
    /* The track's resting fill, named so the hover and press mixes below have exactly one base in
       BOTH states -- unchecked grey and checked brand -- not two rules restating a colour. */
    --_lr-switch-track-fill: var(--lr-color-border);
  }
  .switch-layout {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-switch-gap, var(--lr-space-s));
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    max-inline-size: 100%;
  }
  .switch-owner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
  }
  .switch-owner:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Mouse-pointer parity with the :focus-visible ring above, plus a deeper press. Gated on
     :host(:not(:disabled)) like lr-checkbox's/lr-radio's [part~='base']:hover rules -- not a native
     button, so a bare [part~='base']:hover would also fire while disabled. Both land on the TRACK
     as colour mixes: the pre-8.0.0 filter: brightness() lift on [part~='base'] multiplied every
     channel (moving the track only by luck of its tone) and applied to the whole subtree (fading
     the label text beside it). */
  :host(:not(:disabled)) .switch-layout:hover [part~="track"] {
    background: var(
      --lr-switch-track-hover-fill,
      color-mix(
        in oklab,
        var(--lr-switch-track-fill, var(--_lr-switch-track-fill)),
        var(--lr-color-mix-partner) var(--lr-color-mix-hover)
      )
    );
  }
  :host(:not(:disabled)) .switch-layout:active [part~="track"] {
    background: var(
      --lr-switch-track-active-fill,
      color-mix(
        in oklab,
        var(--lr-switch-track-fill, var(--_lr-switch-track-fill)),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  :host(:disabled) .switch-layout {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part~="track"] {
    position: relative;
    flex: 0 0 auto;
    /* content-box, not the library-wide border-box default: the thumb is absolutely positioned
       against this element's padding box and its size/travel math below derives from these declared
       dimensions, so under border-box a consumer-added ::part(track) border would eat the padding
       box without the thumb shrinking to match, breaking far-edge clearance symmetry. content-box
       grows the outer footprint instead -- the "sits outside, doesn't touch the fill" effect the
       docs point a consumer wanting a rim toward via outline. */
    box-sizing: content-box;
    inline-size: var(
      --width,
      var(--lr-switch-track-inline-size, var(--_lr-switch-track-inline-size))
    );
    block-size: var(
      --height,
      var(--lr-switch-track-block-size, var(--_lr-switch-track-block-size))
    );
    border-radius: var(--lr-radius-pill);
    background: var(--lr-switch-track-fill, var(--_lr-switch-track-fill));
    transition: background-color var(--lr-transition-fast);
  }
  [part~="track"][part~="checked"] {
    --_lr-switch-track-fill: var(
      --lr-switch-checked-track-fill,
      var(--lr-color-brand)
    );
  }

  [part="thumb"] {
    position: absolute;
    inset-block-start: var(
      --lr-switch-thumb-offset,
      var(--_lr-switch-thumb-offset)
    );
    inset-inline-start: var(
      --lr-switch-thumb-offset,
      var(--_lr-switch-thumb-offset)
    );
    inline-size: var(
      --thumb-size,
      calc(
        var(
            --height,
            var(
              --lr-switch-track-block-size,
              var(--_lr-switch-track-block-size)
            )
          ) -
          (var(--lr-switch-thumb-offset, var(--_lr-switch-thumb-offset)) * 2)
      )
    );
    block-size: var(
      --thumb-size,
      calc(
        var(
            --height,
            var(
              --lr-switch-track-block-size,
              var(--_lr-switch-track-block-size)
            )
          ) -
          (var(--lr-switch-thumb-offset, var(--_lr-switch-thumb-offset)) * 2)
      )
    );
    border-radius: 50%;
    background: var(--lr-switch-thumb-fill, var(--lr-color-surface));
    /* Animates the logical 'inset-inline-start' rather than a physical 'transform: translateX()',
       so the slide direction mirrors correctly under dir="rtl" -- this library's CSS-logical-
       properties approach to RTL (see internal/lyra-element.ts). */
    transition: inset-inline-start var(--lr-transition-fast);
  }
  [part~="track"][part~="checked"] [part="thumb"] {
    inset-inline-start: calc(
      var(
          --width,
          var(
            --lr-switch-track-inline-size,
            var(--_lr-switch-track-inline-size)
          )
        ) -
        var(
          --thumb-size,
          calc(
            var(
                --height,
                var(
                  --lr-switch-track-block-size,
                  var(--_lr-switch-track-block-size)
                )
              ) -
              (
                var(--lr-switch-thumb-offset, var(--_lr-switch-thumb-offset)) *
                  2
              )
          )
        ) - var(--lr-switch-thumb-offset, var(--_lr-switch-thumb-offset))
    );
  }

  /* No explicit "display" here (unlike lr-combobox's [part='form-control-label']), so the UA
     stylesheet's default "[hidden] { display: none }" rule needs no author-side override when
     hasLabelSlot is false. */
  [part="label"] {
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text);
  }

  [part~="hint"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches here -- same fix as [part='hint']/[part='error'] on lr-select. */
  [part~="hint"][hidden] {
    display: none;
  }
  [part="error"] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part="error"][hidden] {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    [part~="track"],
    [part="thumb"] {
      transition: none !important;
    }
  }
  [part="form-control"],
  [part="label"],
  [part~="hint"],
  [part="error"] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: break-word;
  }
`;
