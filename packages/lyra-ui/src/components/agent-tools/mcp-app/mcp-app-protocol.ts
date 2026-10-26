/** The supported MCP Apps wire revision, independently implemented from its public specification. */
const PROTOCOL_VERSION = '2026-01-26';
const MAX_PENDING = 64;
const REQUEST_TIMEOUT = 30_000;

export type McpAppProtocol = 'legacy' | 'mcp-apps';
export type McpAppRequestId = string | number;
export type McpAppRequestMethod = 'tools/call' | 'tools/list' | 'resources/list' | 'resources/templates/list' | 'resources/read' | 'ui/message' | 'ui/open-link' | 'ui/update-model-context';
export type McpAppNotificationMethod = 'ui/notifications/tool-input' | 'ui/notifications/tool-input-partial' |
  'ui/notifications/tool-result' | 'ui/notifications/tool-cancelled' | 'ui/notifications/host-context-changed';

/** Supported capabilities only; permissions for browser APIs belong to the resource instead. */
export interface McpAppHostCapabilities {
  readonly serverTools?: Readonly<Record<string, never>>;
  readonly serverResources?: Readonly<Record<string, never>>;
  readonly openLinks?: Readonly<Record<string, never>>;
  readonly logging?: Readonly<Record<string, never>>;
  readonly message?: { readonly text?: Readonly<Record<string, never>> };
  readonly updateModelContext?: {
    readonly text?: Readonly<Record<string, never>>;
    readonly structuredContent?: Readonly<Record<string, never>>;
  };
}

export interface McpAppRequestDetail {
  requestId: McpAppRequestId;
  /** Opaque identity for this request instance, independent of reusable wire IDs. */
  requestToken: string;
  method: McpAppRequestMethod;
  params: Readonly<Record<string, unknown>>;
  frameGeneration: number;
  /** Aborted when cancelled, timed out, replaced, disconnected, or torn down. */
  signal: AbortSignal;
}

export type McpAppResponseOptions = { frameGeneration: number; requestToken: string } & (
  | { result: Readonly<Record<string, unknown>>; error?: never }
  | { result?: never; error: { code: number; message: string; data?: unknown } }
);

export function mcpRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

/** Bound wire values before normalization; undefined optional object fields are omitted by JSON. */
export function boundedMcpValue(value: unknown): boolean {
  const seen = new WeakSet<object>();
  const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let count = 0;
  let characters = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (++count > 10_000 || current.depth > 32) return false;
    const item = current.value;
    if (typeof item === 'string') characters += item.length;
    else if (typeof item === 'number') { if (!Number.isFinite(item)) return false; }
    else if (item !== null && typeof item === 'object') {
      if (seen.has(item) || (Array.isArray(item) && item.length > 10_000)) return false;
      seen.add(item);
      const prototype: unknown = Object.getPrototypeOf(item);
      if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) return false;
      const entries = Object.entries(Object.getOwnPropertyDescriptors(item));
      if (entries.length + count + pending.length > 10_000 ||
        (Array.isArray(item) && entries.length !== item.length + 1)) return false;
      for (const [key, descriptor] of entries) {
        if (Array.isArray(item) && key === 'length') continue;
        if (!('value' in descriptor)) return false;
        characters += key.length;
        if (descriptor.value === undefined && !Array.isArray(item)) continue;
        pending.push({ value: descriptor.value, depth: current.depth + 1 });
      }
    } else if (item !== null && typeof item !== 'boolean') return false;
    if (characters > 1_048_576) return false;
  }
  return true;
}

function validId(value: unknown): value is McpAppRequestId {
  return typeof value === 'string' ? value.length > 0 && value.length <= 256
    : typeof value === 'number' && Number.isSafeInteger(value);
}

function textContent(value: unknown): boolean {
  return Array.isArray(value) && value.every(item => {
    const block = mcpRecord(item);
    return block?.['type'] === 'text' && typeof block['text'] === 'string';
  });
}

function enabled(value: unknown): boolean { return mcpRecord(value) !== null; }

