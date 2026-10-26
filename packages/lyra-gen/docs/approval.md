# Host-owned generated action approval

The browser composition in [`examples/approval.ts`](../examples/approval.ts) connects a generated
view's `confirmAction` callback to a real `lr-confirm-bar`. The application supplies the approval
region and optional localized heading. The bar displays the admitted action's surface, node,
revision and payload, using the component's existing localized labels and keyboard behavior.

Copy the example module into your application alongside the code that mounts the view:

```ts
import { createCatalog, initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';
import { connectGeneratedApproval } from './approval.js';

const view = new LyraGenViewElement();
view.catalog = createCatalog({
  ...initialCatalog,
  actions: { save: { payload: { type: 'null' }, confirm: true } },
});
view.enabledActions = ['save'];
view.document = {
  version: '1', surfaceId: 'report', revision: 0,
  catalog: { id: view.catalog.id, version: view.catalog.version },
  root: { id: 'save', type: 'button', text: 'Save report', action: { name: 'save', payload: null } },
};
const approvalRegion = document.createElement('section');
root.append(view, approvalRegion);
const approval = connectGeneratedApproval(view, approvalRegion, {
  heading: () => 'Review this report save', // Localize application-authored copy.
});
view.addEventListener('lr-gen-action', event => {
  // Recheck application authorization and dispatch the admitted request here.
  hostActions.handle(event.detail);
});

// On host cancellation: approval.cancel(). On teardown: approval.dispose().
```

Only catalog actions marked `confirm: true` enter this callback. The bar grants no additional
action permission: the catalog, `enabledActions`, revision and current bound-state checks still
apply. The example executes no tool, request or navigation itself. The application remains
responsible for authorization and execution after `lr-gen-action`.

Opening the bar focuses its safe Deny control. Tab reaches Approve; Enter or Space activates the
focused action, and Escape within the bar denies. This composition deliberately opts into the
bar's `autofocus` and `escapeDenies` behaviors. It is inline and does not trap focus. Decisions
return focus to the originally focused control, or to the optional `returnFocusTo(action)`
target supplied by the application.

Host cancellation and disposal return focus only while it remains inside the approval bar. They
try the application's return target, then the original control if that target is unavailable.
Hidden, inert, disabled or detached targets are skipped; focus moved elsewhere is preserved.

The callback resolves true only after an actual approve request and the component's
`lr-decision-settled` notification. Merely assigning an approved status does not approve an
action. Denial, scoped Escape, explicit host cancellation, a superseding request and renderer
abort all resolve false. Revision changes and disconnection use the renderer's existing abort
and stale-result guards, including the interval before its next update. An old or detached bar
cannot approve its replacement.

A settled bar remains visible until the next request or disposal. The helper owns only a child
container within the supplied region. Call `dispose()` when removing that region; it cancels any
pending request and restores the previous `confirmAction`, including an originally unset
callback. If the application has installed a newer callback, disposal leaves it intact.

The browser fixture drives the actual component with trusted keyboard input and covers approve,
deny, Escape, cancellation, repeated requests, revision supersession, disconnection and callback
restoration. It checks that no generated action is emitted before approval. These are browser
interaction checks, not a claim of human assistive-technology testing.
