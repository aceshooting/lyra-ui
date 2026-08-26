import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { keyed } from 'lit/directives/keyed.js';
import { finiteRange } from '../../../internal/numbers.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeFrameSrc, safeLinkHref } from '../../../internal/safe-url.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { styles } from './mcp-app.styles.js';
import { purposeAccessibleLabel } from '../semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_mcpAppLabel, LYRA_DEFAULT_mcpAppLoading, LYRA_DEFAULT_mcpAppUnavailable } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface McpAppPermissions {
  readonly camera?: boolean;
  readonly microphone?: boolean;
  readonly geolocation?: boolean;
  readonly clipboardRead?: boolean;
  readonly clipboardWrite?: boolean;
}

export interface McpAppCsp {
  readonly connectDomains?: readonly string[];
  readonly resourceDomains?: readonly string[];
  readonly frameDomains?: readonly string[];
}

interface McpAppResourceBase {
  readonly uri: string;
  readonly title?: string;
  readonly csp?: McpAppCsp;
  readonly permissions?: McpAppPermissions;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** An executable app resource with exactly one document source. */
export type McpAppResource = McpAppResourceBase & (
  | {
      /** Executable app document. It is assigned only to a uniquely-origin sandboxed iframe. */
      readonly html: string;
      readonly src?: never;
    }
  | {
      /** HTTP(S) or relative app URL served as a separate resource. */
      readonly src: string;
      readonly html?: never;
    }
);

export interface McpAppToolCallDetail {
  requestId?: string;
  name: string;
  args: unknown;
  /** Opaque, monotonically increasing id of the frame generation that raised this request. Every
   *  valid `resource` replacement, adoption, or reconnect starts a fresh generation, so a host
   *  that hands this value back to `postToolResult()` has its asynchronous reply dropped instead
   *  of delivered into whatever unrelated app is mounted by the time it resolves. */
  frameGeneration: number;
}

export type McpAppToolResultOptions =
  | { frameGeneration: number; result: unknown; error?: never }
  | { frameGeneration: number; error: string; result?: never };

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
  | {
      channel: 'lyra-mcp-app';
      version: 1;
      type: 'tool-result';
      requestId: string;
      result?: unknown;
      error?: string;
    };

interface ResolvedMcpAppResource {
  resource: McpAppResource;
  uri: string;
  html?: string;
  src?: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function resolveResource(resource: McpAppResource | null | undefined): ResolvedMcpAppResource | null {
  const value = record(resource);
  if (!value || typeof value['uri'] !== 'string') return null;
  const uri = value['uri'].trim();
  if (!uri) return null;

  const ownsHtml = Object.prototype.hasOwnProperty.call(value, 'html');
  const ownsSrc = Object.prototype.hasOwnProperty.call(value, 'src');
  if (ownsHtml === ownsSrc) return null;

  if (ownsHtml) {
    if (typeof value['html'] !== 'string' || value['html'].length === 0) return null;
    return { resource: resource!, uri, html: value['html'] };
  }

  const src = safeFrameSrc(value['src']);
  return src ? { resource: resource!, uri, src } : null;
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
  // Trusted policy bytes must precede every caller-controlled token. Searching for a textual
  // <head> lets a decoy inside a comment or script string capture the insertion, leaving the real
  // document unrestricted. The HTML parser implicitly creates the head for this leading meta;
  // any later doctype/head tokens from the app cannot retroactively weaken an enforced policy.
  return `${meta}${htmlSource}`;
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
 * Inline resources receive a trusted leading CSP meta before any caller-controlled HTML token, so
 * comments or script strings cannot redirect policy insertion away from the parsed document head.
 * Remote resources accept only relative and HTTP(S) document URLs and never send a referrer.
 * The frame can request tools, messages, links, logs, and resizing only through typed events;
 * the component never performs those external actions itself.
 * Resource records and nested CSP/metadata collections are bounded clone-owned readonly
 * snapshots. Create and reassign a new resource record after changes.
 *
 * @customElement lr-mcp-app
 * @event lr-mcp-ready - The frame loaded. `detail: { uri }`.
 * @event lr-mcp-tool-call - The frame requested a tool.
 *   `detail: { requestId?, name, args, frameGeneration }`. `frameGeneration` is an opaque id for
 *   the frame that raised the request; hand it back in `postToolResult()`'s options so an
 *   asynchronous reply arriving after the frame changes is dropped rather than delivered into the
 *   unrelated app now mounted.
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
    mcpAppLabel: LYRA_DEFAULT_mcpAppLabel,
    mcpAppLoading: LYRA_DEFAULT_mcpAppLoading,
    mcpAppUnavailable: LYRA_DEFAULT_mcpAppUnavailable,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['resource']);

  static override styles = [LyraElement.styles, styles];

  /** Clone-owned resource snapshot. Reassign a new record after changing its CSP collections. */
  @property({ attribute: false }) resource: McpAppResource | null = null;
  @property({ type: Number }) height = 320;
  @property({ type: Number, attribute: 'max-height' }) maxHeight = 800;
  /** Purpose-specific iframe title used ahead of the resource title and localized fallback. */
  @property() label = '';
  /** Programmatic iframe title when no authored host `aria-label` attribute is present. An empty
   *  value cannot leave the executable frame unnamed. */
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
    return resolveResource(resource) !== null;
  }

