import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import './tool-result-view.js';
import type { LyraToolResultView } from './tool-result-view.js';
import {
  registerToolRenderer,
  clearToolRenderers,
  type DirectToolRendererDefinition,
  type ToolRenderContext,
  type ToolRendererDefinition,
  type ToolRendererRegistry,
} from './registry.js';

afterEach(() => {
  clearToolRenderers();
});

function base(el: LyraToolResultView): HTMLElement {
  return el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
}

it('defaults to fallback="json" and falls back to lr-json-viewer when nothing is registered', async () => {
  const el = (await fixture(
    html`<lr-tool-result-view tool-name="unregistered" .result=${{ ok: true }}></lr-tool-result-view>`,
  )) as LyraToolResultView;
  expect(el.fallback).to.equal('json');
  expect(el.getAttribute('fallback')).to.equal('json');
  expect(base(el).querySelector('lr-json-viewer')).to.exist;
});

it('normalizes unsupported fallback property and attribute values to the reflected json default', async () => {
  const el = (await fixture(html`
    <lr-tool-result-view tool-name="unregistered" fallback="html" .result=${'plain'}></lr-tool-result-view>
  `)) as LyraToolResultView;
  expect(el.fallback).to.equal('json');
  expect(el.getAttribute('fallback')).to.equal('json');
  expect(base(el).querySelector('lr-json-viewer')).to.exist;

  el.fallback = 'markdown' as never;
  await el.updateComplete;
  expect(el.fallback).to.equal('json');
  expect(el.getAttribute('fallback')).to.equal('json');
  expect(base(el).querySelector('lr-json-viewer')).to.exist;
});

it('resets renderer-owned status when falling back to a different unsupported tool', async () => {
  registerToolRenderer('denied', {
    render: (_result, _args, context) => {
      if (!context) throw new Error('Expected the tool renderer context.');
      context.reportStatus('denied');
      return litHtml`denied`;
    },
  });
  const el = (await fixture(
    html`<lr-tool-result-view tool-name="denied" .result=${{}}></lr-tool-result-view>`,
  )) as LyraToolResultView;
  await waitUntil(() => Boolean(el.shadowRoot!.textContent?.includes('denied')));
  el.toolName = 'unsupported';
  await el.updateComplete;
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('lr-json-viewer')));
  expect(el.status).to.equal('success');
});

it('emits lr-render-error (with the tool name and an Error) before falling back when no renderer matches', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-tool-result-view') as LyraToolResultView;
  el.toolName = 'unregistered_tool';
  el.result = { ok: true };
  const eventPromise = oneEvent(el, 'lr-render-error');
  container.appendChild(el);

  const event = (await eventPromise) as CustomEvent<{ toolName: string; error: unknown }>;
  expect(event.detail.toolName).to.equal('unregistered_tool');
  expect(event.detail.error).to.be.instanceOf(Error);

  await el.updateComplete;
  expect(base(el).querySelector('lr-json-viewer')).to.exist;
});

it('renders the exact tool-name match, handing it both result and args', async () => {
  let seen: { result: unknown; args: unknown } | undefined;
  registerToolRenderer('get_weather', {
    render: (result, args) => {
      seen = { result, args };
      return litHtml`<span class="weather">${JSON.stringify(result)}</span>`;
    },
  });

  const el = (await fixture(html`
    <lr-tool-result-view
      tool-name="get_weather"
      .result=${{ tempC: 19 }}
      .args=${{ location: 'Brussels' }}
    ></lr-tool-result-view>
  `)) as LyraToolResultView;

  expect(base(el).querySelector('.weather')).to.exist;
  expect((base(el).querySelector('lr-json-viewer')) == null).to.be.true;
  expect(seen).to.deep.equal({ result: { tempC: 19 }, args: { location: 'Brussels' } });
});

it('falls back to shape-based matches() dispatch when no exact tool-name entry exists', async () => {
  registerToolRenderer('search_renderer', {
    render: () => litHtml`<span class="search-result">hits</span>`,
    matches: (payload) => typeof payload === 'object' && payload !== null && 'results' in payload,
  });

  const el = (await fixture(html`
    <lr-tool-result-view tool-name="web_search" .result=${{ results: ['a', 'b'] }}></lr-tool-result-view>
  `)) as LyraToolResultView;

  expect(base(el).querySelector('.search-result')).to.exist;
});

