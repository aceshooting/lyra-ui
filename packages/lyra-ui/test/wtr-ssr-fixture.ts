// Hydrated fixtures: render a Lit template on the server with @lit-labs/ssr and the built Lyra
// registrations, parse the response as declarative shadow DOM, hydrate it in the browser, and fail
// on anything a real server-rendered page would get wrong. Import this module FIRST in a test file:
// Lit's hydration support must be installed before anything evaluates `lit`.
import { litElementLoadedBeforeHydrationSupport } from './wtr-ssr-hydration-order.js';
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
import { hydrate } from '@lit-labs/ssr-client';
import { executeServerCommand } from '@web/test-runner-commands';
import { nothing, render, type TemplateResult } from 'lit';

export { html } from 'lit';

/** Wire form of a fixture value; the inverse lives in scripts/wtr-ssr-render-worker.mjs. */
type SerializedValue =
  | { kind: 'primitive'; value: string | number | boolean | null }
  | { kind: 'undefined' }
  | { kind: 'nothing' }
  | { kind: 'array'; items: SerializedValue[] }
  | { kind: 'object'; entries: Record<string, SerializedValue> }
  | { kind: 'template'; strings: string[]; raw: string[]; values: SerializedValue[] };

interface ServerRender {
  html: string;
  modules: string[];
  clientRendered: string[];
}

export interface SsrFixtureOptions {
  /**
   * Server shadow nodes the component legitimately replaces on its first client update. Give the
   * reason; any replaced node otherwise fails the fixture, because hydration must adopt the server
   * DOM rather than re-render it.
   */
  readonly allowReplacedServerNodes?: string;
  /**
   * Skip the structural comparison against a client-only render of the same template. Give the
   * reason (for example, deliberately time-dependent output).
   */
  readonly skipClientRenderComparison?: string;
  /**
   * A reproduced, not-yet-fixed hydration defect. Every reported problem must match `matches`, and
   * at least one must: the fixture then resolves so the rest of the test can run, and it fails as
   * soon as the defect stops reproducing, so the allowance cannot outlive the fix.
   */
  readonly knownDefect?: { readonly matches: RegExp; readonly reason: string };
}

interface ReactiveLike extends Element {
  readonly updateComplete: Promise<boolean>;
  readonly isUpdatePending: boolean;
  readonly hasUpdated: boolean;
}

const isReactive = (node: Node): node is ReactiveLike =>
  node instanceof Element && node.localName.includes('-') && 'updateComplete' in node;

const isTemplateResult = (value: unknown): value is TemplateResult =>
  typeof value === 'object' && value !== null && '_$litType$' in value && 'strings' in value;

function serializeValue(value: unknown, path: string): SerializedValue {
  if (value === undefined) return { kind: 'undefined' };
  if (value === nothing) return { kind: 'nothing' };
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError(`ssrFixture value at ${path} is a non-finite number, which cannot cross to the server.`);
    }
    return { kind: 'primitive', value: value as string | number | boolean | null };
  }
  if (isTemplateResult(value)) {
    if (value._$litType$ !== 1) throw new TypeError(`ssrFixture value at ${path} must be an html\`\` template.`);
    return {
      kind: 'template',
      strings: [...value.strings],
      raw: [...value.strings.raw],
      values: value.values.map((entry, index) => serializeValue(entry, `${path}[${index}]`)),
    };
  }
  if (Array.isArray(value)) return { kind: 'array', items: value.map((entry, index) => serializeValue(entry, `${path}[${index}]`)) };
  const prototype = typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
  if (prototype === Object.prototype || prototype === null) {
    return {
      kind: 'object',
      entries: Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, serializeValue(entry, `${path}.${key}`)]),
      ),
    };
  }
  throw new TypeError(
    `ssrFixture value at ${path} (${typeof value}) cannot be rendered on the server: use plain data, ` +
      'nested html`` templates or nothing, and attach listeners after the fixture resolves.',
  );
}

/** Every node of a tree, descending into open shadow roots, in document order. */
function deepNodes(root: Node): Node[] {
  const nodes: Node[] = [];
  const visit = (node: Node) => {
    nodes.push(node);
    if (node instanceof Element && node.shadowRoot) visit(node.shadowRoot);
    for (const child of node.childNodes) visit(child);
  };
  for (const child of root.childNodes) visit(child);
  return nodes;
}

