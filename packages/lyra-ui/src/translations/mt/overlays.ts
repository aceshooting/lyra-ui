// The `overlays` slice of the mt translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/overlays/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/mt/overlays';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs mt --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  rating: 'Klassifikazzjoni',
  calloutAnnouncementWithContext: '{context}: {content}',
  closeWithContext: 'Agħlaq: {snippet}',
  closeWithTruncatedContext: 'Agħlaq: {snippet}…',
  toastContentIncomplete: 'Notifika b’kontenut mhux komplut',
  toastOverflow: 'Notifiki mhux murija: {count}.',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Escape',
  kbdTabWord: 'Tab',
  kbdSpaceWord: 'Spazju',
  kbdDeleteVisual: 'Del',
  kbdDeleteWord: 'Ħassar',
  kbdHomeWord: 'Home',
  kbdEndWord: 'End',
  kbdPageUpVisual: 'PgUp',
  kbdPageUpWord: 'Paġna ’l fuq',
  kbdPageDownVisual: 'PgDn',
  kbdPageDownWord: 'Paġna ’l isfel',
  kbdEnterWord: 'Enter',
  kbdBackspaceWord: 'Backspace',
  kbdArrowUpWord: 'Vleġġa ’l fuq',
  kbdArrowDownWord: 'Vleġġa ’l isfel',
  kbdArrowLeftWord: 'Vleġġa lejn ix-xellug',
  kbdArrowRightWord: 'Vleġġa lejn il-lemin',
  kbdPlusWord: 'Plus',
  kbdMinusWord: 'Minus',
  kbdCommandWord: 'Kmand',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Kontroll',
  kbdOptionWord: 'Għażla',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Shift',
};

registerLyraLocale('mt', strings);
