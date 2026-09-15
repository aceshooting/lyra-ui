---
"@aceshooting/lyra-ui": minor
---

Adds `formatNumber()`, `formatDate()`, `formatRelativeTime()` and `formatBytes()` to
`@aceshooting/lyra-ui/utilities/format.js` (and the `utilities` barrel): pure, string-returning
locale formatters over the same memoized `Intl` formatter cache and locale resolution
`<lr-format-number>`, `<lr-format-date>`, `<lr-relative-time>` and `<lr-format-bytes>` already
render through.

Previously, locale-aware number, date, byte and relative-time formatting was reachable only as
those four custom elements — anything needing a formatted *string* instead (interpolating into a
message template, populating a text-only property on another component, building a search
predicate, composing an accessibility announcement) had to hand-roll and cache its own `Intl`
instances. `formatNumber()` and `formatBytes()` also accept a `bigint` or a decimal/integer string
for exact-precision input (large ids, monetary amounts, exact byte counts beyond
`Number.MAX_SAFE_INTEGER`) without first collapsing it through a `number`.

```ts
import { formatBytes, formatRelativeTime } from "@aceshooting/lyra-ui/utilities/format.js";

const size = formatBytes(12_345_678_901_234_567_890n, "en-US"); // exact, no float rounding
const updated = formatRelativeTime(item.updatedAt, "en-US"); // "3 days ago"
```

The four `lr-format-*`/`lr-relative-time` elements now render through these same helpers instead
of duplicating the `Intl` construction and locale-fallback logic inline — a pure internal refactor
with no behavior change.
