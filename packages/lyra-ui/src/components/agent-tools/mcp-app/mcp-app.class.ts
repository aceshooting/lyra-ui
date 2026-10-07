import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type ComplexAttributeConverter, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { keyed } from 'lit/directives/keyed.js';
import { finiteRange } from '../../../internal/numbers.js';
import { resolveCssLength } from '../../../internal/css-length.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeFrameSrc } from '../../../internal/safe-url.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
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
  readonly permissions?: McpAppPermissions;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** An executable app resource with exactly one document source. */
export type McpAppResource = McpAppResourceBase & (
  | {
      /** Executable app document. It is assigned only to a uniquely-origin sandboxed iframe. */
      readonly html: string;
      readonly src?: never;
      readonly csp?: McpAppCsp;
    }
  | {
      /** HTTP(S) or relative app URL; its own server's CSP governs it, so it takes no `csp`. */
      readonly src: string;
      readonly html?: never;
      readonly csp?: never;
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

/** Equal app documents (`title` aside) keep the mounted frame, its port and pending replies. */
function sameAppDocument(a: ResolvedMcpAppResource | null, b: ResolvedMcpAppResource | null): boolean {
  if (!a || !b || a.uri !== b.uri || a.html !== b.html || a.src !== b.src) return false;
  const policy = ({ csp, permissions, metadata }: McpAppResource): string =>
    JSON.stringify([csp, permissions, metadata]);
  try {
    return policy(a.resource) === policy(b.resource);
  } catch {
    return false;
  }
}

/** A plain DNS or IP host; anything else (a quote, a semicolon) could reshape the trusted policy. */
const CSP_HOST = /^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:.]+\])$/i;

