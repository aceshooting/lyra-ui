---
'@aceshooting/lyra-ui': minor
---

Add `toolbar-placement="actions"` to chat composer and prompt input. With `actions-layout="below"`, caller toolbar controls sit between start and end below the textarea while attachments remain above it. The default upper toolbar stays unchanged. Live placement changes preserve the editor, draft, selection and focused controls; narrow and RTL layouts keep the toolbar bounded and retain native Tab order. Prompt input's independent model, voice and source controls keep their existing position.

The stable toolbar layout, viewer request lifecycle fixes, thread excerpt observation and contained stepper focus ring increase eight measured bundles. Reviewed gzip sizes are 303,920 bytes for the largest component, 1,489,754 for all components, 1,715,239 for the CDN autoloader, 1,715,085 for the local autoloader, 452,193 for the conversation barrel, 389,655 for the layout barrel, 463,509 for the viewers barrel and 1,736,802 for the SSR aggregate. Only these exceeded ceilings advance to the next 64-byte boundary; passing ceilings, measurement options and optional-peer exclusions are unchanged.