it('re-resolves (and re-dispatches) when result changes shape under shape-based matching', async () => {
  registerToolRenderer('search_renderer', {
    render: () => litHtml`<span class="search-result">hits</span>`,
    matches: (payload) => typeof payload === 'object' && payload !== null && 'results' in payload,
  });

  const el = (await fixture(html`
    <lr-tool-result-view tool-name="web_search" .result=${{ results: ['a'] }}></lr-tool-result-view>
  `)) as LyraToolResultView;
  expect(base(el).querySelector('.search-result')).to.exist;

  el.result = { somethingElse: true };
  await el.updateComplete;
  expect((base(el).querySelector('.search-result')) == null).to.be.true;
  expect(base(el).querySelector('lr-json-viewer')).to.exist;
});

it('accepts a custom registry prop instead of dispatching against the module-level default', async () => {
  registerToolRenderer('get_weather', { render: () => litHtml`<span class="default-registry">nope</span>` });
  const custom: ToolRendererRegistry = new Map([
    ['get_weather', { render: () => litHtml`<span class="custom-registry">yes</span>` } as ToolRendererDefinition],
  ]);

  const el = (await fixture(html`
    <lr-tool-result-view tool-name="get_weather" .result=${{}} .registry=${custom}></lr-tool-result-view>
  `)) as LyraToolResultView;

  expect(base(el).querySelector('.custom-registry')).to.exist;
  expect((base(el).querySelector('.default-registry')) == null).to.be.true;
});

it('takes a recursively frozen readonly registry snapshot', async () => {
  const definition: ToolRendererDefinition = {
    render: () => litHtml`<span class="snapshotted-registry">yes</span>`,
  };
  const source = new Map<string, ToolRendererDefinition>([
    ['snapshotted', definition],
  ]);
  const el = (await fixture(html`
    <lr-tool-result-view
      tool-name="snapshotted"
      .result=${{}}
      .registry=${source}
    ></lr-tool-result-view>
  `)) as LyraToolResultView;

  source.clear();
  source.set('later', { render: () => litHtml`later` });

  expect(base(el).querySelector('.snapshotted-registry')).to.exist;
  const stored = el.registry!.get('snapshotted')!;
  expect(stored === definition).to.be.false;
  expect(stored.render === definition.render).to.be.true;
  expect(Object.isFrozen(stored)).to.be.true;
  expect(el.registry!.has('later')).to.be.false;
  expect(Object.isFrozen(el.registry)).to.be.true;
  expect('set' in el.registry!).to.be.false;
});

it('emits lr-render-error and falls back when a matched renderer throws synchronously', async () => {
  registerToolRenderer('boom_tool', {
    render: () => {
      throw new Error('render exploded');
    },
  });

  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-tool-result-view') as LyraToolResultView;
  el.toolName = 'boom_tool';
  el.result = { x: 1 };
  const eventPromise = oneEvent(el, 'lr-render-error');
  container.appendChild(el);

  const event = (await eventPromise) as CustomEvent<{ toolName: string; error: unknown }>;
  expect(event.detail.toolName).to.equal('boom_tool');
  expect((event.detail.error as Error).message).to.equal('render exploded');

  await el.updateComplete;
  expect(base(el).querySelector('lr-json-viewer')).to.exist;
});

it('emits lr-render-error and falls back when a candidate matches() predicate throws during dispatch', async () => {
  registerToolRenderer('flaky_matcher', {
    render: () => litHtml`<span class="flaky">nope</span>`,
    matches: () => {
      throw new Error('matches exploded');
    },
  });

  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-tool-result-view') as LyraToolResultView;
  el.toolName = 'unrelated_tool_name';
  el.result = { anything: true };
  const eventPromise = oneEvent(el, 'lr-render-error');
  container.appendChild(el);

  const event = (await eventPromise) as CustomEvent<{ toolName: string; error: unknown }>;
  expect(event.detail.toolName).to.equal('unrelated_tool_name');
  expect((event.detail.error as Error).message).to.equal('matches exploded');

  await el.updateComplete;
  expect(base(el).querySelector('lr-json-viewer')).to.exist;
  expect((base(el).querySelector('.flaky')) == null).to.be.true;
});

