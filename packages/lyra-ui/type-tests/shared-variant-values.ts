import type { LyraAvatarShape } from '../src/components/media/avatar/avatar.class.js';
import type { LyraSize, LyraVariant } from '../src/internal/variants.js';
import {
  LYRA_AVATAR_SHAPE_VALUES,
  LYRA_SIZE_VALUES,
  LYRA_VARIANT_VALUES,
} from '../src/internal/variant-values.js';

type Assert<Actual extends true> = Actual;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;

/** The leaf runtime tuples and public unions must accept exactly the same values. */
export type SharedVariantValueContracts = [
  Assert<Equal<LyraVariant, (typeof LYRA_VARIANT_VALUES)[number]>>,
  Assert<Equal<LyraSize, (typeof LYRA_SIZE_VALUES)[number]>>,
  Assert<Equal<LyraAvatarShape, (typeof LYRA_AVATAR_SHAPE_VALUES)[number]>>,
];
