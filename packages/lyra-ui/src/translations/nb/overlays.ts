// The `overlays` slice of the nb translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/overlays/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/nb/overlays';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs nb --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  rating: 'Vurdering',
  calloutAnnouncementWithContext: '{context}: {content}',
  closeWithContext: 'Lukk: {snippet}',
  closeWithTruncatedContext: 'Lukk: {snippet}…',
  toastContentIncomplete: 'Varsel med ufullstendig innhold',
  toastOverflow: 'Varsler som ikke vises: {count}.',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Escape',
  kbdTabWord: 'Tab',
  kbdSpaceWord: 'Mellomrom',
  kbdDeleteVisual: 'Del',
  kbdDeleteWord: 'Delete',
  kbdHomeWord: 'Home',
  kbdEndWord: 'End',
  kbdPageUpVisual: 'PgUp',
  kbdPageUpWord: 'Page Up',
  kbdPageDownVisual: 'PgDn',
  kbdPageDownWord: 'Page Down',
  kbdEnterWord: 'Enter',
  kbdBackspaceWord: 'Tilbaketast',
  kbdArrowUpWord: 'Pil opp',
  kbdArrowDownWord: 'Pil ned',
  kbdArrowLeftWord: 'Pil venstre',
  kbdArrowRightWord: 'Pil høyre',
  kbdPlusWord: 'Pluss',
  kbdMinusWord: 'Minus',
  kbdCommandWord: 'Kommando',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Control',
  kbdOptionWord: 'Tilvalg',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Shift',
};

registerLyraLocale('nb', strings);
