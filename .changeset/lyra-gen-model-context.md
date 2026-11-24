---
"@aceshooting/lyra-gen": minor
---

New `@aceshooting/lyra-gen/model-context.js` entry point: `createModelContext(view, state, options)` serializes what the user currently sees and has edited (surface id, revision, a compact node outline, bound values, dirty pointers, host selection and live-data summary) into a frozen, deterministic, byte-bounded plain-JSON object to send back to a model on the next turn, and `toPromptText(context)` renders it as a compact text block. Host-declared private JSON Pointers and every state path owned by a password, one-time-code, payment-card or secret field are never emitted, and oversize contexts drop the least relevant parts first and are marked `truncated`.
