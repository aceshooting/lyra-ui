import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    /* Internal implementation properties: they ARE declared with @cssprop on <lr-timeline-item>
       (the element that reads them), because an undeclared custom property is invisible to
       web-types/vscode-css-data and to the docs freshness check -- but each declaration says
       plainly that it is plumbing, not a retheming knob, since overriding one to a bogus value
       breaks layout rather than just looking different. They propagate orientation into every
       slotted <lr-timeline-item>'s own
       stylesheet, via ordinary CSS custom-property inheritance across the slot boundary -- no JS
       coordination between the two components is needed for orientation to propagate.
       --lr-timeline-item-direction drives an item's own [part='base'] flex-direction; the
       remaining three are its paired companions so an item's [part='track'] (always the *opposite*
       axis from its [part='base']) and [part='content'] (which single logical padding side reaches
       into the inter-item gap) can react to the same orientation switch with no conditional logic of
       their own -- see timeline-item.styles.ts for the consuming side. flex-direction: row is
       inherently the CSS *inline* axis and column the *block* axis, which is also why none of this
       needs an RTL-specific override: a row flex container already reverses its visual child order
       under dir="rtl" for free. */
    --lr-timeline-item-direction: row; /* vertical (default): marker beside content */
    --lr-timeline-item-track-direction: column; /* opposite axis, for [part='track'] */
    --lr-timeline-item-gap-block-end: var(--lr-timeline-gap, var(--lr-space-l));
    --lr-timeline-item-gap-inline-end: 0;
  }
  :host([orientation='horizontal']) {
    --lr-timeline-item-direction: column; /* marker above content */
    --lr-timeline-item-track-direction: row;
    --lr-timeline-item-gap-block-end: 0;
    --lr-timeline-item-gap-inline-end: var(--lr-timeline-gap, var(--lr-space-l));
  }

  [part='base'] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
  }
  :host([orientation='horizontal']) [part='base'] {
    flex-direction: row;
    /* Mirrors <lr-tabs>'s identical horizontal-overflow handling -- a horizontal timeline
       becomes a horizontally-scrollable strip rather than breaking layout. overflow-y is pinned
       explicitly alongside overflow-x: per the CSS overflow spec, leaving one axis unset once the
       other is non-'visible' forces its used value to 'auto' too, which can show a phantom/empty
       scrollbar from sub-pixel rounding even when the content never actually overflows block-wise. */
    overflow-x: auto;
    overflow-y: hidden;
    /* Static edge affordance: scrolling remains native and no scroll listener is needed. */
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      var(--lr-color-shadow) var(--lr-scroll-fade-size),
      var(--lr-color-shadow) calc(100% - var(--lr-scroll-fade-size)),
      transparent
    );
  }

  /* Matches by role rather than tag name (<lr-timeline-item> sets role="listitem" on itself in
     connectedCallback) so this selector keeps working regardless of the registered tag prefix --
     mirrors <lr-breadcrumb>'s identical ::slotted structural-position technique. Suppresses the
     last item's trailing rail (nothing left to connect to) with no JS coordination between the two
     components -- consumed by <lr-timeline-item>'s own [part='rail'] rule. */
  ::slotted([role='listitem']:last-child) {
    --lr-timeline-item-rail-visibility: hidden;
  }
`;
