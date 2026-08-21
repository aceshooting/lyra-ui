import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './mcp-app.js';
import type { LyraMcpApp, McpAppResource } from './mcp-app.class.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

function sinkTexts(politeness: 'polite' | 'assertive'): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"] > div`,
    ),
    (node) => node.textContent ?? '',
  );
}

/** Firefox does not accept a sandboxed iframe's cross-origin WindowProxy through the
 * `MessageEventInit.source` Web IDL conversion. Define the readonly test-event property directly
 * so every engine exercises the component's real source-window identity check. */
function frameMessage(
  source: MessageEventSource | null,
  data: unknown,
  origin = '',
): MessageEvent {
  const event = new MessageEvent('message', { data, origin });
  Object.defineProperty(event, 'source', { configurable: true, value: source });
  return event;
}

it('renders executable app HTML only inside a uniquely-origin sandbox with CSP metadata', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{
      uri: 'ui://weather/current',
      title: 'Weather',
      html: '<!doctype html><html><head></head><body><button>Refresh</button></body></html>',
      csp: { connectDomains: ['https://api.example.com'] },
      permissions: { clipboardWrite: true },
    }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  const iframe = el.shadowRoot!.querySelector('iframe')!;
  expect(iframe.getAttribute('sandbox')).to.equal('allow-forms allow-scripts');
  expect(iframe.getAttribute('sandbox')).to.not.contain('allow-same-origin');
  expect(iframe.getAttribute('allow')).to.contain('clipboard-write *');
  expect(iframe.getAttribute('allow')).to.not.contain("'none'");
  expect(iframe.srcdoc).to.contain('Content-Security-Policy');
  expect(iframe.srcdoc).to.contain('https://api.example.com');
});

it('filters malformed and non-web CSP origins while enabling each requested frame permission', async () => {
  const el = await fixture<LyraMcpApp>(html`
    <lr-mcp-app
      .resource=${{
        uri: 'ui://permissions/all',
        html: '<p>Permission probe</p>',
        csp: {
          resourceDomains: ['not a URL', 'ftp://files.example.test', 'https://cdn.example.test/path'],
          connectDomains: [],
          frameDomains: ['http://frames.example.test/embed'],
        },
        permissions: {
          camera: true,
          microphone: true,
          geolocation: true,
          clipboardRead: true,
          clipboardWrite: true,
        },
      }}
    ></lr-mcp-app>
  `);
  const iframe = el.shadowRoot!.querySelector('iframe')!;

  expect(iframe.srcdoc).to.contain('https://cdn.example.test');
  expect(iframe.srcdoc).to.contain('http://frames.example.test');
  expect(iframe.srcdoc).to.not.contain('ftp://files.example.test');
  expect(iframe.srcdoc).to.not.contain('not a URL');
  expect(iframe.getAttribute('allow')).to.equal(
    'camera *; microphone *; geolocation *; clipboard-read *; clipboard-write *',
  );
});

it('enforces CSP before attacker-controlled comment or script-text head decoys', async () => {
  for (const [name, prefix] of [
    ['comment', '<!-- <head> -->'],
    ['script text', '<script>const decoy = "<head>";</script>'],
  ] as const) {
    const token = `mcp-csp-${name}-${crypto.randomUUID()}`;
    let cleanup = (): void => {};
    const result = new Promise<boolean>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error(`Timed out waiting for ${name} CSP probe`)), 3_000);
      const handler = (event: MessageEvent): void => {
        if (event.data?.token !== token) return;
        cleanup();
        resolve(Boolean(event.data.blocked));
      };
      cleanup = () => {
        window.clearTimeout(timeout);
        window.removeEventListener('message', handler);
      };
      window.addEventListener('message', handler);
    });
    try {
      const el = await fixture<LyraMcpApp>(html`<lr-mcp-app></lr-mcp-app>`);
      el.resource = {
        uri: `ui://csp/${name}`,
        html: `${prefix}<script>
          fetch('data:text/plain,csp-probe').then(
            () => parent.postMessage({ token: ${JSON.stringify(token)}, blocked: false }, '*'),
            () => parent.postMessage({ token: ${JSON.stringify(token)}, blocked: true }, '*')
          );
        </script>`,
      };
      await el.updateComplete;
      expect(await result, name).to.be.true;
    } finally {
      cleanup();
    }
  }
});

