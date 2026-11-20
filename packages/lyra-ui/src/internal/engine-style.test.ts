import { expect, waitUntil } from '@open-wc/testing';
import { ENGINE_CHART_PALETTE, ENGINE_STYLE_MEDIA_QUERIES, engineStyle, resolveEngineStyle } from './engine-style.js';

const CHART = ['#010101', '#020202', '#030303', '#040404', '#050505', '#060606', '#070707', '#080808'];
const TOKENS = [
  '--lr-color-surface: #ffffff',
  '--lr-color-text: #102030',
  '--lr-color-text-quiet: #405060',
  '--lr-color-brand: #0969da',
  '--lr-focus-ring-color: #ff0000',
  ...CHART.map((value, index) => `--lr-color-chart-${index + 1}: ${value}`),
  'color: #102030',
  'font: 16px serif',
].join('; ');

const created: Element[] = [];

function engineHost(style = TOKENS, doc: Document = document): HTMLElement {
  const host = doc.createElement('div');
  host.attachShadow({ mode: 'open' });
  host.setAttribute('style', style);
  doc.body.append(host);
  created.push(host);
  return host;
}

/** Counts the colour probes `resolveEngineStyle` inserts into the host's shadow root. */
function probeCounter(host: HTMLElement): () => number {
  const observer = new MutationObserver(() => undefined);
  observer.observe(host.shadowRoot!, { childList: true });
  return () => observer.takeRecords().reduce((sum, record) => sum + record.addedNodes.length, 0);
}

function withProperty<T>(target: object, key: string, value: unknown, run: () => T): T {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, get: () => value });
  try {
    return run();
  } finally {
    if (original) Object.defineProperty(target, key, original);
    else Reflect.deleteProperty(target, key);
  }
}

afterEach(() => {
  for (const element of created.splice(0)) element.remove();
});

