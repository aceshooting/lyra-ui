import { css } from "lit";

export const styles = css`
  :host {
    --_lr-accordion-item-spacing: var(--lr-form-control-padding-inline);
    --_lr-accordion-item-show-duration: var(--lr-duration-base);
    --_lr-accordion-item-hide-duration: var(--lr-duration-base);
    --_lr-accordion-item-easing: var(--lr-easing-standard);
    display: block;
    min-inline-size: 0;
    color: var(--lr-color-text);
  }
  [part~="accordion-item"] {
    min-inline-size: 0;
    background: transparent;
    font-size: var(--lr-form-control-font-size);
  }
  [part~="accordion-item"][data-appearance="outlined"] {
    background: var(--lr-accordion-item-outlined-bg, var(--lr-color-surface));
  }
  [part~="accordion-item"][data-appearance="filled"] {
    background: var(
      --lr-accordion-item-filled-bg,
      var(--lr-color-surface-raised)
    );
  }
  [part~="accordion-item"][data-appearance="filled-outlined"] {
    background: var(
      --lr-accordion-item-filled-outlined-bg,
      var(--lr-color-surface-raised)
    );
  }
  [part~="heading"] {
    margin: 0;
    font: inherit;
  }
  [part~="button"] {
    display: flex;
    align-items: center;
    gap: var(
      --spacing,
      var(--lr-accordion-item-spacing, var(--_lr-accordion-item-spacing))
    );
    inline-size: 100%;
    min-block-size: var(--lr-icon-button-size);
    box-sizing: border-box;
    padding: var(
      --spacing,
      var(--lr-accordion-item-spacing, var(--_lr-accordion-item-spacing))
    );
    border: none;
    border-radius: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: var(--lr-font-weight-semibold);
    text-align: start;
    cursor: pointer;
  }
  [part~="button"]:where(:hover):where(:not(:disabled)) {
    background: var(
      --lr-accordion-item-button-hover-bg,
      var(--lr-color-brand-quiet)
    );
  }
  [part~="button"]:where(:active):where(:not(:disabled)) {
    background: var(
      --lr-accordion-item-button-active-bg,
      color-mix(
        in oklab,
        var(--lr-color-brand-quiet),
        var(--lr-color-mix-partner) var(--lr-color-mix-active)
      )
    );
  }
  [part~="button"]:where(:focus-visible) {
    outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color);
    outline-offset: calc(var(--lr-focus-ring-width) * -1);
  }
  [part~="button"]:disabled {
    cursor: not-allowed;
  }
  :host([disabled]) [part~="accordion-item"] {
    opacity: var(--lr-opacity-disabled);
  }
  [part~="label"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  [part~="icon"] {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    color: var(--lr-color-text-quiet);
    transition: rotate
      var(
        --hide-duration,
        var(
          --lr-accordion-item-hide-duration,
          var(--_lr-accordion-item-hide-duration)
        )
      )
      var(
        --easing,
        var(--lr-accordion-item-easing, var(--_lr-accordion-item-easing))
      );
  }
  [part~="accordion-item"][data-icon-placement="start"] [part~="icon"] {
    order: -1;
  }
  .default-icon {
    display: block;
    inline-size: var(--lr-size-0-5rem);
    block-size: var(--lr-size-0-5rem);
    border-inline-end: var(--lr-border-width-thin) solid currentColor;
    border-block-end: var(--lr-border-width-thin) solid currentColor;
    transform: rotate(-45deg);
  }
  :host(:dir(rtl)) .default-icon {
    transform: rotate(45deg);
  }
  :host([expanded]) [part~="icon"] {
    rotate: 90deg;
    transition-duration: var(
      --show-duration,
      var(
        --lr-accordion-item-show-duration,
        var(--_lr-accordion-item-show-duration)
      )
    );
  }
  :host([expanded]:dir(rtl)) [part~="icon"] {
    rotate: -90deg;
  }
  [part~="panel"] {
    display: grid;
    grid-template-rows: 0fr;
    visibility: hidden;
    opacity: 0;
    color: var(--lr-color-text-quiet);
    transition: grid-template-rows
        var(
          --hide-duration,
          var(
            --lr-accordion-item-hide-duration,
            var(--_lr-accordion-item-hide-duration)
          )
        )
        var(
          --easing,
          var(--lr-accordion-item-easing, var(--_lr-accordion-item-easing))
        ),
      opacity
        var(
          --hide-duration,
          var(
            --lr-accordion-item-hide-duration,
            var(--_lr-accordion-item-hide-duration)
          )
        )
        var(
          --easing,
          var(--lr-accordion-item-easing, var(--_lr-accordion-item-easing))
        ),
      visibility
        var(
          --hide-duration,
          var(
            --lr-accordion-item-hide-duration,
            var(--_lr-accordion-item-hide-duration)
          )
        )
        step-end;
  }
  :host([expanded]) [part~="panel"] {
    grid-template-rows: 1fr;
    visibility: visible;
    opacity: 1;
    transition: grid-template-rows
        var(
          --show-duration,
          var(
            --lr-accordion-item-show-duration,
            var(--_lr-accordion-item-show-duration)
          )
        )
        var(
          --easing,
          var(--lr-accordion-item-easing, var(--_lr-accordion-item-easing))
        ),
      opacity
        var(
          --show-duration,
          var(
            --lr-accordion-item-show-duration,
            var(--_lr-accordion-item-show-duration)
          )
        )
        var(
          --easing,
          var(--lr-accordion-item-easing, var(--_lr-accordion-item-easing))
        ),
      visibility
        var(
          --show-duration,
          var(
            --lr-accordion-item-show-duration,
            var(--_lr-accordion-item-show-duration)
          )
        )
        step-start;
  }
  .panel-clip {
    min-block-size: 0;
    overflow: hidden;
  }
  [part~="content"] {
    display: block;
    padding: 0
      var(
        --spacing,
        var(--lr-accordion-item-spacing, var(--_lr-accordion-item-spacing))
      )
      var(
        --spacing,
        var(--lr-accordion-item-spacing, var(--_lr-accordion-item-spacing))
      );
    overflow-wrap: anywhere;
  }
  @media (prefers-reduced-motion: reduce) {
    [part~="panel"],
    [part~="icon"] {
      transition: none;
    }
  }
`;
