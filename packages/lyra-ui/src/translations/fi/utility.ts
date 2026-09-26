// The `utility` slice of the fi translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/fi/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs fi --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'Kopioi JSON leikepöydälle',
  circularReference: 'Kehäviittaus',
  copyDiff: 'Kopioi erot',
  diffViewOldLabel: 'Alkuperäinen',
  diffViewNewLabel: 'Muokattu',
  diffViewHiddenLines: {
    one: '{count} muuttumaton rivi',
    other: '{count} muuttumatonta riviä',
  },
  diffViewTooLarge: 'Erot ovat liian suuret näytettäviksi.',
  jsonArray: 'taulukko',
  jsonObject: 'objekti',
  jsonValue: 'arvo',
  jsonCopyLabel: 'Kopioi: {label}',
  jsonExpandLabel: 'Laajenna: {label}',
  jsonCollapseLabel: 'Tiivistä: {label}',
  jsonItemCount: {
    one: '{count} kohde',
    other: '{count} kohdetta',
  },
  jsonKeyCount: {
    one: '{count} avain',
    other: '{count} avainta',
  },
  jsonViewerLimit: 'Vain ensimmäiset {count} JSON-solmua ja {depth} sisäkkäistä tasoa näytetään ja haetaan.',
  pollPause: 'Keskeytä',
  pollResume: 'Jatka',
  pollInactive: 'Ei käytössä',
  pollRefreshing: 'Päivitetään…',
  pollPaused: 'Keskeytetty',
  pollPausedAnnounce: 'Keskeytetty.',
  pollResumedAnnounce: 'Jatkettu.',
  pollRefreshingAnnounce: 'Päivitetään nyt.',
  randomContentPause: 'Keskeytä kierto',
  randomContentResume: 'Jatka kiertoa',
  exportButtonLabel: 'Vie',
  knownDateDay: 'Päivä',
  knownDateMonth: 'Kuukausi',
  knownDateYear: 'Vuosi',
  exportFormatMenuLabel: 'Muoto: {label}',
  mentionSuggestions: 'Ehdotukset',
  mentionResultCount: {
    one: '{count} ehdotus',
    other: '{count} ehdotusta',
  },
  mentionResultPosition: 'Ehdotus {current}/{total}',
  iconLoadError: 'Kuvakkeen lataaminen epäonnistui.',
  iconTooLarge: 'Kuvaketiedosto on liian suuri näytettäväksi.',
  iconSanitizerMissing: 'Tämä kuvake tarvitsee valinnaisen ”dompurify”-paketin turvalliseen piirtämiseen.',
  tourSkip: 'Ohita',
  tourDone: 'Valmis',
  tourStepOf: 'Vaihe {current}/{total}',
};

registerLyraLocale('fi', strings);