/** A session has one document and one negotiation; changing either requires a new session. */
export class McpAppSession {
  private phase: 'new' | 'initializing' | 'ready' | 'closing' | 'closed' = 'new';
  private readonly pending = new Map<McpAppRequestId, { requestToken: string; controller: AbortController; timer: ReturnType<typeof setTimeout> }>();
  private teardown?: { id: string; resolve: (acknowledged: boolean) => void; timer: ReturnType<typeof setTimeout> };
  private capabilities: McpAppHostCapabilities = {};
  private hostContext: Record<string, unknown>;
  private pendingHostContext = false;

  constructor(private readonly options: {
    generation: number;
    capabilities: McpAppHostCapabilities;
    context: Record<string, unknown>;
    send: (message: Record<string, unknown>) => void;
    request: (detail: McpAppRequestDetail) => void;
    initialized: () => void;
    resize: (height: number) => void;
    log: (level: string, data: unknown) => void;
  }) { this.hostContext = options.context; }

  private send(message: Record<string, unknown>): void {
    if (this.phase !== 'closed' && boundedMcpValue(message)) {
      const normalized = JSON.parse(JSON.stringify(message)) as Record<string, unknown>;
      this.options.send({ jsonrpc: '2.0', ...normalized });
    }
  }

  private error(id: McpAppRequestId, code: number, message: string): void {
    this.send({ id, error: { code, message } });
  }

