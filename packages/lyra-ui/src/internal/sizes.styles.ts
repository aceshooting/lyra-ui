import { css } from 'lit';

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
    --lr-form-control-height-s: var(--lr-theme-form-control-height-s, 1.875rem);
    --lr-form-control-height-m: var(--lr-theme-form-control-height-m, 2.5rem);
    --lr-form-control-height-l: var(--lr-theme-form-control-height-l, 3rem);
    --lr-form-control-height-xl: var(--lr-theme-form-control-height-xl, 3.5rem);

    /* The default tier is "m"; these :host declarations ARE that tier, so a :host([size='m']) block
       would only restate them. */
    --lr-form-control-height: var(--lr-form-control-height-m);
    --lr-form-control-font-size: var(--lr-font-size-m);
    --lr-form-control-padding-inline: var(--lr-space-m);
    --lr-form-control-padding-block: var(--lr-space-xs);
    --lr-form-control-gap: var(--lr-space-2xs);
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius));
  }
  :host([size='2xs']) {
    --lr-form-control-height: var(--lr-form-control-height-2xs);
    --lr-form-control-font-size: var(--lr-font-size-2xs);
    --lr-form-control-padding-inline: var(--lr-space-2xs);
    --lr-form-control-padding-block: 0;
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius-xs));
  }
  :host([size='xs']) {
    --lr-form-control-height: var(--lr-form-control-height-xs);
    --lr-form-control-font-size: var(--lr-font-size-xs);
    --lr-form-control-padding-inline: var(--lr-space-xs);
    --lr-form-control-padding-block: 0;
    --lr-form-control-radius: var(--lr-theme-form-control-radius, var(--lr-radius-xs));
  }
  :host([size='s']),
  :host([size='small']) {
    --lr-form-control-height: var(--lr-form-control-height-s);
    --lr-form-control-font-size: var(--lr-font-size-sm);
    --lr-form-control-padding-inline: var(--lr-space-s);
    --lr-form-control-padding-block: var(--lr-space-2xs);
  }
  :host([size='medium']) {
    --lr-form-control-height: var(--lr-form-control-height-m);
    --lr-form-control-font-size: var(--lr-font-size-m);
    --lr-form-control-padding-inline: var(--lr-space-m);
    --lr-form-control-padding-block: var(--lr-space-xs);
  }
  :host([size='l']),
  :host([size='large']) {
    --lr-form-control-height: var(--lr-form-control-height-l);
    --lr-form-control-font-size: var(--lr-font-size-lg);
    --lr-form-control-padding-inline: var(--lr-space-l);
    --lr-form-control-padding-block: var(--lr-space-s);
  }
  :host([size='xl']) {
    --lr-form-control-height: var(--lr-form-control-height-xl);
    --lr-form-control-font-size: var(--lr-font-size-xl);
    --lr-form-control-padding-inline: var(--lr-space-l);
    --lr-form-control-padding-block: var(--lr-space-s);
  }

  /* Coarse-pointer touch-target floor, paired with the identical --lr-icon-button-size rule in
     tokens.styles.ts's baseTokens -- the two token systems the density-axis request named as "the
     only lever". Every tier's tappable height floors at 2.75rem (44px, the iOS HIG / Android
     Material touch-target convention) once the pointer that reaches it is a finger rather than a
     mouse; 'l' and 'xl' are already at or above that and so are untouched by max(). Font size and
     padding are deliberately left alone -- only the tappable box itself grows, so a coarse-pointer
     '2xs' row still reads as dense, it just is not finger-hostile. Selector-for-selector against
     every rule above (not one generic :host rule): :host([size='2xs']) outranks a bare :host on
     specificity, so a single lower-specificity override here would silently lose the cascade for
     every sized tier and only ever apply to the unsized default. Each rule reads its own
     '--lr-form-control-height-<tier>' input rather than the shared '--lr-form-control-height'
     output above -- referencing the very property a declaration assigns, on the same selector, is
     a cycle per the Custom Properties spec and resolves to guaranteed-invalid (inherited) instead
     of the intended floor, not to some sensible current value. */
  @media (hover: none), (pointer: coarse) {
    :host {
      --lr-form-control-height: max(var(--lr-form-control-height-m), 2.75rem);
    }
    :host([size='2xs']) {
      --lr-form-control-height: max(var(--lr-form-control-height-2xs), 2.75rem);
    }
    :host([size='xs']) {
      --lr-form-control-height: max(var(--lr-form-control-height-xs), 2.75rem);
    }
    :host([size='s']),
    :host([size='small']) {
      --lr-form-control-height: max(var(--lr-form-control-height-s), 2.75rem);
    }
    :host([size='medium']) {
      --lr-form-control-height: max(var(--lr-form-control-height-m), 2.75rem);
    }
    :host([size='l']),
    :host([size='large']) {
      --lr-form-control-height: max(var(--lr-form-control-height-l), 2.75rem);
    }
    :host([size='xl']) {
      --lr-form-control-height: max(var(--lr-form-control-height-xl), 2.75rem);
    }
  }
`;
