// The `utility` slice of the de-CH translation catalog for @aceshooting/lyra-ui: strings owned exclusively by `src/components/utility/**`.
// A side-effect-only module: a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/de-CH/utility';` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- `scripts/check-translations.mjs` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs de-CH --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  copyJson: 'JSON in die Zwischenablage kopieren',
  circularReference: 'Zirkuläre Referenz',
  copyDiff: 'Diff kopieren',
  diffViewOldLabel: 'Original',
  diffViewNewLabel: 'Geändert',
  diffViewHiddenLines: {
    one: '{count} unveränderte Zeile',
    other: '{count} unveränderte Zeilen',
  },
  diffViewTooLarge: 'Der Diff ist zu gross für die Anzeige.',
  jsonArray: 'Array',
  jsonObject: 'Objekt',
  jsonValue: 'Wert',
  jsonCopyLabel: '{label} kopieren',
  jsonExpandLabel: '{label} ausklappen',
  jsonCollapseLabel: '{label} einklappen',
  jsonItemCount: {
    one: '{count} Element',
    other: '{count} Elemente',
  },
  jsonKeyCount: {
    one: '{count} Schlüssel',
    other: '{count} Schlüssel',
  },
  jsonViewerLimit: 'Es werden nur die ersten {count} JSON-Knoten und {depth} Verschachtelungsebenen angezeigt und durchsucht.',
  pollPause: 'Pausieren',
  pollResume: 'Fortsetzen',
  pollInactive: 'Inaktiv',
  pollRefreshing: 'Wird aktualisiert…',
  pollPaused: 'Pausiert',
  pollPausedAnnounce: 'Pausiert.',
  pollResumedAnnounce: 'Fortgesetzt.',
  pollRefreshingAnnounce: 'Wird jetzt aktualisiert.',
  randomContentPause: 'Rotation pausieren',
  randomContentResume: 'Rotation fortsetzen',
  exportButtonLabel: 'Exportieren',
  knownDateDay: 'Tag',
  knownDateMonth: 'Monat',
  knownDateYear: 'Jahr',
  exportFormatMenuLabel: '{label}-Format',
  mentionSuggestions: 'Vorschläge',
  mentionResultCount: {
    one: '{count} Vorschlag',
    other: '{count} Vorschläge',
  },
  mentionResultPosition: 'Vorschlag {current} von {total}',
  iconLoadError: 'Das Symbol konnte nicht geladen werden.',
  iconTooLarge: 'Die Symboldatei ist zu gross für die Anzeige.',
  iconSanitizerMissing: 'Für dieses Symbol muss das optionale Paket «dompurify» installiert sein, damit sicher gerendert werden kann.',
  tourSkip: 'Überspringen',
  tourDone: 'Fertig',
  tourStepOf: 'Schritt {current} von {total}',
};

registerLyraLocale('de-CH', strings);