function cspSources(values: readonly string[] | undefined): string[] {
  return (values ?? []).flatMap((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') && CSP_HOST.test(url.hostname)
        ? [url.origin]
        : [];
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

/** Absolute http(s)/mailto only: a relative href would resolve against the host page. */
function absoluteLinkHref(value: unknown): string | null {
  try {
    const url = new URL(typeof value === 'string' ? value : '');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Parses `height`/`max-height`: a numeric attribute stays the number it always was, and anything
 *  else is kept as a CSS length string for `resolveCssLength()`. */
const heightAttributeConverter: ComplexAttributeConverter<number | string | null> = {
  fromAttribute(value: string | null): number | string | null {
    if (value === null) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value.trim();
  },
};

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
 * Remote resources accept only relative and HTTP(S) document URLs and never send a referrer;
 * `csp` applies to inline resources only. An equal resource record assigned again keeps the frame.
 * The frame can request tools, messages, links, logs, and resizing only through typed events;
 * the component never performs those external actions itself. The initial host context transfers
 * a document-bound message port and nonce; later host messages stay on that port, and a navigation
 * invalidates both before the iframe is remounted.
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
 * @event lr-mcp-open-link - The frame requested navigation to an absolute http(s) or mailto URL;
 *   the host decides whether to honor it.
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
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['resource']);

  static override styles = [LyraElement.styles, styles];

  /** Clone-owned resource snapshot. Reassign a new record after changing its CSP collections. */
  @property({ attribute: false }) resource: McpAppResource | null = null;
  /** Initial frame height: a number of pixels, or a CSS length in `px`, `rem`, `em`, `vw` or `vh`
   *  (resolved when set). Clamped to at least 120px and at most `max-height`; an unresolvable value
   *  uses the 320px default. */
  @property({ converter: heightAttributeConverter }) height: number | string = 320;
  /** Upper bound for `height` and for the frame's own resize requests: a number of pixels, or a CSS
   *  length in `px`, `rem`, `em`, `vw` or `vh` (resolved when set). Clamped to 120px-10000px; an
   *  unresolvable value uses the 800px default. */
  @property({ attribute: 'max-height', converter: heightAttributeConverter }) maxHeight: number | string = 800;
  /** Purpose-specific iframe title used ahead of the resource title and localized fallback. */
  @property() label = '';
  /** Programmatic iframe title when no authored host `aria-label` attribute is present. An empty
   *  value cannot leave the executable frame unnamed. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @state() private loaded = false;
  @state() private frameHeight = 320;
  private frameGeneration = 0;
  @query('iframe') private frame?: HTMLIFrameElement;
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite', 'assertive'] });
  private suppressNextResourceAnnouncement = true;
  /** Secret bound to the currently loaded document. It never crosses a navigation. */
  private frameNonce?: string;
  private framePort?: MessagePort;
  private bootstrapPort?: { frame: HTMLIFrameElement; port: MessagePort };

  private resourceAvailable(resource: McpAppResource | null | undefined): boolean {
    return resolveResource(resource) !== null;
  }

  private invalidateFrame(): void {
    this.closeFramePort();
    this.bootstrapPort?.port.close();
    this.bootstrapPort = undefined;
    this.frameNonce = this.resourceAvailable(this.resource) ? this.createFrameNonce() : undefined;
    this.loaded = false;
    this.frameGeneration++;
    this.requestUpdate();
  }

  private closeFramePort(): void {
    this.framePort?.removeEventListener('message', this.onPortMessage);
    this.framePort?.close();
    this.framePort = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      // Snapshot the resource already present at reconnect before announcing later replacements.
      // This also suppresses a resource write queued while the element was detached.
      this.suppressNextResourceAnnouncement = true;
      this.requestUpdate();
    }
  }

  override disconnectedCallback(): void {
    this.invalidateFrame();
    this.suppressNextResourceAnnouncement = true;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.invalidateFrame();
    this.announcements.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const keptFrame = changed.has('resource') && this.hasUpdated && sameAppDocument(
      resolveResource(changed.get('resource') as McpAppResource | null | undefined),
      resolveResource(this.resource),
    );
    if (changed.has('resource') && !keptFrame) {
      if (this.hasUpdated && !this.suppressNextResourceAnnouncement) {
        const wasAvailable = this.resourceAvailable(
          changed.get('resource') as McpAppResource | null | undefined,
        );
        const isAvailable = this.resourceAvailable(this.resource);
        // Every valid resource replacement starts a fresh frame load. An unavailable transition is
        // assertive, while the ordinary loading state is polite; neither resting state announces on
        // initial mount.
        if (isAvailable) this.announcements.announcePolite(this.localize('mcpAppLoading'));
        else if (wasAvailable) this.announcements.announceAssertive(this.localize('mcpAppUnavailable'));
      }
      this.loaded = false;
      this.closeFramePort();
      this.bootstrapPort?.port.close();
      this.bootstrapPort = undefined;
      this.frameNonce = this.resourceAvailable(this.resource) ? this.createFrameNonce() : undefined;
      this.frameGeneration++;
    }
    if ((changed.has('resource') && !keptFrame) || changed.has('height') || changed.has('maxHeight')) {
      this.frameHeight = finiteRange(this.heightPx(), 320, 120, this.maxHeightPx());
    }
  }

  protected override updated(_changed: PropertyValues<this>): void {
    super.updated(_changed);
    this.suppressNextResourceAnnouncement = false;
  }

  private createFrameNonce(): string {
    return crypto.randomUUID();
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
    if (!currentResource || (currentResource.resource !== resource.resource && !sameAppDocument(currentResource, resource))) return;
    // A second load on the same iframe is a navigation inside the sandbox. The WindowProxy is
    // stable across that navigation, so source/origin checks alone would continue trusting the
    // new document. Drop the port and remount before it can receive any host data.
    if (this.loaded) {
      this.invalidateFrame();
      return;
    }
    this.frameNonce ??= this.createFrameNonce();
    const frame = event.currentTarget as HTMLIFrameElement;
    const port = new MessageChannel();
    this.framePort = port.port1;
    this.framePort.addEventListener('message', this.onPortMessage);
    this.framePort.start();
    this.loaded = true;
    this.bootstrapPort = { frame, port: port.port2 };
    this.postHostContext({
      resource: {
        uri: resource.uri,
        metadata: resource.resource.metadata,
      },
      locale: this.effectiveLocale,
      direction: this.effectiveDirection,
    });
    // A test or consumer subclass may override postHostContext(). Do not leave an untransferred
    // port entangled with the host in that case.
    this.bootstrapPort?.port.close();
    this.bootstrapPort = undefined;
    this.emit('lr-mcp-ready', { uri: resource.uri });
  }

  /** The only inbound channel: window messages are never read. */
  private onPortMessage = (event: MessageEvent): void => {
    this.handleMessage(event.data);
  };

  /** `height` in pixels, or `NaN` (the numeric fallback path) when it does not resolve. Relative
   *  units read the live root/host font size and viewport on every call. */
  private heightPx(): number {
    return resolveCssLength(this.height, { host: this }) ?? Number.NaN;
  }

  /** `max-height` in pixels, clamped to 120px-10000px, with the 800px default for an unresolvable
   *  value. */
  private maxHeightPx(): number {
    return finiteRange(resolveCssLength(this.maxHeight, { host: this }) ?? Number.NaN, 800, 120, 10_000);
  }

  private handleMessage(data: unknown): void {
    const message = record(data);
    if (typeof this.frameNonce !== 'string' || message?.['nonce'] !== this.frameNonce) return;
    if (message?.['channel'] !== 'lyra-mcp-app' || message['version'] !== 1 || typeof message['type'] !== 'string') return;
    switch (message['type']) {
      case 'resize': {
        const requested = typeof message['height'] === 'number' ? message['height'] : this.heightPx();
        const height = finiteRange(requested, this.heightPx(), 120, this.maxHeightPx());
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
          const href = absoluteLinkHref(message['href']);
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

  private post(
    message: HostMessage,
    frame: HTMLIFrameElement | undefined = this.frame,
    transferPort?: MessagePort,
  ): void {
    const nonce = this.frameNonce;
    if (typeof nonce !== 'string') return;
    if (transferPort) {
      const target = frame?.contentWindow;
      if (!target) return;
      target.postMessage({ ...message, nonce }, '*', [transferPort]);
      return;
    }
    this.framePort?.postMessage({ ...message, nonce });
  }

  postHostContext(context: unknown): void {
    const bootstrap = this.bootstrapPort;
    this.bootstrapPort = undefined;
    this.post(
      { channel: 'lyra-mcp-app', version: 1, type: 'host-context', context },
      bootstrap?.frame,
      bootstrap?.port,
    );
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