  private invalidateFrame(): void {
    this.loaded = false;
    this.frameGeneration++;
    this.requestUpdate();
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
    this.invalidateFrame();
    this.loadingAnnouncementSink?.release();
    this.errorAnnouncementSink?.release();
    this.loadingAnnouncementSink = undefined;
    this.errorAnnouncementSink = undefined;
    this.suppressNextResourceAnnouncement = true;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.invalidateFrame();
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
    super.willUpdate(changed);
    if (changed.has('resource')) {
      if (this.hasUpdated && !this.suppressNextResourceAnnouncement) {
        const wasAvailable = this.resourceAvailable(
          changed.get('resource') as McpAppResource | null | undefined,
        );
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
    super.updated(_changed);
    this.suppressNextResourceAnnouncement = false;
  }

  private expectedOrigin(): 'null' | null {
    if (!resolveResource(this.resource)) return null;
    // The frame intentionally omits allow-same-origin. Both srcdoc and network documents
    // therefore have an opaque origin serialized as "null"; the contentWindow identity is
    // the authentication boundary that distinguishes this frame from every other opaque frame.
    return 'null';
  }

  private onLoad(
    event: Event,
    frameGeneration: number,
    resource: ResolvedMcpAppResource,
  ): void {
    if (
      !this.isConnected ||
      frameGeneration !== this.frameGeneration ||
      event.currentTarget !== this.frame
    ) return;
    const currentResource = resolveResource(this.resource);
    if (!currentResource || currentResource.resource !== resource.resource) return;
    this.loaded = true;
    this.emit('lr-mcp-ready', { uri: resource.uri });
    this.postHostContext({
      resource: {
        uri: resource.uri,
        metadata: resource.resource.metadata,
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
            frameGeneration: this.frameGeneration,
          });
        }
        break;
      case 'send-message':
        this.emit('lr-mcp-send-message', { message: message['message'] });
        break;
      case 'open-link':
        {
          const href = safeLinkHref(message['href']);
          if (href) this.emit('lr-mcp-open-link', { href });
        }
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
    // The sandbox never grants `allow-same-origin`, so a resolved resource's frame always carries
    // a forced-opaque origin, whether it came from `html` or `src`; `expectedOrigin()` above can
    // only ever return `'null' | null`, never a real origin. A strict outbound targetOrigin check
    // is therefore unreachable as long as the sandbox omits `allow-same-origin` -- there is no
    // known origin to restrict to, and the platform rejects the literal string `"null"` as a
    // *outbound* postMessage() targetOrigin (only `'*'` or a value that parses as an absolute URL
    // is accepted; `new URL('null')` throws), so passing `expectedOrigin()`'s result straight
    // through would throw a `SyntaxError` on every real send. `target.postMessage(message, '*')`
    // below is therefore not a strict-origin fix -- closing this down for real would mean granting
    // `allow-same-origin` (a materially larger sandbox-escape tradeoff, out of scope here) so the
    // frame's origin becomes a real, checkable value instead of always-opaque. What this line does
    // keep as the actual security boundary is `target` itself, re-resolved from the live DOM on
    // every call, so a stale or foreign window can never receive a message meant for the current
    // frame generation.
    target.postMessage(message, '*');
  }

  postHostContext(context: unknown): void {
    this.post({ channel: 'lyra-mcp-app', version: 1, type: 'host-context', context });
  }

  /** Resolves a prior `lr-mcp-tool-call`. The required frame generation binds the asynchronous
   * reply to the frame that requested it; stale, uncorrelated, and ambiguous replies fail closed. */
  postToolResult(requestId: string, options: McpAppToolResultOptions): void {
    const value = record(options);
    if (typeof requestId !== 'string' || !requestId.trim() || !value) return;
    const frameGeneration = value['frameGeneration'];
    if (
      typeof frameGeneration !== 'number' ||
      !Number.isSafeInteger(frameGeneration) ||
      frameGeneration !== this.frameGeneration
    ) return;
    const hasResult = Object.prototype.hasOwnProperty.call(value, 'result');
    const hasError = Object.prototype.hasOwnProperty.call(value, 'error');
    if (hasResult === hasError) return;
    if (hasError && (typeof value['error'] !== 'string' || !value['error'].trim())) return;
    this.post({
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-result',
      requestId,
      ...(hasResult ? { result: value['result'] } : {}),
      ...(hasError ? { error: value['error'] as string } : {}),
    });
  }

  override render(): TemplateResult {
    const resource = resolveResource(this.resource);
    if (!resource) {
      return html`<div part="base"><p part="error">${this.localize('mcpAppUnavailable')}</p></div>`;
    }
    const propertyLabel = !this.hasAttribute('aria-label') && typeof this.accessibleLabel === 'string'
      ? this.accessibleLabel
      : '';
    const fallbackLabel = propertyLabel || this.label || resource.resource.title || this.localize('mcpAppLabel');
    const label = purposeAccessibleLabel(this, fallbackLabel);
    const frameGeneration = this.frameGeneration;
    return html`<div part="base">
      ${this.loaded ? nothing : html`<p part="loading">${this.localize('mcpAppLoading')}</p>`}
      ${keyed(
        frameGeneration,
        html`<iframe
          part="frame"
          title=${label}
          sandbox="allow-forms allow-scripts"
          referrerpolicy="no-referrer"
          allow=${permissionPolicy(resource.resource.permissions)}
          src=${resource.src ?? nothing}
          .srcdoc=${resource.html ? withCsp(resource.html, resource.resource.csp) : nothing}
          style=${styleMap({ height: `${this.frameHeight}px` })}
          @load=${(event: Event) => this.onLoad(event, frameGeneration, resource)}
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