it('rejects executable frame URL schemes instead of navigating active documents', async () => {
  const el = await fixture<LyraMcpApp>(html`<lr-mcp-app></lr-mcp-app>`);
  for (const src of [
    'javascript:alert(1)',
    'data:text/html,<script>parent.postMessage("executed", "*")</script>',
    'blob:https://example.test/active-document',
  ]) {
    el.resource = { uri: `ui://unsafe/${src.split(':')[0]}`, src };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('iframe'), src).to.have.lengthOf(0);
    expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent?.trim(), src).to.not.equal('');
    expect(el.shadowRoot!.querySelector('[part="error"]')?.getAttribute('role'), src).to.equal(null);
  }
});

it('requires a non-empty resource identity and exactly one executable source at runtime', async () => {
  const el = await fixture<LyraMcpApp>(html`<lr-mcp-app></lr-mcp-app>`);
  const invalid = [
    { html: '<p>Missing identity</p>' },
    { uri: '   ', html: '<p>Blank identity</p>' },
    { uri: 'ui://missing/source' },
    { uri: 'ui://ambiguous/source', html: '<p>Inline</p>', src: 'https://example.test/app' },
  ] as unknown as McpAppResource[];

  for (const resource of invalid) {
    el.resource = resource;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('iframe')).to.have.lengthOf(0);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]')).to.have.lengthOf(1);
  }
});

it('routes fresh loading and unavailable states through pre-mounted light-DOM sinks', async () => {
  const el = (await fixture(html`<lr-mcp-app></lr-mcp-app>`)) as LyraMcpApp;
  expect(sinkTexts('polite'), 'the initial unavailable state stays silent').to.deep.equal([]);
  expect(sinkTexts('assertive'), 'the initial unavailable state stays silent').to.deep.equal([]);

  el.resource = { uri: 'ui://weather/current', html: '<p>Weather</p>' };
  await el.updateComplete;
  expect(sinkTexts('polite')).to.deep.equal(['Loading interactive app…']);
  expect(el.shadowRoot!.querySelector('[part="loading"]')?.getAttribute('role')).to.equal(null);

  el.resource = null;
  await el.updateComplete;
  expect(sinkTexts('assertive')).to.deep.equal(['This interactive app could not be loaded.']);
  expect(el.shadowRoot!.querySelector('[part="error"]')?.getAttribute('role')).to.equal(null);

  el.remove();
  expect(document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}]`).length).to.equal(0);
});

it('treats a resource write queued while detached as a silent reconnect baseline', async () => {
  const el = (await fixture(html`<lr-mcp-app></lr-mcp-app>`)) as LyraMcpApp;
  const parent = el.parentNode!;

  el.remove();
  el.resource = { uri: 'ui://weather/current', html: '<p>Weather</p>' };
  parent.appendChild(el);
  await el.updateComplete;
  expect(sinkTexts('polite'), 'the detached resource is resting content on reconnect').to.deep.equal([]);
  expect(sinkTexts('assertive')).to.deep.equal([]);

  el.resource = null;
  await el.updateComplete;
  expect(sinkTexts('assertive'), 'the next connected transition still announces').to.deep.equal([
    'This interactive app could not be loaded.',
  ]);
});

it('accepts messages only from its own frame and clamps resize requests', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://weather/current', html: '<p>Weather</p>' }}
    max-height="500"
  ></lr-mcp-app>`)) as LyraMcpApp;
  const iframe = el.shadowRoot!.querySelector('iframe')!;
  const toolCall = oneEvent(el, 'lr-mcp-tool-call');
  window.dispatchEvent(frameMessage(
    iframe.contentWindow,
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-call',
      requestId: 'request-1',
      name: 'refresh_weather',
      args: { city: 'Luxembourg' },
    },
    'null',
  ));
  const event = await toolCall as CustomEvent<{ requestId: string; name: string; args: unknown }>;
  expect(event.detail.name).to.equal('refresh_weather');

  window.dispatchEvent(frameMessage(
    iframe.contentWindow,
    { channel: 'lyra-mcp-app', version: 1, type: 'resize', height: 50_000 },
    'null',
  ));
  await el.updateComplete;
  expect(iframe.style.height).to.equal('500px');

  let leaked = false;
  el.addEventListener('lr-mcp-tool-call', () => {
    leaked = true;
  });
  window.dispatchEvent(frameMessage(
    window,
    { channel: 'lyra-mcp-app', version: 1, type: 'tool-call', name: 'bad', args: {} },
  ));
  expect(leaked).to.be.false;
});

