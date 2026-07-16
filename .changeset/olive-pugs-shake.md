---
"@aceshooting/lyra-ui": minor
---

Harden every remote-resource viewer against oversized, cancelled, and failed loads, and close a set of localization gaps.

**Resource limits.** A new internal resource loader caps any remote resource a viewer fetches at 25 MB before handing it to a parser, enforced by streaming the response so the cap holds even when the server omits `Content-Length`. Parsed tabular data is additionally capped at 10,000 rows and 1,000 columns before it is retained or rendered. Exceeding either limit now surfaces the localized `documentPreviewResourceTooLarge` message instead of attempting the parse. This is a behavior change for consumers previewing documents above those thresholds — they will now see a size error where the viewer previously tried (and typically hung or crashed) on them.

**Cancellable loads.** `LyraElement` gained internal `beginAbortableLoad()` and `scheduleAfterUpdate()` helpers. In-flight fetches are now aborted when the element disconnects or its `src` changes again, and loads are coalesced to one per update rather than firing from `willUpdate`. This fixes stale responses racing a newer `src` and work continuing after an element is removed from the DOM. A `src` assigned while an element is detached is held and replayed when it reconnects, rather than being dropped.

**Error messages no longer leak internals.** Viewers previously rendered raw `error.message` text (fetch/parser internals, URLs) directly into the UI on failure. They now render the localized `documentPreviewFailedToLoad` message, with the underlying error still available to consumers via the `lyra-render-error` event.

Affected viewers: `lyra-archive-viewer`, `lyra-calendar-viewer`, `lyra-contact-viewer`, `lyra-csv-viewer`, `lyra-dataset-viewer`, `lyra-docx-viewer`, `lyra-document-preview`, `lyra-ebook-viewer`, `lyra-email-viewer`, `lyra-html-viewer`, `lyra-pdf-viewer`, `lyra-pptx-viewer`, `lyra-spreadsheet-viewer`, `lyra-svg-viewer`.

**Localization fixes.**

- Form-associated components rendered the required-field validation message as a hardcoded English string (`Please fill out this field.`). It now resolves through the `fieldRequired` message key, so `registerLyraLocale()` and per-element `strings` overrides apply. Note that this also changes the default English text to `This field is required.` — if you assert on `validationMessage`, update the expected string.
- Removed a duplicate `hidePassword` member from the `LyraMessageKey` union. The key itself is unchanged and still used by `lyra-input`; only the redundant second declaration is gone.

**Component coverage contract.** A new `check-component-coverage.mjs` gate runs as part of `contract-policy` (and therefore `lint`), requiring every public tag in the manifest to be exercised by a story and a behavior test, and every component family to carry an accessibility assertion. Stories and tests were added across the library to satisfy it, and `test:coverage` now runs the full test suite rather than five hardcoded files. No public API change.
