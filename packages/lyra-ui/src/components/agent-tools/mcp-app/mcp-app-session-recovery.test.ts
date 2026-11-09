import { expect, waitUntil } from '@open-wc/testing';
import { McpAppSession } from './mcp-app-protocol.js';
import type { McpAppHostCapabilities, McpAppRequestDetail } from './mcp-app-protocol.js';

const initialization = {
  protocolVersion: '2026-01-26', appInfo: { name: 'Recovery fixture', version: '1' }, appCapabilities: {},
};

describe('MCP Apps negotiation and request recovery', () => {
  const live = new Set<McpAppSession>();
  afterEach(() => { for (const session of live) session.close(); live.clear(); });

  function setup(capabilities: McpAppHostCapabilities = { serverTools: {}, serverResources: {} }) {
    const messages: Record<string, unknown>[] = [], requests: McpAppRequestDetail[] = [], heights: number[] = [];
    let initialized = 0;
    const session = new McpAppSession({ generation: 7, capabilities, context: {},
      send: message => { messages.push(message); }, request: request => { requests.push(request); },
      initialized: () => { initialized++; }, resize: height => { heights.push(height); }, log: () => {},
    });
    live.add(session);
    const send = (message: Record<string, unknown>): void => { session.receive({ jsonrpc: '2.0', ...message }); };
    const initialize = (): void => { send({ id: 'init', method: 'ui/initialize', params: initialization }); };
    const ready = (): void => { initialize(); send({ method: 'ui/notifications/initialized' }); messages.length = 0; };
    return { session, messages, requests, heights, send, initialize, ready, initialized: () => initialized };
  }

  for (const [name, params] of [
    ['missing parameters', undefined], ['non-record parameters', []],
    ['missing protocol version', { ...initialization, protocolVersion: undefined }],
    ['non-string protocol version', { ...initialization, protocolVersion: 1 }],
    ['missing app info', { ...initialization, appInfo: undefined }],
    ['non-record app info', { ...initialization, appInfo: [] }],
    ['missing app name', { ...initialization, appInfo: { version: '1' } }],
    ['missing app version', { ...initialization, appInfo: { name: 'App' } }],
    ['non-record capabilities', { ...initialization, appCapabilities: [] }],
  ] as const) {
    it(`rejects ${name} without consuming the next valid negotiation`, () => {
      const value = setup();
      value.send({ id: 'invalid', method: 'ui/initialize', params });
      expect(value.messages[0]?.['error']).to.deep.equal({ code: -32602, message: 'Invalid initialization parameters' });
      expect(value.initialized()).to.equal(0);
      value.ready();
      expect(value.initialized()).to.equal(1);
      value.send({ id: 0, method: 'ping' });
      expect(value.messages).to.deep.equal([{ jsonrpc: '2.0', id: 0, result: {} }]);
    });
  }

  for (const complete of [false, true]) {
    it(`refuses repeated initialization ${complete ? 'after' : 'during'} negotiation without replacing the session`, () => {
      const value = setup(); value.initialize();
      if (complete) value.send({ method: 'ui/notifications/initialized' });
      value.send({ id: 'repeat', method: 'ui/initialize', params: initialization });
      expect(value.messages.at(-1)?.['error']).to.deep.equal({ code: -32600, message: 'Already initialized' });
      value.send({ method: 'ui/notifications/initialized' });
      expect(value.initialized()).to.equal(1);
      value.send({ id: 'request', method: 'tools/call', params: { name: 'lookup' } });
      expect(value.requests.map(request => request.requestId)).to.deep.equal(['request']);
    });
  }

  for (const allowed of ['text', 'structuredContent'] as const) {
    it(`negotiates the ${allowed} model-context capability independently`, () => {
      const value = setup({ updateModelContext: { [allowed]: {} } }); value.initialize();
      expect(value.messages[0]?.['result']).to.deep.include({ hostCapabilities: { updateModelContext: { [allowed]: {} } } });
      value.send({ method: 'ui/notifications/initialized' });
      const text = { content: [{ type: 'text', text: 'Context' }] }, structured = { structuredContent: { answer: 42 } };
      value.send({ id: 'allowed', method: 'ui/update-model-context', params: allowed === 'text' ? text : structured });
      value.send({ id: 'denied', method: 'ui/update-model-context', params: allowed === 'text' ? structured : text });
      expect(value.requests.map(request => request.requestId)).to.deep.equal(['allowed']);
      expect(value.messages.at(-1)?.['error']).to.deep.equal({ code: -32602, message: 'Invalid request parameters' });
    });
  }

  for (const method of ['tools/list', 'resources/list', 'resources/templates/list']) {
    it(`validates ${method} cursors before allocating host work`, () => {
      const value = setup(); value.ready();
      for (const cursor of [null, 0, {}, []]) value.send({ id: 'invalid', method, params: { cursor } });
      expect(value.requests.length).to.equal(0);
      expect(value.messages.map(message => message['error'])).to.deep.equal(Array.from({ length: 4 }, () => ({ code: -32602, message: 'Invalid request parameters' })));
      for (const [id, params] of [['first', {}], ['next', { cursor: 'next-page' }]] as const) value.send({ id, method, params });
      expect(value.requests.map(request => request.params)).to.deep.equal([{}, { cursor: 'next-page' }]);
    });
  }

  it('accepts finite height notifications without treating requests or malformed heights as resize commands', () => {
    const value = setup(); value.ready();
    for (const height of ['480', null, {}, Number.NaN, Number.POSITIVE_INFINITY]) {
      value.send({ method: 'ui/notifications/size-changed', params: { height } });
    }
    value.send({ id: 'not-a-notification', method: 'ui/notifications/size-changed', params: { height: 900 } });
    value.send({ method: 'ui/notifications/size-changed', params: { height: 480 } });
    expect(value.heights).to.deep.equal([480]); expect(value.requests.length).to.equal(0);
  });

  it('restricts requested display modes and consistently reports the supported inline mode', () => {
    const value = setup(); value.ready();
    for (const mode of [undefined, null, 'popup', 1]) value.send({ id: 'invalid', method: 'ui/request-display-mode', params: { mode } });
    expect(value.messages.map(message => message['error'])).to.deep.equal(Array.from({ length: 4 }, () => ({ code: -32602, message: 'Invalid display mode' })));
    value.messages.length = 0;
    for (const mode of ['inline', 'fullscreen', 'pip']) value.send({ id: mode, method: 'ui/request-display-mode', params: { mode } });
    expect(value.messages.map(message => message['result'])).to.deep.equal([{ mode: 'inline' }, { mode: 'inline' }, { mode: 'inline' }]);
    expect(value.requests.length).to.equal(0);
  });

  for (const acknowledged of [false, true]) {
    it(`aborts pending requests before a ${acknowledged ? 'successful' : 'failed'} teardown acknowledgment`, async () => {
      const value = setup(); value.ready();
      value.send({ id: 'pending', method: 'tools/call', params: { name: 'lookup' } });
      const request = value.requests[0]!, completion = value.session.teardownResource();
      expect(request.signal.aborted).to.equal(true);
      const id = value.messages.at(-1)?.['id'];
      value.send({ id, ...(acknowledged ? { result: {} } : { error: { code: -32000, message: 'Cannot close' } }) });
      expect(await completion).to.equal(acknowledged);
      expect(await value.session.teardownResource()).to.equal(false);
      expect(value.session.respond('pending', { frameGeneration: 7, requestToken: request.requestToken, result: {} })).to.equal(false);
      const count = value.messages.length;
      value.send({ id: 'late', method: 'ping' }); expect(value.messages.length).to.equal(count);
    });
  }

  it('rejects host-context updates whose merged size exceeds the wire limit without losing the last context', () => {
    const value = setup(); value.ready();
    const first = 'a'.repeat(600_000), second = 'b'.repeat(600_000);
    expect(value.session.updateHostContext({ first })).to.equal(true);
    expect(value.session.updateHostContext({ second })).to.equal(false);
    expect(value.messages.length).to.equal(1);
    expect(value.session.updateHostContext({ locale: 'fr' })).to.equal(true);
    expect(value.messages.at(-1)?.['params']).to.deep.equal({ first, locale: 'fr' });
  });

  it('ignores malformed envelopes and unknown cancellations while preserving a pending request', () => {
    const value = setup(); value.ready();
    value.send({ id: 'live', method: 'tools/call', params: { name: 'lookup' } });
    for (const message of [null, [], 'message', { jsonrpc: '1.0', id: 'live', method: 'ping' },
      { jsonrpc: '2.0', id: 'live', method: 'ping', result: {} }, { jsonrpc: '2.0', method: 42 },
      { jsonrpc: '2.0', method: 'ping' }, { jsonrpc: '2.0', method: 'tools/call', params: { name: 'lookup' } }]) value.session.receive(message);
    value.send({ method: 'notifications/cancelled', params: { requestId: 'missing' } });
    expect(value.requests.length).to.equal(1); expect(value.requests[0]!.signal.aborted).to.equal(false);
    expect(value.messages.length).to.equal(0);
  });

  it('expires unresponsive host work, rejects its late response, and permits the wire ID to be reused', async function () {
    this.timeout(40_000);
    const value = setup(); value.ready();
    value.send({ id: 'slow', method: 'tools/call', params: { name: 'lookup' } });
    const request = value.requests[0]!;
    await waitUntil(() => request.signal.aborted, 'host request did not expire', { timeout: 35_000, interval: 100 });
    expect(value.messages).to.deep.equal([{ jsonrpc: '2.0', id: 'slow', error: { code: -32000, message: 'Host request timed out' } }]);
    value.send({ id: 'slow', method: 'tools/call', params: { name: 'lookup' } });
    const next = value.requests[1]!;
    expect(next.requestToken).not.to.equal(request.requestToken);
    expect(value.session.respond('slow', { frameGeneration: 7, requestToken: request.requestToken, result: {} })).to.equal(false);
    expect(value.session.respond('slow', { frameGeneration: 7, requestToken: next.requestToken, result: { found: true } })).to.equal(true);
    expect(value.messages.at(-1)?.['result']).to.deep.equal({ found: true });
  });
});
