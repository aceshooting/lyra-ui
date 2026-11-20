---
'@aceshooting/lyra-ui': minor
---

Set `composer-disabled` and `heading-level` to disable the workspace composer or integrate its headings into a page outline.
Style the workspace, model settings panel and queue items with component background, border, radius and padding tokens.
Host label references and descriptions reach the workspace, prompt queue and realtime session regions.
The composer preserves keyboard shortcuts and submits once per Enter press.
The prompt input preserves shortcuts while suggesting completions and dismisses stale insertions after selection moves.
The source picker shows its disclosure marker and the prompt input reports admission limits across its collections.
The push-to-talk control supports click-only activation, ignores secondary buttons and ends a hold released outside the trigger.
The recording pulse centers the built-in and slotted recording icons.
The model picker exposes the draft query while typing. Re-selecting the current model or voice closes the picker quietly.
Voice preview failures announce a localized message.
The model settings panel reports temperature corrections after rendering.
The selection toolbar announces successful copies and ignores superseded clipboard completions.
The widget renderer clears content before reporting a new document failure.
The prompt queue uses shared pagination buttons and retains the page-button styling hook.
The composer returns null for unavailable selection endpoints, and class-only prompt and workspace imports avoid loading the editor.
Whitespace-only labels fall back to localized names across the conversation controls.
Model, voice and push-to-talk triggers support themed hover and pressed backgrounds. The composer supports a themed focus border and disabled picker options use the shared opacity.
The Sources disclosure visibly dims when disabled.
Audio visualization continues when resolution media queries are unavailable.
Blank maximum-row and temperature-maximum attributes restore their defaults. A blank visualizer level restores ambient behavior.
The model settings panel forwards size and readonly to both fields. A readonly prompt locks its built-in pickers, queue editing and attachments.
The realtime session can disable its built-in controls and configure its recorder and transcript.
The composer coalesces width changes into one resize per animation frame, including after a move between documents.
At widths below 40rem, the prompt queue puts actions on a separate row so translated labels leave room to edit.
The selection toolbar coalesces viewport changes and leaves focus and pointer styling to its action buttons.
Widget text wraps at narrow widths. Updating one widget binding preserves unrelated property values and event subscriptions.
Audio visualization reuses sample buffers and limits waveform drawing to the backing canvas width.
Set `stream-only` on push-to-talk to receive chunks without retaining a full recording in memory.
Voice previews release their audio source on stop, failure, and disconnect.
Model and voice pickers omit empty hint descriptions when the only supplied content uses an unsupported slot.
Editor metadata lists the chat composer's selection operations as methods.
