---
"@aceshooting/lyra-ui": major
---

Reorganized `packages/lyra-ui/src/components/` into 11 named family subfolders (Conversation &
Chat, Agent Tools & Observability, Retrieval & Knowledge Graphs, Forms & Inputs, Data Display,
Charts, Layout & Navigation, Overlays & Feedback, Document & File Viewers, Media & Files, Utility)
instead of a flat 212-directory list.

**Breaking:** any consumer importing an individual component's granular subpath (e.g.
`@aceshooting/lyra-ui/components/combobox/combobox.js`) must add that component's family segment
(`@aceshooting/lyra-ui/components/forms/combobox/combobox.js`). The root entry
(`@aceshooting/lyra-ui`) and the `@aceshooting/lyra-ui/components/*` wildcard export are
unaffected for consumers who only import the root barrel. See
`packages/lyra-ui/scripts/component-families.json` for the full directory-to-family mapping.