it('forwards typed message, link, and log requests while rejecting malformed link requests', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://assistant/actions', html: '<p>Actions</p>' }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  const iframe = el.shadowRoot!.querySelector('iframe')!;
  const dispatch = (data: Record<string, unknown>) => {
    window.dispatchEvent(frameMessage(
      iframe.contentWindow,
      { channel: 'lyra-mcp-app', version: 1, ...data },
      'null',
    ));
  };

  const sendMessage = oneEvent(el, 'lr-mcp-send-message');
  dispatch({ type: 'send-message', message: { role: 'user', content: 'Continue' } });
  expect((await sendMessage).detail.message).to.deep.equal({ role: 'user', content: 'Continue' });

  const openLink = oneEvent(el, 'lr-mcp-open-link');
  dispatch({ type: 'open-link', href: 'https://example.test/details' });
  expect((await openLink).detail.href).to.equal('https://example.test/details');

  let linkCount = 0;
  el.addEventListener('lr-mcp-open-link', () => linkCount++);
  dispatch({ type: 'open-link', href: 42 });
  expect(linkCount).to.equal(0);
  dispatch({ type: 'open-link', href: 'javascript:alert(1)' });
  expect(linkCount).to.equal(0);

  const defaultLog = oneEvent(el, 'lr-mcp-log');
  dispatch({ type: 'log', value: { status: 'ready' } });
  expect((await defaultLog).detail).to.deep.equal({
    level: 'info',
    value: { status: 'ready' },
  });

  const warningLog = oneEvent(el, 'lr-mcp-log');
  dispatch({ type: 'log', level: 'warn', value: 'slow response' });
  expect((await warningLog).detail.level).to.equal('warn');
});

it('builds host-context and correlated tool-result message envelopes through the public API', () => {
  const el = document.createElement('lr-mcp-app') as LyraMcpApp;
  const messages: unknown[] = [];
  (el as any).post = (message: unknown) => messages.push(message);

  el.postHostContext({ theme: 'dark' });
  el.postToolResult('request-1', { frameGeneration: 0, result: { temperature: 18 } });
  el.postToolResult('request-2', { frameGeneration: 0, error: 'Permission denied' });

  expect(messages).to.deep.equal([
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'host-context',
      context: { theme: 'dark' },
    },
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-result',
      requestId: 'request-1',
      result: { temperature: 18 },
    },
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-result',
      requestId: 'request-2',
      error: 'Permission denied',
    },
  ]);
});

it('delivers host-context to the real always-opaque sandboxed frame instead of throwing', async () => {
  // The sandbox never grants allow-same-origin, so every resolved resource's frame -- html or src
  // alike -- carries a forced-opaque origin. Browsers report that origin to the *recipient* as the
  // literal string "null" (expectedOrigin(), consulted correctly by onMessage() for the inbound
  // direction), but a real postMessage() call REJECTS that same string as an outbound
  // targetOrigin with a SyntaxError -- only "*" or a value that parses as an absolute URL is
  // accepted, and no URL serializes to "null". So the one behavior actually worth locking down
  // here is a real, unmocked round trip through the platform API: it must not throw, and the
  // opaque-origin frame must actually receive the message -- proving '*' is the correct choice for
  // this always-opaque target, not merely the leftover default of a dead ternary.
  const token = `mcp-post-origin-${crypto.randomUUID()}`;
  let cleanup = (): void => {};
  const received = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Timed out waiting for the relayed host-context')), 3_000);
    const handler = (event: MessageEvent): void => {
      if (event.data?.token !== token) return;
      cleanup();
      resolve();
    };
    cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', handler);
    };
    window.addEventListener('message', handler);
  });
  try {
    const el = await fixture<LyraMcpApp>(html`<lr-mcp-app
      .resource=${{
        uri: 'ui://weather/current',
        html: `<script>
          window.addEventListener('message', (event) => {
            if (event.data && event.data.channel === 'lyra-mcp-app' && event.data.type === 'host-context') {
              parent.postMessage({ token: ${JSON.stringify(token)} }, '*');
            }
          });
        </script>`,
      }}
    ></lr-mcp-app>`);
    await oneEvent(el, 'lr-mcp-ready');
    expect(() => el.postHostContext({ theme: 'dark' })).to.not.throw();
    await received;
  } finally {
    cleanup();
  }
});

