import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* Component-local geometry knobs (defined on :host so each instance can
       tune its own geometry) — a fully-rounded pill/thumb
       needs a radius well past --lr-radius's small 0.375rem default, so
       it's expressed here rather than bent onto that shared token.
       Both track dimensions ride the shared size ladder
       (internal/sizes.styles.ts): the track is half the tier's control height, and its inline size
       keeps the 1.8:1 aspect ratio the control has always had. At the default "m" tier that is
       exactly the 1.25rem x 2.25rem it shipped with before it had a size at all. */
    --lr-switch-track-block-size: calc(var(--lr-form-control-height) * 0.5);
    --lr-switch-track-inline-size: calc(var(--lr-switch-track-block-size) * 1.8);
    --lr-switch-thumb-offset: var(--lr-size-2px);
    /* The track's resting fill, named so the hover and press mixes below have exactly one base to
       move away from in BOTH states -- the unchecked grey and the checked brand -- rather than two
       rules each restating a colour. */
    --lr-switch-track-fill: var(--lr-color-border);
  }
  [part~='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-s);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part~='base']:focus-visible {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Gives mouse users the same 'this is interactive' cue the :focus-visible ring above already
     gives keyboard users, and a press that reads as deeper than the hover. Gated on
     :host(:not(:disabled)) the same way lr-checkbox's/lr-radio's [part~='base']:hover rules are
     (this control isn't a native button, so a bare [part~='base']:hover would otherwise also fire
     while disabled).
     Both land on the TRACK, and both are colour mixes. This was a filter: brightness() lift on
     [part~='base'] before 8.0.0, which was wrong twice over: a filter multiplies every channel, so
     it moved the track only by luck of its tone, and it applies to the whole subtree, so it faded
     the label text sitting next to the track as well. */
  :host(:not(:disabled)) [part~='base']:hover [part~='track'] {
    background: color-mix(in oklab, var(--lr-switch-track-fill), var(--lr-color-mix-partner) var(--lr-color-mix-hover));
  }
  :host(:not(:disabled)) [part~='base']:active [part~='track'] {
    background: color-mix(in oklab, var(--lr-switch-track-fill), var(--lr-color-mix-partner) var(--lr-color-mix-active));
  }
  :host(:disabled) [part~='base'] {
    cursor: not-allowed;
    opacity: var(--lr-opacity-disabled);
  }

  [part~='track'] {
    position: relative;
    flex: 0 0 auto;
    /* content-box, not the library-wide border-box default: the thumb is absolutely positioned
       against this element's padding box, and its own size/travel math (below) is derived from
       these same declared dimensions. Under border-box, a consumer-added ::part(track) border
       would eat into the padding box without the thumb shrinking to match, breaking clearance
       symmetry on the far edge. content-box keeps the padding box exactly this declared size
       regardless of any border width, so an added border grows the track's outer footprint
       instead -- the same "sits outside, doesn't touch the fill" effect the docs already point
       consumers wanting a rim toward via outline. */
    box-sizing: content-box;
    inline-size: var(--width, var(--lr-switch-track-inline-size));
    block-size: var(--height, var(--lr-switch-track-block-size));
    border-radius: var(--lr-radius-pill);
    background: var(--lr-switch-track-fill);
    transition: background-color var(--lr-transition-fast);
  }
  [part~='track'][part~='checked'] {
    --lr-switch-track-fill: var(--lr-color-brand);
  }

  [part='thumb'] {
    position: absolute;
    inset-block-start: var(--lr-switch-thumb-offset);
    inset-inline-start: var(--lr-switch-thumb-offset);
    inline-size: var(--thumb-size, calc(var(--height, var(--lr-switch-track-block-size)) - (var(--lr-switch-thumb-offset) * 2)));
    block-size: var(--thumb-size, calc(var(--height, var(--lr-switch-track-block-size)) - (var(--lr-switch-thumb-offset) * 2)));
    border-radius: 50%;
    background: var(--lr-color-surface);
    /* Animates the logical 'inset-inline-start' rather than a physical
       'transform: translateX()' so the slide direction mirrors correctly
       under dir="rtl" — consistent with this library's CSS-logical-
       properties approach to RTL (see internal/lyra-element.ts). */
    transition: inset-inline-start var(--lr-transition-fast);
  }
  [part~='track'][part~='checked'] [part='thumb'] {
    inset-inline-start: calc(
      var(--width, var(--lr-switch-track-inline-size)) -
        var(--thumb-size, calc(var(--height, var(--lr-switch-track-block-size)) - (var(--lr-switch-thumb-offset) * 2))) -
        var(--lr-switch-thumb-offset)
    );
  }

  /* No explicit "display" here (unlike e.g. lr-combobox's
     [part='form-control-label']), so the UA stylesheet's default
     "[hidden] { display: none }" rule needs no author-side override to
     take effect when hasLabelSlot is false. */
  [part='label'] {
    font-size: var(--lr-font-size-md-sm);
    color: var(--lr-color-text);
  }

  [part~='hint'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-text-quiet);
  }
  /* :empty never matches here -- same fix as [part='hint']/[part='error'] on lr-select. */
  [part~='hint'][hidden] {
    display: none;
  }
  [part='error'] {
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-sm);
    color: var(--lr-color-danger);
  }
  [part='error'][hidden] {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    [part~='track'],
    [part='thumb'] {
      transition: none !important;
    }
  }
  [part='form-control'],
  [part='label'],
  [part~='hint'],
  [part='error'] {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
`;
