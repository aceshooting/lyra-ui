// The `overlays` slice of the lt translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/overlays/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/lt/overlays';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs lt --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  rating: 'Įvertinimas',
  calloutAnnouncementWithContext: '{context}: {content}',
  closeWithContext: 'Uždaryti: {snippet}',
  closeWithTruncatedContext: 'Uždaryti: {snippet}…',
  toastContentIncomplete: 'Pranešimas su neišsamiu turiniu',
  toastOverflow: 'Neparodytų pranešimų: {count}.',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Escape',
  kbdTabWord: 'Tab',
  kbdSpaceWord: 'Tarpas',
  kbdDeleteVisual: 'Del',
  kbdDeleteWord: 'Delete',
  kbdHomeWord: 'Home',
  kbdEndWord: 'End',
  kbdPageUpVisual: 'PgUp',
  kbdPageUpWord: 'Page Up',
  kbdPageDownVisual: 'PgDn',
  kbdPageDownWord: 'Page Down',
  kbdEnterWord: 'Enter',
  kbdBackspaceWord: 'Backspace',
  kbdArrowUpWord: 'Rodyklė aukštyn',
  kbdArrowDownWord: 'Rodyklė žemyn',
  kbdArrowLeftWord: 'Rodyklė kairėn',
  kbdArrowRightWord: 'Rodyklė dešinėn',
  kbdPlusWord: 'Pliusas',
  kbdMinusWord: 'Minusas',
  kbdCommandWord: 'Command',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Control',
  kbdOptionWord: 'Option',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Shift',
};

registerLyraLocale('lt', strings);
