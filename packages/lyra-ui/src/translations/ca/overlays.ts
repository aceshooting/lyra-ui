// The `overlays` slice of the ca translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/overlays/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/ca/overlays';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs ca --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  rating: 'Valoració',
  calloutAnnouncementWithContext: '{context}: {content}',
  closeWithContext: 'Tanca: {snippet}',
  closeWithTruncatedContext: 'Tanca: {snippet}…',
  toastContentIncomplete: 'Notificació amb contingut incomplet',
  toastOverflow: 'Notificacions no mostrades: {count}.',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Escapada',
  kbdTabWord: 'Tabulador',
  kbdSpaceWord: 'Espai',
  kbdDeleteVisual: 'Supr',
  kbdDeleteWord: 'Suprimir',
  kbdHomeWord: 'Inici',
  kbdEndWord: 'Fi',
  kbdPageUpVisual: 'RePàg',
  kbdPageUpWord: 'Retrocés de pàgina',
  kbdPageDownVisual: 'AvPàg',
  kbdPageDownWord: 'Avançament de pàgina',
  kbdEnterWord: 'Retorn',
  kbdBackspaceWord: 'Retrocés',
  kbdArrowUpWord: 'Fletxa amunt',
  kbdArrowDownWord: 'Fletxa avall',
  kbdArrowLeftWord: 'Fletxa esquerra',
  kbdArrowRightWord: 'Fletxa dreta',
  kbdPlusWord: 'Més',
  kbdMinusWord: 'Menys',
  kbdCommandWord: 'Ordre',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Control',
  kbdOptionWord: 'Opció',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Majúscules',
};

registerLyraLocale('ca', strings);
