import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { captureReentrantUpdateWarning } from '../../../../test/expected-lit-update.js';
import { nextFrame } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setColorScheme, setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import { chart3dEngineEnvironment, chart3dPointsLoader } from './chart-3d-engine.js';
import type { Chart3dEngineData } from './chart-3d-data.js';
import type { LyraChart3d, LyraChart3dColumns } from './chart-3d.class.js';
import './chart-3d.js';

const PICK = { shift: false, ctrl: false, double: false } as const;

interface EngineState {
  readonly selected: ReadonlySet<number>;
  readonly dimmed: ReadonlySet<number>;
  readonly hover: number;
  readonly focus: number;
}

/** Everything the doubled peer observed, plus switches that make it misbehave on demand. */
interface Peer {
  creates: number;
  mounts: number;
  disposed: number;
  fits: number;
  containers: string[];
  data: { value: Chart3dEngineData; revision: number }[];
  styles: Record<string, unknown>[];
  states: EngineState[];
  cameras: unknown[];
  resizes: [number, number][];
  host?: Engine3dHost;
  completeMount?: () => void;
  deferMount: boolean;
  mountError?: Error;
  dataError: boolean;
  styleError: boolean;
  stateError: boolean;
  cameraError: boolean;
  cameraHook?: () => void;
  disposeHook?: () => void;
  probes: number;
}

function columns(count = 3, extra: Partial<LyraChart3dColumns> = {}): LyraChart3dColumns {
  return {
    ids: Array.from({ length: count }, (_, index) => `row-${index}`),
    x: Float32Array.from({ length: count }, (_, index) => index),
    y: Float32Array.from({ length: count }, (_, index) => index * 2),
    z: Float32Array.from({ length: count }, (_, index) => (index === 0 ? 0 : -index)),
    ...extra,
  };
}