  receive(data: unknown): void {
    if (this.phase === 'closed' || !boundedMcpValue(data)) return;
    const message = mcpRecord(JSON.parse(JSON.stringify(data)));
    if (!message || message['jsonrpc'] !== '2.0') return;
    const id = message['id'];
    const method = message['method'];
    const params = mcpRecord(message['params']);
    if (method === undefined) {
      if (this.teardown && id === this.teardown.id && ('result' in message) !== ('error' in message) &&
        (mcpRecord(message['result']) || mcpRecord(message['error']))) {
        const acknowledged = mcpRecord(message['result']) !== null;
        this.close(acknowledged);
      }
      return;
    }
    if (typeof method !== 'string' || ('id' in message && !validId(id)) || 'result' in message || 'error' in message) return;
    if (method === 'ui/initialize' && validId(id)) {
      const info = mcpRecord(params?.['appInfo']);
      if (this.phase !== 'new') { this.error(id, -32600, 'Already initialized'); return; }
      if (typeof params?.['protocolVersion'] !== 'string' || !info || typeof info['name'] !== 'string' ||
        typeof info['version'] !== 'string' || !mcpRecord(params['appCapabilities'])) {
        this.error(id, -32602, 'Invalid initialization parameters'); return;
      }
      const offered = mcpRecord(this.options.capabilities) ?? {};
      this.capabilities = {
        ...(enabled(offered['serverTools']) ? { serverTools: {} } : {}),
        ...(enabled(offered['serverResources']) ? { serverResources: {} } : {}),
        ...(enabled(offered['openLinks']) ? { openLinks: {} } : {}),
        ...(enabled(offered['logging']) ? { logging: {} } : {}),
        ...(enabled(mcpRecord(offered['message'])?.['text']) ? { message: { text: {} } } : {}),
        ...(enabled(offered['updateModelContext']) ? { updateModelContext: {
          ...(enabled(mcpRecord(offered['updateModelContext'])?.['text']) ? { text: {} } : {}),
          ...(enabled(mcpRecord(offered['updateModelContext'])?.['structuredContent']) ? { structuredContent: {} } : {}),
        } } : {}),
      };
      this.phase = 'initializing';
      this.send({ id, result: { protocolVersion: PROTOCOL_VERSION, hostInfo: { name: 'Lyra UI', version: '1' },
        hostCapabilities: this.capabilities, hostContext: this.hostContext } });
      return;
    }
    if (method === 'ui/notifications/initialized' && id === undefined && this.phase === 'initializing') {
      this.phase = 'ready';
      if (this.pendingHostContext) {
        this.pendingHostContext = false;
        this.notify('ui/notifications/host-context-changed', this.hostContext);
      }
      this.options.initialized();
      return;
    }
    if (this.phase !== 'ready') {
      if (validId(id)) this.error(id, -32600, 'App is not ready');
      return;
    }
    if (method === 'notifications/cancelled' && id === undefined) {
      const requestId = params?.['requestId'];
      if (validId(requestId)) this.clearRequest(requestId, true);
      return;
    }
    if (method === 'ui/notifications/size-changed' && id === undefined) {
      if (typeof params?.['height'] === 'number' && Number.isFinite(params['height'])) this.options.resize(params['height']);
      return;
    }
    if (method === 'notifications/message' && id === undefined && this.capabilities.logging) {
      if (typeof params?.['level'] === 'string') this.options.log(params['level'], params['data']);
      return;
    }
    if (!validId(id)) return;
    if (this.pending.has(id)) { this.clearRequest(id, true); this.error(id, -32600, 'Duplicate request id'); return; }
    if (method === 'ping') { this.send({ id, result: {} }); return; }
    if (method === 'ui/request-display-mode') {
      if (!['inline', 'fullscreen', 'pip'].includes(String(params?.['mode']))) {
        this.error(id, -32602, 'Invalid display mode');
      } else this.send({ id, result: { mode: 'inline' } });
      return;
    }
    const capability = ({ 'tools/call': 'serverTools', 'tools/list': 'serverTools',
      'resources/list': 'serverResources', 'resources/templates/list': 'serverResources', 'resources/read': 'serverResources', 'ui/message': 'message',
      'ui/open-link': 'openLinks', 'ui/update-model-context': 'updateModelContext' } as const)[method as McpAppRequestMethod];
    if (!capability || !this.capabilities[capability]) { this.error(id, -32601, 'Method not available'); return; }
    const requestParams = params ?? {};
    let valid = message['params'] === undefined || params !== null;
    if (method === 'tools/call') valid &&= typeof requestParams['name'] === 'string' && requestParams['name'].length > 0 &&
      (requestParams['arguments'] === undefined || mcpRecord(requestParams['arguments']) !== null);
    if (method === 'resources/read') valid &&= typeof requestParams['uri'] === 'string' && requestParams['uri'].length > 0;
    if (['tools/list', 'resources/list', 'resources/templates/list'].includes(method)) {
      valid &&= requestParams['cursor'] === undefined || typeof requestParams['cursor'] === 'string';
    }
    if (method === 'ui/message') valid &&= requestParams['role'] === 'user' && textContent(requestParams['content']);
    if (method === 'ui/update-model-context') valid &&=
      (requestParams['content'] === undefined || (!!this.capabilities.updateModelContext?.text && textContent(requestParams['content']))) &&
      (requestParams['structuredContent'] === undefined || (!!this.capabilities.updateModelContext?.structuredContent && mcpRecord(requestParams['structuredContent']) !== null));
    if (method === 'ui/open-link') {
      try { valid &&= ['https:', 'http:', 'mailto:'].includes(new URL(String(requestParams['url'])).protocol); }
      catch { valid = false; }
    }
    if (!valid) { this.error(id, -32602, 'Invalid request parameters'); return; }
    if (this.pending.size >= MAX_PENDING) { this.error(id, -32000, 'Too many pending requests'); return; }
    const controller = new AbortController();
    const requestToken = crypto.randomUUID();
    const timer = setTimeout(() => {
      this.error(id, -32000, 'Host request timed out');
      this.clearRequest(id, true);
    }, REQUEST_TIMEOUT);
    this.pending.set(id, { requestToken, controller, timer });
    this.options.request({ requestId: id, requestToken, method: method as McpAppRequestMethod, params: requestParams,
      frameGeneration: this.options.generation, signal: controller.signal });
  }

  private clearRequest(id: McpAppRequestId, abort: boolean): void {
    const request = this.pending.get(id);
    if (!request) return;
    this.pending.delete(id);
    clearTimeout(request.timer);
    if (abort) request.controller.abort();
  }

  respond(id: McpAppRequestId, options: McpAppResponseOptions): boolean {
    const request = this.pending.get(id);
    if (this.phase !== 'ready' || !request || options?.frameGeneration !== this.options.generation ||
      options.requestToken !== request.requestToken || !boundedMcpValue(options)) return false;
    const value = mcpRecord(JSON.parse(JSON.stringify(options)))!;
    const error = mcpRecord(value['error']);
    const result = mcpRecord(value['result']);
    if (('result' in value) === ('error' in value) || (!result && (!error || !Number.isInteger(error['code']) || typeof error['message'] !== 'string'))) return false;
    this.send({ id, ...(result ? { result } : { error }) });
    this.clearRequest(id, false);
    return true;
  }