it('fails closed on uncorrelated or ambiguous tool-result options at runtime', () => {
  const el = document.createElement('lr-mcp-app') as LyraMcpApp;
  const messages: unknown[] = [];
  (el as any).post = (message: unknown) => messages.push(message);
  const postToolResult = el.postToolResult as unknown as (
    requestId: string,
    options: Record<string, unknown>,
  ) => void;

  postToolResult.call(el, 'request-1', { result: 'uncorrelated' });
  postToolResult.call(el, 'request-2', { frameGeneration: 0, result: 'ok', error: 'not ok' });
  postToolResult.call(el, '', { frameGeneration: 0, result: 'missing request identity' });

  expect(messages).to.deep.equal([]);
});

it('authenticates remote uniquely-origin sandbox messages by frame window and opaque origin', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://remote/app', src: 'https://apps.example.test/weather' }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  const iframe = el.shadowRoot!.querySelector('iframe')!;
  let calls = 0;
  el.addEventListener('lr-mcp-tool-call', () => calls++);
  const data = { channel: 'lyra-mcp-app', version: 1, type: 'tool-call', name: 'weather', args: {} };

  window.dispatchEvent(frameMessage(iframe.contentWindow, data, 'https://apps.example.test'));
  expect(calls).to.equal(0);

  window.dispatchEvent(frameMessage(window, data, 'null'));
  expect(calls).to.equal(0);

  window.dispatchEvent(frameMessage(iframe.contentWindow, data, 'null'));
  expect(calls).to.equal(1);
});

it('never sends the embedding document referrer to a remote app', async () => {
  const el = await fixture<LyraMcpApp>(html`<lr-mcp-app
    .resource=${{ uri: 'ui://remote/private', src: 'https://apps.example.test/private' }}
  ></lr-mcp-app>`);
  expect(el.shadowRoot!.querySelector('iframe')!.getAttribute('referrerpolicy')).to.equal(
    'no-referrer',
  );
});

