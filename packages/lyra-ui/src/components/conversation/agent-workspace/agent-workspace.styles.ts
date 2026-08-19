import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    min-inline-size: 0;
    min-block-size: 0;
    block-size: 100%;
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }
  /* The middle track is the only scroll owner: minmax(0, 1fr) lets it shrink to zero and the
     composed lr-chat-viewport scrolls the transcript inside it. The two auto tracks are
     content-sized on purpose -- header chrome and the composer dock must never be what scrolls.
     The trade: content larger than the workspace allocation (a tall header-actions toolbar, a tall
     replacement composer) squeezes the conversation track to zero and is then clipped here, with
     no scrollbar. Cap and scroll those regions consumer-side through the public header and
     composer parts -- see the overflow note in agent-workspace.class.ts's class doc. */
  [part='base'] {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-inline-size: 0;
    min-block-size: 0;
    block-size: 100%;
    overflow: hidden;
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
  }
  [part='header'] {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lr-space-s);
    min-inline-size: 0;
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-end: var(--lr-border-width-thin) solid var(--lr-color-border);
  }
  [part='heading'] {
    min-inline-size: 0;
    margin: 0;
    font-size: var(--lr-font-size-m);
    font-weight: var(--lr-font-weight-semibold);
    overflow-wrap: anywhere;
  }
  [part='header-actions'] {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--lr-space-xs);
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-inline-start: auto;
  }
  slot[name='header-actions'] {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  slot[name='header-actions']::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [part='body'] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(var(--lr-size-16rem), var(--lr-size-24rem));
    min-inline-size: 0;
    min-block-size: 0;
  }
  [part='body'][data-details='false'] {
    grid-template-columns: minmax(0, 1fr);
  }
  [part='conversation'] {
    display: flex;
    min-inline-size: 0;
    min-block-size: 0;
  }
  [part='viewport'] {
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
  }
  [part~='messages'] {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block-end: var(--lr-space-m);
  }
  slot[name='messages']::slotted(*) {
    display: block;
    min-inline-size: 0;
    max-inline-size: 100%;
    margin-block-end: var(--lr-space-m);
  }
  /* The display above is author-origin, so it outranks the UA stylesheet's own
     '[hidden] { display: none }' and a transcript row a consumer filtered out would still paint.
     The 'until-found' carve-out is load-bearing here, not merely consistent: transcript prose is
     exactly what a browser's find-in-page is expected to scroll back into view. */
  slot[name='messages']::slotted([hidden]:not([hidden='until-found' i])) {
    display: none;
  }
  [part='messages-empty'] {
    margin-block: auto;
  }
  [part='details'] {
    min-inline-size: 0;
    min-block-size: 0;
    overflow: auto;
    padding: var(--lr-space-m);
    border-inline-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface-raised);
  }
  [part='details-content'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-l);
    min-inline-size: 0;
  }
  [part='section'] {
    display: flex;
    flex-direction: column;
    gap: var(--lr-space-s);
    min-inline-size: 0;
  }
  [part='section-heading'] {
    margin: 0;
    font-size: var(--lr-font-size-sm);
    font-weight: var(--lr-font-weight-semibold);
  }
  [part='section'] > * {
    min-inline-size: 0;
  }
  [part='composer'] {
    min-inline-size: 0;
    padding: var(--lr-space-s) var(--lr-space-m);
    border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
    background: var(--lr-color-surface);
  }
  [part='composer-input'] {
    display: block;
    max-inline-size: var(--lr-size-48rem);
    margin-inline: auto;
  }
  @container (max-inline-size: 48rem) {
    [part='body'] {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
    }
    [part='body'][data-details='true'] {
      grid-template-rows: minmax(0, 1fr) minmax(0, 45%);
    }
    [part='details'] {
      border-block-start: var(--lr-border-width-thin) solid var(--lr-color-border);
      border-inline-start: 0;
    }
  }
  @container (max-inline-size: 30rem) {
    [part='header'],
    [part='composer'] {
      padding-inline: var(--lr-space-s);
    }
    [part='details'] {
      padding: var(--lr-space-s);
    }
  }
`;