function describeNode(node: Node): string {
  if (node instanceof Element) {
    const host = node.getRootNode() instanceof ShadowRoot ? (node.getRootNode() as ShadowRoot).host.localName : 'light DOM';
    const label = ['part', 'name', 'id'].map((name) => [name, node.getAttribute(name)] as const).find(([, value]) => value);
    return `<${node.localName}${label ? ` ${label[0]}="${label[1]}"` : ''}> in ${host}`;
  }
  if (node instanceof ShadowRoot) return `#shadow-root of <${node.host.localName}>`;
  return `${node.nodeName} ${JSON.stringify((node.textContent ?? '').trim().slice(0, 40))}`;
}

/** A task, a frame, then a task: lets post-hydration seeds (deferred to a task) and frame work run. */
async function quiesce(): Promise<void> {
  const task = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  await task();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await task();
}

/** Waits until no reactive element in the tree has a pending update; collects rejected updates. */
async function settle(root: Node, errors: string[]): Promise<void> {
  for (let round = 0; round < 20; round++) {
    const elements = deepNodes(root).filter(isReactive);
    await Promise.all(
      elements.map((element) =>
        element.updateComplete.catch((error: unknown) => {
          errors.push(`<${element.localName}> update failed: ${error instanceof Error ? error.message : String(error)}`);
        }),
      ),
    );
    await quiesce();
    if (!deepNodes(root).filter(isReactive).some((element) => element.isUpdatePending)) return;
  }
  errors.push('the fixture never settled: an element kept scheduling updates for 20 rounds');
}

/** Records console warnings/errors and uncaught failures while the server tree hydrates. */
function captureDiagnostics(): { readonly messages: string[]; stop(): void } {
  const messages: string[] = [];
  const originalWarn = console.warn;
  const originalError = console.error;
  const format = (args: unknown[]) => args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
  console.warn = (...args: unknown[]) => void messages.push(`console.warn: ${format(args)}`);
  console.error = (...args: unknown[]) => void messages.push(`console.error: ${format(args)}`);
  const onError = (event: ErrorEvent) => {
    // A ResizeObserver loop notice is a layout timing artifact, not a hydration defect.
    if (event.error === null && /ResizeObserver loop/.test(event.message)) return;
    event.preventDefault();
    messages.push(`uncaught error: ${event.error instanceof Error ? event.error.message : event.message}`);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    messages.push(`unhandled rejection: ${event.reason instanceof Error ? event.reason.message : String(event.reason)}`);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return {
    messages,
    stop() {
      console.warn = originalWarn;
      console.error = originalError;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    },
  };
}

const ignoredAttributes = (element: Element, name: string) =>
  name === 'defer-hydration' ||
  name.startsWith('hydrate-internals-') ||
  // Lit SSR serializes a native control's `.value`/`.checked` property binding as the content
  // attribute; the outline compares the live value and checkedness instead.
  ((name === 'value' || name === 'checked') &&
    (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement));

/** Attributes whose tokens reference element ids, so generated id values are compared by position. */
const idReferenceAttributes = new Set([
  'id', 'for', 'form', 'list', 'headers', 'anchor', 'popovertarget', 'commandfor',
  'aria-activedescendant', 'aria-controls', 'aria-describedby', 'aria-details',
  'aria-errormessage', 'aria-flowto', 'aria-labelledby', 'aria-owns',
]);

/**
 * A comparable outline of a rendered tree: elements with sorted, normalized attributes, live form
 * values, open shadow roots and collapsed text. Lit's markers, server-emitted shadow `<style>`
 * blocks (the client adopts constructed sheets instead) and generated id values are normalized
 * away, so only an observable SSR/CSR divergence remains.
 */
function outline(root: Node): string[] {
  const ids = new Map<string, string>();
  for (const node of deepNodes(root)) {
    if (node instanceof Element && node.id && !ids.has(node.id)) ids.set(node.id, `#id${ids.size}`);
  }
  const styleProbe = document.createElement('div');
  const normalize = (name: string, value: string) => {
    if (name === 'style') {
      styleProbe.style.cssText = value;
      return styleProbe.style.cssText;
    }
    if (idReferenceAttributes.has(name)) {
      return value.split(/\s+/).filter(Boolean).map((token) => ids.get(token) ?? token).join(' ');
    }
    return name === 'class' ? value.split(/\s+/).filter(Boolean).sort().join(' ') : value;
  };
  const lines: string[] = [];
  const visit = (node: Node, depth: number) => {
    const indent = '  '.repeat(depth);
    if (node instanceof Text) {
      const text = (node.data ?? '').replace(/\s+/g, ' ').trim();
      if (text) lines.push(`${indent}"${text}"`);
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.localName === 'style' && node.parentNode instanceof ShadowRoot) return;
    const attributes = node
      .getAttributeNames()
      .filter((name) => !ignoredAttributes(node, name))
      .sort()
      .map((name) => `${name}="${normalize(name, node.getAttribute(name) ?? '')}"`);
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
      attributes.push(`:value="${node.value}"`);
      if (node instanceof HTMLInputElement && (node.type === 'checkbox' || node.type === 'radio')) {
        attributes.push(`:checked="${node.checked}"`);
      }
    }
    lines.push(`${indent}<${node.localName}${attributes.length ? ' ' + attributes.join(' ') : ''}>`);
    if (node.shadowRoot) {
      lines.push(`${indent}  #shadow-root`);
      for (const child of node.shadowRoot.childNodes) visit(child, depth + 2);
    }
    for (const child of node.childNodes) visit(child, depth + 1);
  };
  for (const child of root.childNodes) visit(child, 0);
  return lines;
}

