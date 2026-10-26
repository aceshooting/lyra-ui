# Server and transport walkthrough

The executable [server-transport.mjs](../examples/server-transport.mjs) shows a Node 22 Fetch API
handler and an independently validating client. It uses the installed package's granular imports.
Its default run is an **in-process fake provider**: no network request, credentials, tokenizer,
model, framework server or hosting service is used. It demonstrates the application boundary,
not provider acceptance, model quality or a deployment.

```sh
node node_modules/@aceshooting/lyra-gen/examples/server-transport.mjs
```

The output labels the fake provider and reports zero provider tokens because no provider ran.
To run from this repository, use `node packages/lyra-gen/examples/server-transport.mjs` after the
normal package build. The example is application code to adapt, not a package-root runtime API.

## Supply the server-owned capabilities

`createAnswerHandler(options)` returns `(request: Request) => Promise<Response>`. Configure its
reviewed `catalog`, host-issued `surfaceId` and `revision`, and these two callbacks:

- `authorize(request, signal)` checks the application's current viewer/session policy and returns
  exactly `true` to continue. The fake demo permits everything; replace it. The callback must not
  consume the request body, which the handler reads separately.
- `generate({ prompt, schema, question, surfaceId, revision, maxTokens, signal })` calls the
  application's provider adapter and returns `{ value, tokensUsed }`. `value` is a complete parsed
  view candidate; `tokensUsed` is actual total request/response usage. Configure the provider's own
  output/request limits and cancellation. Include the exact host identities in its request and
  verify support for the supplied schema. Missing, invalid or over-budget usage rejects the result.

The client sends only `{ question }`. It cannot choose a catalog, action, identity, revision or
provider configuration. The handler authorizes before reading the body or calling the provider,
accepts bounded JSON, admits plain provider data without invoking getters, validates the complete
view and checks the host identities. It returns JSON with `Cache-Control: no-store`; errors contain
a fixed code and no caught exception, credential, provider response or user input.

Defaults are 8192 request bytes, 2000 question code units, 65536 provider-response bytes, 2048
actual tokens and five seconds. Host options can lower the byte/timeout/token limits; response
bytes, tokens and time are capped at 262144, 16384 and 60 seconds. Provider response admission counts
the complete `{ value, tokensUsed }` envelope. The question limit is fixed. Authorization and
provider waits share the server deadline. Cancellation prevents late authorization from starting
generation; a late result from an ignored provider signal never becomes a response view.

Map this Fetch handler to the chosen server's documented adapter. Authentication/session handling,
CSRF/origin policy, authorization revocation, rate and concurrency limits, accumulated cost,
provider wire/body limits, logging redaction and deployment remain host-owned. JSON admission
cannot bound an SDK's earlier download or buffering. No particular server framework or provider
is qualified by this example. For the pinned SDK message integration, use [ai-sdk.md](ai-sdk.md).

## Validate the response independently

`requestAnswer({ endpoint, question, catalog, surfaceId, revision, fetchImpl?, signal?, maxBytes?,
timeoutMs? })` uses a host-supplied Fetch implementation or native `fetch`. The custom implementation
can attach the application's authentication policy; the demo routes directly into the handler.

The client checks HTTP success and JSON content type, counts response bytes before decoding,
uses fatal streaming UTF-8 decoding, and feeds `createJsonViewStream()`. It exposes no view until
EOF and full validation. The expected catalog, surface and revision must match independently of
server validation. Byte overflow, malformed/truncated input and cancellation discard the parser
and cancel the reader. Cancellation/deadlines also settle when Fetch ignores the signal; a late
response body is canceled. Errors are `AnswerTransportError` with fixed `code` and optional HTTP
`status`; present host-localized recovery text rather than its exception message or server body.

The server sends a complete admitted JSON view. Network chunks do not represent partially active
controls or per-tag rendering. For fenced prose/islands, use [interactive-chat.md](interactive-chat.md).

Keep a generation guard at the actual UI assignment, including when a newer user edit does not
advance a model view revision:

```js
let generation = 0;
let pending;
async function refresh(question) {
  const expected = ++generation;
  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  try {
    const view = await requestAnswer({
      ...hostAnswerContext, question, signal: controller.signal,
    });
    if (expected !== generation || controller.signal.aborted) return;
    generatedElement.document = view;
  } catch {
    if (expected === generation && !controller.signal.aborted) showLocalizedFailure();
  }
}
// Advance generation and abort pending work on user edits, navigation and disposal too.
```

Set the element's matching trusted catalog before assigning its document. A refinement keeps its
logical identities and advances the host-issued revision; it must not replay old binding values
over edits. Locale catalogs translate component chrome, while question/prose language and fallback
copy remain host-owned.

## Verify the exact installed artifact

For a local archive check, set `LYRA_UI_TARBALL` and `LYRA_GEN_TARBALL` to absolute archive paths
from the same candidate cohort. These commands create a separate consumer with no workspace
aliases and run the **installed** example; install scripts and automatic peers are disabled:

```sh
test -f "$LYRA_UI_TARBALL"
test -f "$LYRA_GEN_TARBALL"
consumer_dir=$(mktemp -d "${TMPDIR:-/tmp}/lyra-gen-consumer.XXXXXX")
cd "$consumer_dir"
pnpm add --ignore-scripts --config.auto-install-peers=false "$LYRA_UI_TARBALL" "$LYRA_GEN_TARBALL"
node node_modules/@aceshooting/lyra-gen/examples/server-transport.mjs
```

From the repository root, the same focused adversarial tests can target that installed example:

```sh
LYRA_GEN_TRANSPORT_EXAMPLE="$consumer_dir/node_modules/@aceshooting/lyra-gen/examples/server-transport.mjs" \
  node --test packages/lyra-gen/test/server-transport.test.mjs
```

The fixtures cover unauthorized/malformed requests, usage/schema/identity rejection, deadlines,
ignored cancellation, late bodies, byte overflow, split UTF-8, truncated responses and the EOF
admission boundary. They make no external request. Local archive success does not establish npm
publication: after release, repeat a clean consumer install using the exact published Gen version
and a compatible Lyra UI version, and run its installed example. Record that separately; do not
label a local tarball or a registry-dist-tag lookup as a successful published-package install.
