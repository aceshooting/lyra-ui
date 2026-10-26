import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { HttpAgent } from '@ag-ui/client';
import { RunAgentInputSchema } from '@ag-ui/core/schemas';
import { AgentCard, Message } from '@a2a-js/sdk';
import { ClientFactory, JsonRpcTransportFactory, ServiceParameters, withA2AExtensions } from '@a2a-js/sdk/client';
import { JsonRpcTransportHandler, ServerCallContext } from '@a2a-js/sdk/server';
import { ExtensionSupportRequiredError, RequestMalformedError } from '@a2a-js/sdk/errors';
import { admitCapabilities, activateReportExtension, extensionUri, metadataKey, reportCapabilities, reportProcessor } from './fixtures/a2ui/bindings/admission.mjs';
import { reportCatalogId, reportMessages, reportSurface, reportUpdate } from './fixtures/a2ui/extended-report.ts';

const owner = { ownerId: 'report-agent' };
const invalidCapabilities = [
  undefined, null, [], {}, { 'v1.0': { supportedCatalogIds: [reportCatalogId] } },
  { 'v0.9.1': { supportedCatalogIds: [reportCatalogId] } },
  { 'v0.9': { supportedCatalogIds: 'not-an-array' } },
  { 'v0.9': { supportedCatalogIds: [reportCatalogId, reportCatalogId] } },
  { 'v0.9': { supportedCatalogIds: [reportCatalogId], inlineCatalogs: [] } },
  { 'v0.9': { supportedCatalogIds: ['https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'] } },
  { 'v0.9': { supportedCatalogIds: [reportCatalogId, 'unknown'] } },
];
function accepted(result) {
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.value;
}
async function loopback(t, receive) {
  const errors = [];
  const server = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      await receive(request, response, JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch (error) {
      errors.push(error);
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Fixture server failed' }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.deepEqual(errors, []);
  });
  return `http://127.0.0.1:${server.address().port}`;
}
function applyReport(processor, operations) {
  for (const message of operations) accepted(processor.process(message, owner));
  return processor.getSurface(reportSurface);
}
function sdkVersion(specifier) {
  const require = createRequire(import.meta.url);
  let directory = dirname(require.resolve(specifier));
  while (directory !== dirname(directory)) {
    try {
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
      if (manifest.name === specifier) return manifest.version;
    } catch { /* Continue to the package root. */ }
    directory = dirname(directory);
  }
  throw new Error(`Missing installed package manifest: ${specifier}`);
}

test('binding cohort uses the exact reviewed SDK versions and keeps default advertising empty', () => {
  const provenance = JSON.parse(readFileSync(new URL('./fixtures/a2ui/bindings/provenance.json', import.meta.url), 'utf8'));
  for (const { name, version } of provenance.packages) assert.equal(sdkVersion(name), version);
  const schemaBytes = readFileSync(new URL('./fixtures/a2ui/v0.9.1/client_capabilities.json', import.meta.url));
  assert.equal(createHash('sha256').update(schemaBytes).digest('hex'), provenance.a2uiSources[0].sha256);
  assert.deepEqual(JSON.parse(schemaBytes).required, ['v0.9']);
  assert.equal(provenance.profile.catalogId, reportCatalogId);
  assert.equal(provenance.profile.extensionUri, extensionUri);
  assert.deepEqual(reportCapabilities(reportProcessor()), { [metadataKey]: { 'v0.9': { supportedCatalogIds: [] } } });
  assert.equal(admitCapabilities(reportCapabilities(reportProcessor())[metadataKey]), null);
  assert.equal(admitCapabilities(reportCapabilities(reportProcessor({ qualified: true }))[metadataKey]), reportCatalogId);
  for (const value of invalidCapabilities) assert.throws(() => admitCapabilities(value));
  assert.throws(() => admitCapabilities({ 'v0.9': { supportedCatalogIds: [reportCatalogId] } }, []));
});

