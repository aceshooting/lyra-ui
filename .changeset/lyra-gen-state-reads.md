---
"@aceshooting/lyra-gen": minor
---

Generated nodes can declare `reads`: a declared, non-URL component property shown from a local-state path that a binding in the same view owns, so a slider bound to `/limit` updates a sibling gauge or stat live without a new revision. A read value applies only while it satisfies the property schema; the prompt schema, markup, templates and static SSR understand `reads`.
