import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { finiteRange } from '../../../internal/numbers.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { styles } from './mcp-app.styles.js';

export interface McpAppPermissions {
  camera?: boolean;
  microphone?: boolean;
  geolocation?: boolean;
  clipboardRead?: boolean;
  clipboardWrite?: boolean;
}

export interface McpAppCsp {
  connectDomains?: string[];
  resourceDomains?: string[];
  frameDomains?: string[];
}

export interface McpAppResource {
  uri: string;
  title?: string;
  /** Executable app document. It is assigned only to a uniquely-origin sandboxed iframe. */
  html?: string;
  /** Resolved app URL when the host serves the UI as a separate resource. */
  src?: string;
  csp?: McpAppCsp;
  permissions?: McpAppPermissions;
  metadata?: Record<string, unknown>;
}

export interface McpAppToolCallDetail {
  requestId?: string;
  name: string;
  args: unknown;
}

export interface LyraMcpAppEventMap {
  'lr-mcp-ready': CustomEvent<{ uri: string }>;
  'lr-mcp-tool-call': CustomEvent<McpAppToolCallDetail>;
  'lr-mcp-send-message': CustomEvent<{ message: unknown }>;
  'lr-mcp-open-link': CustomEvent<{ href: string }>;
  'lr-mcp-log': CustomEvent<{ level: string; value: unknown }>;
  'lr-mcp-resize': CustomEvent<{ height: number }>;
}

type HostMessage =
  | { channel: 'lyra-mcp-app'; version: 1; type: 'host-context'; context: unknown }
  | { channel: 'lyra-mcp-app'; version: 1; type: 'tool-result'; requestId: string; result?: unknown; error?: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cspSources(values: readonly string[] | undefined): string[] {
  return (values ?? []).flatMap((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:' ? [url.origin] : [];
    } catch {
      return [];
    }
  });
}

function buildCsp(csp: McpAppCsp | undefined): string {
  const resources = cspSources(csp?.resourceDomains);
  const connections = cspSources(csp?.connectDomains);
  const frames = cspSources(csp?.frameDomains);
  return [
    `default-src 'none'`,
    `script-src 'unsafe-inline'`,
    `style-src 'unsafe-inline'`,
    `img-src data: blob: ${resources.join(' ')}`.trim(),
    `font-src data: ${resources.join(' ')}`.trim(),
    `media-src data: blob: ${resources.join(' ')}`.trim(),
    `connect-src ${connections.length ? connections.join(' ') : "'none'"}`,
    `frame-src ${frames.length ? frames.join(' ') : "'none'"}`,
    `base-uri 'none'`,
    `form-action 'none'`,
  ].join('; ');
}

