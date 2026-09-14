---
"@aceshooting/lyra-ui": minor
---

`<lr-callout>`, `<lr-empty>`, `<lr-rag-answer>`, `<lr-retrieval-search>`, `<lr-retrieval-results>`,
`<lr-table>` and `<lr-ingestion-queue>` gain an opt-in `announce` boolean that sends the message
they are already presenting when they first mount to the shared light-DOM announcement sink.

Every one of them has always announced *later* content changes and deliberately stayed silent about
the content present at mount — correct for a callout or empty state that is simply part of the page
a user is arriving on, because that text is read in document order anyway. It is wrong for the
other common case: a callout or empty state created in response to something the user just did
("Save failed", "No results"). Nothing else announces that first message, so a screen-reader user
whose focus stayed on the control they activated never learned the outcome. `announce` opts one
component into announcing it, and the default keeps every existing consumer silent at mount.

The initial announcement goes through each component's existing announcement path, so it resolves
exactly like a later update: `<lr-callout>` picks assertive urgency for `variant="danger"`
(including a `danger` inherited from a composed ancestor) and polite otherwise, `<lr-empty>` is
always polite, both skip content hidden by `hidden`/`inert`/`aria-hidden`/CSS or a hidden composed
ancestor, both read flattened text through nested forwarding slots, and a callout's nonempty
`aria-label`/`accessible-label` prefixes the message through the full localized
`calloutAnnouncementWithContext` template rather than being prejoined. A closed callout
(`open="false"`) announces nothing.

The three retrieval components announce the state they are already presenting rather than their
whole content, because that is the only part of them that is a message: the verbatim
caller-supplied `errorText` assertively, or — with no error and nothing loading —
`<lr-retrieval-search>`'s localized zero-result message and `<lr-retrieval-results>`' localized
empty-result message, politely. A component still `loading`, or one already showing an answer or
chunks, has settled on no message and announces nothing.

`<lr-table>` and `<lr-ingestion-queue>` close the same gap on their failure surfaces. A table
created to report a reload that already rejected mounts with `error` set, so there is no `error`
transition for its assertive sink to catch; `announce` speaks the `error-heading` text once,
through the same sink and the same text the later transition uses, and deliberately does not
forward `announce` to the composed `[part="error"]` `<lr-empty>` so the failure is spoken once
rather than twice. A queue mounted with `stage: "failed"` rows announces their caller-supplied
`item.error` strings once, list-formatted in the effective locale exactly as a later failure is.

`announce` is read once, when the component first mounts. A later reconnection or adoption stages
the existing content again instead of replaying the announcement — the same reconnect contract
these components already documented — and later content changes continue to announce whether or
not `announce` is set. In every case the shared region is acquired on connect, strictly before the
first text lands in it — for `<lr-callout>` and `<lr-empty>` the mount announcement is additionally
deferred one animation frame past the first update so slot distribution has settled first. Assistive
technology has to have been observing the region for an addition to be read at all.
