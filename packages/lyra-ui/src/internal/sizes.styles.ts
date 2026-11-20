import { css } from 'lit';
import { sizeTiersWithDefault } from './size-tiers.styles.js';

// The ONE size ladder. Twenty-two components carried their own copy of this scale, and four
// different ladders were in circulation ('2xs..xl', 'xs..xl', 'small|medium|large', 'sm|md').
//
// Every tier assigns the same six `--lr-form-control-*` knobs; nothing here declares a property on a
// part. A component adopts the ladder by pointing its own `--lr-<name>-min-height` (etc.) at the
// corresponding knob, which keeps each component's public custom-property surface intact while the
// VALUES come from one place. That indirection is deliberate: retuning a tier for one component
// stays a one-line override rather than a `::part()` rule.
//
// Both spellings of every tier match in the same selector list. `small`/`medium`/`large` are Web
// Awesome's and Shoelace's names, so a migration is a tag rename with no attribute rewrite; `s`/`m`/
// `l` are the names the rest of this library already uses. Neither is normalised away in JS -- the
// CSS simply matches both, so no component pays for the alias.
//
// Heights chain through `--lr-theme-form-control-height-*` and corner radii through
// `--lr-theme-form-control-radius`, so an application can retune the whole control scale from one
// place. Their defaults are the scale `lr-button`, `lr-input`, `lr-select`, `lr-combobox` and
// `lr-date-input` already shared, so a control of any of those types sits at the same height and
// corner language as its neighbours in a toolbar row at every tier.
export const sizes = css`
  :host {
    --lr-form-control-height-2xs: var(--lr-theme-form-control-height-2xs, 1.25rem);
    --lr-form-control-height-xs: var(--lr-theme-form-control-height-xs, 1.5rem);
    --lr-form-control-height-s: var(--lr-theme-form-control-height-s, 2rem);
    --lr-form-control-height-m: var(--lr-theme-form-control-height-m, 2.25rem);
    --lr-form-control-height-l: var(--lr-theme-form-control-height-l, 2.5rem);
    --lr-form-control-height-xl: var(--lr-theme-form-control-height-xl, 3.5rem);

    /* The default tier is "m"; these :host declarations ARE that tier, so a :host([size='m']) block
       would only restate them. */
    --lr-form-control-height: var(--lr-form-control-height-m);
    --_lr-form-control-tier-height: var(--lr-form-control-height-m);
    /* Cap default padding against the consumer's live line box. Rows retain auto height, so
       larger authored content still grows instead of being clipped to the tier's floor. */
    --_lr-form-control-padding-block-limit: max(
      0px,
      calc((var(--lr-form-control-height) - 1lh - 2 * var(--lr-border-width-thin)) / 2)
    );
    --lr-form-control-font-size: var(--lr-font-size-m);
    --lr-form-control-padding-inline: var(--lr-space-m);
    --lr-form-control-padding-block: min(var(--lr-space-xs), var(--_lr-form-control-padding-block-limit));
    --lr-form-control-gap: var(--lr-space-2xs);
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius));
  }
  /* Coarse-pointer touch-target floor for the unsized default tier; the explicit tiers carry their
     own floor in the shared tier rules, which outrank this bare :host rule. */
  @media (hover: none), (pointer: coarse) {
    :host {
      --lr-form-control-height: max(var(--lr-form-control-height-m), var(--_lr-touch-target-min, 2.75rem));
    }
  }
  ${sizeTiersWithDefault}
`;

/** An owning group supplies its resolved size tier while preserving an option's authored size.
 * Compose after the local size ladder so removing the group marker restores that ladder. */
export const groupOptionSize = css`
  :host([data-lr-group-size]) {
    --lr-form-control-height: inherit;
    --lr-form-control-font-size: inherit;
    --lr-form-control-padding-inline: inherit;
    --lr-form-control-padding-block: inherit;
    --lr-form-control-gap: inherit;
    --lr-form-control-radius: inherit;
  }
`;