describe('resolveEngineStyle', () => {
  it('resolves theme tokens, the chart palette, fonts and preferences in the owner window', () => {
    const host = engineHost();
    const style = resolveEngineStyle(host);
    expect([style.background, style.foreground, style.muted, style.accent, style.focus]).to.deep.equal([
      'rgb(255, 255, 255)',
      'rgb(16, 32, 48)',
      'rgb(64, 80, 96)',
      'rgb(9, 105, 218)',
      'rgb(255, 0, 0)',
    ]);
    expect([...style.palette]).to.deep.equal(CHART.map((_, index) => `rgb(${index + 1}, ${index + 1}, ${index + 1})`));
    expect(style.fontFamily).to.equal(getComputedStyle(host).fontFamily);
    expect([style.fontSize, style.pointSize, style.lineWidth]).to.deep.equal([16, 8, 1]);
    expect(style.devicePixelRatio).to.equal(Math.min(4, Math.max(0.25, window.devicePixelRatio)));
    expect(style.reducedMotion).to.equal(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    expect(style.forcedColors).to.equal(window.matchMedia('(forced-colors: active)').matches);
    expect(Object.isFrozen(style) && Object.isFrozen(style.palette)).to.equal(true);
    expect([...ENGINE_CHART_PALETTE]).to.deep.equal(CHART.map((_, index) => `--lr-color-chart-${index + 1}`));
    expect([...ENGINE_STYLE_MEDIA_QUERIES]).to.deep.equal([
      '(prefers-reduced-motion: reduce)',
      '(forced-colors: active)',
      '(prefers-color-scheme: dark)',
    ]);
  });

  it('returns the same style until an input changes and probes only colours it has not resolved', () => {
    const host = engineHost();
    const probes = probeCounter(host);
    const first = resolveEngineStyle(host);
    expect(probes()).to.equal(13);
    expect(resolveEngineStyle(host) === first).to.equal(true);
    expect(probes()).to.equal(0);

    host.style.setProperty('--lr-color-brand', '#00ff00');
    const second = resolveEngineStyle(host);
    expect(second === first).to.equal(false);
    expect(second.accent).to.equal('rgb(0, 255, 0)');
    expect(second.background).to.equal(first.background);
    expect(probes()).to.equal(1);

    host.style.color = '#000000';
    resolveEngineStyle(host);
    expect(probes()).to.equal(13);
  });

  it('probes a colour value shared by several tokens once', () => {
    const shared = TOKENS.replace(/--lr-color-chart-(\d): #0\d0\d0\d/gu, '--lr-color-chart-$1: #abcdef');
    const host = engineHost(shared);
    const probes = probeCounter(host);
    const style = resolveEngineStyle(host);
    expect(probes()).to.equal(6);
    expect(new Set(style.palette).size).to.equal(1);
    expect(style.palette[7]).to.equal('rgb(171, 205, 239)');
  });

  it('falls back to the host colour for a token that is not a colour', () => {
    const host = engineHost(`${TOKENS}; --lr-color-brand: not-a-colour`);
    expect(resolveEngineStyle(host).accent).to.equal('rgb(16, 32, 48)');
  });

  it('keeps a translucent token translucent', () => {
    const host = engineHost(`${TOKENS}; --lr-color-text-quiet: rgb(0 0 0 / 50%)`);
    expect(resolveEngineStyle(host).muted).to.match(/^rgba\(0, 0, 0, 0\.5\d*\)$/u);
  });

  it('resolves a custom palette and the fixed sizes a renderer asks for', () => {
    const host = engineHost();
    const style = resolveEngineStyle(host, { palette: ['--lr-color-brand'], pointSize: 24, lineWidth: 2 });
    expect([...style.palette]).to.deep.equal(['rgb(9, 105, 218)']);
    expect([style.pointSize, style.lineWidth]).to.deep.equal([24, 2]);
    const hostile = resolveEngineStyle(host, { pointSize: Number.NaN, lineWidth: 500 });
    expect([hostile.pointSize, hostile.lineWidth]).to.deep.equal([8, 64]);
  });

  it('measures point size and line width live from a probe element, within bounds', () => {
    const host = engineHost();
    const probe = document.createElement('span');
    probe.setAttribute('style', 'display: block; inline-size: 10px; border-block-start: 3px solid');
    host.shadowRoot!.append(probe);
    let style = resolveEngineStyle(host, { probe });
    expect([style.pointSize, style.lineWidth]).to.deep.equal([10, 3]);

    probe.style.inlineSize = '2000px';
    probe.style.borderBlockStartWidth = '100px';
    style = resolveEngineStyle(host, { probe });
    expect([style.pointSize, style.lineWidth]).to.deep.equal([1024, 64]);

    probe.style.display = 'none';
    probe.style.inlineSize = 'auto';
    probe.style.borderBlockStartStyle = 'none';
    style = resolveEngineStyle(host, { probe, pointSize: 5 });
    expect([style.pointSize, style.lineWidth]).to.deep.equal([5, 0]);
  });

  it('bounds the device pixel ratio', () => {
    const host = engineHost();
    const ratio = (value: number): number =>
      withProperty(window, 'devicePixelRatio', value, () => resolveEngineStyle(host).devicePixelRatio);
    expect([ratio(10), ratio(0.1), ratio(Number.NaN), ratio(2)]).to.deep.equal([4, 0.25, 1, 2]);
  });

  it('reads media preferences and colours from the host document window', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    created.push(frame);
    await waitUntil(() => frame.contentDocument?.readyState === 'complete');
    const view = frame.contentWindow!;
    const queries: string[] = [];
    const answer = (query: string): MediaQueryList =>
      ({ matches: query !== '(prefers-color-scheme: dark)', media: query } as MediaQueryList);
    const style = withProperty(view, 'matchMedia', (query: string) => {
      queries.push(query);
      return answer(query);
    }, () => resolveEngineStyle(engineHost(TOKENS, frame.contentDocument!)));
    expect([style.reducedMotion, style.forcedColors]).to.deep.equal([true, true]);
    expect(style.background).to.equal('rgb(255, 255, 255)');
    expect([...queries].sort()).to.deep.equal([...ENGINE_STYLE_MEDIA_QUERIES].sort());
  });

  it('keeps the computed colour when the canvas readback is unavailable', () => {
    const host = engineHost(`${TOKENS}; --lr-color-brand: color(display-p3 1 0 0)`);
    const getContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => null });
    try {
      expect(resolveEngineStyle(host).accent).to.match(/^color\(display-p3 1 0 0\)$/u);
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContext);
    }
  });
});

describe('engineStyle', () => {
  it('resolves the theme colours, the given palette, sizes and bounded window preferences', () => {
    const host = engineHost();
    const style = engineStyle(host, ['--lr-color-brand', '--lr-color-chart-2'], 24, 2);
    expect([style.background, style.foreground, style.muted, style.accent, style.focus]).to.deep.equal([
      'rgb(255, 255, 255)', 'rgb(16, 32, 48)', 'rgb(64, 80, 96)', 'rgb(9, 105, 218)', 'rgb(255, 0, 0)',
    ]);
    expect([...style.palette]).to.deep.equal(['rgb(9, 105, 218)', 'rgb(2, 2, 2)']);
    expect([style.fontFamily, style.fontSize, style.pointSize, style.lineWidth])
      .to.deep.equal([getComputedStyle(host).fontFamily, 16, 24, 2]);
    expect([style.reducedMotion, style.forcedColors]).to.deep.equal([
      window.matchMedia('(prefers-reduced-motion: reduce)').matches, window.matchMedia('(forced-colors: active)').matches,
    ]);
    const ratio = (value: number): number =>
      withProperty(window, 'devicePixelRatio', value, () => engineStyle(host, [], 1, 1).devicePixelRatio);
    expect([ratio(10), ratio(0.1), ratio(Number.NaN), ratio(2)]).to.deep.equal([4, 0.25, 1, 2]);
  });

  it('keeps the resolved colour when the canvas readback is unavailable', () => {
    const host = engineHost(`${TOKENS}; --lr-color-brand: color(display-p3 1 0 0)`);
    const getContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')!;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => null });
    try {
      expect(engineStyle(host, ['--lr-color-brand'], 1, 1).palette[0]).to.match(/^color\(display-p3 1 0 0\)$/u);
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContext);
    }
  });
});
