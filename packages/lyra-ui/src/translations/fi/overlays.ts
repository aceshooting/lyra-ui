// The `overlays` slice of the fi translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/overlays/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/fi/overlays';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs fi --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  rating: 'Arvio',
  calloutAnnouncementWithContext: '{context}: {content}',
  closeWithContext: 'Sulje: {snippet}',
  closeWithTruncatedContext: 'Sulje: {snippet}…',
  toastContentIncomplete: 'Ilmoitus, jonka sisältö on puutteellinen',
  toastOverflow: 'Näyttämättömiä ilmoituksia: {count}.',
  kbdEscapeVisual: 'Esc',
  kbdEscapeWord: 'Escape',
  kbdTabWord: 'Sarkain',
  kbdSpaceWord: 'Välilyönti',
  kbdDeleteVisual: 'Del',
  kbdDeleteWord: 'Delete',
  kbdHomeWord: 'Home',
  kbdEndWord: 'End',
  kbdPageUpVisual: 'PgUp',
  kbdPageUpWord: 'Page Up',
  kbdPageDownVisual: 'PgDn',
  kbdPageDownWord: 'Page Down',
  kbdEnterWord: 'Enter',
  kbdBackspaceWord: 'Askelpalautin',
  kbdArrowUpWord: 'Nuoli ylös',
  kbdArrowDownWord: 'Nuoli alas',
  kbdArrowLeftWord: 'Nuoli vasemmalle',
  kbdArrowRightWord: 'Nuoli oikealle',
  kbdPlusWord: 'Plus',
  kbdMinusWord: 'Miinus',
  kbdCommandWord: 'Command',
  kbdControlVisual: 'Ctrl',
  kbdControlWord: 'Control',
  kbdOptionWord: 'Option',
  kbdAltWord: 'Alt',
  kbdShiftWord: 'Shift',
};

registerLyraLocale('fi', strings);
