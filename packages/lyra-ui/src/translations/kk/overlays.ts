// The `overlays` slice of the kk translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/overlays/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/kk/overlays';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs kk --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  rating: 'Бағалау',
  calloutAnnouncementWithContext: '{context}: {content}',
  closeWithContext: 'Жабу: {snippet}',
  closeWithTruncatedContext: 'Жабу: {snippet}…',
  toastContentIncomplete: 'Мазмұны толық емес хабарландыру',
  toastOverflow: 'Көрсетілмеген хабарландырулар: {count}.',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Escape',
  kbdTabWord: 'Tab',
  kbdSpaceWord: 'Бос орын',
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
  kbdArrowUpWord: 'Жоғары көрсеткі',
  kbdArrowDownWord: 'Төмен көрсеткі',
  kbdArrowLeftWord: 'Сол көрсеткі',
  kbdArrowRightWord: 'Оң көрсеткі',
  kbdPlusWord: 'Плюс',
  kbdMinusWord: 'Минус',
  kbdCommandWord: 'Command',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Control',
  kbdOptionWord: 'Option',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Shift',
};

registerLyraLocale('kk', strings);