const part = (el: LyraChart3d, name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const has = (el: LyraChart3d, name: string) => part(el, name) !== null;
const text = (el: LyraChart3d, name: string) => part(el, name)?.textContent?.trim() ?? null;
const ready = (el: LyraChart3d) => waitUntil(() => has(el, 'fit-button'), 'the renderer did not become ready', { timeout: 5000 });
const live = (politeness: 'polite' | 'assertive') => document.querySelector(`[data-lr-live-region="${politeness}"]`)?.textContent ?? '';

describe('lr-chart-3d optional renderer', () => {
  const available = chart3dEngineEnvironment.available;
  const visible = chart3dEngineEnvironment.visible;
  let peer: Peer;

  function install(): void {
    chart3dPointsLoader.override(async () => ({
      createEngine: (): Engine3dInstance => {
        peer.creates++;
        return {
          contract: 1,
          async mount(container, next) {
            peer.mounts++;
            peer.host = next;
            peer.containers.push(container.getAttribute('part') ?? '');
            if (peer.mountError) throw peer.mountError;
            if (peer.deferMount) await new Promise<void>((resolve) => { peer.completeMount = resolve; });
          },
          setData(value, revision) {
            if (peer.dataError) throw new Error('data rejected');
            peer.data.push({ value: value as Chart3dEngineData, revision });
          },
          setStyle(style) {
            if (peer.styleError) throw new Error('style rejected');
            peer.styles.push(style as Record<string, unknown>);
          },
          setState(state) {
            if (peer.stateError) throw new Error('state rejected');
            peer.states.push(state);
          },
          setCamera(camera) {
            peer.cameraHook?.();
            if (peer.cameraError) throw new Error('camera rejected');
            peer.cameras.push(camera);
          },
          fit() { peer.fits++; },
          resize(width, height) { peer.resizes.push([width, height]); },
          dispose() { peer.disposed++; peer.disposeHook?.(); },
        };
      },
    }));
  }

  beforeEach(() => {
    peer = {
      creates: 0, mounts: 0, disposed: 0, fits: 0, containers: [], data: [], styles: [], states: [], cameras: [], resizes: [],
      deferMount: false, dataError: false, styleError: false, stateError: false, cameraError: false, probes: 0,
    };
    chart3dEngineEnvironment.available = () => { peer.probes++; return true; };
    install();
  });

  afterEach(async () => {
    chart3dPointsLoader.override(undefined);
    chart3dEngineEnvironment.available = available;
    chart3dEngineEnvironment.visible = visible;
    await setColorScheme('no-preference');
    await setForcedColors('none');
    await setReducedMotion('no-preference');
  });

  async function chart(attributes: string, data: LyraChart3dColumns | null = columns()): Promise<LyraChart3d> {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const el = document.createElement('lr-chart-3d') as LyraChart3d;
    for (const entry of attributes.split(/\s+/).filter(Boolean)) {
      const [name, value = ''] = entry.split('=');
      el.setAttribute(name!, value);
    }
    el.data = data;
    wrapper.append(el);
    await el.updateComplete;
    return el;
  }

  describe('opt-in, capability and failure', () => {
    it('imports nothing and probes nothing under the unset builtin default', async () => {
      const el = await chart('');
      await aTimeout(30);
      expect([el.engine, peer.creates, peer.probes, has(el, 'engine')]).to.deep.equal(['builtin', 0, 0, false]);
      el.engine = 'mistyped' as 'builtin';
      el.type = 'line';
      await el.updateComplete;
      expect([el.engine, peer.creates, peer.probes]).to.deep.equal(['builtin', 0, 0]);
    });

    it('probes WebGL2 before downloading and descends straight to the table with a visible, announced notice', async () => {
      chart3dEngineEnvironment.available = () => { peer.probes++; return false; };
      const el = await chart('');
      const fallbacks: unknown[] = [];
      el.addEventListener('lr-engine-fallback', (event) => fallbacks.push((event as CustomEvent).detail));
      const first = oneEvent(el, 'lr-engine-fallback');
      el.engine = 'webgl';
      expect((await first).detail).to.deep.equal({ from: 'webgl', to: 'list', reason: 'unsupported' });
      await el.updateComplete;
      expect([peer.creates, peer.probes, fallbacks.length]).to.deep.equal([0, 1, 1]);
      expect(Object.isFrozen(fallbacks[0])).to.equal(true);
      expect(part(el, 'engine')!.hasAttribute('hidden')).to.equal(true);
      expect(part(el, 'engine-notice')!.getAttribute('role')).to.equal(null);
      expect(Array.from(part(el, 'engine-notice')!.querySelectorAll('p')).map((p) => p.textContent)).to.deep.equal([
        'This browser cannot display 3D graphics.', 'Showing a list instead.',
      ]);
      expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(3);
      await waitUntil(() => live('assertive').includes('This browser cannot display 3D graphics.'));
      await waitUntil(() => live('polite').includes('Showing a list instead.'));
      await expect(el).to.be.accessible();
    });

    it('localizes the fallback notice through .strings', async () => {
      chart3dEngineEnvironment.available = () => false;
      const el = await chart('', columns());
      el.strings = { engine3dUnsupported: 'Pas de graphiques 3D', engine3dShowingList: 'Liste affichée' };
      const fallback = oneEvent(el, 'lr-engine-fallback');
      el.engine = 'webgl';
      await fallback;
      await el.updateComplete;
      expect(Array.from(part(el, 'engine-notice')!.querySelectorAll('p')).map((p) => p.textContent)).to.deep.equal(['Pas de graphiques 3D', 'Liste affichée']);
    });

    it('reports a missing companion as unavailable and keeps the table', async () => {
      expectDevWarning('lyra-3d-points-unavailable');
      chart3dPointsLoader.override(async () => { throw new Error('missing'); });
      const el = await chart('');
      const fallback = oneEvent(el, 'lr-engine-fallback');
      el.engine = 'webgl';
      expect((await fallback).detail).to.deep.equal({ from: 'webgl', to: 'list', reason: 'unavailable' });
      await el.updateComplete;
      expect(text(el, 'engine-notice')).to.contain('The 3D engine could not be loaded.');
      expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(3);
    });

    it('falls back after a mount rejection, disposing the renderer exactly once', async () => {
      peer.mountError = new Error('mount rejected');
      const el = await chart('');
      const first = oneEvent(el, 'lr-engine-fallback');
      el.engine = 'webgl';
      expect((await first).detail).to.deep.equal({ from: 'webgl', to: 'list', reason: 'error' });
      await el.updateComplete;
      expect([peer.creates, peer.disposed, peer.data.length]).to.deep.equal([1, 1, 0]);
      expect(text(el, 'engine-notice')).to.contain('The 3D view stopped because of an error.');
      expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(3);
    });

    it('falls back when the renderer rejects the payload', async () => {
      peer.dataError = true;
      const el = await chart('');
      const first = oneEvent(el, 'lr-engine-fallback');
      el.engine = 'webgl';
      expect((await first).detail.reason).to.equal('error');
      expect([peer.disposed, peer.data.length, has(el, 'fit-button')]).to.deep.equal([1, 0, false]);
    });

    it('returns to a fresh renderer when the preference is written again after a failure', async () => {
      peer.dataError = true;
      const el = await chart('engine=webgl');
      await waitUntil(() => text(el, 'engine-notice')?.includes('stopped because of an error') === true);
      peer.dataError = false;
      el.engine = 'builtin';
      await el.updateComplete;
      expect(has(el, 'engine-notice')).to.equal(false);
      el.engine = 'webgl';
      await ready(el);
      expect([peer.creates, peer.disposed]).to.deep.equal([2, 1]);
    });
  });

  describe('admission', () => {
    it('mounts after the first intersection, probing and importing only then', async () => {
      const wrapper = await fixture<HTMLElement>(html`<div style="position:fixed;inset-block-start:0;inset-inline-start:-6000px;inline-size:480px"></div>`);
      const el = document.createElement('lr-chart-3d') as LyraChart3d;
      el.setAttribute('engine', 'webgl');
      el.data = columns();
      wrapper.append(el);
      await el.updateComplete;
      // wait-reason: asserting that nothing starts while the chart is off screen; no event marks the absence
      await aTimeout(120);
      expect([peer.probes, peer.creates, has(el, 'fit-button')]).to.deep.equal([0, 0, false]);
      wrapper.style.insetInlineStart = '0';
      await ready(el);
      expect([peer.probes, peer.creates, peer.mounts]).to.deep.equal([1, 1, 1]);
    });

    it('does not download while hidden and mounts when first shown', async () => {
      const wrapper = await fixture<HTMLElement>(html`<div hidden><lr-chart-3d engine="webgl" .data=${columns()}></lr-chart-3d></div>`);
      await aTimeout(60);
      expect(peer.creates).to.equal(0);
      wrapper.hidden = false;
      await ready(wrapper.querySelector<LyraChart3d>('lr-chart-3d')!);
      expect(peer.creates).to.equal(1);
    });

    for (const fence of ['aria-hidden', 'inert', 'visibility'] as const) {
      it(`starts after ${fence} is removed without another native intersection change`, async () => {
        const OriginalIntersectionObserver = window.IntersectionObserver;
        const intersected = new Set<Element>();
        window.IntersectionObserver = class extends OriginalIntersectionObserver {
          constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
            super((entries, observer) => {
              callback(entries, observer);
              for (const entry of entries) {
                const root = entry.target.getRootNode();
                if (entry.isIntersecting && root instanceof ShadowRoot) intersected.add(root.host);
              }
            }, options);
          }
        };
        try {
          const wrapper = await fixture<HTMLDivElement>(html`<div aria-hidden=${fence === 'aria-hidden' ? 'true' : 'false'} ?inert=${fence === 'inert'}
            style=${fence === 'visibility' ? 'visibility:hidden' : ''}><lr-chart-3d engine="webgl" .data=${columns()}></lr-chart-3d></div>`);
          const element = wrapper.firstElementChild!;
          await waitUntil(() => intersected.has(element), 'native intersection must report the fenced branch');
          expect(peer.creates).to.equal(0);
          const before = element.getBoundingClientRect();
          wrapper.removeAttribute('aria-hidden');
          wrapper.inert = false;
          wrapper.style.visibility = 'visible';
          const after = element.getBoundingClientRect();
          expect([after.x, after.y, after.width, after.height]).to.deep.equal([before.x, before.y, before.width, before.height]);
          await ready(element as LyraChart3d);
          expect(peer.creates).to.equal(1);
        } finally {
          window.IntersectionObserver = OriginalIntersectionObserver;
        }
      });
    }

    it('does not start a renderer for an empty, filtered-out or invalid chart', async () => {
      const el = await chart('engine=webgl', null);
      el.data = columns(2, { category: Uint16Array.of(0, 0), categories: ['a'] });
      el.hiddenCategories = new Set([0]);
      await el.updateComplete;
      el.data = { ...columns(), ids: ['same', 'same', 'other'] };
      await el.updateComplete;
      await aTimeout(60);
      expect([peer.probes, peer.creates, has(el, 'engine')]).to.deep.equal([0, 0, false]);
    });
  });

  describe('payload and style', () => {
    it('mounts once, resolves the tokens and fits when no camera was authored', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      expect([peer.creates, peer.mounts, peer.containers]).to.deep.equal([1, 1, ['engine']]);
      expect([peer.fits, peer.cameras.length]).to.deep.equal([1, 0]);
      expect([peer.data.length, peer.data[0]!.revision, peer.data[0]!.value.positions.length]).to.deep.equal([1, 1, 9]);
      expect(peer.data[0]!.value.axes.map((axis) => [axis.axis, axis.label, axis.ticks.length])).to.deep.equal([['x', 'X', 5], ['y', 'Y', 5], ['z', 'Z', 5]]);
      expect(peer.resizes[0]![0]).to.be.above(0);
      expect(peer.resizes[0]![1]).to.be.above(0);
      expect(part(el, 'base')!.getAttribute('aria-busy')).to.equal('false');
      expect(part(el, 'engine')!.hasAttribute('hidden')).to.equal(false);
      expect(has(el, 'engine-notice')).to.equal(false);
      const style = peer.styles[0]!;
      expect((style['palette'] as string[]).length).to.equal(8);
      expect(new Set(style['palette'] as string[]).size).to.be.above(1);
      expect([style['reducedMotion'], style['forcedColors']]).to.deep.equal([false, false]);
      expect(style['background']).to.match(/^rgba\(/);
      await expect(el).to.be.accessible();
    });

    it('uses an authored camera instead of fitting', async () => {
      const el = await chart('engine=webgl');
      el.camera = { yaw: 1, pitch: 0.5, distance: 7, target: { x: 0, y: 0, z: 0 } };
      await ready(el);
      expect(peer.cameras.at(-1)).to.deep.equal(el.camera);
      expect(peer.fits).to.equal(0);
    });

    it('sends diameters and categories in row order for a bubble chart and joined rows for a line chart', async () => {
      const el = await chart('engine=webgl type=bubble', columns(3, { size: Float32Array.of(8, 16, 24), category: Uint16Array.of(0, 1, 0), categories: ['a', 'b'] }));
      await ready(el);
      const payload = peer.data.at(-1)!.value;
      expect([Array.from(payload.sizes!), Array.from(payload.categories!), payload.segments]).to.deep.equal([[8, 16, 24], [0, 1, 0], undefined]);
      el.type = 'line';
      await el.updateComplete;
      await ready(el);
      const line = peer.data.at(-1)!.value;
      expect([Array.from(line.segments!), line.sizes]).to.deep.equal([[0, 1, 1, 2], undefined]);
      el.type = 'scatter';
      await el.updateComplete;
      await ready(el);
      const dots = peer.data.at(-1)!.value;
      expect([dots.sizes, dots.segments]).to.deep.equal([undefined, undefined]);
    });

    it('resolves point size, line width and category colors from the live tokens', async () => {
      const wrapper = await fixture<HTMLElement>(html`<div data-lr-theme-scope style="--lr-theme-color-chart-1:rgb(1,2,3);--lr-theme-color-chart-2:rgb(4,5,6);--lr-color-brand:rgb(255,0,0);--lr-chart-3d-point-size:20px;--lr-chart-3d-line-width:3px"></div>`);
      const el = document.createElement('lr-chart-3d') as LyraChart3d;
      el.engine = 'webgl';
      el.data = columns();
      wrapper.append(el);
      await ready(el);
      const style = peer.styles[0]!;
      expect([style['pointSize'], style['lineWidth']]).to.deep.equal([20, 3]);
      expect((style['palette'] as string[]).slice(0, 2)).to.deep.equal(['rgba(1, 2, 3, 1)', 'rgba(4, 5, 6, 1)']);
      expect(style['accent']).to.equal('rgba(255, 0, 0, 1)');
    });

    it('re-resolves its style when an ancestor changes a token, the theme or a media preference', async () => {
      const wrapper = await fixture<HTMLElement>(html`<div data-lr-theme-scope></div>`);
      const el = document.createElement('lr-chart-3d') as LyraChart3d;
      el.engine = 'webgl';
      el.data = columns();
      wrapper.append(el);
      await ready(el);
      const latest = () => peer.styles.at(-1)!;
      const before = peer.styles.length;
      wrapper.style.setProperty('--lr-color-brand', 'rgb(9,8,7)');
      await waitUntil(() => latest()['accent'] === 'rgba(9, 8, 7, 1)');
      expect(peer.styles.length).to.be.above(before);
      await setForcedColors('active');
      if (matchMedia('(forced-colors: active)').matches) await waitUntil(() => latest()['forcedColors'] === true);
      await setForcedColors('none');
      await waitUntil(() => latest()['forcedColors'] === false);
      await setReducedMotion('reduce');
      await waitUntil(() => latest()['reducedMotion'] === true);
      await setReducedMotion('no-preference');
      await waitUntil(() => latest()['reducedMotion'] === false);
      await setColorScheme('light');
      await nextFrame();
      const light = String(latest()['background']);
      await setColorScheme('dark');
      await waitUntil(() => latest()['background'] !== light);
    });

    it('resizes the renderer when its box changes', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      const count = peer.resizes.length;
      el.style.setProperty('--lr-chart-3d-height', '10rem');
      await waitUntil(() => peer.resizes.length > count);
      const box = part(el, 'engine')!.getBoundingClientRect();
      expect(peer.resizes.at(-1)![1]).to.be.closeTo(box.height, 1);
      expect(box.height).to.be.closeTo(160, 1);
    });
  });

  describe('selection, hover and focus', () => {
    it('maps filtered picks to original IDs, ignores out-of-range and stale picks, and reports each user pick once', async () => {
      const el = await chart('engine=webgl', columns(4, { category: Uint16Array.of(0, 1, 0, 1), categories: ['a', 'b'] }));
      el.hiddenCategories = new Set([0]);
      await ready(el);
      await waitUntil(() => peer.data.length === 1 && peer.data[0]!.value.positions.length === 6);
      const selections: unknown[] = [];
      el.addEventListener('lr-chart-row-select', (event) => selections.push((event as CustomEvent).detail));
      const host = peer.host!;
      host.pick(1, PICK);
      expect(selections).to.deep.equal([{ id: 'row-3', index: 3 }]);
      expect(el.selectedId).to.equal('row-3');
      for (const invalid of [2, 99, -1, 0.5, Number.NaN, null]) host.pick(invalid, PICK);
      expect(selections.length).to.equal(1);
      host.pick(0, PICK);
      expect(selections.at(-1)).to.deep.equal({ id: 'row-1', index: 1 });
      await el.updateComplete;
      expect(Array.from(peer.states.at(-1)!.selected)).to.deep.equal([0]);
    });

    it('sends the selected, hovered and keyboard-focused rows to the renderer', async () => {
      const el = await chart('engine=webgl', columns(4));
      await ready(el);
      expect(peer.states.at(-1)).to.deep.equal({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
      el.selectedId = 'row-2';
      await waitUntil(() => peer.states.at(-1)!.selected.has(2));
      peer.host!.hover(3);
      expect(peer.states.at(-1)!.hover).to.equal(3);
      for (const invalid of [99, -1, null, Number.NaN]) peer.host!.hover(invalid);
      expect(peer.states.at(-1)!.hover).to.equal(-1);
      await focusByKeyboard(part(el, 'cursor')!);
      await waitUntil(() => peer.states.at(-1)!.focus === 2);
      (part(el, 'cursor')! as HTMLElement).blur();
      await waitUntil(() => peer.states.at(-1)!.focus === -1);
    });

    it('ignores renderer callbacks that arrive before the renderer is ready', async () => {
      peer.deferMount = true;
      const el = await chart('engine=webgl');
      await waitUntil(() => peer.completeMount !== undefined);
      const selections: unknown[] = [];
      el.addEventListener('lr-chart-row-select', (event) => selections.push((event as CustomEvent).detail));
      peer.host!.pick(0, PICK);
      peer.host!.hover(1);
      peer.host!.camera({ yaw: 3 });
      expect([selections.length, peer.states.length, el.camera]).to.deep.equal([0, 0, undefined]);
      await el.updateComplete;
      expect(part(el, 'base')!.getAttribute('aria-busy')).to.equal('true');
      expect(text(el, 'engine-notice')).to.equal('Loading the 3D view…');
      await waitUntil(() => live('polite').includes('Loading the 3D view…'));
      peer.completeMount!();
      await ready(el);
      expect(part(el, 'base')!.getAttribute('aria-busy')).to.equal('false');
      expect(has(el, 'engine-notice')).to.equal(false);
    });
  });

  describe('camera', () => {
    it('keeps authored writes silent and reports only current renderer gestures', async () => {
      const el = await chart('engine=webgl');
      const events: unknown[] = [];
      el.addEventListener('lr-camera-change', (event) => events.push((event as CustomEvent).detail));
      el.camera = { yaw: 1, pitch: 0, distance: 4, target: { x: 0, y: 0, z: 0 } };
      await ready(el);
      expect(events.length).to.equal(0);
      const sent = peer.cameras.length;
      peer.host!.camera({ yaw: 2, pitch: 0.25, distance: 4, target: { x: 1, y: 0, z: 0 } });
      expect(el.camera!.yaw).to.equal(2);
      expect(events.length).to.equal(1);
      expect(Object.isFrozen(events[0])).to.equal(true);
      expect((events[0] as { camera: unknown }).camera === el.camera).to.equal(true);
      await el.updateComplete;
      expect(peer.cameras.length).to.equal(sent);
      peer.host!.camera({ yaw: Number.NaN });
      expect(el.camera!.yaw).to.equal(0);
      el.camera = { yaw: 0.5, pitch: 0, distance: 4, target: { x: 0, y: 0, z: 0 } };
      await el.updateComplete;
      expect([events.length, peer.cameras.length]).to.deep.equal([2, sent + 1]);
    });

    it('shows a Fit control only while the renderer is ready and emits the framed camera from it', async () => {
      const el = await chart('engine=webgl lang=en', columns(3));
      expect(has(el, 'fit-button')).to.equal(false);
      await ready(el);
      expect(text(el, 'fit-button')).to.equal('Fit chart');
      el.strings = { chart3dFit: 'Cadrer' };
      await el.updateComplete;
      expect(text(el, 'fit-button')).to.equal('Cadrer');
      const events: unknown[] = [];
      el.addEventListener('lr-camera-change', (event) => events.push((event as CustomEvent).detail));
      el.camera = { yaw: 2, pitch: 1, distance: 50, target: { x: 3, y: 3, z: 3 } };
      await el.updateComplete;
      part(el, 'fit-button')!.click();
      await el.updateComplete;
      expect(events.length).to.equal(1);
      expect((events[0] as { camera: { yaw: number; target: unknown } }).camera.yaw).to.equal(0);
      expect((events[0] as { camera: { target: unknown } }).camera.target).to.deep.equal({ x: 0, y: 0, z: 0 });
      expect(peer.cameras.at(-1)).to.deep.equal(el.camera);
      el.fit();
      el.focusRow('row-1');
      await el.updateComplete;
      expect(events.length).to.equal(1);
    });

    it('aims the renderer at a focused row without any event', async () => {
      const el = await chart('engine=webgl', columns(3));
      await ready(el);
      const events: unknown[] = [];
      el.addEventListener('lr-camera-change', (event) => events.push((event as CustomEvent).detail));
      expect(el.focusRow('row-2')).to.equal(true);
      await waitUntil(() => peer.cameras.length > 0);
      const target = (peer.cameras.at(-1) as { target: { x: number; y: number; z: number } }).target;
      expect([target.x, target.y, target.z]).to.deep.equal([0.5, -1, -0.5]);
      expect(events.length).to.equal(0);
    });

    it('turns a throwing camera write into a single error fallback', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      const fallbacks: unknown[] = [];
      el.addEventListener('lr-engine-fallback', (event) => fallbacks.push((event as CustomEvent).detail));
      peer.cameraError = true;
      el.camera = { yaw: 1, pitch: 0, distance: 4, target: { x: 0, y: 0, z: 0 } };
      await waitUntil(() => fallbacks.length === 1);
      await el.updateComplete;
      expect(fallbacks[0]).to.deep.equal({ from: 'webgl', to: 'list', reason: 'error' });
      expect(peer.disposed).to.equal(1);
      expect(has(el, 'fit-button')).to.equal(false);
    });
  });

  describe('ownership', () => {
    it('replaces the renderer when the data, type or hidden categories change, and not for equal-content writes', async () => {
      const el = await chart('engine=webgl', columns(3, { category: Uint16Array.of(0, 1, 0), categories: ['a', 'b'] }));
      await ready(el);
      el.xAxis = { label: 'Distance', unit: 'km' };
      await waitUntil(() => peer.creates === 2);
      await ready(el);
      const settled = peer.creates;
      el.xAxis = { label: 'Distance', unit: 'km' };
      el.yAxis = {};
      el.zAxis = { label: '', unit: '' };
      el.hiddenCategories = new Set();
      el.engine = 'webgl';
      await el.updateComplete;
      await aTimeout(50);
      expect([peer.creates, peer.disposed]).to.deep.equal([settled, settled - 1]);
      el.hiddenCategories = new Set([1]);
      await waitUntil(() => peer.creates === settled + 1);
      await ready(el);
      expect(peer.data.at(-1)!.value.positions.length).to.equal(6);
      el.type = 'bubble';
      await waitUntil(() => peer.creates === settled + 2);
      el.data = columns(2);
      await waitUntil(() => peer.creates === settled + 3);
      await ready(el);
      expect(peer.disposed).to.equal(peer.creates - 1);
    });

    it('disposes a late created renderer exactly once after disconnect without mounting it', async () => {
      let resolve!: (value: unknown) => void;
      chart3dPointsLoader.override(() => new Promise((done) => { resolve = done; }));
      const el = await chart('engine=webgl');
      await waitUntil(() => peer.probes === 1);
      el.remove();
      resolve({ createEngine: () => { peer.creates++; return { contract: 1, mount: async () => { peer.mounts++; }, setData() {}, setStyle() {}, setCamera() {}, resize() {}, dispose() { peer.disposed++; } }; } });
      await waitUntil(() => peer.disposed === 1);
      expect([peer.creates, peer.mounts]).to.deep.equal([1, 0]);
    });

    it('retires a mounting renderer once when the preference changes and ignores its late callbacks', async () => {
      peer.deferMount = true;
      const el = await chart('engine=webgl');
      await waitUntil(() => peer.completeMount !== undefined);
      const stale = peer.host!;
      const events: unknown[] = [];
      el.addEventListener('lr-engine-fallback', (event) => events.push((event as CustomEvent).detail));
      el.addEventListener('lr-chart-row-select', (event) => events.push((event as CustomEvent).detail));
      el.engine = 'builtin';
      await el.updateComplete;
      peer.completeMount!();
      await aTimeout(20);
      stale.lost('error');
      stale.pick(0, PICK);
      stale.restored!();
      await el.updateComplete;
      expect([peer.disposed, peer.data.length, events.length, has(el, 'engine-notice')]).to.deep.equal([1, 0, 0, false]);
    });

    it('does not publish a stale error when disposal starts a newer builtin preference', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      const fallbacks: unknown[] = [];
      el.addEventListener('lr-engine-fallback', (event) => fallbacks.push((event as CustomEvent).detail));
      peer.disposeHook = () => { el.engine = 'builtin'; };
      peer.host!.lost('error');
      await el.updateComplete;
      expect([el.engine, fallbacks.length, has(el, 'engine-notice')]).to.deep.equal(['builtin', 0, false]);
    });

    it('ignores a stale camera exception after the peer changes the public preference', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      const fallbacks: unknown[] = [];
      el.addEventListener('lr-engine-fallback', (event) => fallbacks.push((event as CustomEvent).detail));
      peer.cameraError = true;
      peer.cameraHook = () => { el.engine = 'builtin'; };
      // The peer re-enters the element from inside the update that applies the camera, which Lit reports.
      const reentrant = await captureReentrantUpdateWarning('lr-chart-3d', async () => {
        el.camera = { yaw: 1, pitch: 0, distance: 5, target: { x: 0, y: 0, z: 0 } };
        await el.updateComplete;
        await el.updateComplete;
      });
      expect(reentrant).to.be.at.most(1);
      expect([el.engine, fallbacks.length, has(el, 'engine-notice'), peer.disposed]).to.deep.equal(['builtin', 0, false, 1]);
    });

    it('ignores a stale disposal failure that starts a newer preference during a camera error', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      const fallbacks: unknown[] = [];
      el.addEventListener('lr-engine-fallback', (event) => fallbacks.push((event as CustomEvent).detail));
      peer.cameraError = true;
      peer.disposeHook = () => { el.engine = 'builtin'; };
      const reentrant = await captureReentrantUpdateWarning('lr-chart-3d', async () => {
        el.camera = { yaw: 1, pitch: 0, distance: 5, target: { x: 0, y: 0, z: 0 } };
        await el.updateComplete;
        await el.updateComplete;
      });
      expect(reentrant).to.be.at.most(1);
      expect([el.engine, fallbacks.length, has(el, 'engine-notice')]).to.deep.equal(['builtin', 0, false]);
    });

    it('restarts a ready renderer on reconnect and retires the old one on disconnect', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      const first = peer.host!;
      const parent = el.parentElement!;
      el.remove();
      expect(peer.disposed).to.equal(1);
      first.pick(0, PICK);
      first.restored!();
      parent.append(el);
      await waitUntil(() => peer.creates === 2);
      await ready(el);
      const selected = oneEvent(el, 'lr-chart-row-select');
      peer.host!.pick(1, PICK);
      expect((await selected).detail).to.deep.equal({ id: 'row-1', index: 1 });
    });
  });

  describe('context loss and software rendering', () => {
    it('keeps one renderer through a lost context, reports it once and resumes from the current inputs', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      const fallbacks: unknown[] = [];
      el.addEventListener('lr-engine-fallback', (event) => fallbacks.push((event as CustomEvent).detail));
      const host = peer.host!;
      host.lost('context-lost');
      host.lost('context-lost');
      await el.updateComplete;
      expect(fallbacks).to.deep.equal([{ from: 'webgl', to: 'list', reason: 'context-lost' }]);
      expect([peer.disposed, has(el, 'fit-button'), part(el, 'engine')!.hasAttribute('hidden')]).to.deep.equal([0, false, true]);
      expect(text(el, 'engine-notice')).to.contain('The 3D view lost its graphics context.');
      expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(3);
      el.camera = { yaw: 1, pitch: 0, distance: 8, target: { x: 1, y: 0, z: 0 } };
      el.selectedId = 'row-1';
      await el.updateComplete;
      const writes = peer.cameras.length;
      host.restored!();
      await el.updateComplete;
      expect(peer.cameras.length).to.equal(writes + 1);
      expect(peer.cameras.at(-1)).to.deep.equal(el.camera);
      expect(Array.from(peer.states.at(-1)!.selected)).to.deep.equal([1]);
      expect([has(el, 'engine-notice'), has(el, 'fit-button'), part(el, 'engine')!.hasAttribute('hidden'), peer.creates]).to.deep.equal([false, true, false, 1]);
      expect(fallbacks.length).to.equal(1);
    });

    it('keeps the notice when a failure follows a lost context and stops restoring', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      const fallbacks: unknown[] = [];
      el.addEventListener('lr-engine-fallback', (event) => fallbacks.push((event as CustomEvent).detail));
      const host = peer.host!;
      host.lost('context-lost');
      await el.updateComplete;
      host.lost('error');
      await el.updateComplete;
      expect(text(el, 'engine-notice')).to.contain('The 3D view lost its graphics context.');
      expect([fallbacks.length, peer.disposed]).to.deep.equal([1, 1]);
      host.restored!();
      await el.updateComplete;
      expect([has(el, 'fit-button'), peer.creates]).to.deep.equal([false, 1]);
    });

    it('survives a loss while mounting and becomes ready after the restore', async () => {
      peer.deferMount = true;
      const el = await chart('engine=webgl');
      await waitUntil(() => peer.completeMount !== undefined);
      const host = peer.host!;
      host.lost('context-lost');
      host.restored!();
      peer.completeMount!();
      await ready(el);
      expect([has(el, 'engine-notice'), peer.creates, peer.disposed]).to.deep.equal([false, 1, 0]);
    });

    it('shows and announces software rendering once the renderer reports it', async () => {
      const el = await chart('engine=webgl');
      await ready(el);
      peer.host!.rendering!({ software: true });
      await el.updateComplete;
      expect(text(el, 'engine-notice')).to.equal('3D graphics run without hardware acceleration, so detail is reduced.');
      await waitUntil(() => live('polite').includes('without hardware acceleration'));
      peer.host!.rendering!({ software: false });
      await el.updateComplete;
      expect(has(el, 'engine-notice')).to.equal(false);
    });
  });

  describe('terminal failures release every resource', () => {
    for (const duringMount of [false, true]) {
      it(`after a ${duringMount ? 'rejected initial state' : 'rejected live style'} without descending twice`, async () => {
        const OriginalResizeObserver = window.ResizeObserver;
        const observations: { target: Element | null; disconnected: boolean; deliver: () => void }[] = [];
        window.ResizeObserver = class implements ResizeObserver {
          private readonly observation: { target: Element | null; disconnected: boolean; deliver: () => void };
          constructor(callback: ResizeObserverCallback) {
            this.observation = { target: null, disconnected: false, deliver: () => callback([], this) };
            observations.push(this.observation);
          }
          observe(target: Element): void { this.observation.target = target; }
          unobserve(target: Element): void { if (this.observation.target === target) this.observation.target = null; }
          disconnect(): void { this.observation.disconnected = true; }
        };
        try {
          peer.stateError = duringMount;
          const el = await chart('');
          const fallbacks: unknown[] = [];
          el.addEventListener('lr-engine-fallback', (event) => fallbacks.push((event as CustomEvent).detail));
          el.engine = 'webgl';
          if (!duringMount) {
            await ready(el);
            peer.styleError = true;
            el.style.setProperty('--lr-color-brand', 'rgb(1,1,1)');
          }
          await waitUntil(() => fallbacks.length === 1);
          await el.updateComplete;
          expect(fallbacks[0]).to.deep.equal({ from: 'webgl', to: 'list', reason: 'error' });
          const observer = observations.find((item) => item.target?.getAttribute('part') === 'engine');
          expect(observer !== undefined && observer.disconnected).to.equal(true);
          expect(peer.disposed).to.equal(1);
          const writes = [peer.styles.length, peer.states.length, peer.resizes.length];
          observer!.deliver();
          peer.host!.lost('error');
          peer.host!.restored!();
          el.style.setProperty('--lr-color-brand', 'rgb(2,2,2)');
          await el.updateComplete;
          await aTimeout(30);
          expect([peer.styles.length, peer.states.length, peer.resizes.length]).to.deep.equal(writes);
          expect(fallbacks.length).to.equal(1);
          expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(3);
        } finally {
          window.ResizeObserver = OriginalResizeObserver;
        }
      });
    }
  });
});
