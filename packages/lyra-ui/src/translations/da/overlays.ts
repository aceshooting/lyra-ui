// The `overlays` slice of the da translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/overlays/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/da/overlays';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs da --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  rating: 'Bedømmelse',
  calloutAnnouncementWithContext: '{context}: {content}',
  closeWithContext: 'Luk: {snippet}',
  closeWithTruncatedContext: 'Luk: {snippet}…',
  toastContentIncomplete: 'Notifikation med ufuldstændigt indhold',
  toastOverflow: 'Notifikationer, der ikke vises: {count}.',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Escape',
  kbdTabWord: 'Tab',
  kbdSpaceWord: 'Mellemrum',
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
  kbdArrowUpWord: 'Pil op',
  kbdArrowDownWord: 'Pil ned',
  kbdArrowLeftWord: 'Venstre pil',
  kbdArrowRightWord: 'Højre pil',
  kbdPlusWord: 'Plus',
  kbdMinusWord: 'Minus',
  kbdCommandWord: 'Kommando',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Control',
  kbdOptionWord: 'Alternativ',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Skift',
};

registerLyraLocale('da', strings);
