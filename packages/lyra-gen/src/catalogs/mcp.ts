import type { JsonValue, LyraGenActionDefinition, LyraGenCatalog, LyraGenComponent, LyraGenSchema } from '../types.js';
import { documentation, label, scalar } from './shared.js';

/** A host-reviewed MCP App document. Generated content can only pick one by its id. */
export interface LyraGenMcpAppResource {
  /** Logical resource identity; must be a `ui://` URI. */
  readonly uri: string;
  readonly title?: string;
  /** Inline executable document, mutually exclusive with `src`. */
  readonly html?: string;
  /** Relative or HTTP(S) document URL reviewed by the host, mutually exclusive with `html`. */
  readonly src?: string;
  /** Sandbox CSP origins for an inline document (`resourceDomains`, `connectDomains`, `frameDomains`, `baseUriDomains`). */
  readonly csp?: Readonly<Record<string, readonly string[]>>;
  /** Browser permissions the sandbox may grant; all denied when omitted. */
  readonly permissions?: Readonly<Record<string, boolean>>;
  /** Shown to the model when choosing among resources. */
  readonly description?: string;
}

/** Host-owned MCP App configuration. Nothing here reaches the prompt except resource ids, descriptions and tool names. */
export interface LyraGenMcpAppOptions {
  /** Allowlisted apps by id (1-32 ids, `[a-z][a-z0-9-]*`); the only documents generated content can select. */
  readonly resources: Readonly<Record<string, LyraGenMcpAppResource>>;
  /** Tool names the app may request through an action; the host still executes and authorizes each call. */
  readonly tools?: readonly string[];
  /** Require `lr-gen-view.confirmAction` before every tool-call action. Defaults to true. */
  readonly confirmToolCalls?: boolean;
  /** Wire protocol; defaults to the legacy bridge. */
  readonly protocol?: 'legacy' | 'mcp-apps';
  /** Host capability grants for `protocol: 'mcp-apps'`; never generated. */
  readonly hostCapabilities?: Readonly<Record<string, unknown>>;
}

/** The app's requested tool and arguments become the action payload; the action schema then admits only allowlisted tools and bounded input. */
function toolCallPayload(event: Event): JsonValue | undefined {
  const detail = (event as CustomEvent<{ readonly name?: unknown; readonly args?: unknown }>).detail;
  if (!detail || typeof detail.name !== 'string') throw new TypeError('Tool requests need a tool name.');
  return detail.args === undefined ? { tool: detail.name } : { tool: detail.name, input: detail.args as JsonValue };
}

/** Name of the catalog action an app's tool request initiates. */
export const mcpToolCallAction = 'mcp-tool-call';

const idPattern = /^[a-z][a-z0-9-]*$/u;
const input: LyraGenSchema = { type: 'object', properties: {}, additionalProperties: scalar, maxProperties: 32, propertyNames: { maxLength: 64 } };

interface Admitted { readonly resources: ReadonlyMap<string, Readonly<Record<string, unknown>>>; readonly descriptions: readonly string[]; readonly tools: readonly string[] }
function admit(options: LyraGenMcpAppOptions): Admitted {
  const entries = options?.resources && typeof options.resources === 'object' ? Object.entries(options.resources) : [];
  if (entries.length === 0 || entries.length > 32) throw new TypeError('An MCP app catalog needs 1-32 host-reviewed resources.');
  const resources = new Map<string, Readonly<Record<string, unknown>>>();
  const descriptions: string[] = [];
  for (const [id, entry] of entries) {
    const hasHtml = typeof entry?.html === 'string' && entry.html.length > 0, hasSrc = typeof entry?.src === 'string' && entry.src.length > 0;
    if (!idPattern.test(id) || id.length > 64 || typeof entry?.uri !== 'string' || !entry.uri.startsWith('ui://') || entry.uri.length <= 5 || hasHtml === hasSrc || (hasSrc && entry.csp !== undefined)) {
      throw new TypeError('Every MCP app resource needs a lowercase id, a ui:// uri and exactly one of html or src (src takes no csp).');
    }
    const { description, ...resource } = entry;
    resources.set(id, Object.freeze(structuredClone(resource) as Record<string, unknown>));
    descriptions.push(`${id}${description ? ` (${description.slice(0, 120)})` : ''}`);
  }
  const tools = [...(options.tools ?? [])];
  if (tools.length > 64 || tools.some(tool => typeof tool !== 'string' || !tool || tool.length > 128) || new Set(tools).size !== tools.length) throw new TypeError('MCP app tools must be 0-64 unique names.');
  return { resources, descriptions, tools: Object.freeze(tools) as readonly string[] };
}

/** The `mcp-app` role: a sandboxed host-allowlisted app plus bounded input; tool requests become actions. */
export function mcpAppComponent(options: LyraGenMcpAppOptions): LyraGenComponent {
  const { resources, descriptions, tools } = admit(options);
  const protocol = options.protocol === 'mcp-apps' ? 'mcp-apps' : 'legacy';
  const hostCapabilities = Object.freeze(structuredClone(options.hostCapabilities ?? {}));
  return {
    tag: 'lr-mcp-app',
    properties: { app: { type: 'string', enum: [...resources.keys()] }, label, input },
    required: ['app', 'label'],
    accessibleName: { required: true, properties: ['label'] },
    ...(tools.length ? { events: ['lr-mcp-tool-call'], eventPayload: toolCallPayload } : {}),
    hostProperties: ['resource', 'protocol', 'hostCapabilities'],
    prepareProperties: (props: Readonly<Record<string, JsonValue>>) => {
      const resource = resources.get(String(props['app']));
      if (!resource) throw new TypeError('Unknown MCP app.');
      const generated = props['input'];
      return {
        label: props['label'],
        resource: { ...resource, ...(generated === undefined ? {} : { metadata: { toolInput: structuredClone(generated) } }) },
        protocol,
        hostCapabilities,
      };
    },
    minimumBlockSize: '12rem',
    useWhen: `Embed one reviewed interactive app (${descriptions.join('; ')}) and optionally pass bounded scalar input for it${tools.length ? `; the app may request these tools only through the declared action: ${tools.join(', ')}` : ''}.`,
    examples: [{ id: 'app', type: 'mcp-app', props: { app: [...resources.keys()][0]!, label: 'Interactive app' } }],
    load: () => import('@aceshooting/lyra-ui/components/lr-mcp-app.js'),
    documentation: documentation('lr-mcp-app'),
  };
}

/** The tool-call action definition; empty when the host allowlists no tools. */
export function mcpAppActions(options: LyraGenMcpAppOptions): Readonly<Record<string, LyraGenActionDefinition>> {
  const { tools } = admit(options);
  if (!tools.length) return {};
  return {
    [mcpToolCallAction]: {
      payload: { type: 'object', properties: { tool: { type: 'string', enum: [...tools] }, input }, required: ['tool'], additionalProperties: false },
      confirm: options.confirmToolCalls !== false,
      description: 'Run an allowlisted tool the embedded app asked for; the host authorizes and executes it.',
    },
  };
}

/** Overlay role definitions; throws when the base already defines `mcp-app`. */
export function mcpAppComponents(base: LyraGenCatalog, options: LyraGenMcpAppOptions): Readonly<Record<string, LyraGenComponent>> {
  if (Object.hasOwn(base.components, 'mcp-app')) throw new TypeError('The base catalog already defines mcp-app.');
  return { 'mcp-app': mcpAppComponent(options) };
}