test('pinned AG-UI HttpAgent admits only the owned report metadata contract through real HTTP/SSE', async t => {
  const processor = reportProcessor({ qualified: true });
  const received = [];
  const url = await loopback(t, (_request, response, raw) => {
    const input = RunAgentInputSchema.parse(raw);
    const selected = admitCapabilities(input.forwardedProps[metadataKey]);
    received.push(structuredClone(input.forwardedProps));
    const operations = selected ? (received.length === 1 ? reportMessages : [reportUpdate]) : [];
    const events = [
      { type: 'RUN_STARTED', threadId: input.threadId, runId: input.runId, protocolVersion: '1.0' },
      { type: 'ACTIVITY_SNAPSHOT', messageId: `report-${input.runId}`, activityType: 'a2ui-surface', content: { a2ui_operations: operations }, replace: true },
      { type: 'RUN_FINISHED', threadId: input.threadId, runId: input.runId, outcome: { type: 'success' } },
    ];
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
  });
  const client = new HttpAgent({ url, threadId: 'report-thread' });
  const subscriber = { onActivitySnapshotEvent({ event }) { applyReport(processor, event.content.a2ui_operations); } };
  await client.runAgent({ runId: 'initial', forwardedProps: reportCapabilities(processor) }, subscriber);
  assert.equal(processor.getSurface(reportSurface).data.total, '24');
  const { root } = accepted(processor.resolveSurface(reportSurface));
  const citation = root.children.find(node => node.sourceComponentId === 'source');
  const action = accepted(processor.createAction(reportSurface, citation.id, { ...owner, expectedRevision: processor.getSurface(reportSurface).revision }, '2026-10-26T12:00:00.000Z'));
  await client.runAgent({ runId: 'update', forwardedProps: { ...reportCapabilities(processor), reportAction: action } }, subscriber);
  assert.equal(processor.getSurface(reportSurface).data.total, '32');
  assert.deepEqual(received[1][metadataKey], received[0][metadataKey]);
  assert.deepEqual(received[1].reportAction, action);
});

