---
'@aceshooting/lyra-ui': minor
'@aceshooting/lyra-translations': minor
---

Add ten complete locale catalogs: Slovak (`sk`), Bulgarian (`bg`), Lithuanian (`lt`), Latvian (`lv`), Estonian (`et`), Catalan (`ca`), Irish (`ga`), Maltese (`mt`), and Serbian in Cyrillic (`sr`) and Latin (`sr-Latn`) script, bringing the built-in catalogs to 80. They ship in `@aceshooting/lyra-translations` as `<locale>.js` aggregates and per-family slices, and appear in `locales.json` and the optional locale loader. These are AI-assisted translations with structural verification only (complete keys, placeholders, ICU syntax and CLDR plural categories); they await native-speaker review, and no human or native-speaker review is claimed.

Serbian resolution is script-aware: a tag without a script subtag whose CLDR likely script differs from its bare language now tries that script before the bare language, so `sr-ME` (Latin by CLDR) reaches `sr-Latn` while `sr`, `sr-RS`, `sr-BA` and `sr-Cyrl-*` reach Cyrillic `sr`. `languageToCountry()` now maps `ga` to Ireland and `mt` to Malta.