it('retargets authenticated frame messages to the adopted owner window and cleans up reconnects', async () => {
  const ownerFrame = document.createElement('iframe');
  document.body.append(ownerFrame);
  const ownerDocument = ownerFrame.contentDocument!;
  const ownerWindow = ownerFrame.contentWindow!;
  const originalAddDescriptor = Object.getOwnPropertyDescriptor(ownerWindow, 'addEventListener');
  const originalRemoveDescriptor = Object.getOwnPropertyDescriptor(
    ownerWindow,
    'removeEventListener',
  );
  const originalAdd = ownerWindow.addEventListener.bind(ownerWindow);
  const originalRemove = ownerWindow.removeEventListener.bind(ownerWindow);
  let messageListenerAdds = 0;
  let messageListenerRemoves = 0;
  Object.defineProperty(ownerWindow, 'addEventListener', {
    configurable: true,
    value: (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'message') messageListenerAdds += 1;
      originalAdd(type, listener, options);
    },
  });
  Object.defineProperty(ownerWindow, 'removeEventListener', {
    configurable: true,
    value: (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) => {
      if (type === 'message') messageListenerRemoves += 1;
      originalRemove(type, listener, options);
    },
  });

  const el = document.createElement('lr-mcp-app') as LyraMcpApp;
  el.resource = { uri: 'ui://adopted/app', html: '<p>Adopted app</p>' };
  let calls = 0;
  el.addEventListener('lr-mcp-tool-call', () => calls++);
  const data = {
    channel: 'lyra-mcp-app',
    version: 1,
    type: 'tool-call',
    name: 'owner_bound_tool',
    args: {},
  };

  try {
    document.body.append(el);
    await el.updateComplete;
    ownerDocument.adoptNode(el);
    ownerDocument.body.append(el);
    await el.updateComplete;
    const sandboxWindow = el.shadowRoot!.querySelector('iframe')!.contentWindow;

    window.dispatchEvent(frameMessage(sandboxWindow, data, 'null'));
    expect(calls, 'the prior parent window must no longer reach the component').to.equal(0);

    ownerWindow.dispatchEvent(frameMessage(ownerWindow, data, 'null'));
    expect(calls, 'another window in the right realm is still the wrong source').to.equal(0);

    ownerWindow.dispatchEvent(frameMessage(sandboxWindow, data, 'null'));
    expect(calls).to.equal(1);

    el.remove();
    ownerDocument.body.append(el);
    await el.updateComplete;
    const reconnectedSandboxWindow = el.shadowRoot!.querySelector('iframe')!.contentWindow;
    ownerWindow.dispatchEvent(frameMessage(reconnectedSandboxWindow, data, 'null'));
    expect(calls).to.equal(2);
  } finally {
    el.remove();
    if (originalAddDescriptor) {
      Object.defineProperty(ownerWindow, 'addEventListener', originalAddDescriptor);
    } else {
      delete (ownerWindow as unknown as { addEventListener?: typeof addEventListener })
        .addEventListener;
    }
    if (originalRemoveDescriptor) {
      Object.defineProperty(ownerWindow, 'removeEventListener', originalRemoveDescriptor);
    } else {
      delete (ownerWindow as unknown as { removeEventListener?: typeof removeEventListener })
        .removeEventListener;
    }
    ownerFrame.remove();
  }

  expect(messageListenerAdds).to.equal(2);
  expect(messageListenerRemoves).to.equal(2);
});

it('replaces the iframe window across resource navigation so the previous opaque document cannot message the host', async () => {
  const first = { uri: 'ui://first', html: '<p>First</p>' };
  const second = { uri: 'ui://second', html: '<p>Second</p>' };
  const el = (await fixture(html`<lr-mcp-app .resource=${first}></lr-mcp-app>`)) as LyraMcpApp;
  const oldFrame = el.shadowRoot!.querySelector('iframe')!;
  const oldWindow = oldFrame.contentWindow;
  el.resource = second;
  await el.updateComplete;
  const newFrame = el.shadowRoot!.querySelector('iframe')!;
  expect(newFrame.contentWindow === oldWindow).to.be.false;

  let calls = 0;
  el.addEventListener('lr-mcp-tool-call', () => calls++);
  const data = { channel: 'lyra-mcp-app', version: 1, type: 'tool-call', name: 'stale', args: {} };
  window.dispatchEvent(frameMessage(oldWindow, data, 'null'));
  expect(calls).to.equal(0);
  window.dispatchEvent(frameMessage(newFrame.contentWindow, data, 'null'));
  expect(calls).to.equal(1);
});

it('ignores a detached previous frame load after replacing the resource', async () => {
  const el = await fixture<LyraMcpApp>(html`<lr-mcp-app
    .resource=${{ uri: 'ui://first', html: '<p>First</p>' }}
  ></lr-mcp-app>`);
  const oldFrame = el.shadowRoot!.querySelector('iframe')!;
  const readyUris: string[] = [];
  el.addEventListener('lr-mcp-ready', (event) => readyUris.push(event.detail.uri));

  el.resource = { uri: 'ui://second', html: '<p>Second</p>' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="loading"]')).to.have.lengthOf(1);
  const readyCountBeforeStaleLoad = readyUris.length;

  oldFrame.dispatchEvent(new Event('load'));
  await el.updateComplete;

  expect(readyUris.length, 'a detached frame must not emit readiness for its replacement').to.equal(
    readyCountBeforeStaleLoad,
  );
  expect(el.shadowRoot!.querySelectorAll('[part="loading"]')).to.have.lengthOf(1);

  el.shadowRoot!.querySelector('iframe')!.dispatchEvent(new Event('load'));
  expect(readyUris.at(-1)).to.equal('ui://second');
});

