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

The example owns its English, French and Arabic labels, prompts and scripted prose. Core Lyra
control and renderer translations remain application-owned: load the matching catalogs before
mounting; their package version follows **Lyra UI**, independently of Gen. The host applies the
selected language and direction, including Arabic RTL. Adding a core catalog does not translate
the example's own copy or extend its three-language inventory. Numeric chart and table values
remain JSON numbers; display prose uses the selected locale.

Website integration and deployment are separate and pending. This guide covers the library
example; adapting it into another application requires that application's own integration checks.
