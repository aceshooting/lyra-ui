import { css } from "lit";

export const styles = css`
  :host {
    --_lr-page-aside-width: var(--aside-width, auto);
    --_lr-page-banner-height: var(--banner-height, 0);
    --_lr-page-header-height: var(--header-height, 0);
    --_lr-page-main-width: var(--main-width, 1fr);
    --_lr-page-menu-width: var(--menu-width, auto);
    --_lr-page-subheader-height: var(--subheader-height, 0);
    display: block;
    min-inline-size: 0;
    color: var(--lr-color-text);
    container-type: inline-size;
    contain-intrinsic-inline-size: var(--lr-size-20rem);
  }

  [part~="page"] {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    min-block-size: 100dvh;
    overflow-x: clip;
    background: var(--lr-color-surface);
  }

  [part~="skip-to-content"] {
    position: fixed;
    inset-block-start: max(var(--lr-space-s), var(--lr-safe-area-top));
    inset-inline-start: max(
      var(--lr-space-s),
      var(--lr-safe-area-inline-start)
    );
    z-index: var(--lr-layer-toast);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    box-sizing: border-box;
    padding-inline: var(--lr-space-m);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    opacity: 0;
    pointer-events: none;
    background: var(--lr-color-surface-overlay);
    color: var(--lr-color-text);
    box-shadow: var(--lr-shadow-m);
    text-decoration: none;
    transform: translateY(calc(-100% - var(--lr-space-l)));
    transition: opacity var(--lr-transition-fast),
      transform var(--lr-transition-fast),
      background-color var(--lr-transition-fast);
    cursor: pointer;
  }
  [part~="skip-to-content"]:where(:hover) {
    background: var(
      --lr-page-skip-to-content-hover-bg,
      var(--lr-color-brand-quiet)
    );
    color: var(--lr-page-skip-to-content-hover-color, var(--lr-color-brand));
  }
  [part~="skip-to-content"]:where(:active) {
    background: var(
      --lr-page-skip-to-content-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(--lr-page-skip-to-content-active-color, var(--lr-color-brand));
  }
  [part~="skip-to-content"]:where(:focus-visible) {
    opacity: 1;
    pointer-events: auto;
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
    transform: none;
  }

  [part~="banner"],
  [part~="header"],
  [part~="subheader"],
  [part~="menu"],
  [part~="navigation-header"],
  [part~="navigation-footer"],
  [part~="main-header"],
  [part~="main-content"],
  [part~="main-footer"],
  [part~="aside"],
  [part~="footer"] {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }

  [part~="banner"] {
    min-block-size: var(--lr-page-banner-height, var(--_lr-page-banner-height));
  }
  [part~="header"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--lr-space-s);
    min-block-size: var(--lr-page-header-height, var(--_lr-page-header-height));
  }
  [part~="subheader"] {
    min-block-size: var(
      --lr-page-subheader-height,
      var(--_lr-page-subheader-height)
    );
  }

  :host(:not([disable-sticky~="banner"])) [part~="banner"] {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--lr-layer-content);
  }
  :host(:not([disable-sticky~="header"])) [part~="header"] {
    position: sticky;
    inset-block-start: var(
      --lr-page-banner-height,
      var(--_lr-page-banner-height)
    );
    z-index: var(--lr-layer-content);
  }
  :host(:not([disable-sticky~="subheader"])) [part~="subheader"] {
    position: sticky;
    inset-block-start: calc(
      var(--lr-page-banner-height, var(--_lr-page-banner-height)) +
        var(--lr-page-header-height, var(--_lr-page-header-height))
    );
    z-index: var(--lr-layer-content);
  }

  .navigation-toggle-container {
    display: none;
    flex: 0 0 auto;
  }
  :host([view="mobile"]) .navigation-toggle-container {
    display: block;
  }
  [part~="navigation-toggle"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    box-sizing: border-box;
    padding: var(--lr-space-s);
    border: var(--lr-border-width-thin) solid var(--lr-color-border);
    border-radius: var(--lr-radius);
    background: var(--lr-color-surface);
    color: var(--lr-color-text);
    font: inherit;
    cursor: pointer;
  }
  :host([disable-navigation-toggle]) [part~="navigation-toggle"] {
    display: none;
  }
  [part~="navigation-toggle"]:where(:hover),
  ::slotted([slot="navigation-toggle"]:hover) {
    background: var(
      --lr-page-navigation-toggle-hover-bg,
      var(--lr-color-brand-quiet)
    );
    color: var(--lr-page-navigation-toggle-hover-color, var(--lr-color-brand));
  }
  [part~="navigation-toggle"]:where(:active),
  ::slotted([slot="navigation-toggle"]:active) {
    background: var(
      --lr-page-navigation-toggle-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
    color: var(--lr-page-navigation-toggle-active-color, var(--lr-color-brand));
  }
  [part~="navigation-toggle"]:where(:focus-visible),
  ::slotted([slot="navigation-toggle"]:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: var(--lr-focus-ring-offset);
  }
  ::slotted([slot="navigation-toggle"]) {
    min-inline-size: var(--lr-icon-button-size);
    min-block-size: var(--lr-icon-button-size);
    cursor: pointer;
  }
  [part~="navigation-toggle-icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  [part~="navigation-toggle-icon"] svg {
    display: block;
  }

  [part~="body"] {
    display: grid;
    flex: 1 1 auto;
    grid-template-areas: "menu navigation main aside";
    grid-template-columns:
      var(--lr-page-menu-width, var(--_lr-page-menu-width))
      auto
      minmax(0, var(--lr-page-main-width, var(--_lr-page-main-width)))
      var(--lr-page-aside-width, var(--_lr-page-aside-width));
    min-inline-size: 0;
    align-items: stretch;
  }
  :host([navigation-placement="end"]) [part~="body"] {
    grid-template-areas: "menu main aside navigation";
    grid-template-columns:
      var(--lr-page-menu-width, var(--_lr-page-menu-width))
      minmax(0, var(--lr-page-main-width, var(--_lr-page-main-width)))
      var(--lr-page-aside-width, var(--_lr-page-aside-width))
      auto;
  }

  [part~="menu"] {
    grid-area: menu;
    inline-size: var(--lr-page-menu-width, var(--_lr-page-menu-width));
  }
  [part~="dialog-wrapper"],
  [part~="drawer"] {
    display: contents;
  }
  [part~="navigation"] {
    grid-area: navigation;
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  [part~="navigation"] > slot[name="navigation"] {
    flex: 1 1 auto;
  }
  [part~="main"] {
    grid-area: main;
    min-inline-size: 0;
    inline-size: var(--lr-page-main-width, var(--_lr-page-main-width));
    max-inline-size: 100%;
    outline: none;
  }
  [part~="aside"] {
    grid-area: aside;
    inline-size: var(--lr-page-aside-width, var(--_lr-page-aside-width));
    max-inline-size: 100%;
  }

  :host(:not([disable-sticky~="menu"])) [part~="menu"],
  :host(:not([disable-sticky~="aside"])) [part~="aside"] {
    position: sticky;
    inset-block-start: calc(
      var(--lr-page-banner-height, var(--_lr-page-banner-height)) +
        var(--lr-page-header-height, var(--_lr-page-header-height)) +
        var(--lr-page-subheader-height, var(--_lr-page-subheader-height))
    );
    align-self: start;
    max-block-size: calc(
      100dvh - var(--lr-page-banner-height, var(--_lr-page-banner-height)) -
        var(--lr-page-header-height, var(--_lr-page-header-height)) -
        var(--lr-page-subheader-height, var(--_lr-page-subheader-height))
    );
    overflow-y: auto;
    overflow-x: clip;
  }

  :host([view="mobile"]) [part~="body"] {
    display: block;
  }
  :host([view="mobile"]) [part~="menu"],
  :host([view="mobile"]) [part~="main"],
  :host([view="mobile"]) [part~="aside"] {
    inline-size: 100%;
  }
  :host([view="mobile"]) [part~="dialog-wrapper"] {
    position: fixed;
    inset: 0;
    z-index: var(--lr-overlay-stack-index, var(--lr-layer-modal));
    display: block;
    visibility: hidden;
    pointer-events: none;
    background: transparent;
    transition: background-color var(--lr-transition-base),
      visibility var(--lr-transition-base);
  }
  :host([view="mobile"][nav-open]) [part~="dialog-wrapper"] {
    visibility: visible;
    pointer-events: auto;
    background: var(--lr-page-navigation-backdrop-bg, var(--lr-color-overlay));
  }
  :host([view="mobile"]) [part~="drawer"] {
    position: absolute;
    inset-block: 0;
    display: flex;
    flex-direction: column;
    inline-size: min(var(--lr-size-18rem), calc(100% - var(--lr-space-l)));
    max-inline-size: 100%;
    min-inline-size: 0;
    box-sizing: border-box;
    padding-block-start: var(--lr-safe-area-top);
    padding-block-end: var(--lr-safe-area-bottom);
    padding-inline-start: var(--lr-safe-area-inline-start);
    padding-inline-end: var(--lr-safe-area-inline-end);
    background: var(
      --lr-page-navigation-drawer-bg,
      var(--lr-color-surface-overlay)
    );
    box-shadow: var(--lr-page-navigation-drawer-shadow, var(--lr-shadow-l));
    overflow-y: auto;
    overflow-x: clip;
    transition: transform var(--lr-transition-base);
  }
  :host([view="mobile"][navigation-placement="start"]) [part~="drawer"] {
    inset-inline-start: 0;
  }
  :host([view="mobile"][navigation-placement="end"]) [part~="drawer"] {
    inset-inline-end: 0;
  }
  :host(
      [view="mobile"]:not([nav-open])[navigation-placement="start"]:not(
          :dir(rtl)
        )
    )
    [part~="drawer"],
  :host([view="mobile"]:not([nav-open])[navigation-placement="end"]:dir(rtl))
    [part~="drawer"] {
    transform: translateX(-100%);
  }
  :host(
      [view="mobile"]:not([nav-open])[navigation-placement="end"]:not(:dir(rtl))
    )
    [part~="drawer"],
  :host([view="mobile"]:not([nav-open])[navigation-placement="start"]:dir(rtl))
    [part~="drawer"] {
    transform: translateX(100%);
  }
  :host([view="mobile"][nav-open]) [part~="drawer"] {
    transform: none;
  }
  :host([view="mobile"]) [part~="navigation"] {
    flex: 1 1 auto;
    min-block-size: 0;
  }

  ::slotted(*) {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    [part~="skip-to-content"],
    [part~="navigation-toggle"],
    [part~="dialog-wrapper"],
    [part~="drawer"] {
      transition: none !important;
    }
  }
`;
