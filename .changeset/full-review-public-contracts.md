---
"@aceshooting/lyra-ui": minor
---

Expand the public component contracts needed by advanced consumers.

- Export the document-viewer anchor, highlight, search, selection, and target types through the
  owning granular component entry, with type tests covering those imports.
- Complete native-style `input`/`change`, focus, selection, and editing contracts across the
  affected form and conversation controls, including emoji picker and token input.
- Add the documented viewer navigation, search, highlight, comparison, preview, and theme hooks,
  plus the corresponding component parts and custom properties.
- Complete the typed agent-evaluation, evaluation-dataset, retrieval, and data-view surfaces that
  previously required consumers to infer internal shapes.
