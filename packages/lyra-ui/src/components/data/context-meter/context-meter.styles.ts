import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    inline-size: 100%;
    min-inline-size: 0;
  }
  :host([shape='ring']) {
    display: inline-block;
    inline-size: var(--lr-size-8em);
    block-size: var(--lr-size-8em);
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-xs);
  }
  :host([shape='ring']) [part='base'] {
    inline-size: 100%;
    block-size: 100%;
  }

  [part='label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
    font-family: var(--lr-font);
  }

  /* --- bar variant ------------------------------------------------- */
  [part='track'] {
    position: relative;
    display: flex;
    align-items: stretch;
    overflow: hidden;
    block-size: var(--lr-context-meter-track-size, var(--lr-size-0-5rem));
    border-radius: var(--lr-context-meter-track-radius, calc(var(--lr-radius) * 0.5));
    /* Quiet neutral fill for the unfilled remainder: deliberately lighter than a 'neutral'-tone
       segment (var(--lr-color-border) at full strength below), so counted-but-uncolored data
       stays visually distinct from not counted at all. */
    background: var(
      --lr-context-meter-track-bg,
      color-mix(in srgb, var(--lr-color-border) 30%, transparent)
    );
  }
  [part~='segment'] {
    display: block;
    flex: 0 0 auto;
    /* A near-zero-ratio segment's own inter-segment separator border (below) can equal or exceed
       its computed flex-basis width, leaving nothing but surface-colored hairline where its tone
       should be. Floor it at twice the separator's own width so the tone always has visible fill
       past the border, derived from the same border-width token rather than a new literal. */
    min-inline-size: calc(var(--lr-border-width-thin) * 2);
    block-size: 100%;
    background: var(--lr-color-border);
    transition: flex-basis var(--lr-transition-base);
  }
  /* A hairline seam between adjacent segments, painted in the surface color rather than as real
     gap spacing, so two adjacent same-tone segments (e.g. two 'neutral' entries) read as separate
     quantities instead of one block. The logical property keeps it RTL-correct without extra
     math. */
  [part~='segment']:not(:first-of-type) {
    border-inline-start: var(--lr-border-width-thin) solid
      var(--lr-context-meter-segment-seam-color, var(--lr-color-surface));
  }
  [part~='segment'][data-tone='brand'] {
    background: var(--lr-context-meter-tone-brand-bg, var(--lr-color-brand));
  }
  [part~='segment'][data-tone='success'] {
    background: var(--lr-context-meter-tone-success-bg, var(--lr-color-success));
  }
  [part~='segment'][data-tone='warning'] {
    background: var(--lr-context-meter-tone-warning-bg, var(--lr-color-warning));
  }
  [part~='segment'][data-tone='danger'] {
    background: var(--lr-context-meter-tone-danger-bg, var(--lr-color-danger));
  }
  [part~='segment'][style*='--lr-context-meter-segment-color'] {
    background: var(--lr-context-meter-segment-color);
  }

  /* --- legend --------------------------------------------------------- */
  /* The key grows a row per consumer-supplied segment and each label grows with translation, so it
     wraps rather than overflows; min-inline-size: 0 on every item shrinks a long label inside its
     own row instead of widening the meter's allocation. Same shape and part names as
     lr-sequence-strip's legend. */
  [part='legend'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-2xs) var(--lr-space-s);
    margin-block-start: var(--lr-space-xs);
    font-size: var(--lr-font-size-xs);
    color: var(--lr-color-text-quiet);
  }
  [part~='legend-item'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    min-inline-size: 0;
  }
  [part='legend-swatch'] {
    flex: none;
    inline-size: var(--lr-context-meter-legend-swatch-size, var(--lr-size-0-625rem));
    block-size: var(--lr-context-meter-legend-swatch-size, var(--lr-size-0-625rem));
    border-radius: var(--lr-radius-xs);
    /* The chip reproduces the option's data colour as [part~='segment'] does -- same tone ladder,
       same inline custom-property escape -- so a swatch can never disagree with its band. */
    background: var(--lr-color-border);
  }
  [part='legend-swatch'][data-tone='brand'] {
    background: var(--lr-context-meter-tone-brand-bg, var(--lr-color-brand));
  }
  [part='legend-swatch'][data-tone='success'] {
    background: var(--lr-context-meter-tone-success-bg, var(--lr-color-success));
  }
  [part='legend-swatch'][data-tone='warning'] {
    background: var(--lr-context-meter-tone-warning-bg, var(--lr-color-warning));
  }
  [part='legend-swatch'][data-tone='danger'] {
    background: var(--lr-context-meter-tone-danger-bg, var(--lr-color-danger));
  }
  [part='legend-swatch'][style*='--lr-context-meter-segment-color'] {
    background: var(--lr-context-meter-segment-color);
  }
  [part='legend-label'] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  /* --- interactive mode ------------------------------------------------- */
  /* Interactive mode swaps each band and each legend row for a real control, so the reset below only
     undoes the native button chrome -- every colour, size and seam rule above still targets the
     part and applies unchanged. Deliberately no background declaration in the band reset: the fill is
     the tone ladder's, and a reset background would outrank the neutral default. */
  button[part~='segment'] {
    appearance: none;
    padding: 0;
    border: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  /* The band's outline is drawn INSIDE it: the track clips its overflow (that is what rounds the
     bar's ends), so a positive outline-offset would put the focus ring where nothing can paint it.
     Outline rather than a fill change keeps the band's own colour -- which is the datum -- intact. */
  button[part~='segment']:where(:not(:disabled)):where(:hover) {
    outline: var(--lr-border-width-thin) solid var(--lr-color-text-quiet);
    outline-offset: calc(var(--lr-border-width-thin) * -1);
  }
  button[part~='segment']:where(:not(:disabled)):where(:active) {
    outline-color: var(--lr-color-text);
  }
  button[part~='segment']:where(:focus-visible) {
    outline: var(--lr-focus-ring);
    outline-offset: calc(var(--lr-focus-ring-width) * -1);
  }
  /* An arc has no box to outline per segment -- every arc shares the ring's bounding box -- so the
     ring reports which arc is involved by dimming it, and keeps the shared outline for the "focus
     is in here" half of the signal. */
  :host([shape='ring']) [part~='segment']:where(:not([aria-disabled='true'])):where(:hover) {
    opacity: 0.8;
  }
  :host([shape='ring']) [part~='segment']:where(:not([aria-disabled='true'])):where(:active) {
    opacity: 0.6;
  }
  :host([shape='ring']) [part~='segment']:where(:focus-visible) {
    opacity: 0.8;
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  button[part~='legend-item'] {
    appearance: none;
    padding: var(--lr-space-2xs);
    border: 0;
    border-radius: var(--lr-radius-xs);
    background: none;
    font: inherit;
    color: inherit;
    text-align: start;
    cursor: pointer;
    transition: var(--lr-transition-interactive);
  }
  button[part~='legend-item']:where(:not(:disabled)):where(:hover) {
    background: var(--lr-color-brand-quiet);
  }
  button[part~='legend-item']:where(:not(:disabled)):where(:active) {
    background: var(--lr-color-border);
  }
  button[part~='legend-item']:where(:focus-visible) {
    outline: var(--lr-focus-ring);
    outline-offset: var(--lr-focus-ring-offset);
  }
  /* Selected bands and rows. The state lives in the part NAME because nothing but a pseudo-class
     may follow ::part(), so a consumer cannot select on an attribute here.

     An INSET RING rather than an outline, and deliberately not a specificity contest: the hover,
     active and focus-visible rules above all write the outline shorthand, so an outline here
     would be REPLACED by theirs exactly while the user is pointing at or keyboard-focusing the
     band -- the one moment the filter's on/off state has to stay readable -- and winning the
     specificity contest instead would swallow the focus ring. A separate property composes with
     all three, so a selected, hovered, focused band shows selection AND focus at once. The ring is
     inset for the same reason the hover outline is: the track clips its own overflow. */
  button[part~='segment-selected'],
  button[part~='legend-item-selected'] {
    box-shadow: inset 0 0 0
      var(--lr-context-meter-selected-ring-width, var(--lr-border-width-thick))
      var(--lr-context-meter-selected-ring-color, var(--lr-color-text));
  }
  /* An arc owns no box: an outline or an inset ring traces the whole ring's bounding box, so every
     selected arc would paint the same rectangle and none of them would be identifiable. The one
     cue a single arc can carry is its own stroke, so a selected arc thickens in place. The value
     is in SVG user units against this component's 0 0 100 100 viewBox -- a rem/px length would not
     scale with the ring -- and an unselected arc is the template's own stroke width. */
  :host([shape='ring']) [part~='segment-selected'] {
    stroke-width: var(--lr-context-meter-selected-arc-stroke, 16);
  }

  /* A segment entry marked disabled is non-actionable: it keeps its colour (the band is still
     the datum it always was) but loses every affordance that promises activation. The hover,
     active and focus-visible rules above are gated on :not(:disabled) rather than overridden
     here, because CSS :hover DOES still match a natively disabled button -- only :active and
     :focus-visible stop on their own -- so without that gate a disabled band would keep painting
     a hover outline it can never honour. */
  button[part~='segment']:where(:disabled),
  button[part~='legend-item']:where(:disabled) {
    cursor: default;
    opacity: var(--lr-context-meter-disabled-opacity, var(--lr-opacity-disabled));
  }
  :host([shape='ring']) [part~='segment']:where([aria-disabled='true']) {
    cursor: default;
    opacity: var(--lr-context-meter-disabled-opacity, var(--lr-opacity-disabled));
  }
  /* The segment-empty and legend-item-empty part tokens carry NO default treatment on purpose.
     The state is derived from a zero value rather than declared, so styling it here would restyle
     every existing meter that happens to hold a zero band. It exists so a consumer can express
     its own "nothing in this bucket" treatment through ::part(). */

  /* The ring is a fixed 8em square, so a legend under it would be clipped by the host's own block
     size. Only under show-legend does the host stop being square: the ring keeps its declared size
     and the key flows beneath it. */
  :host([shape='ring'][show-legend]) {
    block-size: auto;
  }
  :host([shape='ring'][show-legend]) svg[part='base'] {
    inline-size: var(--lr-size-8em);
    block-size: var(--lr-size-8em);
  }

  /* --- ring variant -------------------------------------------------- */
  :host([shape='ring']) svg[part='base'] {
    display: block;
    overflow: visible;
  }
  :host([shape='ring']) [part='track'] {
    fill: none;
    stroke: color-mix(in srgb, var(--lr-color-border) 30%, transparent);
  }
  :host([shape='ring']) [part~='segment'] {
    fill: none;
    stroke: var(--lr-color-border);
    /* Butt caps: round caps on tightly-packed segmented arcs bleed past the exact boundary and
       overlap the next segment's color. */
    stroke-linecap: butt;
    transition:
      stroke-dasharray var(--lr-transition-base),
      stroke-dashoffset var(--lr-transition-base);
  }
  :host([shape='ring']) [part~='segment'][data-tone='brand'] {
    stroke: var(--lr-context-meter-tone-brand-bg, var(--lr-color-brand));
  }
  :host([shape='ring']) [part~='segment'][data-tone='success'] {
    stroke: var(--lr-context-meter-tone-success-bg, var(--lr-color-success));
  }
  :host([shape='ring']) [part~='segment'][data-tone='warning'] {
    stroke: var(--lr-context-meter-tone-warning-bg, var(--lr-color-warning));
  }
  :host([shape='ring']) [part~='segment'][data-tone='danger'] {
    stroke: var(--lr-context-meter-tone-danger-bg, var(--lr-color-danger));
  }
  :host([shape='ring']) [part~='segment'][style*='--lr-context-meter-segment-color'] {
    stroke: var(--lr-context-meter-segment-color);
  }
  :host([shape='ring']) [part='label'] {
    overflow: hidden;
    /* Re-anchors the em chain for .ring-label below: the unscoped [part='label'] rule further up
       this sheet sets a rem-based font-size for the bar shape's own (non-em-sized) visible label,
       and 'em' on the font-size property is relative to the PARENT's font-size -- so without this,
       .ring-label's own em multiplier would resolve against that unrelated rem value instead of
       against this host's own font-size. */
    font-size: var(--lr-size-1em);
  }
  :host([shape='ring']) .ring-label {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    block-size: 100%;
    overflow: hidden;
    overflow-wrap: anywhere;
    color: var(--lr-color-text-quiet);
    /* The ring itself is --lr-size-8em (em-based, so it tracks the host's own font-size), but
       --lr-font-size-2xs is rem-based and would stay pinned to the document root regardless of a
       caller's own font-size on the host -- the same mismatch <lr-gauge>'s linear caption had.
       --lr-font-size-2xs has no em-suffixed sibling token, so this multiplies the existing
       --lr-size-1em token instead of introducing a new value-named one; that catalog's growth is
       frozen. */
    font-size: calc(var(--lr-size-1em) * 0.625);
    line-height: var(--lr-line-height-compact);
    text-align: center;
    text-transform: uppercase;
  }

  @media (forced-colors: active) {
    [part~='segment'],
    [part='legend-swatch'] {
      forced-color-adjust: none;
      background: CanvasText;
      border: var(--lr-border-width-thin) solid Canvas;
    }
    [part~='segment'][data-tone='success'],
    [part='legend-swatch'][data-tone='success'] {
      border-style: dashed;
    }
    [part~='segment'][data-tone='warning'],
    [part='legend-swatch'][data-tone='warning'] {
      border-style: dotted;
    }
    [part~='segment'][data-tone='danger'],
    [part='legend-swatch'][data-tone='danger'] {
      border-style: double;
    }
    :host([shape='ring']) [part~='segment'] {
      fill: none;
      stroke: CanvasText;
    }
    :host([shape='ring']) [part~='segment'][data-tone='success'] {
      stroke-dasharray: 8 3;
    }
    :host([shape='ring']) [part~='segment'][data-tone='warning'] {
      stroke-dasharray: 2 3;
    }
    :host([shape='ring']) [part~='segment'][data-tone='danger'] {
      stroke-dasharray: 8 2 2 2;
    }
    /* Selection has to survive forced colours too. The bands keep the inset ring because the rule
       at the top of this block opts them out of forced-colour adjustment; a legend row does not,
       and box-shadow is dropped there, so it carries an outline, which forced-colour mode paints
       itself. A selected arc restates itself in the system highlight -- its tone is already
       carried by the dash pattern, not by its stroke colour, in this mode. */
    button[part~='segment-selected'] {
      box-shadow: inset 0 0 0 var(--lr-border-width-thick) Highlight;
    }
    button[part~='legend-item-selected'] {
      outline: var(--lr-border-width-thick) solid Highlight;
      outline-offset: calc(var(--lr-border-width-thick) * -1);
    }
    :host([shape='ring']) [part~='segment-selected'] {
      stroke: Highlight;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [part~='segment'],
    button[part~='legend-item'] {
      transition: none !important;
    }
  }
`;
