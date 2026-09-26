// The `overlays` slice of the sv translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/overlays/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/sv/overlays';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs sv --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  rating: 'Betyg',
  calloutAnnouncementWithContext: '{context}: {content}',
  closeWithContext: 'Stäng: {snippet}',
  closeWithTruncatedContext: 'Stäng: {snippet}…',
  toastContentIncomplete: 'Avisering med ofullständigt innehåll',
  toastOverflow: 'Aviseringar som inte visas: {count}.',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Escape',
  kbdTabWord: 'Tabb',
  kbdSpaceWord: 'Blanksteg',
  kbdDeleteVisual: 'Del',
  kbdDeleteWord: 'Delete',
  kbdHomeWord: 'Home',
  kbdEndWord: 'End',
  kbdPageUpVisual: 'PgUp',
  kbdPageUpWord: 'Page Up',
  kbdPageDownVisual: 'PgDn',
  kbdPageDownWord: 'Page Down',
  kbdEnterWord: 'Retur',
  kbdBackspaceWord: 'Backsteg',
  kbdArrowUpWord: 'Uppåtpil',
  kbdArrowDownWord: 'Nedåtpil',
  kbdArrowLeftWord: 'Vänsterpil',
  kbdArrowRightWord: 'Högerpil',
  kbdPlusWord: 'Plus',
  kbdMinusWord: 'Minus',
  kbdCommandWord: 'Kommando',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Control',
  kbdOptionWord: 'Alternativ',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Skift',
};

registerLyraLocale('sv', strings);
