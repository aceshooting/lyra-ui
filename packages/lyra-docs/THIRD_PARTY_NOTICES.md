# Third-party notices

Lyra Docs is distributed under the MIT License in `LICENSE`. This package uses
and redistributes the third-party software and stylesheet listed here. The
corresponding full license texts and upstream notices are included in
`THIRD_PARTY_LICENSES/` in this package.

## DOCX engine and stylesheet

`@docx-editor.dev/core@2.31.0` is copyright 2026 EigenPal Inc. and is
licensed under Apache-2.0. The upstream package source is published at
[github.com/eigenpal/docx-editor/tree/main/packages/core](https://github.com/eigenpal/docx-editor/tree/main/packages/core),
and the exact public package is
[`@docx-editor.dev/core@2.31.0`](https://www.npmjs.com/package/@docx-editor.dev/core/v/2.31.0).
Lyra Docs builds a modified internal engine from the pinned Apache-2.0 source and
redistributes the package's `dist/editor.css` stylesheet unchanged.

Source commit: `d22e3b4f02d4d0b73d7964114d077b286f207742`

The engine and its feature modules are
included in the npm package. [NOTICE](NOTICE) describes the modifications and
reproduction inputs; `scripts/engine-source.lock.json` binds the source, patches,
maintainer dependencies and generated assets. No upstream Pro package is included.
The Apache-2.0 license text is included in
[`THIRD_PARTY_LICENSES/docx-editor-core-2.31.0-Apache-2.0.txt`](THIRD_PARTY_LICENSES/docx-editor-core-2.31.0-Apache-2.0.txt).

The upstream package's
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_LICENSES/docx-editor-core-2.31.0-THIRD_PARTY_NOTICES.md)
is included verbatim. It attributes bundled `harfbuzzjs@1.6.1` to its project
authors under MIT and identifies the separately distributed HarfBuzz asset.
The upstream HarfBuzz license is included at
[`THIRD_PARTY_LICENSES/HarfBuzz-COPYING.txt`](THIRD_PARTY_LICENSES/HarfBuzz-COPYING.txt).

## Runtime package licenses

The workspace installs these runtime packages with Lyra Docs:

- `fflate@0.8.3` — MIT; copyright 2026 Arjun Barrett. The full license is
  [`THIRD_PARTY_LICENSES/fflate-0.8.3-MIT.txt`](THIRD_PARTY_LICENSES/fflate-0.8.3-MIT.txt).
- `saxes@6.0.0` — ISC; copyright Contributors. Its `xmlchars@2.2.0`
  dependency is MIT; copyright Louis-Dominique Dubeau and contributors. Full
  texts are in [`THIRD_PARTY_LICENSES/saxes-6.0.0-ISC.txt`](THIRD_PARTY_LICENSES/saxes-6.0.0-ISC.txt)
  and [`THIRD_PARTY_LICENSES/xmlchars-2.2.0-MIT.txt`](THIRD_PARTY_LICENSES/xmlchars-2.2.0-MIT.txt).
- `lit@3.3.3` — BSD-3-Clause; copyright 2017 Google LLC. The full license is
  [`THIRD_PARTY_LICENSES/lit-3.3.3-BSD-3-Clause.txt`](THIRD_PARTY_LICENSES/lit-3.3.3-BSD-3-Clause.txt).
- `@aceshooting/lyra-ui` — MIT; see that package's distributed `LICENSE` file.

These attributions identify the installed packages; each package retains its
own license and copyright notices in its separately distributed files.

## Dependencies bundled in the internal engine

The generated engine also includes these packages. Their full license texts are
included with this distribution; fflate is listed above.

- `@docx-editor.dev/i18n@2.31.0` — Apache-2.0; [license](THIRD_PARTY_LICENSES/docx-editor.dev-i18n-2.31.0-Apache-2.0.txt).
- `@nodable/entities@3.1.0` — MIT; [license](THIRD_PARTY_LICENSES/nodable-entities-3.1.0-MIT.txt).
- `anynum@1.0.1` — MIT; [license](THIRD_PARTY_LICENSES/anynum-1.0.1-MIT.txt).
- `bidi-js@1.1.0` — MIT; [license](THIRD_PARTY_LICENSES/bidi-js-1.1.0-MIT.txt).
- `emf-converter@2.0.2` — Apache-2.0; [license](THIRD_PARTY_LICENSES/emf-converter-2.0.2-Apache-2.0.txt).
- `fast-xml-parser@5.11.2` — MIT; [license](THIRD_PARTY_LICENSES/fast-xml-parser-5.11.2-MIT.txt).
- `harfbuzzjs@1.6.1` — MIT; [license](THIRD_PARTY_LICENSES/harfbuzzjs-1.6.1-MIT.txt).
- `is-unsafe@2.0.2` — MIT; [license](THIRD_PARTY_LICENSES/is-unsafe-2.0.2-MIT.txt).
- `orderedmap@2.1.1` — MIT; [license](THIRD_PARTY_LICENSES/orderedmap-2.1.1-MIT.txt).
- `pako@1.0.11` — (MIT AND Zlib); [license](THIRD_PARTY_LICENSES/pako-1.0.11--MIT-AND-Zlib-.txt).
- `path-expression-matcher@1.6.2` — MIT; [license](THIRD_PARTY_LICENSES/path-expression-matcher-1.6.2-MIT.txt).
- `prosemirror-model@1.25.12` — MIT; [license](THIRD_PARTY_LICENSES/prosemirror-model-1.25.12-MIT.txt).
- `strnum@2.4.2` — MIT; [license](THIRD_PARTY_LICENSES/strnum-2.4.2-MIT.txt).
- `utif2@4.1.0` — MIT; [license](THIRD_PARTY_LICENSES/utif2-4.1.0-MIT.txt).
- `xml-naming@0.3.0` — MIT; [license](THIRD_PARTY_LICENSES/xml-naming-0.3.0-MIT.txt).

The entities package omits its license file from npm; its MIT text is retained from
[the upstream repository](https://github.com/nodable/val-parsers/blob/4fe544c219e52cb6e302c43a88824a8333babe3e/LICENSE).
