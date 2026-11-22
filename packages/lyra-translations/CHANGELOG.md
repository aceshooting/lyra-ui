# @aceshooting/lyra-translations

## 32.1.0

No changes in this release.

## 32.0.0

### Major Changes

- e4d6610: Load optional composed controls on first use and publish smaller locale catalogs.

  - `lr-filter-bar`'s default entry registers each filter type's control (`lr-select`, `lr-combobox`, `lr-option`, `lr-date-input`, `lr-input`, `lr-dropdown`, `lr-dropdown-item`) and the `loading` spinner the first time a bar renders it. `lr-prompt-input` does the same for `lr-model-select`, `lr-voice-picker`, `lr-source-picker` and `lr-prompt-queue`, and `lr-document-library` for its tag facet's `lr-combobox`. Each control upgrades in place, and the host's `updateComplete` waits for the registrations its render started. The `components/layout` family barrel still registers every filter control up front.
  - `@aceshooting/lyra-translations` omits a message whose text equals the English default when the locale's lookup falls straight back to English (a catalog without a parent locale that shares its base language with no other shipped catalog, and the regional deltas built on it). Rendered text is unchanged; development builds do not report these messages as missing.

  Migration:

  - Code that reads `customElements.get('lr-combobox')` (or any control listed above) right after importing only `lr-filter-bar.js`, `lr-prompt-input.js` or `lr-document-library.js` must import that control's own `components/lr-*.js` entry, or await the host's `updateComplete` after it renders the control. `filter-bar-register.js` and `prompt-input-register.js` still register nothing on demand.
  - For those locales, an application-registered `en` catalog (or an application-registered standalone catalog sharing the locale's base language, such as `fr-BE`) now also answers the omitted messages, `getRegisteredLyraLocaleKeys()` no longer lists them, and a `resolveLyraString()` call without its `defaults` argument returns the key for them. Register the locale's own override with `registerLyraLocale()` to pin a message, and pass the component's `defaultStrings` as `defaults`.

### Patch Changes

- 150dd68: - `lr-rubric-form` no longer registers `lr-select`, `lr-option`, `lr-checkbox` and `lr-checkbox-group` when its entry is imported. They now register the first time a `category` key renders, and `updateComplete` waits for them. A score-and-comment rubric therefore never downloads those controls. **Migration:** code that imported `lr-rubric-form.js` only to get `lr-select` or the checkbox controls for its own markup must now import their entries directly (`components/lr-select.js`, `components/lr-option.js`, `components/lr-checkbox.js`, `components/lr-checkbox-group.js`). Code that reads a rubric's category controls right after a render should `await rubric.updateComplete` first.
  - Smaller published bundles with no change in behaviour: component stylesheets drop whitespace and terminators that punctuation makes redundant (custom property values keep their authored text), text-quote anchoring and highlighting share one offset mapper, the localization runtime resolves plural rules without the general formatter-option capture, `lr-markdown` loads its quote-search index only when it first resolves a highlight or text-quote anchor (selection anchors stay synchronous), the GreyCat highlighting grammar loads only when a `gcl`/`greycat` code block is highlighted, unused shared style fragments and frozen lookup tables are now droppable by bundlers, and source-backed components that never resolve explicit selections (such as `lr-flow-canvas`) no longer ship the selection resolver.
  - `@aceshooting/lyra-translations`: locale catalogs that contain plural messages are now packed as compactly as plain-string catalogs, shrinking the package by about 45 KB packed and 64 KB unpacked. Every catalog registers exactly the same messages.
- Updated dependencies [d72f7b0]
- Updated dependencies [7f5ec4a]
- Updated dependencies [d7c393e]
- Updated dependencies [844a92c]
- Updated dependencies [6962da4]
- Updated dependencies [6962da4]
- Updated dependencies [6962da4]
- Updated dependencies [b42179f]
- Updated dependencies [6962da4]
- Updated dependencies [6962da4]
- Updated dependencies [dba234e]
- Updated dependencies [afb2b75]
- Updated dependencies [5bb1448]
- Updated dependencies [f226c9b]
- Updated dependencies [8e9ad29]
- Updated dependencies [67673cb]
- Updated dependencies [c768915]
- Updated dependencies [71a8b37]
- Updated dependencies [376f3e2]
- Updated dependencies [8e9ad29]
- Updated dependencies [c768915]
- Updated dependencies [96166b2]
- Updated dependencies [376f3e2]
- Updated dependencies [c768915]
- Updated dependencies [96166b2]
- Updated dependencies [376f3e2]
- Updated dependencies [8e9ad29]
- Updated dependencies [376f3e2]
- Updated dependencies [f226c9b]
- Updated dependencies [67673cb]
- Updated dependencies [8e9ad29]
- Updated dependencies [71a8b37]
- Updated dependencies [8e9ad29]
- Updated dependencies [8e9ad29]
- Updated dependencies [71a8b37]
- Updated dependencies [8e9ad29]
- Updated dependencies [c768915]
- Updated dependencies [8e9ad29]
- Updated dependencies [8e9ad29]
- Updated dependencies [cb9fb3d]
- Updated dependencies [d72f7b0]
- Updated dependencies [8e9ad29]
- Updated dependencies [376f3e2]
- Updated dependencies [376f3e2]
- Updated dependencies [376f3e2]
- Updated dependencies [7e55a01]
- Updated dependencies [b68579a]
- Updated dependencies [5026900]
- Updated dependencies [0a87a8b]
- Updated dependencies [d72f7b0]
- Updated dependencies [14a0730]
- Updated dependencies [600bf98]
- Updated dependencies [369dc81]
- Updated dependencies [81bd291]
- Updated dependencies [921d77a]
- Updated dependencies [8b312f4]
- Updated dependencies [6fb4cdf]
- Updated dependencies [7d210b5]
- Updated dependencies [d266133]
- Updated dependencies [44b9c4f]
- Updated dependencies [7f31eef]
- Updated dependencies [59cb878]
- Updated dependencies [9ba9cca]
- Updated dependencies [9ba9cca]
- Updated dependencies [0e15a2a]
- Updated dependencies [70a9046]
- Updated dependencies [0e15a2a]
- Updated dependencies [0e15a2a]
- Updated dependencies [70a9046]
- Updated dependencies [0e15a2a]
- Updated dependencies [0e15a2a]
- Updated dependencies [5cbe812]
- Updated dependencies [70a9046]
- Updated dependencies [0d12725]
- Updated dependencies [2a6d019]
- Updated dependencies [7386ae0]
- Updated dependencies [2a6d019]
- Updated dependencies [55c733d]
- Updated dependencies [2a6d019]
- Updated dependencies [55c733d]
- Updated dependencies [2a6d019]
- Updated dependencies [55c733d]
- Updated dependencies [181418d]
- Updated dependencies [55c733d]
- Updated dependencies [3814758]
- Updated dependencies [23afcda]
- Updated dependencies [b183985]
- Updated dependencies [17a0be0]
- Updated dependencies [b183985]
- Updated dependencies [8db6263]
- Updated dependencies [23afcda]
- Updated dependencies [ee5dc18]
- Updated dependencies [ee5dc18]
- Updated dependencies [3bd1aa6]
- Updated dependencies [8db6263]
- Updated dependencies [88f2a91]
- Updated dependencies [e75ecdd]
- Updated dependencies [e75ecdd]
- Updated dependencies [4b94b62]
- Updated dependencies [4b94b62]
- Updated dependencies [4b94b62]
- Updated dependencies [17a0be0]
- Updated dependencies [181418d]
- Updated dependencies [e75ecdd]
- Updated dependencies [17a0be0]
- Updated dependencies [e0ab518]
- Updated dependencies [c6489ec]
- Updated dependencies [fdb38b1]
- Updated dependencies [3f4a1ef]
- Updated dependencies [e87ee1d]
- Updated dependencies [2a4a51c]
- Updated dependencies [76d8604]
- Updated dependencies [81f9ed8]
- Updated dependencies [f7fc46c]
- Updated dependencies [a3635b5]
- Updated dependencies [a9446ce]
- Updated dependencies [f92b674]
- Updated dependencies [5608cb5]
- Updated dependencies [d8397b8]
- Updated dependencies [1e2bd68]
- Updated dependencies [ce63ef5]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [d8c0eb1]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [7f71f81]
- Updated dependencies [150dd68]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [d8c0eb1]
- Updated dependencies [ef57ee6]
- Updated dependencies [723f026]
- Updated dependencies [fff6b42]
- Updated dependencies [e4d6610]
- Updated dependencies [fff6b42]
- Updated dependencies [fff6b42]
- Updated dependencies [180a4ba]
- Updated dependencies [52e8c37]
  - @aceshooting/lyra-ui@32.0.0

## 31.2.1

No changes in this release.

## 31.2.0

### Patch Changes

- fe6ba7d: Include document editor translations in full locale imports and expose a `docx-editor` family for applications that load editor messages separately.
- Updated dependencies [fe6ba7d]
- Updated dependencies [fe6ba7d]
- Updated dependencies [fe6ba7d]
- Updated dependencies [fe6ba7d]
- Updated dependencies [fe6ba7d]
  - @aceshooting/lyra-ui@31.2.0

## 31.1.1

### Patch Changes

- Updated dependencies [03eaaf1]
  - @aceshooting/lyra-ui@31.1.1

## 31.1.0

### Patch Changes

- Updated dependencies [6dd5f5a]
- Updated dependencies [6dd5f5a]
- Updated dependencies [32cbf4c]
- Updated dependencies [cb780e1]
- Updated dependencies [6dd5f5a]
- Updated dependencies [6dd5f5a]
- Updated dependencies [6dd5f5a]
- Updated dependencies [6dd5f5a]
- Updated dependencies [6dd5f5a]
- Updated dependencies [63e863b]
- Updated dependencies [3a0f6aa]
- Updated dependencies [6dd5f5a]
- Updated dependencies [6dd5f5a]
- Updated dependencies [6d20578]
- Updated dependencies [15a78de]
- Updated dependencies [3a0f6aa]
- Updated dependencies [7daef56]
- Updated dependencies [3a0f6aa]
- Updated dependencies [32cbf4c]
- Updated dependencies [6dd5f5a]
- Updated dependencies [32cbf4c]
- Updated dependencies [a7eeb1d]
- Updated dependencies [6dd5f5a]
- Updated dependencies [86ab216]
- Updated dependencies [6dd5f5a]
- Updated dependencies [32cbf4c]
- Updated dependencies [8deb78a]
  - @aceshooting/lyra-ui@31.1.0

## 31.0.0

### Patch Changes

- Updated dependencies [47d5ced]
- Updated dependencies [fceec2c]
- Updated dependencies [c3498de]
- Updated dependencies [44b9773]
- Updated dependencies [5e894d7]
- Updated dependencies [53874fa]
- Updated dependencies [3b2998e]
- Updated dependencies [5cc0590]
- Updated dependencies [a0d873c]
- Updated dependencies [33515ec]
- Updated dependencies [f9b769c]
- Updated dependencies [e69c1a0]
- Updated dependencies [f044d39]
- Updated dependencies [411cb01]
- Updated dependencies [055fb82]
- Updated dependencies [fdee86f]
- Updated dependencies [926d1b0]
- Updated dependencies [2dbef4f]
- Updated dependencies [eb64a53]
- Updated dependencies [88c0382]
- Updated dependencies [43c4859]
- Updated dependencies [a182932]
- Updated dependencies [4decda0]
- Updated dependencies [5d47cee]
- Updated dependencies [71b8079]
- Updated dependencies [81b0923]
- Updated dependencies [d77a865]
- Updated dependencies [b23677f]
- Updated dependencies [a1dadb4]
- Updated dependencies [7b61dc8]
- Updated dependencies [4e1f338]
- Updated dependencies [707146a]
- Updated dependencies [11cb9f6]
- Updated dependencies [5236f0d]
- Updated dependencies [6a59684]
- Updated dependencies [c6fde08]
- Updated dependencies [bc213b1]
- Updated dependencies [ec87368]
- Updated dependencies [26bef2a]
- Updated dependencies [a1dadb4]
- Updated dependencies [5363490]
- Updated dependencies [ddac560]
- Updated dependencies [7a85d8d]
- Updated dependencies [2391e13]
- Updated dependencies [2f03bb2]
- Updated dependencies [ddf7081]
- Updated dependencies [04fb410]
- Updated dependencies [fed2225]
- Updated dependencies [a7a5763]
- Updated dependencies [e52be70]
- Updated dependencies [e104409]
- Updated dependencies [29cb92f]
- Updated dependencies [7bf8abe]
- Updated dependencies [474c4cb]
- Updated dependencies [524f2f4]
- Updated dependencies [b5c8da4]
- Updated dependencies [7378f05]
- Updated dependencies [65c60d4]
- Updated dependencies [644b1f2]
- Updated dependencies [bdb0150]
- Updated dependencies [644b1f2]
- Updated dependencies [a76b936]
- Updated dependencies [79d296f]
- Updated dependencies [2229e1a]
- Updated dependencies [50f634b]
- Updated dependencies [88e7806]
- Updated dependencies [2060c47]
- Updated dependencies [b43b4dc]
- Updated dependencies [ccb0d35]
- Updated dependencies [57fb2a3]
- Updated dependencies [f7ccc57]
- Updated dependencies [d531e88]
- Updated dependencies [fbbfdda]
- Updated dependencies [f916304]
- Updated dependencies [7b1badf]
- Updated dependencies [fdee86f]
- Updated dependencies [f282fc2]
- Updated dependencies [a49df38]
- Updated dependencies [353292c]
- Updated dependencies [922d2d3]
- Updated dependencies [52fafa4]
- Updated dependencies [45063a8]
- Updated dependencies [711b1fa]
- Updated dependencies [f4ffb25]
- Updated dependencies [40780b4]
- Updated dependencies [6218e9e]
- Updated dependencies [644b7ab]
- Updated dependencies [2170466]
- Updated dependencies [bac361a]
- Updated dependencies [d867044]
- Updated dependencies [6a24221]
- Updated dependencies [f251b0d]
- Updated dependencies [ee91edf]
- Updated dependencies [38b99fa]
- Updated dependencies [e868ed4]
- Updated dependencies [cf16424]
- Updated dependencies [ecaebc3]
- Updated dependencies [c8b457a]
- Updated dependencies [2479fe6]
- Updated dependencies [31a13bc]
- Updated dependencies [fbbfdda]
- Updated dependencies [5b86df0]
- Updated dependencies [4ba3e5e]
- Updated dependencies [2279caf]
  - @aceshooting/lyra-ui@31.0.0

## 30.9.0

### Patch Changes

- Updated dependencies [8e590fc]
- Updated dependencies [b96b689]
- Updated dependencies [d90f34a]
- Updated dependencies [b96b689]
  - @aceshooting/lyra-ui@30.9.0

## 30.8.0

### Patch Changes

- Updated dependencies [fddd9e7]
- Updated dependencies [c8efd9b]
  - @aceshooting/lyra-ui@30.8.0

## 30.7.0

### Minor Changes

- 630bae1: Add ten complete locale catalogs: Slovak (`sk`), Bulgarian (`bg`), Lithuanian (`lt`), Latvian (`lv`), Estonian (`et`), Catalan (`ca`), Irish (`ga`), Maltese (`mt`), and Serbian in Cyrillic (`sr`) and Latin (`sr-Latn`) script, bringing the built-in catalogs to 80. They ship in `@aceshooting/lyra-translations` as `<locale>.js` aggregates and per-family slices, and appear in `locales.json` and the optional locale loader. These are AI-assisted translations with structural verification only (complete keys, placeholders, ICU syntax and CLDR plural categories); they await native-speaker review, and no human or native-speaker review is claimed.

  Serbian resolution is script-aware: a tag without a script subtag whose CLDR likely script differs from its bare language now tries that script before the bare language, so `sr-ME` (Latin by CLDR) reaches `sr-Latn` while `sr`, `sr-RS`, `sr-BA` and `sr-Cyrl-*` reach Cyrillic `sr`. `languageToCountry()` now maps `ga` to Ireland and `mt` to Malta.

### Patch Changes

- Updated dependencies [630bae1]
- Updated dependencies [9a6b7bb]
- Updated dependencies [ee377e2]
- Updated dependencies [5afdde7]
- Updated dependencies [4bcb093]
- Updated dependencies [80e85b6]
- Updated dependencies [a1cde90]
- Updated dependencies [ee377e2]
- Updated dependencies [df2c163]
- Updated dependencies [6113927]
- Updated dependencies [4c6b8d9]
- Updated dependencies [8d430ea]
- Updated dependencies [5979980]
- Updated dependencies [7f8a11f]
- Updated dependencies [c77649c]
- Updated dependencies [36f1381]
- Updated dependencies [f0277da]
- Updated dependencies [cfc6524]
- Updated dependencies [6488a11]
- Updated dependencies [5481ded]
  - @aceshooting/lyra-ui@30.7.0

## 30.6.0

### Patch Changes

- Updated dependencies [0bd9ba4]
- Updated dependencies [0bd9ba4]
  - @aceshooting/lyra-ui@30.6.0

## 30.5.0

### Patch Changes

- Updated dependencies [13b4c5d]
  - @aceshooting/lyra-ui@30.5.0

## 30.4.0

### Patch Changes

- Updated dependencies [fea5203]
  - @aceshooting/lyra-ui@30.4.0

## 30.3.0

### Patch Changes

- Updated dependencies [0d840bd]
- Updated dependencies [0d840bd]
- Updated dependencies [0d840bd]
- Updated dependencies [0d840bd]
- Updated dependencies [0d840bd]
- Updated dependencies [c3b40ec]
- Updated dependencies [3d5644c]
  - @aceshooting/lyra-ui@30.3.0

## 30.2.0

### Patch Changes

- Updated dependencies [d9fe8ee]
- Updated dependencies [6c9751f]
  - @aceshooting/lyra-ui@30.2.0

## 30.1.0

### Patch Changes

- Updated dependencies [1e233d8]
- Updated dependencies [1e233d8]
- Updated dependencies [e7ed92d]
- Updated dependencies [49b43b3]
- Updated dependencies [49b43b3]
- Updated dependencies [49b43b3]
- Updated dependencies [55ec21c]
- Updated dependencies [1e233d8]
- Updated dependencies [1e233d8]
- Updated dependencies [1e233d8]
- Updated dependencies [1e233d8]
- Updated dependencies [e7ed92d]
- Updated dependencies [49b43b3]
- Updated dependencies [e487c79]
- Updated dependencies [49b43b3]
- Updated dependencies [e143d1c]
- Updated dependencies [e143d1c]
- Updated dependencies [49b43b3]
- Updated dependencies [1e233d8]
- Updated dependencies [1e233d8]
  - @aceshooting/lyra-ui@30.1.0

## 30.0.0

### Patch Changes

- Updated dependencies [bdc75cc]
- Updated dependencies [955817c]
- Updated dependencies [52792ec]
- Updated dependencies [7fa4f02]
- Updated dependencies [3c2bace]
- Updated dependencies [6e32333]
- Updated dependencies [30ca106]
- Updated dependencies [d60e64e]
- Updated dependencies [9c55bdd]
- Updated dependencies [d60e64e]
- Updated dependencies [afc026a]
- Updated dependencies [afc026a]
- Updated dependencies [2e3e192]
- Updated dependencies [5c4824f]
- Updated dependencies [afc026a]
- Updated dependencies [afc026a]
- Updated dependencies [38a734c]
- Updated dependencies [166f12c]
- Updated dependencies [daaf791]
- Updated dependencies [ff668f9]
- Updated dependencies [daaf791]
- Updated dependencies [631a5d5]
- Updated dependencies [7fa4f02]
- Updated dependencies [daaf791]
- Updated dependencies [6e32333]
- Updated dependencies [ba97350]
- Updated dependencies [7fa4f02]
- Updated dependencies [f5b4bde]
- Updated dependencies [c9a3891]
- Updated dependencies [5c66e18]
- Updated dependencies [aae417a]
- Updated dependencies [5b83018]
- Updated dependencies [3cc71c2]
- Updated dependencies [631a5d5]
- Updated dependencies [7fa4f02]
- Updated dependencies [1c49a93]
- Updated dependencies [d84c719]
- Updated dependencies [04a9d6f]
  - @aceshooting/lyra-ui@30.0.0

## 29.2.2

### Patch Changes

- Updated dependencies [e020642]
  - @aceshooting/lyra-ui@29.2.2

## 29.2.1

### Patch Changes

- Updated dependencies [b7262ed]
- Updated dependencies [0ef480e]
  - @aceshooting/lyra-ui@29.2.1

## 29.2.0

### Patch Changes

- Updated dependencies [d756bce]
- Updated dependencies [2fd9f5c]
- Updated dependencies [d3725d2]
- Updated dependencies [58eb5b2]
- Updated dependencies [5dd23d3]
  - @aceshooting/lyra-ui@29.2.0

## 29.1.0

### Patch Changes

- Updated dependencies [b603b71]
- Updated dependencies [3807e35]
- Updated dependencies [88c3542]
  - @aceshooting/lyra-ui@29.1.0

## 29.0.2

### Patch Changes

- Updated dependencies [cb8c8c5]
  - @aceshooting/lyra-ui@29.0.2

## 29.0.1

### Patch Changes

- Updated dependencies [6590e5d]
  - @aceshooting/lyra-ui@29.0.1

## 29.0.0

### Patch Changes

- Updated dependencies [919bd25]
  - @aceshooting/lyra-ui@29.0.0

## 28.2.0

### Patch Changes

- Updated dependencies [21686f9]
- Updated dependencies [70ecffc]
  - @aceshooting/lyra-ui@28.2.0

## 28.1.6

### Patch Changes

- Updated dependencies [91e0b33]
  - @aceshooting/lyra-ui@28.1.6

## 28.1.5

### Patch Changes

- Updated dependencies [1910139]
  - @aceshooting/lyra-ui@28.1.5

## 28.1.4

### Patch Changes

- edae457: Correct pseudo-locale manifest imports to point to their Lyra UI exports. Allow valid regional catalog imports within the translations package while continuing to reject imports that escape the package.
- Updated dependencies [edae457]
- Updated dependencies [edae457]
  - @aceshooting/lyra-ui@28.1.4

## 28.1.3

### Patch Changes

- Updated dependencies [53edd10]
  - @aceshooting/lyra-ui@28.1.3

## 28.1.2

### Patch Changes

- Updated dependencies [ea2a845]
- Updated dependencies [4ceefc4]
- Updated dependencies [7a119cc]
- Updated dependencies [b3cc650]
- Updated dependencies [829c00d]
- Updated dependencies [e607435]
- Updated dependencies [bfd071f]
- Updated dependencies [e449f0b]
  - @aceshooting/lyra-ui@28.1.2

## 28.1.1

### Patch Changes

- Updated dependencies [992d6a2]
- Updated dependencies [07d9075]
- Updated dependencies [c529f00]
- Updated dependencies [7a28693]
- Updated dependencies [7a28693]
- Updated dependencies [6ea4454]
- Updated dependencies [b582d6d]
  - @aceshooting/lyra-ui@28.1.1

## 28.1.0

### Patch Changes

- Updated dependencies [be521ef]
  - @aceshooting/lyra-ui@28.1.0

## 28.0.0

### Patch Changes

- Updated dependencies [3160025]
- Updated dependencies [de6b148]
- Updated dependencies [9767b43]
- Updated dependencies [3e9e251]
- Updated dependencies [b6636b8]
- Updated dependencies [39b4dd0]
- Updated dependencies [4eadd60]
- Updated dependencies [5a25138]
- Updated dependencies [458b832]
- Updated dependencies [c4a8e96]
- Updated dependencies [bcd2daa]
- Updated dependencies [0a55cfb]
- Updated dependencies [bf50c85]
- Updated dependencies [b6636b8]
- Updated dependencies [0845756]
- Updated dependencies [0fea4be]
- Updated dependencies [081312e]
- Updated dependencies [c5ea949]
- Updated dependencies [bbcd486]
- Updated dependencies [8147014]
- Updated dependencies [95f07d1]
  - @aceshooting/lyra-ui@28.0.0

## 27.0.0

### Minor Changes

- fe2bb4e: Initial release: the built-in locale catalogs for `@aceshooting/lyra-ui`, previously published under `@aceshooting/lyra-ui/translations/`. Import `@aceshooting/lyra-translations/<locale>.js` to register a locale.

### Patch Changes

- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [902c90b]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [ee0b543]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [902c90b]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
- Updated dependencies [fe2bb4e]
  - @aceshooting/lyra-ui@27.0.0
