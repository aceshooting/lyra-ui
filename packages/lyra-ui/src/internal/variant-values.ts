/** Shared runtime values kept separate from converter factories for lean component imports. */
export const LYRA_VARIANT_VALUES = ['neutral', 'brand', 'success', 'warning', 'danger'] as const;

/** Every accepted spelling in the shared size ladder. */
export const LYRA_SIZE_VALUES = [
  '2xs',
  'xs',
  's',
  'm',
  'l',
  'xl',
  'small',
  'medium',
  'large',
] as const;

/** Runtime values for the avatar shape vocabulary shared by avatars and their group. */
export const LYRA_AVATAR_SHAPE_VALUES = ['circle', 'rounded', 'square'] as const;
