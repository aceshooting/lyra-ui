import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { keyed } from 'lit/directives/keyed.js';
import { finiteRange } from '../../../internal/numbers.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { styles } from './mcp-app.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_mcpAppLabel, LYRA_DEFAULT_mcpAppLoading, LYRA_DEFAULT_mcpAppUnavailable, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
  return enabled.map((permission) => `${permission} *`).join('; ');
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
 * @status stable
 * @since 7.0.0
 */
export class LyraMcpApp extends LyraElement<LyraMcpAppEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    mcpAppLabel: LYRA_DEFAULT_mcpAppLabel,
    mcpAppLoading: LYRA_DEFAULT_mcpAppLoading,
    mcpAppUnavailable: LYRA_DEFAULT_mcpAppUnavailable,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) resource: McpAppResource | null = null;
  @property({ type: Number }) height = 320;
  @property({ type: Number, attribute: 'max-height' }) maxHeight = 800;
  @property() label = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @state() private loaded = false;
  @state() private frameHeight = 320;
  private frameGeneration = 0;
  @query('iframe') private frame?: HTMLIFrameElement;
  private loadingAnnouncementSink?: AnnouncementSink;
  private errorAnnouncementSink?: AnnouncementSink;
  private suppressNextResourceAnnouncement = true;
  private messageWindow?: Window;

  private resourceAvailable(resource: McpAppResource | null | undefined): boolean {
    return Boolean(resource && (resource.html || safeMediaSrc(resource.src)));
  }

  private syncAnnouncementSinks(): void {
    if (!this.isConnected) return;
    const heldDocument = this.loadingAnnouncementSink?.element.ownerDocument;
    if (
      heldDocument === this.ownerDocument &&
      this.errorAnnouncementSink?.element.ownerDocument === this.ownerDocument
    ) return;
    this.loadingAnnouncementSink?.release();
    this.errorAnnouncementSink?.release();
    this.loadingAnnouncementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.errorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSinks();
    if (this.hasUpdated) {
      // Snapshot the resource already present at reconnect before announcing later replacements.
      // This also suppresses a resource write queued while the element was detached.
      this.suppressNextResourceAnnouncement = true;
      this.requestUpdate();
    }
    this.bindMessageWindow();
  }

  override disconnectedCallback(): void {
    this.unbindMessageWindow();
    this.loaded = false;
    this.loadingAnnouncementSink?.release();
    this.errorAnnouncementSink?.release();
    this.loadingAnnouncementSink = undefined;
    this.errorAnnouncementSink = undefined;
    this.suppressNextResourceAnnouncement = true;
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    this.syncAnnouncementSinks();
    this.bindMessageWindow();
  }

  private bindMessageWindow(): void {
    const nextWindow = this.isConnected ? this.ownerDocument.defaultView : null;
    if (this.messageWindow === nextWindow) return;
    this.unbindMessageWindow();
    this.messageWindow = nextWindow ?? undefined;
    this.messageWindow?.addEventListener('message', this.onMessage);
  }

  private unbindMessageWindow(): void {
    this.messageWindow?.removeEventListener('message', this.onMessage);
    this.messageWindow = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('resource')) {
      if (this.hasUpdated && !this.suppressNextResourceAnnouncement) {
        const wasAvailable = this.resourceAvailable(changed.get('resource') as McpAppResource | null | undefined);
        const isAvailable = this.resourceAvailable(this.resource);
        // Every valid resource replacement starts a fresh frame load. An unavailable transition is
        // assertive, while the ordinary loading state is polite; neither resting state announces on
        // initial mount.
        if (isAvailable) this.loadingAnnouncementSink?.announce(this.localize('mcpAppLoading'));
        else if (wasAvailable) this.errorAnnouncementSink?.announce(this.localize('mcpAppUnavailable'));
      }
      this.loaded = false;
      this.frameGeneration++;
    }
    if (changed.has('resource') || changed.has('height') || changed.has('maxHeight')) {
      this.frameHeight = finiteRange(
        this.height,
        320,
        120,
        finiteRange(this.maxHeight, 800, 120, 10_000),
      );
    }
  }

  protected override updated(_changed: PropertyValues<this>): void {
    this.suppressNextResourceAnnouncement = false;
  }

  private expectedOrigin(): 'null' | null {
    if (this.resource?.html) return 'null';
    const src = safeMediaSrc(this.resource?.src);
    if (!src) return null;
    // The frame intentionally omits allow-same-origin. Both srcdoc and network documents
    // therefore have an opaque origin serialized as "null"; the contentWindow identity is
    // the authentication boundary that distinguishes this frame from every other opaque frame.
    return 'null';
  }

  private onLoad(): void {
    this.loaded = true;
    this.emit('lr-mcp-ready', { uri: this.resource?.uri ?? '' });
    this.postHostContext({
      resource: {
        uri: this.resource?.uri,
        metadata: this.resource?.metadata,
      },
      locale: this.effectiveLocale,
      direction: this.effectiveDirection,
    });
  }

  private onMessage = (event: MessageEvent): void => {
    if (event.currentTarget !== this.messageWindow) return;
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
    target.postMessage(message, origin === 'null' ? '*' : origin ?? '*');
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
      return html`<div part="base"><p part="error">${this.localize('mcpAppUnavailable')}</p></div>`;
    }
    return html`<div part="base">
      ${this.loaded ? nothing : html`<p part="loading">${this.localize('mcpAppLoading')}</p>`}
      ${keyed(
        this.frameGeneration,
        html`<iframe
          part="frame"
          title=${label}
          sandbox="allow-forms allow-scripts"
          allow=${permissionPolicy(resource?.permissions)}
          src=${resource?.html ? nothing : src ?? nothing}
          .srcdoc=${resource?.html ? withCsp(resource.html, resource.csp) : nothing}
          style=${styleMap({ height: `${this.frameHeight}px` })}
          @load=${this.onLoad}
        ></iframe>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-mcp-app': LyraMcpApp;
  }
}