it('shows a lr-skeleton while an async load() is pending, then renders its resolved output', async () => {
  let resolveLoad!: (mod: { default: DirectToolRendererDefinition }) => void;
  const loadPromise = new Promise<{ default: DirectToolRendererDefinition }>((resolve) => {
    resolveLoad = resolve;
  });
  registerToolRenderer('slow_tool', { load: () => loadPromise });

  const el = (await fixture(html`
    <lr-tool-result-view
      tool-name="slow_tool"
      .result=${{ a: 1 }}
      .strings=${{ loading: 'Chargement du résultat…' }}
    ></lr-tool-result-view>
  `)) as LyraToolResultView;

  const skeleton = base(el).querySelector('lr-skeleton') as HTMLElement & {
    announce: boolean;
    updateComplete: Promise<unknown>;
  };
  expect(base(el).querySelectorAll('lr-skeleton').length).to.equal(1);
  await skeleton.updateComplete;
  const activeLiveSelector = '[role="status"], [role="alert"], [aria-live]:not([aria-live="off"])';
  expect(base(el).getAttribute('aria-busy')).to.equal('true');
  expect(skeleton.announce, 'the parent owns busy state; the visual skeleton is decorative').to.be.false;
  expect(base(el).querySelector('.sr-only')?.textContent?.trim()).to.equal('Chargement du résultat…');
  expect(el.shadowRoot!.querySelectorAll(activeLiveSelector).length).to.equal(0);
  expect(skeleton.shadowRoot!.querySelectorAll(activeLiveSelector).length).to.equal(0);

  resolveLoad({ default: { render: (result) => litHtml`<span class="loaded">${(result as { a: number }).a}</span>` } });
  await waitUntil(() => base(el).querySelector('lr-skeleton') === null);

  expect(base(el).getAttribute('aria-busy')).to.equal('false');
  expect(base(el).querySelector('.loaded')!.textContent).to.equal('1');
});

it('emits lr-render-error and falls back when load() rejects', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  registerToolRenderer('failing_load_tool', { load: () => Promise.reject(new Error('network down')) });

  const el = document.createElement('lr-tool-result-view') as LyraToolResultView;
  el.toolName = 'failing_load_tool';
  el.result = {};
  const eventPromise = oneEvent(el, 'lr-render-error');
  container.appendChild(el);

  const event = (await eventPromise) as CustomEvent<{ toolName: string; error: unknown }>;
  expect((event.detail.error as Error).message).to.equal('network down');

  await el.updateComplete;
  expect(base(el).querySelector('lr-json-viewer')).to.exist;
});

it('ignores a stale load() resolution superseded by a newer tool-name before it settles', async () => {
  let resolveSlow!: (mod: { default: DirectToolRendererDefinition }) => void;
  const slowPromise = new Promise<{ default: DirectToolRendererDefinition }>((resolve) => {
    resolveSlow = resolve;
  });
  registerToolRenderer('slow_tool', { load: () => slowPromise });
  registerToolRenderer('fast_tool', { render: () => litHtml`<span class="fast">fast</span>` });

  const el = (await fixture(html`
    <lr-tool-result-view tool-name="slow_tool" .result=${{}}></lr-tool-result-view>
  `)) as LyraToolResultView;
  expect(base(el).querySelector('lr-skeleton')).to.exist;

  el.toolName = 'fast_tool';
  await el.updateComplete;
  expect(base(el).querySelector('.fast')).to.exist;

  resolveSlow({ default: { render: () => litHtml`<span class="stale">stale</span>` } });
  await slowPromise;
  await el.updateComplete;

  expect(base(el).querySelector('.fast'), 'the newer resolution must not be clobbered by the stale one').to.exist;
  expect((base(el).querySelector('.stale')) == null).to.be.true;
});

it('does not re-show the loading skeleton for a result-only update once a lazy renderer has already resolved', async () => {
  registerToolRenderer('slow_tool', {
    load: () =>
      Promise.resolve({
        default: {
          render: (result) => litHtml`<span class="loaded">${(result as { a: number }).a}</span>`,
        },
      }),
  });

  const el = (await fixture(html`
    <lr-tool-result-view tool-name="slow_tool" .result=${{ a: 1 }}></lr-tool-result-view>
  `)) as LyraToolResultView;

  await waitUntil(() => base(el).querySelector('.loaded') !== null);
  const spanBefore = base(el).querySelector('.loaded');
  expect(spanBefore!.textContent).to.equal('1');

  el.result = { a: 2 };
  await waitUntil(() => base(el).querySelector('.loaded')?.textContent === '2');

  expect(base(el).querySelector('lr-skeleton') == null, 'a cached load() must not re-show the loading skeleton').to.be
    .true;
  expect((base(el).querySelector('.loaded')) === (spanBefore), 'the already-rendered DOM subtree must be reused in place, not torn down and rebuilt via a loading round-trip').to.equal(true);
});