function withCsp(htmlSource: string, csp: McpAppCsp | undefined): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${buildCsp(csp)}">`;
  return /<head(?:\s[^>]*)?>/i.test(htmlSource)
    ? htmlSource.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${meta}`)
    : `${meta}${htmlSource}`;
}

function permissionPolicy(permissions: McpAppPermissions | undefined): string {
  const enabled = [
    permissions?.camera ? 'camera' : '',
    permissions?.microphone ? 'microphone' : '',
    permissions?.geolocation ? 'geolocation' : '',
    permissions?.clipboardRead ? 'clipboard-read' : '',
    permissions?.clipboardWrite ? 'clipboard-write' : '',
  ].filter(Boolean);
  return enabled.map((permission) => `${permission} 'none'`).join('; ');
}

/**
 * `<lr-mcp-app>` — hosts an MCP App-style executable UI resource in a uniquely-origin sandbox.
 * The frame can request tools, messages, links, logs, and resizing only through typed events;
 * the component never performs those external actions itself.
 *
 * @customElement lr-mcp-app
 * @event lr-mcp-ready - The frame loaded. `detail: { uri }`.
 * @event lr-mcp-tool-call - The frame requested a tool. `detail: { requestId?, name, args }`.
 * @event lr-mcp-send-message - The frame requested a conversation message.
 * @event lr-mcp-open-link - The frame requested navigation; the host decides whether to honor it.
 * @event lr-mcp-log - The frame sent a diagnostic value.
 * @event lr-mcp-resize - The frame requested a clamped height.
 * @csspart base - The sandbox frame wrapper.
 * @csspart frame - The sandboxed iframe.
 * @csspart loading - The pre-load status.
 * @csspart error - The invalid-resource error.
 */
export class LyraMcpApp extends LyraElement<LyraMcpAppEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) resource: McpAppResource | null = null;
  @property({ type: Number }) height = 320;
  @property({ type: Number, attribute: 'max-height' }) maxHeight = 800;
  @property() label = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @state() private loaded = false;
  @state() private frameHeight = 320;
  @query('iframe') private frame?: HTMLIFrameElement;

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('message', this.onMessage);
  }

  override disconnectedCallback(): void {
    window.removeEventListener('message', this.onMessage);
    this.loaded = false;
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('resource') || changed.has('height') || changed.has('maxHeight')) {
      this.loaded = false;
      this.frameHeight = finiteRange(this.height, 320, 120, finiteRange(this.maxHeight, 800, 120, 10_000));
    }
  }

  private expectedOrigin(): string | null {
    if (this.resource?.html) return 'null';
    const src = safeMediaSrc(this.resource?.src);
    if (!src) return null;
    try {
      return new URL(src, document.baseURI).origin;
    } catch {
      return null;
    }
  }

  private onLoad(): void {
    this.loaded = true;
    this.emit('lr-mcp-ready', { uri: this.resource?.uri ?? '' });
    this.postHostContext({
      resource: {
        uri: this.resource?.uri,
        metadata: this.resource?.metadata,
      },
      locale: this.locale || document.documentElement.lang,
      direction: this.effectiveDirection,
    });
  }

  private onMessage = (event: MessageEvent): void => {
    if (!this.frame?.contentWindow || event.source !== this.frame.contentWindow) return;
    const expectedOrigin = this.expectedOrigin();
    if (expectedOrigin && event.origin !== expectedOrigin) return;
    const message = record(event.data);
    if (message?.['channel'] !== 'lyra-mcp-app' || message['version'] !== 1 || typeof message['type'] !== 'string') return;
    switch (message['type']) {
      case 'resize': {
        const requested = typeof message['height'] === 'number' ? message['height'] : this.height;
        const height = finiteRange(requested, this.height, 120, finiteRange(this.maxHeight, 800, 120, 10_000));
        this.frameHeight = height;
        this.emit('lr-mcp-resize', { height });
        break;
      }
      case 'tool-call':
        if (typeof message['name'] === 'string') {
          this.emit('lr-mcp-tool-call', {
            requestId: typeof message['requestId'] === 'string' ? message['requestId'] : undefined,
            name: message['name'],
            args: message['args'],
          });
        }
        break;
      case 'send-message':
        this.emit('lr-mcp-send-message', { message: message['message'] });
        break;
      case 'open-link':
        if (typeof message['href'] === 'string') this.emit('lr-mcp-open-link', { href: message['href'] });
        break;
      case 'log':
        this.emit('lr-mcp-log', {
          level: typeof message['level'] === 'string' ? message['level'] : 'info',
          value: message['value'],
        });
        break;
    }
  };

  private post(message: HostMessage): void {
    const target = this.frame?.contentWindow;
    if (!target) return;
    const origin = this.expectedOrigin();
    target.postMessage(message, origin && origin !== 'null' ? origin : '*');
  }

  postHostContext(context: unknown): void {
    this.post({ channel: 'lyra-mcp-app', version: 1, type: 'host-context', context });
  }

  postToolResult(requestId: string, result?: unknown, error?: string): void {
    this.post({
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-result',
      requestId,
      ...(result !== undefined ? { result } : {}),
      ...(error ? { error } : {}),
    });
  }

  override render(): TemplateResult {
    const resource = this.resource;
    const src = safeMediaSrc(resource?.src);
    const valid = Boolean(resource && (resource.html || src));
    const label = this.accessibleLabel || this.label || resource?.title || this.localize('mcpAppLabel');
    if (!valid) {
      return html`<div part="base"><p part="error" role="alert">${this.localize('mcpAppUnavailable')}</p></div>`;
    }
    return html`<div part="base">
      ${this.loaded ? nothing : html`<p part="loading" role="status">${this.localize('mcpAppLoading')}</p>`}
      <iframe
        part="frame"
        title=${label}
        sandbox="allow-forms allow-scripts"
        allow=${permissionPolicy(resource?.permissions)}
        src=${resource?.html ? nothing : src ?? nothing}
        .srcdoc=${resource?.html ? withCsp(resource.html, resource.csp) : ''}
        style=${`height: ${this.frameHeight}px`}
        @load=${this.onLoad}
      ></iframe>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-mcp-app': LyraMcpApp;
  }
}