function firstDifference(expected: string[], actual: string[]): string {
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index++) {
    if (expected[index] !== actual[index]) {
      const context = (lines: string[]) => lines.slice(Math.max(0, index - 3), index + 4).join('\n');
      return `first difference at outline line ${index + 1}\n--- client render ---\n${context(expected)}\n--- hydrated server render ---\n${context(actual)}`;
    }
  }
  return 'no difference';
}

const containers = new Set<HTMLElement>();

/** Removes every container a hydrated fixture created; registered as a root `afterEach`. */
export function ssrFixtureCleanup(): void {
  for (const container of containers) container.remove();
  containers.clear();
}

if (typeof afterEach === 'function') afterEach(ssrFixtureCleanup);

// The first render loads the server's complete registration graph once per run (seconds); pay it
// in a root hook with its own budget so no individual test's timeout absorbs it.
if (typeof before === 'function') {
  before(async function warmServerRenderer(this: Mocha.Context) {
    this.timeout(120_000);
    await executeServerCommand('lyra-ssr-warm');
  });
}

/**
 * Renders `template` on the server, inserts the response as declarative shadow DOM, hydrates it
 * with `@lit-labs/ssr-client`, and returns its first element once every update has settled.
 *
 * Rejects, naming the cause, when: hydration logs a warning or error, throws, or leaves a rejected
 * update; any element keeps `defer-hydration`; a server-rendered node was replaced instead of
 * adopted; the engine did not attach a declarative shadow root; or the hydrated tree differs from
 * a client-only render of the same template (the divergence Lit itself accepts silently, such as a
 * stale server text value).
 */
