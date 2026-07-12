import { css } from 'lit';

export const styles = css`
  :host {
    display: inline-block;
    /* Component-local geometry knobs (same "define your own on :host"
       pattern as lyra-toast's --gap/--width) — a fully-rounded pill/thumb
       needs a radius well past --lyra-radius's small 0.375rem default, so
       it's expressed here rather than bent onto that shared token. */
    --track-inline-size: 2.25rem;
    --track-block-size: 1.25rem;
    --thumb-offset: 2px;
  }
  [part='base'] {
    display: inline-flex;
    align-items: center;
    gap: var(--lyra-space-s);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  [part='base']:focus-visible {
    outline: var(--lyra-focus-ring-width) solid var(--lyra-focus-ring-color);
    outline-offset: var(--lyra-focus-ring-offset);
  }
  :host(:disabled) [part='base'] {
    cursor: not-allowed;
    opacity: var(--lyra-opacity-disabled);
  }

  [part='track'] {
    position: relative;
    flex: 0 0 auto;
    inline-size: var(--track-inline-size);
    block-size: var(--track-block-size);
    border-radius: 999px;
    background: var(--lyra-color-border);
    transition: background-color var(--lyra-transition-fast);
  }
  :host([checked]) [part='track'] {
    background: var(--lyra-color-brand);
  }

  [part='thumb'] {
    position: absolute;
    inset-block-start: var(--thumb-offset);
    inset-inline-start: var(--thumb-offset);
    inline-size: calc(var(--track-block-size) - (var(--thumb-offset) * 2));
    block-size: calc(var(--track-block-size) - (var(--thumb-offset) * 2));
    border-radius: 50%;
    background: var(--lyra-color-surface);
    /* Animates the logical 'inset-inline-start' rather than a physical
       'transform: translateX()' so the slide direction mirrors correctly
       under dir="rtl" — consistent with this library's CSS-logical-
       properties approach to RTL (see internal/lyra-element.ts). */
    transition: inset-inline-start var(--lyra-transition-fast);
  }
  :host([checked]) [part='thumb'] {
    inset-inline-start: calc(var(--track-inline-size) - var(--track-block-size) + var(--thumb-offset));
  }

  /* No explicit "display" here (unlike e.g. lyra-combobox's
     [part='form-control-label']), so the UA stylesheet's default
     "[hidden] { display: none }" rule needs no author-side override to
     take effect when hasLabelSlot is false. */
  [part='label'] {
    font-size: 0.875rem;
    color: var(--lyra-color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    [part='track'],
    [part='thumb'] {
      transition: none !important;
    }
  }
`;
