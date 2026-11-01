// The `overlays` slice of the ga translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/overlays/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-translations/ga/overlays';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs ga --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  rating: 'Rátáil',
  calloutAnnouncementWithContext: '{context}: {content}',
  closeWithContext: 'Dún: {snippet}',
  closeWithTruncatedContext: 'Dún: {snippet}…',
  toastContentIncomplete: 'Fógra le hábhar neamhiomlán',
  toastOverflow: 'Fógraí nár taispeánadh: {count}.',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Éalú',
  kbdTabWord: 'Táb',
  kbdSpaceWord: 'Spás',
  kbdDeleteVisual: 'Del',
  kbdDeleteWord: 'Scrios',
  kbdHomeWord: 'Baile',
  kbdEndWord: 'Deireadh',
  kbdPageUpVisual: 'PgUp',
  kbdPageUpWord: 'Leathanach Suas',
  kbdPageDownVisual: 'PgDn',
  kbdPageDownWord: 'Leathanach Síos',
  kbdEnterWord: 'Iontráil',
  kbdBackspaceWord: 'Cúlspás',
  kbdArrowUpWord: 'Saighead Suas',
  kbdArrowDownWord: 'Saighead Síos',
  kbdArrowLeftWord: 'Saighead Chlé',
  kbdArrowRightWord: 'Saighead Dheas',
  kbdPlusWord: 'Móide',
  kbdMinusWord: 'Lúide',
  kbdCommandWord: 'Ordú',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Rialú',
  kbdOptionWord: 'Rogha',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Iomlaoid',
};

registerLyraLocale('ga', strings);
