import { css } from 'lit';

export const styles = css`
  /* The contained menu list owns scrolling. A scrolling positioning shell prevents WebKit from
     hit-testing fixed submenus outside that shell, even while they remain visibly painted. */
  [part~='popup'] {
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
  /* Let the list shrink within the popup's height limit, with header/footer controls kept in
     view. This also overrides the generic popover's inner scroll container when an arrow is used. */
  [part~='popup'] [part~='content'] {
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    overflow: visible;
    padding: var(--lr-space-xs);
  }
  [part~='menu'] {
    display: contents;
  }
`;
