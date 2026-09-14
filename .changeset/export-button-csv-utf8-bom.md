---
"@aceshooting/lyra-ui": minor
---

`<lr-export-button>`'s built-in CSV download gains an opt-in `bom` property so it opens correctly
in Excel on Windows.

- `bom: boolean = false` (reflected). Excel on Windows ignores a downloaded file's MIME charset
  and instead decodes a byte-order-mark-less CSV using the system ANSI code page, so accented,
  Arabic, CJK, and typographic characters in exported rows render as mojibake once the file is
  opened. Setting `bom` prepends a UTF-8 byte-order mark (U+FEFF) ahead of the CSV header row,
  which Excel uses to detect UTF-8 and decode the file correctly. Google Sheets, LibreOffice, and
  Numbers already sniff UTF-8 correctly with or without a byte-order mark, so this only matters
  for Excel.
- The default remains `false`: today's downloaded CSV bytes are unchanged unless a consumer opts
  in.
- The built-in JSON download never gets a byte-order mark, under any setting -- RFC 8259 forbids
  one in JSON.
- The package-level `buildCsv()` helper (`@aceshooting/lyra-ui/components/utility/export-button/
  csv.js`) gained the same opt-in through a new third `options: LyraBuildCsvOptions` parameter
  (`{ bom?: boolean }`), for standalone callers that build their own CSV without going through
  `<lr-export-button>`.