test('AG-UI host rejects unsupported metadata before producing any surface', async t => {
  let admissions = 0;
  const reported = t.mock.method(console, 'error', () => {});
  const url = await loopback(t, (_request, response, raw) => {
    const input = RunAgentInputSchema.parse(raw);
    let selected;
    try { selected = admitCapabilities(input.forwardedProps[metadataKey]); }
    catch {
      response.writeHead(422, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Capability admission refused' }));
      return;
    }
    if (selected) admissions++;
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end([
      { type: 'RUN_STARTED', threadId: input.threadId, runId: input.runId, protocolVersion: '1.0' },
      { type: 'RUN_FINISHED', threadId: input.threadId, runId: input.runId, outcome: { type: 'success' } },
    ].map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
  });
  for (const capabilities of invalidCapabilities) {
    const client = new HttpAgent({ url, threadId: 'invalid' });
    await assert.rejects(client.runAgent({ forwardedProps: { [metadataKey]: capabilities } }), error => error.status === 422);
  }
  await new HttpAgent({ url, threadId: 'empty' }).runAgent({ forwardedProps: reportCapabilities(reportProcessor()) });
  assert.equal(admissions, 0);
  assert.equal(reported.mock.callCount(), invalidCapabilities.length);
  for (const call of reported.mock.calls) {
    assert.equal(call.arguments[0], 'Agent execution failed:');
    assert.equal(call.arguments[1].status, 422);
  }
});

async function a2aHost(t, { advertised = true, catalogs = [reportCatalogId] } = {}) {
  const received = [];
  const wire = [];
  const activations = [];
  const responseHeaders = [];
  let card;
  const handler = new JsonRpcTransportHandler({
    async getAgentCard() { return card; },
    async sendMessage(params, context) {
      let selected;
      try { selected = admitCapabilities(params.message.metadata?.[metadataKey], catalogs); }
      catch { throw new RequestMalformedError({ message: 'Capability admission refused' }); }
      try { activateReportExtension(context, advertised ? [extensionUri] : []); }
      catch { throw new ExtensionSupportRequiredError({ message: 'Report extension was not negotiated' }); }
      received.push(structuredClone(params.message));
      activations.push([...context.activatedExtensions]);
      return Message.fromJSON({
        messageId: `report-${received.length}`, role: 'ROLE_AGENT',
        parts: selected ? [{ data: received.length === 1 ? reportMessages : [reportUpdate], metadata: { mimeType: 'application/a2ui+json' } }] : [{ text: 'No qualified report catalog.' }],
      });
    },
  });
  const url = await loopback(t, async (request, response, body) => {
    wire.push({ method: body.method, version: request.headers['a2a-version'], extensions: request.headers['a2a-extensions'], metadata: body.params.message.metadata });
    const context = new ServerCallContext({
      requestedExtensions: request.headers['a2a-extensions']?.split(','),
      requestedVersion: request.headers['a2a-version'],
    });
    const result = await handler.handle(body, context);
    response.writeHead(200, { 'content-type': 'application/json', ...(context.activatedExtensions?.length ? { 'A2A-Extensions': context.activatedExtensions.join(',') } : {}) });
    response.end(JSON.stringify(result));
  });
  card = AgentCard.fromJSON({
    name: 'Report fixture', description: 'Owned stable report capability cohort', version: '1',
    supportedInterfaces: [{ url, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }],
    capabilities: { extensions: advertised ? [{ uri: extensionUri, required: false, params: { supportedCatalogIds: catalogs } }] : [] },
    defaultInputModes: ['text/plain'], defaultOutputModes: ['application/a2ui+json'], skills: [],
  });
  const factory = new ClientFactory({ transports: [new JsonRpcTransportFactory({ fetchImpl: async (...args) => {
    const response = await fetch(...args);
    responseHeaders.push(response.headers.get('a2a-extensions'));
    return response;
  } })] });
  return { client: await factory.createFromAgentCard(card), received, wire, activations, responseHeaders };
}
function a2aRequest(capabilities, id = 'request') {
  return { message: Message.fromJSON({ messageId: id, role: 'ROLE_USER', parts: [{ text: 'Show the report.' }], metadata: { [metadataKey]: capabilities } }) };
}
const activated = () => ({ serviceParameters: ServiceParameters.create(withA2AExtensions(extensionUri)) });

test('pinned A2A client/server activates the exact extension and admits message metadata through JSON-RPC', async t => {
  const host = await a2aHost(t);
  const processor = reportProcessor({ qualified: true });
  const capabilities = reportCapabilities(processor)[metadataKey];
  for (const id of ['initial', 'update']) {
    const response = await host.client.sendMessage(a2aRequest(capabilities, id), activated());
    assert.equal(response.parts[0].metadata.mimeType, 'application/a2ui+json');
    assert.equal(response.parts[0].content.$case, 'data');
    applyReport(processor, response.parts[0].content.value);
  }
  assert.equal(processor.getSurface(reportSurface).data.total, '32');
  assert.deepEqual(host.received.map(message => message.metadata[metadataKey]), [capabilities, capabilities]);
  assert.deepEqual(host.activations, [[extensionUri], [extensionUri]]);
  assert.deepEqual(host.responseHeaders, [extensionUri, extensionUri]);
  assert.deepEqual(host.wire, ['initial', 'update'].map(() => ({ method: 'SendMessage', version: '1.0', extensions: extensionUri, metadata: { [metadataKey]: capabilities } })));
  assert.equal(host.received[0].parts[0].content.value, 'Show the report.');
});

test('A2A rejects absent/wrong/unadvertised activation and unsupported catalogs; empty IDs retain prose fallback', async t => {
  const host = await a2aHost(t);
  const capabilities = reportCapabilities(reportProcessor({ qualified: true }))[metadataKey];
  await assert.rejects(host.client.sendMessage(a2aRequest(capabilities)), /Report extension was not negotiated/);
  await assert.rejects(host.client.sendMessage(a2aRequest(capabilities), { serviceParameters: ServiceParameters.create(withA2AExtensions('https://a2ui.org/a2a-extension/a2ui/v1.0')) }), /Report extension was not negotiated/);
  for (const value of invalidCapabilities) await assert.rejects(host.client.sendMessage(a2aRequest(value), activated()), /Capability admission refused/);
  assert.equal(host.received.length, 0);
  assert.equal(host.responseHeaders.every(header => header === null), true);
  const fallback = await host.client.sendMessage(a2aRequest(reportCapabilities(reportProcessor())[metadataKey]), activated());
  assert.equal(fallback.parts[0].content.$case, 'text');
  const unavailable = await a2aHost(t, { advertised: false });
  await assert.rejects(unavailable.client.sendMessage(a2aRequest(capabilities), activated()), /Report extension was not negotiated/);
  assert.equal(unavailable.received.length, 0);
  const otherCatalog = await a2aHost(t, { catalogs: [] });
  await assert.rejects(otherCatalog.client.sendMessage(a2aRequest(capabilities), activated()), /Capability admission refused/);
  assert.equal(otherCatalog.received.length, 0);
});
