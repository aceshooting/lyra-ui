---
"@aceshooting/lyra-ui": patch
---
Every component does less work per element and per localized string: elements share one empty `strings` snapshot, `localize()` reads a component class's English defaults from a once-built snapshot instead of re-reading and re-freezing them on every call, locale candidate lists and catalog versions are no longer copied or rebuilt per lookup, the event-detail policy is resolved once per class instead of on every event, and dev-mode attribute checks no longer recompute a class's observed attributes on every connect.
