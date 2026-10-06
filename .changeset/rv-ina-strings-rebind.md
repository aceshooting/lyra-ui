---
"@aceshooting/lyra-ui": patch
---
Every component: assigning the same `strings` object again — which a declarative `.strings=${overrides}` binding does on every render of its parent — no longer re-snapshots it and re-renders the component (and re-runs work keyed on a `strings` change, such as announcements or relayouts). Assign a new object to change the overrides, as documented.
