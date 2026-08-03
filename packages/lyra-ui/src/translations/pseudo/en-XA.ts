/**
 * Expanded, accented LTR pseudo locale for layout and localization testing.
 *
 * This catalog is synthetic and generated from the built-in English strings at runtime. It is not
 * a translation and carries no native-speaker review claim.
 */
import {
  LYRA_DEFAULT_STRINGS,
  type LyraLocaleStrings,
} from '../../internal/localization.js';
import { registerLyraExactLocale } from '../../internal/localization-runtime.js';
import { createPseudoCatalog, pseudoExpand } from '../../internal/pseudo-localization.js';

export const strings: LyraLocaleStrings = createPseudoCatalog(LYRA_DEFAULT_STRINGS, (literal) =>
  literal ? `[!! ${pseudoExpand(literal)} !!]` : literal,
);

registerLyraExactLocale('en-XA', strings, {
  dir: 'ltr',
  name: 'Pseudo: expanded accented LTR (synthetic)',
});
