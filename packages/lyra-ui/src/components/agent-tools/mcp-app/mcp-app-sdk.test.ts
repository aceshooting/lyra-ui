import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './mcp-app.js';
import type { LyraMcpApp, McpAppRequestDetail } from './mcp-app.class.js';

interface SdkReport { stage: string; value: unknown }
let sdkDocument: string;
before(async () => {
  const response = await fetch('/__lyra-mcp-app-sdk-fixture.js');
  expect(response.ok).to.equal(true);
  const source = await response.text();
  sdkDocument = `<!doctype html><html><body><p>Official SDK fixture</p><script>${source.replaceAll('</script', '<\\/script')}</script></body></html>`;
});

it('interoperates with the official App SDK across tools, resources, context, display, cancellation and teardown', async () => {
  const el = await fixture<LyraMcpApp>(html`<lr-mcp-app protocol="mcp-apps" .hostCapabilities=${{
    serverTools: {}, serverResources: {}, logging: {}, openLinks: {}, message: { text: {} },
    updateModelContext: { text: {}, structuredContent: {} },
  }}></lr-mcp-app>`);
  const reports: SdkReport[] = [];
  const requests: string[] = [];
  let pending: McpAppRequestDetail | undefined;
  let generation = -1;
  el.addEventListener('lr-mcp-log', event => reports.push(event.detail.value as SdkReport));
  el.addEventListener('lr-mcp-initialized', event => {
    generation = event.detail.frameGeneration;
    el.postMcpNotification('ui/notifications/tool-input-partial', { arguments: { city: 'Lux' } }, generation);
    el.postMcpNotification('ui/notifications/tool-result', { content: [{ type: 'text', text: 'Initial result' }] }, generation);
    el.postMcpNotification('ui/notifications/tool-cancelled', { reason: 'Initial operation cancelled' }, generation);
    el.postMcpNotification('ui/notifications/host-context-changed', { theme: 'dark' }, generation);
  });
  el.addEventListener('lr-mcp-request', event => {
    const { requestId, requestToken, method, params, frameGeneration } = event.detail;
    requests.push(method);
    if (method === 'tools/call' && params['name'] === 'cancel-me') {
      pending = event.detail;
      el.postMcpNotification('ui/notifications/tool-input', { arguments: { cancel: true } }, generation);
      return;
    }
    if (method === 'tools/call' && params['name'] === 'host-error') {
      el.postMcpResponse(requestId, { frameGeneration, requestToken, error: { code: -32001, message: 'Host denied the tool' } });
      return;
    }
    const result = method === 'tools/call' ? { content: [{ type: 'text', text: '21 °C' }] }
      : method === 'tools/list' ? { tools: [{ name: 'weather', inputSchema: { type: 'object' } }] }
      : method === 'resources/list' ? { resources: [{ uri: 'test://weather', name: 'Weather' }] }
      : method === 'resources/templates/list' ? { resourceTemplates: [{ uriTemplate: 'test://weather/{city}', name: 'City weather' }] }
      : method === 'resources/read' ? { contents: [{ uri: 'test://weather', text: '21 °C' }] }
      : {};
    expect(el.postMcpResponse(requestId, { frameGeneration, requestToken, result })).to.equal(true);
  });
  el.resource = { uri: 'ui://sdk/complete', html: sdkDocument };
  await waitUntil(() => reports.some(report => ['done', 'fixture-error'].includes(report.stage)), 'the actual SDK must complete its exchanges', { timeout: 5_000 }).catch(() => {
    throw new Error(JSON.stringify({ requests, reports }));
  });
  expect(reports.filter(report => report.stage === 'fixture-error')).to.deep.equal([]);
  expect(requests).to.deep.equal(['tools/call', 'tools/list', 'resources/list', 'resources/templates/list', 'resources/read',
    'ui/update-model-context', 'ui/message', 'ui/open-link', 'tools/call', 'tools/call']);
  expect(reports.find(report => report.stage === 'display')?.value).to.deep.equal({ mode: 'inline' });
  expect(reports.find(report => report.stage === 'tool')?.value).to.deep.equal({ content: [{ type: 'text', text: '21 °C' }] });
  expect(reports.some(report => report.stage === 'cancelled')).to.equal(true);
  expect(reports.find(report => report.stage === 'error')?.value).to.contain('Host denied the tool');
  expect(pending?.signal.aborted).to.equal(true);
  for (const stage of ['toolinput', 'toolinputpartial', 'toolresult', 'toolcancelled', 'hostcontextchanged']) {
    expect(reports.some(report => report.stage === stage), stage).to.equal(true);
  }
  expect(await el.teardownApp()).to.equal(true);
});

it('advertises denied resource capabilities to the actual SDK without dispatching host work', async () => {
  const el = await fixture<LyraMcpApp>(html`<lr-mcp-app protocol="mcp-apps"
    .hostCapabilities=${{ logging: {}, sampling: {}, downloadFile: {} }}></lr-mcp-app>`);
  const reports: SdkReport[] = [];
  let requests = 0;
  el.addEventListener('lr-mcp-log', event => reports.push(event.detail.value as SdkReport));
  el.addEventListener('lr-mcp-request', () => { requests++; });
  el.resource = { uri: 'ui://sdk/denied', html: sdkDocument };
  await waitUntil(() => reports.some(report => ['done', 'fixture-error'].includes(report.stage)), 'the actual SDK must observe denied resource access', { timeout: 5_000 });
  expect(reports.filter(report => report.stage === 'fixture-error')).to.deep.equal([]);
  expect(reports.some(report => report.stage === 'resource-denied')).to.equal(true);
  expect(reports.some(report => report.stage === 'sampling-denied')).to.equal(true);
  expect(reports.some(report => report.stage === 'download-denied')).to.equal(true);
  expect(reports.find(report => report.stage === 'initialize')?.value).to.deep.include({ capabilities: { logging: {} } });
  expect(requests).to.equal(0);
  expect(await el.teardownApp()).to.equal(true);
});


it('loads the actual external SDK bundle and stylesheet only from host-authorized resource origins', async () => {
  const el = await fixture<LyraMcpApp>(html`<lr-mcp-app protocol="mcp-apps"
    .hostCapabilities=${{ logging: {} }}></lr-mcp-app>`);
  const reports: SdkReport[] = [];
  el.addEventListener('lr-mcp-log', event => reports.push(event.detail.value as SdkReport));
  el.resource = {
    uri: 'ui://sdk/external-assets',
    csp: { resourceDomains: [window.location.origin] },
    html: `<!doctype html><html><head>
      <link rel="stylesheet" href="${window.location.origin}/__lyra-mcp-app-sdk-fixture.css">
      </head><body><p>External SDK fixture</p>
      <script src="${window.location.origin}/__lyra-mcp-app-sdk-fixture.js"></script>
      </body></html>`,
  };
  await waitUntil(() => reports.some(report => ['done', 'fixture-error'].includes(report.stage)), 'the external SDK must initialize through the approved origin', { timeout: 5_000 });
  expect(reports.filter(report => report.stage === 'fixture-error')).to.deep.equal([]);
  expect(reports.find(report => report.stage === 'asset-style')?.value).to.equal('permitted');
  expect(await el.teardownApp()).to.equal(true);
});
