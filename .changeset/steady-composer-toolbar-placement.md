---
'@aceshooting/lyra-ui': minor
---

Add `toolbar-placement="actions"` to chat composer and prompt input. With `actions-layout="below"`, caller toolbar controls sit between start and end below the textarea while attachments remain above it. The default upper toolbar stays unchanged. Live placement changes preserve the editor, draft, selection and focused controls; narrow and RTL layouts keep the toolbar bounded and retain native Tab order. Prompt input's independent model, voice and source controls keep their existing position.
