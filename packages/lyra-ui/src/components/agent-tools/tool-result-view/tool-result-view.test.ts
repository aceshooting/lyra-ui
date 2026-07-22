import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import './tool-result-view.js';
import type { LyraToolResultView } from './tool-result-view.js';
import {
  registerToolRenderer,
  clearToolRenderers,
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
  expect(base(el).querySelector('lr-json-viewer')).to.not.exist;
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
  expect(base(el).querySelector('.search-result')).to.not.exist;
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
  expect(base(el).querySelector('.default-registry')).to.not.exist;
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
  expect(base(el).querySelector('.flaky')).to.not.exist;
});

it('shows a lr-skeleton while an async load() is pending, then renders its resolved output', async () => {
  let resolveLoad!: (mod: { default: ToolRendererDefinition }) => void;
  const loadPromise = new Promise<{ default: ToolRendererDefinition }>((resolve) => {
    resolveLoad = resolve;
  });
  registerToolRenderer('slow_tool', { load: () => loadPromise });

  const el = (await fixture(html`
    <lr-tool-result-view tool-name="slow_tool" .result=${{ a: 1 }}></lr-tool-result-view>
  `)) as LyraToolResultView;

  expect(base(el).querySelector('lr-skeleton')).to.exist;

  resolveLoad({ default: { render: (result) => litHtml`<span class="loaded">${(result as { a: number }).a}</span>` } });
  await waitUntil(() => base(el).querySelector('lr-skeleton') === null);

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
  let resolveSlow!: (mod: { default: ToolRendererDefinition }) => void;
  const slowPromise = new Promise<{ default: ToolRendererDefinition }>((resolve) => {
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
  expect(base(el).querySelector('.stale')).to.not.exist;
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

  expect(base(el).querySelector('lr-skeleton'), 'a cached load() must not re-show the loading skeleton').to.not
    .exist;
  expect(
    base(el).querySelector('.loaded'),
    'the already-rendered DOM subtree must be reused in place, not torn down and rebuilt via a loading round-trip',
  ).to.equal(spanBefore);
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
  expect(pre).to.exist;
  expect(pre!.textContent).to.equal('line one\nline two');
  expect(base(el).querySelector('lr-json-viewer')).to.not.exist;
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
  expect(base(el).querySelector('[part="fallback-text"]')).to.not.exist;
});

it('copyable renders a lr-copy-button alongside the text fallback, wired to the result text', async () => {
  const el = (await fixture(html`
    <lr-tool-result-view tool-name="unregistered" fallback="text" copyable .result=${'copy me'}></lr-tool-result-view>
  `)) as LyraToolResultView;
  const btn = base(el).querySelector('lr-copy-button') as (HTMLElement & { value: string }) | null;
  expect(btn).to.exist;
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
    expect(base(el).querySelector('lr-json-viewer')).to.not.exist;
  });

  it('resets status back to "success" on the next resolve when the newly-matched renderer stays quiet', async () => {
    registerToolRenderer('flaky_tool', {
      render: (_result, _args, context) => {
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
          render: (_result: unknown, _args: unknown, context: { reportStatus: (s: string) => void }) => {
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