it('is accessible in the default, empty (no renderer registered) state', async () => {
  const el = (await fixture(
    html`<lr-tool-result-view tool-name="anything"></lr-tool-result-view>`,
  )) as LyraToolResultView;
  await expect(el).to.be.accessible();
});

it('is accessible once a matched renderer has populated content', async () => {
  registerToolRenderer('get_weather', {
    render: () => litHtml`<p>It is 19°C in Brussels.</p>`,
  });
  const el = (await fixture(html`
    <lr-tool-result-view tool-name="get_weather" .result=${{ tempC: 19 }}></lr-tool-result-view>
  `)) as LyraToolResultView;
  await expect(el).to.be.accessible();
});

it('fallback="text" renders a plain string result as preformatted text, not lr-json-viewer', async () => {
  const el = (await fixture(html`
    <lr-tool-result-view tool-name="unregistered" fallback="text" .result=${'line one\nline two'}></lr-tool-result-view>
  `)) as LyraToolResultView;
  const pre = base(el).querySelector('[part="fallback-text"]');
  expect((pre) != null).to.equal(true);
  expect(pre!.textContent).to.equal('line one\nline two');
  expect((base(el).querySelector('lr-json-viewer')) == null).to.be.true;
});

it('chains the fallback-text font through the shared --lr-font-mono token, honoring a --lr-theme-font-family-mono override', async () => {
  const el = (await fixture(html`
    <lr-tool-result-view tool-name="unregistered" fallback="text" style="--lr-theme-font-family-mono: 'Custom Mono';" .result=${'line one'}></lr-tool-result-view>
  `)) as LyraToolResultView;
  const pre = base(el).querySelector('[part="fallback-text"]') as HTMLElement;
  expect(getComputedStyle(pre).fontFamily).to.contain('Custom Mono');
});

it('fallback="text" still falls back to lr-json-viewer when the result is not a string', async () => {
  const el = (await fixture(html`
    <lr-tool-result-view tool-name="unregistered" fallback="text" .result=${{ ok: true }}></lr-tool-result-view>
  `)) as LyraToolResultView;
  expect(base(el).querySelector('lr-json-viewer')).to.exist;
  expect((base(el).querySelector('[part="fallback-text"]')) == null).to.be.true;
});

it('copyable renders a lr-copy-button alongside the text fallback, wired to the result text', async () => {
  const el = (await fixture(html`
    <lr-tool-result-view tool-name="unregistered" fallback="text" copyable .result=${'copy me'}></lr-tool-result-view>
  `)) as LyraToolResultView;
  const btn = base(el).querySelector('lr-copy-button') as (HTMLElement & { value: string }) | null;
  expect((btn) != null).to.equal(true);
  expect(btn!.value).to.equal('copy me');
});

it('copyable also forwards to lr-json-viewer in the default json fallback', async () => {
  const el = (await fixture(html`
    <lr-tool-result-view tool-name="unregistered" copyable .result=${{ ok: true }}></lr-tool-result-view>
  `)) as LyraToolResultView;
  const viewer = base(el).querySelector('lr-json-viewer') as HTMLElement & { copyable: boolean };
  expect(viewer.copyable).to.be.true;
});