  /** Retain host context for negotiation and deliver changes only once the app is ready. */
  updateHostContext(params: Record<string, unknown>): boolean {
    if (this.phase === 'closing' || this.phase === 'closed' || !mcpRecord(params) || !boundedMcpValue(params)) return false;
    const context = { ...this.hostContext, ...JSON.parse(JSON.stringify(params)) as Record<string, unknown> };
    if (!boundedMcpValue(context)) return false;
    this.hostContext = context;
    if (this.phase === 'ready') this.notify('ui/notifications/host-context-changed', context);
    else if (this.phase === 'initializing') this.pendingHostContext = true;
    return true;
  }

  notify(method: McpAppNotificationMethod, params: Record<string, unknown>): boolean {
    if (this.phase !== 'ready' || !['ui/notifications/tool-input', 'ui/notifications/tool-input-partial',
      'ui/notifications/tool-result', 'ui/notifications/tool-cancelled', 'ui/notifications/host-context-changed'].includes(method) ||
      !mcpRecord(params) || !boundedMcpValue(params)) return false;
    this.send({ method, params });
    return true;
  }

  teardownResource(): Promise<boolean> {
    if (this.phase !== 'ready') return Promise.resolve(false);
    this.phase = 'closing';
    for (const id of this.pending.keys()) this.clearRequest(id, true);
    return new Promise(resolve => {
      const id = `teardown:${crypto.randomUUID()}`;
      const timer = setTimeout(() => this.close(false), 1_000);
      this.teardown = { id, resolve, timer };
      this.send({ id, method: 'ui/resource-teardown', params: {} });
    });
  }

  close(acknowledged = false): void {
    this.phase = 'closed';
    for (const id of this.pending.keys()) this.clearRequest(id, true);
    if (this.teardown) {
      clearTimeout(this.teardown.timer);
      this.teardown.resolve(acknowledged);
      this.teardown = undefined;
    }
  }
}

/** Only trusted code runs in this outer sandbox. App bytes are assigned to a second opaque frame. */
export const MCP_APP_PROXY_DOCUMENT = `<!doctype html><html><head><meta name="referrer" content="no-referrer"></head>
<body style="margin:0"><script>
(() => {
  let port, nonce, app, stopped = false, loaded = false;
  const envelope = message => ({ channel: 'lyra-mcp-app', version: 1, type: 'mcp-apps', nonce, message });
  addEventListener('message', event => {
    if (!port && event.source === parent && event.data?.type === 'host-context' && event.ports[0]) {
      port = event.ports[0]; nonce = event.data.nonce;
      port.onmessage = incoming => {
        const data = incoming.data;
        if (stopped || data?.nonce !== nonce) return;
        if (data.type === 'mcp-resource' && !app) {
          app = document.createElement('iframe');
          app.title = data.title;
          app.setAttribute('sandbox', 'allow-forms allow-scripts');
          app.setAttribute('referrerpolicy', 'no-referrer');
          app.setAttribute('allow', data.allow);
          app.style.cssText = 'border:0;width:100%;height:100vh;display:block';
          app.addEventListener('load', () => {
            if (!loaded) { loaded = true; return; }
            stopped = true;
            port.postMessage({ channel: 'lyra-mcp-app', version: 1, type: 'mcp-navigation', nonce });
            port.close(); app.remove();
          });
          if (typeof data.html === 'string') app.srcdoc = data.html;
          else app.src = data.src;
          document.body.append(app);
        } else if (data.type === 'mcp-apps' && app) app.contentWindow.postMessage(data.message, '*');
      };
      port.start();
    } else if (!stopped && app && event.source === app.contentWindow && event.origin === 'null' && event.data?.jsonrpc === '2.0') {
      port.postMessage(envelope(event.data));
    }
  });
})();
</script></body></html>`;
