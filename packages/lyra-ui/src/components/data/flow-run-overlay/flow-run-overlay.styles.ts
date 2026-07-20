import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
  }
  [part='base'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--lr-space-s);
    padding: var(--lr-space-2xs) var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    box-shadow: var(--lr-shadow);
    font-size: var(--lr-font-size-xs);
  }
  /* Chrome-less escape, mirroring lr-card's appearance="plain" (and lr-callout's [inline]): the
     summary strip is often placed directly inside a host toolbar that already draws its own
     border/background, where this floating-surface chrome doubles the frame. Only the box
     decoration goes -- the flex layout, gap and the per-status count dots stay. */
  :host([appearance='plain']) [part='base'] {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  [part='summary'] {
    font-weight: var(--lr-font-weight-medium);
  }
  [part='count'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lr-space-2xs);
    color: var(--lr-color-text-muted);
  }
  .tone-dot {
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-radius: var(--lr-radius-pill);
    background: var(--lr-color-border-strong);
  }
  [part='count'][data-status='running'] .tone-dot { background: var(--lr-color-brand); }
  [part='count'][data-status='success'] .tone-dot { background: var(--lr-color-success); }
  [part='count'][data-status='error'] .tone-dot { background: var(--lr-color-danger); }
  [part='count'][data-status='denied'] .tone-dot { background: var(--lr-color-warning); }
`;
