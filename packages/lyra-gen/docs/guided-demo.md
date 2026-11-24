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

The lyra-ui.com demo adapts this example under its own checks. This guide covers the library
example; adapting it into another application requires that application's own integration checks.

## Build a branching scripted conversation

The guided demo above scripts one refinement per scenario. For a longer, branching scripted
conversation (still with no model), `@aceshooting/lyra-gen/scripted-conversation.js` provides a
framework-free, DOM-free controller. It owns the choice tree, the current path, revisions,
supersession and transcript state. Your application still owns every visible string and each
step's view.

```ts
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { connectScriptedConversation, createScriptedConversation, type LyraGenScriptedTree } from '@aceshooting/lyra-gen/scripted-conversation.js';
import type { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';

type Copy = { readonly label: string }; // application-owned, already localized
const tree: LyraGenScriptedTree<Copy> = {
  start: 'intro',
  steps: {
    intro: { id: 'intro', copy: { label: copy.introPrompt }, choices: [
      { id: 'markets', next: 'detail', copy: { label: copy.markets } },
      { id: 'weather', next: 'detail', copy: { label: copy.weather } },
    ] },
    detail: { id: 'detail', copy: { label: copy.refine }, choices: [
      { id: 'focus', next: 'done', copy: { label: copy.focus } },
      { id: 'compare', next: 'done', copy: { label: copy.compare } },
    ] },
    done: { id: 'done', copy: { label: copy.complete }, choices: [] },
  },
};

const conversation = createScriptedConversation({
  tree, catalog: initialCatalog, surfaceId: 'guided', controls: { nights: 3 },
  // Return a view body ({ root }) or patch operations against context.previous.
  buildStep: (path, controls, context) => ({ root: renderStep(path.step, path.choices, controls) }),
});
conversation.subscribe(snapshot => paintChoicesAndTranscript(snapshot)); // snapshot.choices, snapshot.transcript
connectScriptedConversation(conversation, view as LyraGenViewElement, {
  resolveFocus: target => choiceButton(target.choiceId), // opt in; omit to manage focus yourself
});
conversation.restart();
```

- **The tree is checked at creation.** Step and choice ids are short identifiers. A tree has at
  least three steps, and each continuing step offers 2 to 16 choices. Every step must be reachable,
  no choice may lead back to an earlier step, and a path takes at most 32 choices. An invalid tree
  throws `TypeError`; `validateScriptedTree()` returns the diagnostics without throwing.
  `resolveScriptedPath()` and `goTo(choices)` accept only declared choice sequences.
- **Revisions only increase.** `restart()`, `choose()`, `back()`, `goTo()`, `retry()` and
  `setControls()` each take a new revision for the one live surface. Back gets a new revision too,
  and a revision is never reused, so `lr-gen-view` always accepts the next document. The
  controller sets `surfaceId`, `revision` and `catalog`, then validates every result with
  `validateView()` against your catalog.
- **A later transition replaces an earlier one.** Each transition aborts the previous build's
  `context.signal`, and a stale build result never commits. `markRendered()`, which the DOM helper
  calls from `lr-gen-ready`, accepts only the committed revision. A late ready event from a replaced
  revision is ignored.
- **Control edits are coalesced.** Only one control build runs at a time. If more edits arrive
  while it runs, the latest values are built once it finishes, so a burst of edits costs at most
  two revisions. Navigation cancels a pending control rebuild, and the navigation build uses the
  latest controls.
- **Focus moves only if you opt in.** After a navigation renders, `snapshot.focusTarget` names the
  choice to focus: the first choice of the new step, or after Back the choice that was undone.
  Control edits never set it. The helper moves focus only when you supply `resolveFocus`, and only
  if focus was lost or is inside the view or `focusScope`.
- **Your code owns the copy.** Transcript entries (`prompt` and `answer`) carry each step's or
  choice's `copy` unchanged, and the controller adds no user-facing text of its own. A failed or
  invalid build sets `status: 'error'` with generic diagnostics and keeps the last committed
  document. Call `retry()`, `back()` or `restart()` to recover.