export async function ssrFixture<T extends Element = HTMLElement>(
  template: TemplateResult,
  options: SsrFixtureOptions = {},
): Promise<T> {
  if (litElementLoadedBeforeHydrationSupport) {
    throw new Error('ssrFixture: lit-element loaded before hydration support. Import test/wtr-ssr-fixture.js first.');
  }
  const server = (await executeServerCommand('lyra-ssr-render', {
    template: serializeValue(template, 'template'),
  })) as ServerRender;
  if (server.clientRendered.length) {
    throw new Error(
      `ssrFixture: ${server.clientRendered.join(', ')} declare the client-render SSR mode; ` +
        'hydrated fixtures cover render-and-hydrate tags only.',
    );
  }
  await Promise.all(server.modules.map((module) => import(module)));

  const parse = (Document as unknown as { parseHTMLUnsafe?: (html: string) => Document }).parseHTMLUnsafe;
  if (typeof parse !== 'function') throw new Error('ssrFixture: this engine lacks Document.parseHTMLUnsafe().');
  const parsed = parse(`<!doctype html><body>${server.html}`);
  const serverNodes = deepNodes(parsed.body);
  // Described while still in place: a replaced node is detached afterwards and has no location.
  const serverDescriptions = new Map(serverNodes.map((node) => [node, describeNode(node)]));
  const lyraHosts = serverNodes.filter((node): node is Element => node instanceof Element && node.localName.startsWith('lr-'));
  const withoutShadow = lyraHosts.filter((host) => !host.shadowRoot);
  if (withoutShadow.length) {
    throw new Error(
      `ssrFixture: the server response attached no declarative shadow root to ${withoutShadow.map((host) => `<${host.localName}>`).join(', ')}.`,
    );
  }

  const diagnostics = captureDiagnostics();
  const updateErrors: string[] = [];
  const container = document.createElement('div');
  container.setAttribute('data-ssr-fixture', '');
  containers.add(container);
  let replaced: Node[] = [];
  let comparison: string | undefined;
  try {
    document.body.append(container);
    // Moving the nodes adopts them; each Lyra host upgrades on connection and finds its server
    // shadow root. Hydrating the outer template in the same task applies its property bindings
    // before any element's first (hydrating) update runs.
    container.append(...parsed.body.childNodes);
    hydrate(template, container);
    await settle(container, updateErrors);

    replaced = replacedServerNodes(serverNodes, container);

    if (options.skipClientRenderComparison === undefined) {
      const clientContainer = document.createElement('div');
      containers.add(clientContainer);
      document.body.append(clientContainer);
      render(template, clientContainer);
      await settle(clientContainer, updateErrors);
      const expected = outline(clientContainer);
      const actual = outline(container);
      clientContainer.remove();
      containers.delete(clientContainer);
      if (expected.join('\n') !== actual.join('\n')) comparison = firstDifference(expected, actual);
    }
  } finally {
    diagnostics.stop();
  }

  const problems = [...diagnostics.messages, ...updateErrors];
  const deferred = deepNodes(container).filter((node) => node instanceof Element && node.hasAttribute('defer-hydration'));
  if (deferred.length) problems.push(`never hydrated: ${deferred.map(describeNode).join(', ')}`);
  const unhydrated = deepNodes(container).filter((node) => isReactive(node) && !node.hasUpdated);
  if (unhydrated.length) problems.push(`no completed update: ${unhydrated.map(describeNode).join(', ')}`);
  if (replaced.length && options.allowReplacedServerNodes === undefined) {
    problems.push(
      `${replaced.length} server-rendered node(s) were replaced instead of adopted, e.g. ` +
        replaced.slice(0, 5).map((node) => serverDescriptions.get(node)).join('; '),
    );
  }
  if (comparison) problems.push(`hydrated DOM diverges from a client render: ${comparison}`);
  const known = options.knownDefect;
  if (known) {
    const unexpected = problems.filter((problem) => !known.matches.test(problem));
    if (unexpected.length) throw new Error(`ssrFixture hydration failed beyond the known defect (${known.reason}):\n- ${unexpected.join('\n- ')}`);
    if (!problems.length) {
      throw new Error(`ssrFixture: the known defect no longer reproduces (${known.reason}); remove the knownDefect allowance.`);
    }
  } else if (problems.length) {
    throw new Error(`ssrFixture hydration failed:\n- ${problems.join('\n- ')}`);
  }

  const element = container.firstElementChild;
  if (!element) throw new Error('ssrFixture: the template rendered no element.');
  return element as T;
}

/** Identity-free signature of a content node; comments, whitespace and shadow roots have none. */
function signature(node: Node): string | undefined {
  if (node instanceof Text) return node.data.trim() ? `#text ${node.data.trim()}` : undefined;
  if (!(node instanceof Element)) return undefined;
  const attributes = node
    .getAttributeNames()
    .filter((name) => name !== 'id' && !ignoredAttributes(node, name))
    .sort()
    .map((name) => `${name}=${node.getAttribute(name)}`);
  return `<${node.localName} ${attributes.join(' ')}>`;
}

/**
 * Server nodes that left the tree while an equivalent node took their place: a client re-render
 * rather than adoption. A server node removed with no equivalent replacement is a progressive
 * fallback collapsing (for example a slot wrapper whose light DOM proved empty), and a new node
 * with no removed counterpart is a progressive addition; the client-render comparison judges both.
 */
export function replacedServerNodes(serverNodes: readonly Node[], container: Node): Node[] {
  const live = new Set(deepNodes(container));
  const server = new Set(serverNodes);
  const created = new Map<string, number>();
  for (const node of live) {
    if (server.has(node)) continue;
    const key = signature(node);
    if (key !== undefined) created.set(key, (created.get(key) ?? 0) + 1);
  }
  const replaced: Node[] = [];
  for (const node of serverNodes) {
    if (live.has(node)) continue;
    const key = signature(node);
    const remaining = key === undefined ? 0 : created.get(key) ?? 0;
    if (key === undefined || remaining === 0) continue;
    created.set(key, remaining - 1);
    replaced.push(node);
  }
  return replaced;
}
