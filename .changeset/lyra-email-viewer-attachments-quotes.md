---
"@aceshooting/lyra-ui": minor
---

`lyra-email-viewer` attachments become interactive: each row is now a real button emitting
`lyra-attachment-open { attachment: { filename, mimeType, content } }` with the attachment's decoded
bytes attached (the component itself never opens/downloads anything — host-owned routing, e.g. into
`lyra-document-viewer`). A new `fold-quotes` property collapses trailing quoted-reply text/HTML
(`>`-prefixed text runs, `gmail_quote`/`yahoo_quoted`/Outlook-style HTML blocks) behind a localized
toggle. Previously attachments were inert metadata with no way to retrieve their content, and quoted
reply chains always rendered in full.
