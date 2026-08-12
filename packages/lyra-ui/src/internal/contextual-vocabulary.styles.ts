import { css } from 'lit';

/**
 * Explicit-only semantic mappings for components whose unset variant inherits a containing
 * component's semantic context. Unlike `variants.styles.ts`, this sheet deliberately has no
 * unconditional `:host` defaults: a host without a `variant` attribute leaves the generic colour
 * slots inherited. The consuming component supplies its own standalone fallback at the final use
 * site.
 */
export const contextualVariants = css`
  :host([variant='neutral']) {
    --lr-color-fill-quiet: var(--lr-color-neutral-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-neutral-fill-normal);
    --lr-color-fill-loud: var(--lr-color-neutral-fill-loud);
    --lr-color-border-quiet: var(--lr-color-neutral-border-quiet);
    --lr-color-border-normal: var(--lr-color-neutral-border-normal);
    --lr-color-border-loud: var(--lr-color-neutral-border-loud);
    --lr-color-on-quiet: var(--lr-color-neutral-on-quiet);
    --lr-color-on-normal: var(--lr-color-neutral-on-normal);
    --lr-color-on-loud: var(--lr-color-neutral-on-loud);
  }
  :host([variant='brand']) {
    --lr-color-fill-quiet: var(--lr-color-brand-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-brand-fill-normal);
    --lr-color-fill-loud: var(--lr-color-brand-fill-loud);
    --lr-color-border-quiet: var(--lr-color-brand-border-quiet);
    --lr-color-border-normal: var(--lr-color-brand-border-normal);
    --lr-color-border-loud: var(--lr-color-brand-border-loud);
    --lr-color-on-quiet: var(--lr-color-brand-on-quiet);
    --lr-color-on-normal: var(--lr-color-brand-on-normal);
    --lr-color-on-loud: var(--lr-color-brand-on-loud);
  }
  :host([variant='success']) {
    --lr-color-fill-quiet: var(--lr-color-success-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-success-fill-normal);
    --lr-color-fill-loud: var(--lr-color-success-fill-loud);
    --lr-color-border-quiet: var(--lr-color-success-border-quiet);
    --lr-color-border-normal: var(--lr-color-success-border-normal);
    --lr-color-border-loud: var(--lr-color-success-border-loud);
    --lr-color-on-quiet: var(--lr-color-success-on-quiet);
    --lr-color-on-normal: var(--lr-color-success-on-normal);
    --lr-color-on-loud: var(--lr-color-success-on-loud);
  }
  :host([variant='warning']) {
    --lr-color-fill-quiet: var(--lr-color-warning-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-warning-fill-normal);
    --lr-color-fill-loud: var(--lr-color-warning-fill-loud);
    --lr-color-border-quiet: var(--lr-color-warning-border-quiet);
    --lr-color-border-normal: var(--lr-color-warning-border-normal);
    --lr-color-border-loud: var(--lr-color-warning-border-loud);
    --lr-color-on-quiet: var(--lr-color-warning-on-quiet);
    --lr-color-on-normal: var(--lr-color-warning-on-normal);
    --lr-color-on-loud: var(--lr-color-warning-on-loud);
  }
  :host([variant='danger']) {
    --lr-color-fill-quiet: var(--lr-color-danger-fill-quiet);
    --lr-color-fill-normal: var(--lr-color-danger-fill-normal);
    --lr-color-fill-loud: var(--lr-color-danger-fill-loud);
    --lr-color-border-quiet: var(--lr-color-danger-border-quiet);
    --lr-color-border-normal: var(--lr-color-danger-border-normal);
    --lr-color-border-loud: var(--lr-color-danger-border-loud);
    --lr-color-on-quiet: var(--lr-color-danger-on-quiet);
    --lr-color-on-normal: var(--lr-color-danger-on-normal);
    --lr-color-on-loud: var(--lr-color-danger-on-loud);
  }
`;

/**
 * Explicit-only form-control size mappings. A host without a `size` attribute inherits the six
 * generic size slots from its containing context; each explicit tier resets every slot so no
 * value leaks from a differently-sized ancestor. Consumers provide standalone `m` fallbacks where
 * they read the generic slots.
 */
export const contextualSizes = css`
  :host([size='2xs']) {
    --lr-form-control-height: var(
      --lr-form-control-height-2xs,
      var(--lr-theme-form-control-height-2xs, var(--lr-size-1-25rem))
    );
    --lr-form-control-font-size: var(--lr-font-size-2xs);
    --lr-form-control-padding-inline: var(--lr-space-2xs);
    --lr-form-control-padding-block: 0;
    --lr-form-control-gap: var(--lr-space-2xs);
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius-xs));
  }
  :host([size='xs']) {
    --lr-form-control-height: var(
      --lr-form-control-height-xs,
      var(--lr-theme-form-control-height-xs, var(--lr-size-1-5rem))
    );
    --lr-form-control-font-size: var(--lr-font-size-xs);
    --lr-form-control-padding-inline: var(--lr-space-xs);
    --lr-form-control-padding-block: 0;
    --lr-form-control-gap: var(--lr-space-2xs);
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius-xs));
  }
  :host([size='s']),
  :host([size='small']) {
    --lr-form-control-height: var(
      --lr-form-control-height-s,
      var(--lr-theme-form-control-height-s, var(--lr-size-1-875rem))
    );
    --lr-form-control-font-size: var(--lr-font-size-sm);
    --lr-form-control-padding-inline: var(--lr-space-s);
    --lr-form-control-padding-block: var(--lr-space-2xs);
    --lr-form-control-gap: var(--lr-space-2xs);
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius));
  }
  :host([size='m']),
  :host([size='medium']) {
    --lr-form-control-height: var(
      --lr-form-control-height-m,
      var(--lr-theme-form-control-height-m, var(--lr-size-2-5rem))
    );
    --lr-form-control-font-size: var(--lr-font-size-m);
    --lr-form-control-padding-inline: var(--lr-space-m);
    --lr-form-control-padding-block: var(--lr-space-xs);
    --lr-form-control-gap: var(--lr-space-2xs);
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius));
  }
  :host([size='l']),
  :host([size='large']) {
    --lr-form-control-height: var(
      --lr-form-control-height-l,
      var(--lr-theme-form-control-height-l, var(--lr-size-3rem))
    );
    --lr-form-control-font-size: var(--lr-font-size-lg);
    --lr-form-control-padding-inline: var(--lr-space-l);
    --lr-form-control-padding-block: var(--lr-space-s);
    --lr-form-control-gap: var(--lr-space-2xs);
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius));
  }
  :host([size='xl']) {
    --lr-form-control-height: var(
      --lr-form-control-height-xl,
      var(--lr-theme-form-control-height-xl, var(--lr-size-3-5rem))
    );
    --lr-form-control-font-size: var(--lr-font-size-xl);
    --lr-form-control-padding-inline: var(--lr-space-l);
    --lr-form-control-padding-block: var(--lr-space-s);
    --lr-form-control-gap: var(--lr-space-2xs);
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius));
  }
`;
