---
'@aceshooting/lyra-ui': major
---

Conversation list, feedback and message-item controls leave modified and IME-composing keys to the browser and input method.
Conversation rows discard an in-progress rename when their conversation ID changes.
Message feedback skips its persistence request when a change listener invalidates the rating or detaches the control.
Message-part retry controls ignore clicks for parts that have been replaced.
Whitespace-only conversation labels fall back to localized names or visible content.
Branch picker announces the next navigation after a move between parents.
Typing indicator stays quiet when it moves between parents with the same label.
Stream status restores the 10000 ms stall threshold when the attribute is removed.
Stream status announces connecting, streaming, interrupted, and idle transitions.
Generation metrics captures the final elapsed time when a run completes.
Streaming text core preserves Markdown highlight state across renders when no languages are supplied.
Plain streaming text and message parts take their direction from the caller's text.
Message actions can reveal on interaction when placed directly inside a shadow root.
Chat viewport announces messages after a bounded wait when their busy state persists.
Chat viewport emits follow changes for scroll and jump-button interactions. Track direct follow assignments and calls to scrollToBottom at the call site.
Thread list sticky group headers expose a background token.
Thread list search matches accented titles and excerpts with unaccented queries.
A throwing thread filter excludes the affected row and keeps the list usable.
Thread row action names include the thread title or ID.
Thread list skips rows inside hidden wrappers during keyboard navigation.
A throwing message-part renderer falls back to the built-in rendering.
Transcript feed isolates speaker names for mixed-direction text.
Chat message retry names include the message ID when supplied.
Conversation rows take their default names from visible custom content.
Conversation rename inputs restore the browser's autocorrect default when the host removes an authored hint.
Suggestion chips wrap unbroken labels and draw the keyboard focus outline inside scrolling rows.
Decorative separators in generation metrics and usage badges carry empty alternative text.
Usage badge tooltips use the shared overlay surface and border tokens.
Thread lists load pagination and error controls on demand. Message feedback loads its chip control when reasons are present.
Thread lists keep each group usable when its label or adornment callback fails.
Thread lists refresh row content when its inputs change and update changed excerpts independently.
Thread group chevrons support themed transforms, RTL and reduced motion.
Message parts and transcript feeds show and announce how many older items their render windows hide.
Transcript history and its caption log have distinct accessible names.
The branch picker, message actions, conversation item and suggestion chips support disabling all built-in controls.
Message parts supports an explicit accessible group label.
Markdown render errors propagate through both streaming text variants.
Resume controls in stream status and message parts use the shared button theme and support long labels.
Chat messages and message parts preserve whole-word intrinsic sizing in narrow layouts.
Selected feedback thumbs retain their own fill during hover and press. Closing feedback details removes unused spacing.
Checkpoint rules remain aligned when its controls wrap.
Conversation controls expose shared icon-action styling and component tokens for message retries, row hover, handoff dividers, checkpoints and suggestions.
Transcript jump controls support theming, long localized labels and reduced motion.
Usage badge and generation metric separators stay with the preceding value when metrics wrap.