it('keeps the loaded state when only height constraints change', async () => {
  const el = (await fixture(html`
    <lr-mcp-app .resource=${{ uri: 'ui://sizing', html: '<p>Sizing</p>' }}></lr-mcp-app>
  `)) as LyraMcpApp;
  const frame = el.shadowRoot!.querySelector('iframe')!;
  frame.dispatchEvent(new Event('load'));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="loading"]').length).to.equal(0);

  el.height = 420;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="loading"]').length).to.equal(0);
  el.maxHeight = 500;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="loading"]').length).to.equal(0);
});

it('posts host context with the nearest inherited effective locale', async () => {
  const wrapper = await fixture(html`
    <div lang="de-DE">
      <lr-mcp-app .resource=${{ uri: 'ui://locale', html: '<p>Locale</p>' }}></lr-mcp-app>
    </div>
  `);
  const el = wrapper.querySelector('lr-mcp-app') as LyraMcpApp;
  const contexts: unknown[] = [];
  el.postHostContext = (context: unknown) => contexts.push(context);
  el.shadowRoot!.querySelector('iframe')!.dispatchEvent(new Event('load'));
  expect((contexts[0] as { locale: string }).locale).to.equal('de-DE');
});

it('applies per-instance strings to the unavailable state', async () => {
  const el = (await fixture(
    html`<lr-mcp-app
      .strings=${{ mcpAppUnavailable: 'Application interactive indisponible.' }}
    ></lr-mcp-app>`,
  )) as LyraMcpApp;
  expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent?.trim()).to.equal(
    'Application interactive indisponible.',
  );
});

