# Guided demo

Explore Markets, Weather and a travel budget without a model or live-data request. The
[controller and scenarios](../examples/guided-demo.ts) contain authored replies, simulated data
and original synthetic chunk offsets. The [browser host](../examples/guided-demo-host.ts) renders
real Lyra controls, tables and charts through `lr-message-parts` and admitted `lr-gen-view` islands.
Keep its visible **Simulated data** and **Scripted reply** labels when presenting these scenarios.
The recordings do not measure model quality, tokens, cost or provider latency.

## Mount the example

Run from a built repository workspace, or copy both example files together into application
source, preserving their relative import. Their runtime dependencies use public granular entries.
The files are shipped examples, not package exports: do not import
`@aceshooting/lyra-gen/examples/*`. See the [supported API boundary](compatibility.md#supported-api-boundary)
for the runtime paths and implementation-path migration.

In the same source directory as the copied files:

```ts
import '@aceshooting/lyra-ui/theme.css';
import '@aceshooting/lyra-translations/fr.js';
import { mountGuidedDemo } from './guided-demo-host.js';

export async function startDemo(root: HTMLElement, installedGenVersion: string) {
  const demo = mountGuidedDemo(root, { locale: 'fr', packageVersion: installedGenVersion });
  await demo.ready;
  return demo;
}
```

Pass a connected mount and the actual installed Gen package version from application build
metadata; it is recorded as provenance. `ready` settles initial chrome, not a future replay or
generated dashboard. Playback is exposed through `demo.controller`; generated views report
their own `lr-gen-ready` settlement. Call `demo.dispose()` when leaving the route to abort pending
playback and release the host. The [chat guide](interactive-chat.md) explains the underlying
stream and renderer boundaries.

## Follow the scenarios

Choose a scenario, then use **Next** to move from its prompt to the streamed answer and its
predefined refinement. **Back** moves within that scenario; choosing a scenario starts again at
its prompt. **Replay** restarts the current response. Cancellation keeps completed content, and
the invalid-response control demonstrates rejection while retaining admitted islands.

Markets compares fictional indices and can focus on Orchard. Weather uses fixed city samples
and can filter to precipitation of at most 20%; it is not a forecast. The travel scenario uses
displayed sample rates and editable nights, travelers and EUR budget. Edits recalculate the
actual table, chart and remaining budget. Budgets accept whole cents. Adding a night changes
the calculation once; replay preserves those inputs instead of adding another night.

The follow-up field accepts the displayed predefined question. Other questions show an explicit
unsupported status and leave the accepted response available; the example does not interpret
free-form prompts. Source disclosure shows the actual authored response and restricted Markup,
including the deliberately invalid tail when that control is used.

## Language ownership and delivery scope

The example includes English, French and Arabic labels, prompts and scripted prose. Omitting
`locale` selects English; `locale: 'fr'` and `locale: 'ar'` retain those built-in packs, including
Arabic RTL. To use another language, supply complete trusted application copy through
`localization` instead of `locale`:

```ts
import '@aceshooting/lyra-translations/he.js';
import type { GuidedDemoLocalization } from './guided-demo.js';
import { mountGuidedDemo } from './guided-demo-host.js';

export async function startLocalizedDemo(
  root: HTMLElement,
  installedGenVersion: string,
  labels: GuidedDemoLocalization['labels'],
) {
  const demo = mountGuidedDemo(root, {
    packageVersion: installedGenVersion,
    localization: { locale: 'he', direction: 'rtl', labels },
  });
  await demo.ready;
  return demo;
}
```

The same `localization` option works with `createGuidedDemo()`. Its locale must be a valid BCP47
tag; snapshots expose the canonical tag. Direction is explicitly `ltr` or `rtl`, independently
of the locale. Supply every string key from the example's [English copy](../examples/guided-demo.ts),
including cityLyon/cityLisbon/cityOslo, provenance labels, statuses, prompts and follow-ups. The
indexed type above checks pack completeness. The controller copies and freezes its own labels;
subsequent caller edits do not change an active recording. Dispose and remount to change language.

Keep `{nights}`, `{travelers}` and `{budget}` in `travelPrompt`; `{total}` and `{remaining}` in
`travelReply`; and `{nights}`, `{travelers}`, `{total}` and `{remaining}` in `travelRefinement`.
Tokens may be reordered or repeated. Unknown or missing tokens, incomplete/empty copy, an invalid
locale/direction, or both `locale` and `localization` throw `TypeError`; there is no automatic
English fallback for a missing application pack. Quotes and angle brackets remain literal text.
Copy cannot contain a line beginning with up to three spaces followed by three or more backticks
or tildes: those fence openers would affect the authored prose/island framing and are rejected as
invalid configuration. Application strings never choose node types, IDs, actions or numeric data.

Core Lyra control and renderer translations remain application-owned: load the matching catalogs
before mounting; their package version follows **Lyra UI**, independently of Gen. Adding a core
catalog does not translate the example's own copy. Numeric chart and table values remain JSON
numbers; prose formats numbers/currency through the supplied locale and the browser's Intl data.
The library's representative en/fr/ar checks do not qualify every application language or imply
human translation or assistive-technology review.

Website integration and deployment are separate and pending. This guide covers the library
example; adapting it into another application requires that application's own integration checks.
