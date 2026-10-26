# Host-reviewed navigation

[`examples/navigation.ts`](../examples/navigation.ts) connects a generated view to a separate
host-owned destination review. The generated button only requests review. The host displays the
canonical HTTPS destination as text and provides its own localized Open and Cancel buttons.
Opening requires a trusted click, including native keyboard activation, on that host button and
current transient browser activation. A synthetic click or `lr-gen-action` event cannot create
this approval.

Declare the action with `confirm: true` and a closed payload schema. For example, add this action
to the application's existing reviewed catalog:

```ts
const actions = {
  openDestination: {
    confirm: true,
    payload: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['navigation'] },
        destination: { type: 'string', maxLength: 2048 },
      },
      required: ['kind', 'destination'],
      additionalProperties: false,
    },
  },
} as const;
```

The host installs the example connection once for the view. `reviewRegion` must be a visible,
trusted region outside generated content. Its layout must show the full address and preserve
keyboard access; do not truncate or replace the address with a generated label.

```ts
import { connectGeneratedNavigation } from './navigation.js';

const navigation = connectGeneratedNavigation(view, reviewRegion, {
  actionName: 'openDestination',
  policy: () => ({ origins: currentViewerNavigationOrigins() }),
  authorize: (action, destination) => canNavigate(currentViewer(), action, destination),
  strings: {
    heading: 'Review destination',
    open: 'Open destination',
    cancel: 'Cancel',
    unavailable: 'This destination is unavailable.',
  },
});
// Use application-localized strings above. On host teardown: navigation.dispose().
```

Both callbacks are synchronous trusted application code. Return only an explicit `true` from
`authorize`; use already available authorization state rather than awaiting a network request and
losing the user gesture. The destination is canonicalized and checked against current exact-origin
policy before review and again immediately before opening. The renderer's confirmation guard
rejects superseded documents, changed action permissions and disconnection. The connection consumes
each approved request once and uses `window.open(destination, '_blank', 'noopener,noreferrer')`.
Browser popup policy may still block the new context. Disposing cancels pending review and restores
the previous confirmation callback if this connection still owns it.

This connection owns `confirmAction` for the view and refuses other action names. Use a dedicated
navigation view or explicitly compose a host confirmation dispatcher for other workflows. It does
not replace authentication, authorization or CSRF protection on the destination server. Trusted
host JavaScript can navigate independently; this example is not a sandbox for application code.

| Sink | This example's policy |
| --- | --- |
| Navigation | Only explicit `kind: 'navigation'` actions, approved canonical HTTPS origin, visible review and a fresh trusted host-button activation. |
| Download | Refused, even on an approved origin. No download attribute, blob creation or save API. |
| Fetch/API | Refused. No fetch, XHR, credentials forwarding or automatic data acquisition. |
| Executable resource | Refused. No script/module, worker, frame document or HTML loading. |
| Media | Refused by this action profile. The initial catalog has no automatic media URL roles. |

An origin grant is specific to navigation; it never grants any other sink. A navigation can still
receive an HTTP redirect or an attachment response from its approved server. This example does not
inspect responses or constrain later browsing. Where those server-controlled outcomes are
unacceptable, exclude that origin or use a separately reviewed server delivery policy; do not claim
that a navigation button guarantees a document response or confines every redirect.

Custom media catalogs have a separate assigned-URL policy described in [security.md](security.md).
Native media elements follow redirects without exposing every destination to this validator.
A strict every-hop profile must exclude remote media or use a host-controlled proxy that validates
each redirect and final response before delivery. Initial origin validation alone provides no
such isolation. The example's browser tests exercise the destination-review and refusal boundaries;
they stub new-window opening and do not certify remote servers, redirects or browser popup behavior.