describe('status / context.reportStatus', () => {
  it('defaults status to "success" for a renderer that never calls reportStatus (unset regression)', async () => {
    registerToolRenderer('get_weather', {
      render: (result, args) => litHtml`<span class="weather">${JSON.stringify(result)}${JSON.stringify(args)}</span>`,
    });
    const el = (await fixture(html`
      <lr-tool-result-view tool-name="get_weather" .result=${{ tempC: 19 }}></lr-tool-result-view>
    `)) as LyraToolResultView;
    expect(el.status).to.equal('success');
    expect(el.getAttribute('status')).to.equal('success');
    expect(base(el).querySelector('.weather')).to.exist;
  });

  it('threads context.reportStatus through render(), setting status while keeping the renderer\'s own content mounted', async () => {
    registerToolRenderer('flaky_tool', {
      render: (_result, _args, context) => {
        if (!context) throw new Error('Expected the tool renderer context.');
        context.reportStatus('error');
        return litHtml`<span class="flaky-result">partial</span>`;
      },
    });
    const el = (await fixture(html`
      <lr-tool-result-view tool-name="flaky_tool" .result=${{ ok: false }}></lr-tool-result-view>
    `)) as LyraToolResultView;
    expect(el.status).to.equal('error');
    expect(el.getAttribute('status')).to.equal('error');
    expect(base(el).querySelector('.flaky-result')).to.exist;
    expect((base(el).querySelector('lr-json-viewer')) == null).to.be.true;
  });

  it('resets status back to "success" on the next resolve when the newly-matched renderer stays quiet', async () => {
    registerToolRenderer('flaky_tool', {
      render: (_result, _args, context) => {
        if (!context) throw new Error('Expected the tool renderer context.');
        context.reportStatus('error');
        return litHtml`<span class="flaky-result">partial</span>`;
      },
    });
    registerToolRenderer('quiet_tool', { render: () => litHtml`<span class="quiet">ok</span>` });

    const el = (await fixture(html`
      <lr-tool-result-view tool-name="flaky_tool" .result=${{}}></lr-tool-result-view>
    `)) as LyraToolResultView;
    expect(el.status).to.equal('error');

    el.toolName = 'quiet_tool';
    await el.updateComplete;
    expect(el.status).to.equal('success');
  });

  it('threads context.reportStatus through the lazy load() path too', async () => {
    registerToolRenderer('slow_status_tool', {
      load: () =>
        Promise.resolve({
          render: (_result: unknown, _args: unknown, context?: ToolRenderContext) => {
            if (!context) throw new Error('Expected the lazy tool renderer context.');
            context.reportStatus('denied');
            return litHtml`<span class="lazy-status">lazy</span>`;
          },
        }),
    });

    const el = (await fixture(html`
      <lr-tool-result-view tool-name="slow_status_tool" .result=${{}}></lr-tool-result-view>
    `)) as LyraToolResultView;

    await waitUntil(() => base(el).querySelector('.lazy-status') !== null);
    expect(el.status).to.equal('denied');
  });

  it('every pre-existing 2-arg renderer (result, args) stays assignable and unaffected by the 3rd context argument', async () => {
    let seen: { result: unknown; args: unknown } | undefined;
    registerToolRenderer('get_weather', {
      render: (result, args) => {
        seen = { result, args };
        return litHtml`<span class="weather-2arg">${JSON.stringify(result)}</span>`;
      },
    });
    const el = (await fixture(html`
      <lr-tool-result-view
        tool-name="get_weather"
        .result=${{ tempC: 19 }}
        .args=${{ location: 'Brussels' }}
      ></lr-tool-result-view>
    `)) as LyraToolResultView;
    expect(base(el).querySelector('.weather-2arg')).to.exist;
    expect(el.status).to.equal('success');
    expect(seen).to.deep.equal({ result: { tempC: 19 }, args: { location: 'Brussels' } });
  });
});

it('registers and upgrades the copy button it renders, through its own entry point alone', async () => {
  // This file imports `./tool-result-view.js` and nothing else, so the granular entry point is the
  // whole module graph -- exactly what a consumer importing one component gets. `<lr-copy-button>`
  // was rendered but never registered there (only its side-effect-free `.class.js` was imported),
  // so it reached the page as an inert, never-upgrading element that swallowed every click.
  expect(customElements.get('lr-copy-button') !== undefined, 'registered by the entry point').to.be
    .true;

  const el = (await fixture(
    html`<lr-tool-result-view
      tool-name="unregistered"
      fallback="text"
      copyable
      .result=${'copy me'}
    ></lr-tool-result-view>`,
  )) as LyraToolResultView;
  await el.updateComplete;

  const copy = base(el).querySelector('lr-copy-button') as (HTMLElement & { value?: string }) | null;
  // Compared as booleans, never as DOM nodes: a failing chai assertion carrying an element hangs
  // the whole file.
  expect(copy !== null, 'rendered alongside the text fallback').to.be.true;
  await (copy as unknown as { updateComplete?: Promise<unknown> }).updateComplete;

  // Presence in the DOM proves nothing -- an unregistered custom element still parses into an
  // element with the right tag name. Only an upgraded one is an instance of its class and has a
  // shadow root with the real button inside it.
  expect(copy instanceof customElements.get('lr-copy-button')!, 'upgraded, not inert').to.be.true;
  expect(copy!.shadowRoot !== null, 'an upgraded element renders its own shadow root').to.be.true;
  expect(
    copy!.shadowRoot!.querySelector('button') !== null,
    'the clickable affordance an inert element never grew',
  ).to.be.true;
  expect(copy!.value).to.equal('copy me');
});
