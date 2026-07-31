import { css } from 'lit';
export const styles = css`
  :host {
    display: inline-flex;
    inline-size: var(--lr-icon-size, var(--lr-size-1-25rem));
    block-size: var(--lr-icon-size, var(--lr-size-1-25rem));
    color: inherit;
  }
  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }

  /* rotate and flip are deliberately physical, not direction-relative: an author asking for a
     horizontal flip gets the same mirrored artwork in LTR and RTL. A glyph that must follow
     reading direction is mirrored by the wrapping part of the component that owns it, and a
     second, direction-driven flip here would silently cancel that one out. */
  :host([rotate]),
  :host([flip]) {
    transform: rotate(var(--lr-icon-rotate, 0deg)) scale(var(--lr-icon-flip-x, 1), var(--lr-icon-flip-y, 1));
  }
  :host([flip='horizontal']) {
    --lr-icon-flip-x: -1;
  }
  :host([flip='vertical']) {
    --lr-icon-flip-y: -1;
  }
  :host([flip='both']) {
    --lr-icon-flip-x: -1;
    --lr-icon-flip-y: -1;
  }

  /* A wider canvas than the glyph, so a column of differently-shaped icons lines its labels up.
     The glyph keeps its own size and centers inside the wider box. */
  :host([fixed-width]) {
    inline-size: var(--lr-icon-fixed-width, var(--lr-size-1-5rem));
    align-items: center;
    justify-content: center;
  }
  :host([fixed-width]) svg {
    inline-size: var(--lr-icon-size, var(--lr-size-1-25rem));
  }
`;
