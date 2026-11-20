import { unsafeCSS } from 'lit';

/**
 * One tier of the form-control size ladder: the attribute values that select it, the six knobs it
 * assigns, and the theme-chained height input it reads.
 */
interface SizeTier {
  readonly values: readonly string[];
  readonly height: string;
  readonly heightFallback: string;
  readonly fontSize: string;
  readonly paddingInline: string;
  readonly paddingBlock: string;
  readonly radius: string;
}

const THEME_RADIUS = 'var(--lr-theme-form-control-radius, var(--lr-radius))';
const THEME_RADIUS_SMALL = 'var(--lr-theme-form-control-radius, var(--lr-radius-xs))';

const TIERS: readonly SizeTier[] = [
  { values: ['2xs'], height: '2xs', heightFallback: 'var(--lr-size-1-25rem)', fontSize: 'var(--lr-font-size-2xs)', paddingInline: 'var(--lr-space-2xs)', paddingBlock: '0', radius: THEME_RADIUS_SMALL },
  { values: ['xs'], height: 'xs', heightFallback: 'var(--lr-size-1-5rem)', fontSize: 'var(--lr-font-size-xs)', paddingInline: 'var(--lr-space-xs)', paddingBlock: '0', radius: THEME_RADIUS_SMALL },
  { values: ['s', 'small'], height: 's', heightFallback: 'var(--lr-size-2rem)', fontSize: 'var(--lr-font-size-sm)', paddingInline: 'var(--lr-space-s)', paddingBlock: 'min(var(--lr-space-2xs), var(--_lr-form-control-padding-block-limit))', radius: THEME_RADIUS },
  { values: ['m', 'medium'], height: 'm', heightFallback: 'var(--lr-size-2-25rem)', fontSize: 'var(--lr-font-size-m)', paddingInline: 'var(--lr-space-m)', paddingBlock: 'min(var(--lr-space-xs), var(--_lr-form-control-padding-block-limit))', radius: THEME_RADIUS },
  { values: ['l', 'large'], height: 'l', heightFallback: 'var(--lr-size-2-5rem)', fontSize: 'var(--lr-font-size-lg)', paddingInline: 'var(--lr-space-l)', paddingBlock: 'min(var(--lr-space-s), var(--_lr-form-control-padding-block-limit))', radius: THEME_RADIUS },
  { values: ['xl'], height: 'xl', heightFallback: 'var(--lr-size-3-5rem)', fontSize: 'var(--lr-font-size-xl)', paddingInline: 'var(--lr-space-l)', paddingBlock: 'min(var(--lr-space-s), var(--_lr-form-control-padding-block-limit))', radius: THEME_RADIUS },
];

const selectorsOf = (tier: SizeTier): string => tier.values.map((value) => `:host([size='${value}'])`).join(',\n  ');

function renderTiers(tiers: readonly SizeTier[]): string {
  return `${tiers
    .map(
      (tier) => `${selectorsOf(tier)} {
    --_lr-form-control-tier-height: var(--lr-form-control-height-${tier.height}, var(--lr-theme-form-control-height-${tier.height}, ${tier.heightFallback}));
    --lr-form-control-height: var(--_lr-form-control-tier-height);
    --lr-form-control-font-size: ${tier.fontSize};
    --lr-form-control-padding-inline: ${tier.paddingInline};
    --lr-form-control-padding-block: ${tier.paddingBlock};
    --lr-form-control-gap: var(--lr-space-2xs);
    --lr-form-control-radius: ${tier.radius};
  }`
    )
    .join('\n  ')}
  @media (hover: none), (pointer: coarse) {
    ${tiers.map(selectorsOf).join(',\n    ')} {
      --lr-form-control-height: max(var(--_lr-form-control-tier-height), var(--_lr-touch-target-min, 2.75rem));
    }
  }`;
}

/**
 * The explicit size tiers, shared by the unconditional ladder (`sizes`) and the contextual one
 * (`contextualSizes`) so both resolve a tier identically: each tier reads its theme-chained height
 * into one private input, assigns all six knobs (no value leaks from a differently-sized ancestor),
 * and floors the tappable height at the coarse-pointer target minimum. This is the full set, for a
 * host whose unset `size` inherits its context and so needs the `m` tier spelled out.
 */
export const sizeTiers = unsafeCSS(renderTiers(TIERS));

/**
 * The same tiers for a host that carries its own unconditional `m` defaults: the plain `m` value is
 * not restated (it equals the default, and a component's own `:host` override of the default tier
 * must keep applying to it), while the `medium` alias stays explicit as it always has.
 */
export const sizeTiersWithDefault = unsafeCSS(
  renderTiers(TIERS.map((tier) => (tier.height === 'm' ? { ...tier, values: ['medium'] } : tier)))
);
