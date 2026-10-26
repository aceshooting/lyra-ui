# Saved dashboard development host

This executable offline example connects the public `DashboardStore` SDK to a file-backed HTTP
host and a browser interface using `lr-input`, `lr-button`, and `lr-gen-view`. It uses original
sample stationery data and makes no model or provider requests.

From a built workspace with development dependencies installed:

```sh
node packages/lyra-gen/examples/saved-dashboard/host.mjs
```

Open the printed loopback URL. `PORT` defaults to `4179`. Without `--data`, the host creates and
cleans its own temporary storage. To retain documents across restarts, pass an explicit directory:

```sh
node packages/lyra-gen/examples/saved-dashboard/host.mjs --data /tmp/saved-dashboard-example
```

The browser session selector uses **public simulated tokens** mapped on the server to an author,
editor, viewer, and a viewer in another tenant. These are development fixtures, not production
credentials or authentication. The client cannot provide a role, actor, tenant, owner or grant in a
request. The server authorizes each SDK operation and conditional write. Do not deploy this host or
use it with real accounts or private data.

Create a dashboard as the author. **Save draft** and **Publish draft** first open an inline review;
neither writes until **Approve and save draft** or **Approve and publish draft** is activated.
Saving shows a readable before/after diff of the exact proposal against its storage revision.
Publishing compares the saved draft with the previous publication, or shows the first publication.
It publishes saved content; unsaved title edits remain in the field. Cancel keeps edits and makes
no write. Title changes made after the preview remain unsaved while approval commits the previewed
proposal. Other application actions invalidate the pending review. This is a host UI policy, not
a mandatory confirmation policy added to the core SDK. Server permissions are checked independently
even after UI approval.

Open the dashboard URL in another tab with the viewer session and published mode. Editor draft
changes remain unpublished. Try competing saves from two editor tabs, review the retained proposal
and current changes, then deliberately load the latest draft and preview a new save. Approval
retains its original expected revision: if another editor changes the document, the server reports
a conflict and preserves the proposal rather than applying it to the newer revision. History
restoration creates a new draft. An independent copy receives new document and surface identities.
Revoke the viewer session as the author and refresh the viewer to observe server denial and removal
of the displayed document. Reloading a page or restarting the host reuses stored definitions.

The file adapter uses an exclusive host lock and synchronous read/compare/atomic-rename writes
within one process. It demonstrates durable reopen and conditional writes, not a production,
crash-proof or distributed database. Close it normally to release its lock. After an interrupted
process, verify that the host has stopped before removing the lock file. Production hosts must
replace the fixture session map, enforce transactional storage, provide revocation notifications,
and implement retention before reaching the SDK's bounded archive limit.

Browser qualification lives outside the shipped example:

```sh
pnpm --filter @aceshooting/lyra-gen test:saved-dashboard
WTR_BROWSER=firefox pnpm --filter @aceshooting/lyra-gen test:saved-dashboard
WTR_BROWSER=webkit pnpm --filter @aceshooting/lyra-gen test:saved-dashboard
```

The test starts a loopback host on an ephemeral port, uses task-owned temporary directories,
exercises actual browser controls and HTTP authorization, restarts storage, and removes its files.
The review regression covers positive approval, cancellation, retained later edits, stale save and
publication approvals, and an editor's denied publication after approval.
It does not establish deployed multiuser authentication or production-service qualification.
