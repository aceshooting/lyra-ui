---
'@aceshooting/lyra-ui': patch
---

Fix a batch of translation-content defects found during a pre-release audit of the localization catalogs.

- `ja`: `temperature` (the LLM sampling-temperature label) was left as the literal English word; now `温度`.
- `zh-CN`/`zh-TW`: `artifactPanelLabel` was left as the literal English word `Artifact`; now `产物`/`產物`.
- `pt-BR`/`pt-PT`: `policySummaryCategoryGuardrail` was left as the literal English word `Guardrail`; now `Barreira de proteção`.
- `de`/`de-CH`: the retrieval span-kind badges `spanKindRetriever` and `spanKindEmbedding`, and the retrieval-compare/stage score labels `Dense`/`Sparse`/`Rerank`/`Final`, were left in English while every other locale (and this catalog's own `retrievalStageEmbed`/`retrievalStageRetrieve`) already translates them; now `Abrufkomponente`/`Einbettung`/`Dicht`/`Dünn`/`Neuordnung`/`Endgültig`.
- `sl`: the singular and plural forms of the chat unread-count pill (`newMessageCount`/`newMessagesCount`) were byte-identical, so a single unread message rendered the ungrammatical `Nova sporočila: 1`; the singular form is now `Novo sporočilo: {count}`.
- `uk`: `threadListMatchAnnounce` used the same text for all four CLDR plural categories; it now declines by category (`Знайдено {count} розмову`/`розмови`/`розмов`/`розмови`).
- `id`: `fileTypeFile` and `archiveViewerFile` used the native word `Berkas` while the rest of the catalog consistently uses the loanword `File` for the same concept; normalized to `File`.
- `hi`/`tr`: `generationStatusThroughput` (tokens-per-second) was left as the raw `tok/s` abbreviation while the sibling `generationStatusTokenCount` key already translates "token" in the same catalog; now `{rate} टोकन/सेकंड` and `{rate} belirteç/sn` respectively.
- `hi`: `geojsonViewMissingMapLibrary` left the English word "peer" untransliterated mid-sentence; replaced with `पैकेज` (package), matching this catalog's own `mapMissingLibrary` wording for the same package.
- `kk`: normalized nine strings that quoted a package name or placeholder with plain ASCII `"..."` quotes to the catalog's own established guillemet (`«...»`) convention.
- `hi`, `id`, `ko`, `nl`, `pl`, `uk`: dropped the optional `{ dir: 'ltr', name: '<endonym>' }` `registerLyraLocale()` metadata, which nothing in the library currently reads back and which the other 26 locale catalogs omit, so all-LTR catalogs are consistent again.
- `<lr-flag>`/`<lr-locale-picker>`: added the missing `nn` → `no` and `kk` → `kz` entries to the language-to-country flag map, so those two locales resolve a flag like every sibling locale instead of rendering unresolved.

Every catalog's key set, key order, interpolation placeholders and plural-category shapes are unchanged.
