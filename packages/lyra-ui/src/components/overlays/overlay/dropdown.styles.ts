import { css } from 'lit';

export const styles = css`
  /* The contained menu list owns scrolling. A scrolling positioning shell prevents WebKit from
     hit-testing fixed submenus outside that shell, even while they remain visibly painted. */
  [part~='popup'] {
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
  [part~='popup'][popover] {
    /* Popover UA defaults center the box with all four insets and auto margins. Keep the base
       popup's fixed top/left origin that Floating UI overwrites, while clearing opposing insets. */
    /* policy-allow(physical-css): Floating UI writes physical left/top; clear the opposing UA
       insets the same way under both LTR and RTL. */
    right: auto;
    bottom: auto;
    margin: 0;
    padding: 0;
    inline-size: auto;
    block-size: auto;
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
