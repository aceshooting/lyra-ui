import { css } from 'lit';

export const styles = css`
  :host {
    align-items: stretch;
    justify-content: flex-start;
    padding: 0;
  }
  :host([contained]) {
    position: absolute;
  }
  :host([contained]) [part~="backdrop"] {
    display: none;
  }
  :host([placement="end"]) {
    justify-content: flex-end;
  }
  :host([placement="top"]) {
    align-items: flex-start;
    justify-content: stretch;
  }
  :host([placement="bottom"]) {
    align-items: flex-end;
    justify-content: stretch;
  }
  [part~="panel"] {
    inline-size: min(
      var(
        --size,
        var(
          --lr-drawer-width,
          var(--width, var(--lr-dialog-width, var(--lr-size-24rem)))
        )
      ),
      100%
    );
    block-size: 100%;
    max-inline-size: min(var(--lr-dialog-max-width, 100%), 100%);
    max-block-size: 100%;
    border-radius: 0;
    /* Modal layer, one step below lr-dialog's --lr-shadow-xl: an edge-anchored sheet is flush with
       three viewport edges, so only the one inward edge can cast anything. The surface itself keeps
       the inherited --lr-color-surface-overlay. */
    box-shadow: var(--lr-shadow-l);
  }
  :host([placement="top"]) [part~="panel"],
  :host([placement="bottom"]) [part~="panel"] {
    inline-size: 100%;
    block-size: min(
      var(--size, var(--lr-drawer-height, var(--lr-size-24rem))),
      100%
    );
    max-inline-size: 100%;
    max-block-size: 100%;
  }
  :host([placement="end"]) [part~="panel"] {
    --_lr-drawer-enter-x: var(--lr-size-1rem);
  }
  /* translateX is a physical transform -- logical properties don't cover it -- so the
     enter-from offset is flipped explicitly under RTL, the same way app-rail's offscreen
     panel transform is. A 'start' drawer rests at the physical right edge under RTL and
     must enter from further right (positive X); an 'end' drawer rests at the physical left
     edge and must enter from further left (negative X) -- the mirror image of the LTR rules
     above. */
  :host(:dir(rtl)) [part~="panel"] {
    --_lr-drawer-enter-x: var(--lr-size-1rem);
  }
  :host(:dir(rtl)[placement="end"]) [part~="panel"] {
    --_lr-drawer-enter-x: calc(-1 * var(--lr-size-1rem));
  }
  :host([placement="bottom"]) [part~="panel"] {
    --_lr-drawer-enter-y: var(--lr-size-1rem);
  }
`;