it('is accessible with an app loaded', async () => {
  const el = await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://example/app', title: 'Example app', html: '<p>Example</p>' }}
  ></lr-mcp-app>`);
  expect(el.shadowRoot!.querySelectorAll('iframe')).to.have.lengthOf(1);
  await expect(el).to.be.accessible();
});

it('keeps a non-empty host name on the host and preserves explicit-empty frame semantics', async () => {
  const el = (await fixture(html`<lr-mcp-app
    aria-label="Weather experience"
    .resource=${{ uri: 'ui://weather/app', title: 'Weather controls', html: '<p>Weather</p>' }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  const frame = el.shadowRoot!.querySelector('iframe')!;
  expect(el.getAttribute('aria-label')).to.equal('Weather experience');
  expect(frame.title).to.equal('Weather controls');

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(frame.title).to.equal('');
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .strings=${{ mcpAppLabel: 'Localized MCP application' }}
    .resource=${{ uri: 'ui://example/app', html: '<p>Example</p>' }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  expect(el.shadowRoot!.querySelector('iframe')!.title).to.equal('Localized MCP application');
});

// -- Remote src mode must not be shadowed by an empty srcdoc --------------------

it('renders no srcdoc attribute at all for a src-only resource, so the frame really navigates', async () => {
  const el = (await fixture(html`<lr-mcp-app></lr-mcp-app>`)) as LyraMcpApp;
  el.resource = { uri: 'ui://remote/src-only', src: 'https://example.test/app.html' };
  await el.updateComplete;
  const frame = el.shadowRoot!.querySelector('iframe') as HTMLIFrameElement;
  // A present-but-empty srcdoc still wins over src per the HTML spec's iframe processing steps,
  // which branch on the attribute's PRESENCE -- the frame would navigate to about:srcdoc instead.
  expect(frame.hasAttribute('srcdoc'), 'srcdoc must be absent, not empty').to.be.false;
  expect(frame.getAttribute('src')).to.equal('https://example.test/app.html');
});

it('still renders srcdoc for an inline html resource', async () => {
  const el = (await fixture(html`<lr-mcp-app></lr-mcp-app>`)) as LyraMcpApp;
  el.resource = { uri: 'ui://inline/html-only', html: '<p>inline</p>' };
  await el.updateComplete;
  const frame = el.shadowRoot!.querySelector('iframe') as HTMLIFrameElement;
  expect(frame.hasAttribute('srcdoc')).to.be.true;
  expect(frame.getAttribute('srcdoc')).to.contain('inline');
  expect(frame.hasAttribute('src'), 'the inline branch must not also set src').to.be.false;
});

// -- Tool results are correlated to the frame generation that asked for them ----

it('drops a tool result whose frame generation no longer matches the mounted frame', async () => {
  const el = (await fixture(html`<lr-mcp-app
    .resource=${{ uri: 'ui://first', html: '<p>First</p>' }}
  ></lr-mcp-app>`)) as LyraMcpApp;
  const firstWindow = el.shadowRoot!.querySelector('iframe')!.contentWindow;

  const firstCall = oneEvent(el, 'lr-mcp-tool-call');
  window.dispatchEvent(frameMessage(
    firstWindow,
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-call',
      requestId: 'request-1',
      name: 'slow_tool',
      args: {},
    },
    'null',
  ));
  const staleGeneration = (await firstCall).detail.frameGeneration;
  expect(typeof staleGeneration, 'the request carries the generation it came from').to.equal('number');

  // A tool call is inherently asynchronous -- the host is still doing real work (an API call, a
  // filesystem read) when the conversation UI swaps the displayed resource on the same element.
  el.resource = { uri: 'ui://second', html: '<p>Second</p>' };
  await el.updateComplete;
  const secondWindow = el.shadowRoot!.querySelector('iframe')!.contentWindow;
  expect(secondWindow === firstWindow, 'the swap really mounted a fresh frame').to.equal(false);

  const posted: Record<string, unknown>[] = [];
  (el as unknown as { post: (message: Record<string, unknown>) => void }).post = (message) => {
    posted.push(message);
  };
  const toolResults = (): Record<string, unknown>[] => posted.filter((m) => m['type'] === 'tool-result');

  el.postToolResult('request-1', {
    frameGeneration: staleGeneration,
    result: { temperature: 18 },
  });
  expect(
    toolResults().length,
    "the old resource's result must not be delivered into the newly-loaded app",
  ).to.equal(0);

  const secondCall = oneEvent(el, 'lr-mcp-tool-call');
  window.dispatchEvent(frameMessage(
    secondWindow,
    {
      channel: 'lyra-mcp-app',
      version: 1,
      type: 'tool-call',
      requestId: 'request-2',
      name: 'slow_tool',
      args: {},
    },
    'null',
  ));
  const liveGeneration = (await secondCall).detail.frameGeneration;
  expect(liveGeneration).to.not.equal(staleGeneration);

  el.postToolResult('request-2', {
    frameGeneration: liveGeneration,
    result: { temperature: 19 },
  });
  expect(toolResults().length, 'a result correlated to the live frame still lands').to.equal(1);
  expect(toolResults()[0]!['requestId']).to.equal('request-2');
});

it('invalidates tool-result correlation when a connected frame is adopted or reconnected', async () => {
  const el = await fixture<LyraMcpApp>(html`<lr-mcp-app
    .resource=${{ uri: 'ui://lifecycle', html: '<p>Lifecycle</p>' }}
  ></lr-mcp-app>`);
  const frameGeneration = async (): Promise<number> => {
    const frame = el.shadowRoot!.querySelector('iframe')!;
    const call = oneEvent(el, 'lr-mcp-tool-call');
    window.dispatchEvent(frameMessage(
      frame.contentWindow,
      {
        channel: 'lyra-mcp-app',
        version: 1,
        type: 'tool-call',
        requestId: crypto.randomUUID(),
        name: 'slow_tool',
        args: {},
      },
      'null',
    ));
    return (await call).detail.frameGeneration as number;
  };

  const beforeAdoption = await frameGeneration();
  el.adoptedCallback();
  await el.updateComplete;
  const afterAdoption = await frameGeneration();
  expect(afterAdoption).to.not.equal(beforeAdoption);

  const parent = el.parentNode!;
  el.remove();
  parent.append(el);
  await el.updateComplete;
  const afterReconnect = await frameGeneration();
  expect(afterReconnect).to.not.equal(afterAdoption);

  const posted: unknown[] = [];
  (el as unknown as { post: (message: unknown) => void }).post = (message) => posted.push(message);
  el.postToolResult('stale-adoption', { frameGeneration: beforeAdoption, result: 'stale' });
  el.postToolResult('stale-reconnect', { frameGeneration: afterAdoption, result: 'stale' });
  el.postToolResult('current', { frameGeneration: afterReconnect, result: 'current' });
  expect(posted).to.have.lengthOf(1);
});
