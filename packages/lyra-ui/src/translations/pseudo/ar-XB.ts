/**
 * Mirrored RTL pseudo locale for bidirectional layout and localization testing.
 *
 * This catalog is synthetic and generated from the built-in English strings at runtime. It is not
 * Arabic, is not a translation, and carries no native-speaker review claim.
 */
import {
  LYRA_DEFAULT_STRINGS,
  type LyraLocaleStrings,
} from '../../internal/localization.js';
import { registerLyraExactLocale } from '../../internal/localization-runtime.js';
import { createPseudoCatalog, pseudoMirror } from '../../internal/pseudo-localization.js';

export const strings: LyraLocaleStrings = createPseudoCatalog(LYRA_DEFAULT_STRINGS, (literal) =>
  literal ? `⟦RTL⟧ ${pseudoMirror(literal)}` : literal,
);

registerLyraExactLocale('ar-XB', strings, {
  dir: 'rtl',
  name: 'Pseudo: mirrored RTL (synthetic)',
});
