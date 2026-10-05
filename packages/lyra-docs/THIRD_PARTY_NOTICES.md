# Third-party notices

Lyra Docs is distributed under the MIT License in `LICENSE`. This package uses
and redistributes the third-party software and stylesheet listed here. The
corresponding full license texts and upstream notices are included in
`THIRD_PARTY_LICENSES/` in this package.

## DOCX engine and stylesheet

`@docx-editor.dev/core@2.26.0` is copyright 2026 EigenPal Inc. and is
licensed under Apache-2.0. The upstream package source is published at
[github.com/eigenpal/docx-editor/tree/main/packages/core](https://github.com/eigenpal/docx-editor/tree/main/packages/core),
and the exact public package is
[`@docx-editor.dev/core@2.26.0`](https://www.npmjs.com/package/@docx-editor.dev/core/v/2.26.0).
Lyra Docs redistributes the package's `dist/editor.css` stylesheet unchanged.
The Apache-2.0 license text is included in
[`THIRD_PARTY_LICENSES/docx-editor-core-2.26.0-Apache-2.0.txt`](THIRD_PARTY_LICENSES/docx-editor-core-2.26.0-Apache-2.0.txt).

The upstream package's
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_LICENSES/docx-editor-core-2.26.0-THIRD_PARTY_NOTICES.md)
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
