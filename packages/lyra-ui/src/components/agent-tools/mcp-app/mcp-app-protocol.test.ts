import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './mcp-app.js';
import { McpAppSession } from './mcp-app-protocol.js';
import type { McpAppRequestDetail } from './mcp-app-protocol.js';
import type { LyraMcpApp } from './mcp-app.class.js';

/** A wire-level app fixture; this deliberately does not claim SDK conformance. */
function appDocument(body: string): string {
  return `<script>
    const send = message => parent.postMessage({ jsonrpc: '2.0', ...message }, '*');
    addEventListener('message', event => {
      if (event.source !== parent || event.data?.jsonrpc !== '2.0') return;
      const message = event.data;
      if (message.id === 'initialize') {
        send({ method: 'ui/notifications/initialized' });
        ${body}
      }
    });
    send({ id: 'initialize', method: 'ui/initialize', params: {
      protocolVersion: '2026-01-26', appInfo: { name: 'Fixture', version: '1' }, appCapabilities: {}
    } });
  </script>`;
}

describe('MCP Apps protocol host', () => {
  it('negotiates the official lifecycle and correlates numeric request ids through the sandbox proxy', async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app protocol="mcp-apps"
      .hostCapabilities=${{ serverTools: {}, logging: {} }}></lr-mcp-app>`);
    const reports: unknown[] = [];
    const calls: string[] = [];
    el.addEventListener('lr-mcp-log', event => reports.push(event.detail.value));
    el.addEventListener('lr-mcp-request', event => {
      calls.push(event.detail.method);
      el.postMcpResponse(event.detail.requestId, { frameGeneration: event.detail.frameGeneration, requestToken: event.detail.requestToken, result: { content: [] } });
    });
    el.resource = { uri: 'ui://protocol/lifecycle', html: appDocument(`
      send({ id: 0, method: 'tools/call', params: { name: 'weather', arguments: {} } });
      addEventListener('message', event => {
        if (event.source === parent && event.data?.id === 0) {
          send({ method: 'notifications/message', params: { level: 'info', data: event.data.result } });
        }
      });
    `) };
    await waitUntil(() => reports.length === 1, 'the protocol tool response must reach the app', { timeout: 5_000 });
    expect(calls).to.deep.equal(['tools/call']);
    expect(reports).to.deep.equal([{ content: [] }]);
    expect(el.shadowRoot!.querySelector('iframe')!.sandbox.contains('allow-same-origin')).to.equal(false);
    await expect(el).to.be.accessible();
  });

  it('rejects protocol requests from a nested window even when its opaque origin matches', async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app protocol="mcp-apps"
      .hostCapabilities=${{ serverTools: {}, logging: {} }}></lr-mcp-app>`);
    let requests = 0;
    const reports: unknown[] = [];
    el.addEventListener('lr-mcp-request', () => { requests++; });
    el.addEventListener('lr-mcp-log', event => reports.push(event.detail.value));
    el.resource = { uri: 'ui://protocol/nested-window', html: appDocument(`
      const nested = document.createElement('iframe');
      nested.setAttribute('sandbox', 'allow-scripts');
      addEventListener('message', event => {
        if (event.source === nested.contentWindow && event.data === 'spoof-sent') {
          send({ method: 'notifications/message', params: { level: 'info', data: 'barrier' } });
        }
      });
      nested.srcdoc = '<script>parent.parent.postMessage({ jsonrpc: "2.0", id: "spoof", method: "tools/call", params: { name: "unauthorized" } }, "*"); parent.postMessage("spoof-sent", "*");<' + '/script>';
      document.body.append(nested);
    `) };
    await waitUntil(() => reports.length === 1, 'the nested-window spoof must precede the genuine app barrier', { timeout: 5_000 });
    expect(reports).to.deep.equal(['barrier']);
    expect(requests).to.equal(0);
  });

  it('denies unadvertised methods and aborts cancelled host requests', async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app protocol="mcp-apps"
      .hostCapabilities=${{ serverTools: {}, logging: {} }}></lr-mcp-app>`);
    const reports: unknown[] = [];
    let signal: AbortSignal | undefined;
    let calls = 0;
    el.addEventListener('lr-mcp-log', event => reports.push(event.detail.value));
    el.addEventListener('lr-mcp-request', event => { calls++; signal = event.detail.signal; });
    el.resource = { uri: 'ui://protocol/cancel', html: appDocument(`
      addEventListener('message', event => {
        if (event.source === parent && event.data?.id === 'denied') {
          send({ method: 'notifications/message', params: { level: 'info', data: event.data.error.code } });
        }
      });
      send({ id: 'denied', method: 'ui/open-link', params: { url: 'https://example.com' } });
      send({ id: 'pending', method: 'tools/call', params: { name: 'weather' } });
      send({ method: 'notifications/cancelled', params: { requestId: 'pending' } });
    `) };
    await waitUntil(() => reports.length === 1 && signal?.aborted === true, 'denial and cancellation must complete', { timeout: 5_000 });
    expect(reports).to.deep.equal([-32601]);
    expect(calls).to.equal(1);
  });

  it('aborts in-flight requests on resource replacement and rejects old-generation notifications', async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app protocol="mcp-apps"
      .hostCapabilities=${{ serverTools: {} }}></lr-mcp-app>`);
    let pending: McpAppRequestDetail | undefined;
    el.addEventListener('lr-mcp-request', event => { pending = event.detail; });
    el.resource = { uri: 'ui://protocol/replace', html: appDocument(`
      send({ id: 'pending', method: 'tools/call', params: { name: 'weather' } });
    `) };
    await waitUntil(() => pending !== undefined, 'the original app must have a pending request', { timeout: 5_000 });
    const request = pending!;
    el.resource = { uri: 'ui://protocol/replacement', html: appDocument('') };
    await el.updateComplete;
    expect(request.signal.aborted).to.equal(true);
    expect(el.postMcpResponse(request.requestId, { frameGeneration: request.frameGeneration, requestToken: request.requestToken, result: {} })).to.equal(false);
    expect(el.postMcpNotification('ui/notifications/tool-result', { content: [] }, request.frameGeneration)).to.equal(false);
  });

  it('delivers tool input only after initialization and supports graceful teardown', async () => {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app protocol="mcp-apps"
      .hostCapabilities=${{ logging: {} }}></lr-mcp-app>`);
    const reports: unknown[] = [];
    el.addEventListener('lr-mcp-log', event => reports.push(event.detail.value));
    el.addEventListener('lr-mcp-initialized', event => {
      el.postMcpNotification('ui/notifications/tool-input', { arguments: { city: 'Luxembourg' } }, event.detail.frameGeneration);
    });
    el.resource = { uri: 'ui://protocol/teardown', html: appDocument(`
      addEventListener('message', event => {
        if (event.source !== parent) return;
        if (event.data?.method === 'ui/notifications/tool-input') {
          send({ method: 'notifications/message', params: { level: 'info', data: event.data.params } });
        }
        if (event.data?.method === 'ui/resource-teardown') send({ id: event.data.id, result: {} });
      });
    `) };
    await waitUntil(() => reports.length === 1, 'tool input must reach the ready app', { timeout: 5_000 });
    expect(reports).to.deep.equal([{ arguments: { city: 'Luxembourg' } }]);
    expect(await el.teardownApp()).to.equal(true);
    expect(el.postMcpNotification('ui/notifications/tool-cancelled', {}, -1)).to.equal(false);
  });
});


describe('MCP Apps session boundaries', () => {
  it('does not turn advertised app tools into server grants or unsupported host capabilities', () => {
    const responses: Record<string, unknown>[] = [];
    let requests = 0;
    const bridge = new McpAppSession({ generation: 1, capabilities: {}, context: {},
      send: message => responses.push(message), request: () => { requests++; },
      initialized: () => {}, resize: () => {}, log: () => {},
    });
    bridge.receive({ jsonrpc: '2.0', id: 'init', method: 'ui/initialize', params: {
      protocolVersion: '2026-01-26', appInfo: { name: 'App tools', version: '1' }, appCapabilities: { tools: { listChanged: true } },
    } });
    expect(responses[0]?.['result']).to.deep.include({ hostCapabilities: {} });
    bridge.receive({ jsonrpc: '2.0', method: 'ui/notifications/initialized' });
    for (const method of ['tools/call', 'sampling/createMessage', 'ui/download-file']) {
      bridge.receive({ jsonrpc: '2.0', id: method, method, params: {} });
    }
    expect(responses.slice(1).map(message => message['error'])).to.deep.equal([
      { code: -32601, message: 'Method not available' },
      { code: -32601, message: 'Method not available' },
      { code: -32601, message: 'Method not available' },
    ]);
    expect(requests).to.equal(0);
    bridge.close();
  });

  function session() {
    const responses: Record<string, unknown>[] = [];
    const requests: McpAppRequestDetail[] = [];
    const bridge = new McpAppSession({ generation: 3, capabilities: { serverTools: {}, openLinks: {} }, context: {},
      send: message => responses.push(message), request: detail => requests.push(detail),
      initialized: () => {}, resize: () => {}, log: () => {},
    });
    bridge.receive({ jsonrpc: '2.0', id: 'init', method: 'ui/initialize', params: {
      protocolVersion: '2026-01-26', appInfo: { name: 'test', version: '1' }, appCapabilities: {},
    } });
    bridge.receive({ jsonrpc: '2.0', method: 'ui/notifications/initialized' });
    responses.length = 0;
    return { bridge, responses, requests };
  }

  it('limits pending work, closes abort signals and rejects stale, duplicate or unsolicited responses', () => {
    const { bridge, responses, requests } = session();
    for (let id = 0; id < 65; id++) bridge.receive({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'weather' } });
    expect(requests.length).to.equal(64);
    expect(responses.length).to.equal(1);
    expect(bridge.respond(0, { frameGeneration: 2, requestToken: requests[0]!.requestToken, result: {} })).to.equal(false);
    expect(bridge.respond(0, { frameGeneration: 3, requestToken: requests[0]!.requestToken, result: {} })).to.equal(true);
    expect(bridge.respond(0, { frameGeneration: 3, requestToken: requests[0]!.requestToken, result: {} })).to.equal(false);
    bridge.receive({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'duplicate' } });
    expect(requests[1]!.signal.aborted).to.equal(true);
    expect(bridge.respond(1, { frameGeneration: 3, requestToken: requests[1]!.requestToken, result: {} })).to.equal(false);
    bridge.close();
    expect(requests.slice(1).every(request => request.signal.aborted)).to.equal(true);
    expect(bridge.respond(2, { frameGeneration: 3, requestToken: requests[2]!.requestToken, result: {} })).to.equal(false);
  });

  for (const retirement of ['cancelled', 'duplicate', 'completed']) {
    it(`rejects a late response from a ${retirement} request after its ID is reused`, () => {
      const { bridge, requests, responses } = session();
      const request = { jsonrpc: '2.0', id: 'reused', method: 'tools/call', params: { name: 'weather' } };
      bridge.receive(request);
      const first = requests[0]!;
      if (retirement === 'cancelled') {
        bridge.receive({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 'reused' } });
      } else if (retirement === 'duplicate') bridge.receive(request);
      else expect(bridge.respond('reused', { frameGeneration: 3, requestToken: first.requestToken, result: {} })).to.equal(true);
      bridge.receive(request);
      const second = requests[1]!;
      responses.length = 0;
      expect(Reflect.apply(bridge.respond, bridge, ['reused', { frameGeneration: 3, result: {} }])).to.equal(false);
      expect(bridge.respond('reused', { frameGeneration: 3, requestToken: 'wrong', result: {} })).to.equal(false);
      expect(bridge.respond('reused', { frameGeneration: 3, requestToken: first.requestToken, result: { source: 'first' } })).to.equal(false);
      expect(responses.length).to.equal(0);
      expect(first.requestToken).not.to.equal(second.requestToken);
      expect(bridge.respond('reused', { frameGeneration: 3, requestToken: second.requestToken, result: { source: 'second' } })).to.equal(true);
      expect(responses[0]?.['result']).to.deep.equal({ source: 'second' });
      bridge.close();
    });
  }

  it('closes an unresponsive app after the bounded teardown wait', async () => {
    const { bridge } = session();
    expect(await bridge.teardownResource()).to.equal(false);
    expect(bridge.notify('ui/notifications/tool-input', {})).to.equal(false);
  });

  it('rejects unsafe links and malformed methods without creating host work', () => {
    const { bridge, responses, requests } = session();
    for (const url of ['javascript:alert(1)', 'data:text/html,hello', '/relative', 'file:///tmp/app']) {
      bridge.receive({ jsonrpc: '2.0', id: url, method: 'ui/open-link', params: { url } });
    }
    bridge.receive({ jsonrpc: '2.0', id: 0, method: 'tools/call', params: { name: 'weather', arguments: [] } });
    bridge.receive({ jsonrpc: '2.0', id: 1, method: 'ui/download-file', params: {} });
    bridge.receive({ jsonrpc: '2.0', id: null, method: 'tools/call', params: { name: 'weather' } });
    expect(requests.length).to.equal(0);
    expect(responses.length).to.equal(6);
    bridge.close();
  });

  it('negotiates only supported capabilities and gates requests before initialized', () => {
    const sent: Record<string, unknown>[] = [];
    let calls = 0;
    const bridge = new McpAppSession({ generation: 1, capabilities: {}, context: {}, send: message => sent.push(message),
      request: () => { calls++; }, initialized: () => {}, resize: () => {}, log: () => {},
    });
    bridge.receive({ jsonrpc: '2.0', id: 0, method: 'tools/call', params: { name: 'weather' } });
    expect(bridge.notify('ui/notifications/tool-input', {})).to.equal(false);
    bridge.receive({ jsonrpc: '2.0', id: 1, method: 'ui/initialize', params: {
      protocolVersion: 'future-version', appInfo: { name: 'test', version: '1' }, appCapabilities: {},
    } });
    expect(sent[1]?.['result']).to.deep.include({ protocolVersion: '2026-01-26', hostCapabilities: {} });
    bridge.receive({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'weather' } });
    expect(calls).to.equal(0);
    bridge.close();
  });
});


it('retains latest host context before initialization and queues changes during negotiation', () => {
  const sent: Record<string, unknown>[] = [];
  const session = new McpAppSession({ generation: 1, capabilities: {}, context: { locale: 'en', displayMode: 'inline' },
    send: message => sent.push(message), request: () => {}, initialized: () => {}, resize: () => {}, log: () => {},
  });
  expect(session.updateHostContext({ locale: 'fr' })).to.equal(true);
  expect(sent.length).to.equal(0);
  session.receive({ jsonrpc: '2.0', id: 'initialize', method: 'ui/initialize', params: {
    protocolVersion: '2026-01-26', appInfo: { name: 'Locale fixture', version: '1' }, appCapabilities: {},
  } });
  expect((sent[0]?.['result'] as { hostContext: unknown }).hostContext).to.deep.equal({ locale: 'fr', displayMode: 'inline' });
  const change = { locale: 'ar' };
  expect(session.updateHostContext(change)).to.equal(true);
  change.locale = 'en';
  expect(sent.length).to.equal(1);
  session.receive({ jsonrpc: '2.0', method: 'ui/notifications/initialized' });
  expect(sent[1]).to.deep.include({ method: 'ui/notifications/host-context-changed', params: { locale: 'ar', displayMode: 'inline' } });
  expect(session.updateHostContext({ locale: 'fr' })).to.equal(true);
  expect(sent[2]).to.deep.include({ method: 'ui/notifications/host-context-changed', params: { locale: 'fr', displayMode: 'inline' } });
  expect(session.updateHostContext({ locale: () => 'invalid' })).to.equal(false);
  session.close();
  expect(session.updateHostContext({ locale: 'en' })).to.equal(false);
  expect(sent.length).to.equal(3);
});
