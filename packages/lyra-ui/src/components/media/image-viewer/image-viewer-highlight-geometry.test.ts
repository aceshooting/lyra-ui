import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './image-viewer.js';
import type { LyraImageViewer, LyraImageRotation } from './image-viewer.js';
import type { LyraHighlight } from '../../viewers/document-viewer/anchors.js';

type Rect = { x: number; y: number; width: number; height: number };

function realImage(width = 800, height = 600): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#888';
  context.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/png');
}

const IMAGE = realImage();

function region(id: string, rect: Rect): LyraHighlight {
  // Unlabeled: a visible label is a separate, larger hit surface that is not under test here.
  return { id, anchor: { kind: 'region', rect } };
}

async function paint(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function viewer(
  highlights: LyraHighlight[],
  options: { fit?: string; zoom?: number; rotation?: LyraImageRotation; dir?: string } = {},
): Promise<LyraImageViewer> {
  const el = await fixture<LyraImageViewer>(html`<lr-image-viewer
    dir=${options.dir ?? 'ltr'}
    src=${IMAGE}
    fit=${options.fit ?? 'contain'}
    .zoom=${options.zoom ?? 1}
    .rotation=${options.rotation ?? 0}
    style="inline-size: 640px; block-size: 420px;"
    .highlights=${highlights}
  ></lr-image-viewer>`);
  await waitUntil(
    () => el.shadowRoot!.querySelectorAll('[part="highlight"]').length === highlights.length
      && el.shadowRoot!.querySelector('[part="highlight-layer"]')!.getBoundingClientRect().width > 0,
    'highlights should render over a laid-out image',
  );
  await el.updateComplete;
  await paint();
  // The measured frame starts a wrapper transform transition; settle it before
  // comparing separately sampled child and layer rectangles.
  await waitUntil(
    () => el.shadowRoot!.querySelector('[part="rotation-frame"]')!.hasAttribute('data-measured')
      && el.shadowRoot!.querySelector('[part="image-wrapper"]')!.getAnimations()
        .every(animation => !animation.pending && animation.playState !== 'running'),
    'the measured image wrapper transform should settle',
  );
  return el;
}

function box(el: LyraImageViewer, id: string): HTMLButtonElement {
  return el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="highlight"][data-highlight-id="${id}"]`)!;
}

/** The axis-aligned screen rectangle a percentage rect should occupy over the (possibly
 *  rotated) highlight layer, from the layer's own bounding box. */
function expectedRect(el: LyraImageViewer, rect: Rect, rotation: number): DOMRect | { left: number; top: number; width: number; height: number } {
  const layer = el.shadowRoot!.querySelector('[part="highlight-layer"]')!.getBoundingClientRect();
  const turned = rotation === 90 || rotation === 270;
  // Unrotated layer size.
  const w = turned ? layer.height : layer.width;
  const h = turned ? layer.width : layer.height;
  const cx = layer.left + layer.width / 2;
  const cy = layer.top + layer.height / 2;
  const corners = [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height],
  ].map(([u, v]) => {
    const dx = ((u! - 50) / 100) * w;
    const dy = ((v! - 50) / 100) * h;
    const radians = (rotation * Math.PI) / 180;
    return [
      cx + dx * Math.cos(radians) - dy * Math.sin(radians),
      cy + dx * Math.sin(radians) + dy * Math.cos(radians),
    ];
  });
  const xs = corners.map((c) => c[0]!);
  const ys = corners.map((c) => c[1]!);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

function expectPainted(el: LyraImageViewer, id: string, rect: Rect, rotation: number, message: string): void {
  const actual = box(el, id).getBoundingClientRect();
  const expected = expectedRect(el, rect, rotation);
  expect(actual.left, `${message} left`).to.be.closeTo(expected.left, 0.5);
  expect(actual.top, `${message} top`).to.be.closeTo(expected.top, 0.5);
  expect(actual.width, `${message} width`).to.be.closeTo(expected.width, 0.5);
  expect(actual.height, `${message} height`).to.be.closeTo(expected.height, 0.5);
}

const SMALL: Rect = { x: 40, y: 40, width: 1, height: 1 };
const WIDE: Rect = { x: 55, y: 60, width: 2, height: 0.8 };

describe('lr-image-viewer highlight painted geometry', () => {
  it('transitions only highlight paint while region geometry updates immediately and reduced motion collapses timing', async () => {
    await setReducedMotion('no-preference');
    try {
      const el = await viewer([region('a', SMALL)]);
      const motion = getComputedStyle(box(el, 'a'));
      expect(motion.transitionProperty.split(',').map(property => property.trim())).to.deep.equal([
        'background-color', 'color', 'border-color',
      ]);
      expect(motion.transitionDuration.split(',').every(value => Number.parseFloat(value) > 0)).to.equal(true);
      const moved: Rect = { x: 61, y: 33, width: 10, height: 8 };
      el.highlights = [region('a', moved)];
      el.activeHighlightId = 'a';
      await el.updateComplete;
      expectPainted(el, 'a', moved, 0, 'updated region');
      await setReducedMotion('reduce');
      await paint();
      const reduced = getComputedStyle(box(el, 'a'));
      expect(reduced.transitionDuration.split(',').every(value => Number.parseFloat(value) <= 0.00001)).to.equal(true);
      expectPainted(el, 'a', moved, 0, 'reduced motion region');
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  for (const fit of ['contain', 'width', 'actual']) {
    for (const zoom of [0.5, 1, 1.5]) {
      for (const rotation of [0, 90] as const) {
        it(`paints a sub-hit-area region exactly (fit ${fit}, zoom ${zoom}, rotation ${rotation})`, async () => {
          const el = await viewer([region('a', SMALL), region('b', WIDE)], { fit, zoom, rotation });
          const painted = box(el, 'a').getBoundingClientRect();
          expect(Math.min(painted.width, painted.height), 'the fixture region is below the hit-area floor')
            .to.be.lessThan(36);
          expectPainted(el, 'a', SMALL, rotation, 'small region');
          expectPainted(el, 'b', WIDE, rotation, 'wide region');
        });
      }
    }
  }

  it('does not paint adjacent small regions over each other', async () => {
    const left: Rect = { x: 30, y: 45, width: 1, height: 1 };
    const right: Rect = { x: 32, y: 45, width: 1, height: 1 };
    const el = await viewer([region('left', left), region('right', right)]);
    const a = box(el, 'left').getBoundingClientRect();
    const b = box(el, 'right').getBoundingClientRect();
    expect(a.right, 'the first box ends before the second begins').to.be.at.most(b.left + 0.5);
    expectPainted(el, 'left', left, 0, 'left');
    expectPainted(el, 'right', right, 0, 'right');
  });

  it('hit-tests the intended region at its centre and inside its enlarged area', async () => {
    const lone: Rect = { x: 20, y: 20, width: 1, height: 1 };
    const left: Rect = { x: 30, y: 45, width: 1, height: 1 };
    const right: Rect = { x: 32, y: 45, width: 1, height: 1 };
    const el = await viewer([region('lone', lone), region('left', left), region('right', right)]);
    const root = el.shadowRoot!;
    const pick = (x: number, y: number) => {
      const hit = (root.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[part="highlight"]') ?? (root.elementFromPoint(x, y) as HTMLElement | null);
      return hit?.dataset['highlightId'] ?? `<${hit?.localName}:${hit?.getAttribute('part')} at ${Math.round(x)},${Math.round(y)}>`;
    };
    for (const id of ['lone', 'left', 'right']) {
      const rect = box(el, id).getBoundingClientRect();
      expect(pick(rect.left + rect.width / 2, rect.top + rect.height / 2), `${id} centre`).to.equal(id);
    }
    const lonely = box(el, 'lone').getBoundingClientRect();
    const cx = lonely.left + lonely.width / 2;
    const cy = lonely.top + lonely.height / 2;
    for (const [dx, dy] of [[14, 0], [-14, 0], [0, 14], [0, -14], [12, 12]]) {
      expect(pick(cx + dx!, cy + dy!), `lone enlarged area at ${dx},${dy}`).to.equal('lone');
    }
    expect(pick(cx + 24, cy), 'beyond the enlarged area nothing is picked').to.not.equal('lone');
    // A painted box always wins over another region's enlarged area, in any order.
    const l = box(el, 'left').getBoundingClientRect();
    const r = box(el, 'right').getBoundingClientRect();
    expect(pick(l.left + l.width / 2, l.top + l.height / 2)).to.equal('left');
    expect(pick(r.left + r.width / 2, r.top + r.height / 2)).to.equal('right');
    // Overlapping enlarged areas resolve deterministically to the later region in document order.
    const gapMiddle = (l.right + r.left) / 2;
    expect(pick(gapMiddle, l.top + l.height / 2)).to.equal('right');
  });

  it('activates the owning highlight from a native click inside its enlarged target', async () => {
    await setReducedMotion('reduce');
    try {
      const el = await viewer([region('lone', { x: 20, y: 20, width: 1, height: 1 })]);
      const highlight = box(el, 'lone');
      await hoverUntilMatched(highlight, 'the enlarged highlight target should receive the pointer', rect => [
        rect.left + rect.width / 2 + 14, rect.top + rect.height / 2,
      ]);
      const activation = oneEvent(el, 'lr-highlight-activate');
      await sendMouse({ type: 'down' });
      await sendMouse({ type: 'up' });
      expect((await activation).detail.highlightId).to.equal('lone');
      expect(el.activeHighlightId).to.equal('lone');
    } finally {
      await resetMouse();
      await setReducedMotion('no-preference');
    }
  });

  it('keeps arrow-key navigation between highlights unchanged', async () => {
    const el = await viewer([
      region('a', { x: 20, y: 40, width: 1, height: 1 }),
      region('b', { x: 40, y: 40, width: 1, height: 1 }),
      region('c', { x: 60, y: 40, width: 1, height: 1 }),
    ]);
    box(el, 'a').focus();
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.dataset['highlightId']).to.equal('a');
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect((el.shadowRoot!.activeElement as HTMLElement).dataset['highlightId']).to.equal('b');
    await sendKeys({ press: 'ArrowRight' });
    expect((el.shadowRoot!.activeElement as HTMLElement).dataset['highlightId']).to.equal('c');
    await sendKeys({ press: 'ArrowLeft' });
    expect((el.shadowRoot!.activeElement as HTMLElement).dataset['highlightId']).to.equal('b');
  });

  it('keeps the same painted geometry and hit-testing under dir="rtl"', async () => {
    const lone: Rect = { x: 20, y: 20, width: 1, height: 1 };
    const el = await viewer([region('lone', lone), region('other', SMALL)], { dir: 'rtl' });
    expectPainted(el, 'lone', lone, 0, 'rtl lone');
    expectPainted(el, 'other', SMALL, 0, 'rtl other');
    const rect = box(el, 'lone').getBoundingClientRect();
    const hit = el.shadowRoot!.elementFromPoint(rect.left + rect.width / 2 + 14, rect.top + rect.height / 2) as HTMLElement | null;
    expect(hit?.dataset['highlightId']).to.equal('lone');
  });

  it('has no accessibility violations with small populated highlights', async () => {
    const el = await viewer([region('a', SMALL), region('b', WIDE)]);
    expect(el.shadowRoot!.querySelectorAll('[part="highlight"]').length).to.equal(2);
    await expect(el).to.be.accessible();
  });
});


it('keeps geometry resources released when an update flushes after removal', async () => {
  const el = await viewer([region('geometry', { x: 0.1, y: 0.1, width: 0.2, height: 0.2 })]);
  const state = el as unknown as {
    geometryObserver?: ResizeObserver;
    geometryFrame?: number;
    mediaLayoutSize: { width: number; height: number } | null;
  };
  await waitUntil(() => state.geometryObserver !== undefined && state.geometryFrame === undefined);
  const parent = el.parentNode!;
  const initialSize = JSON.stringify(state.mediaLayoutSize);
  el.rotation = 90;
  el.remove();
  await el.updateComplete;
  expect(state.geometryObserver === undefined, 'detached update must not recreate an observer').to.equal(true);
  expect(state.geometryFrame === undefined, 'detached update must not queue geometry work').to.equal(true);
  await paint();
  expect(JSON.stringify(state.mediaLayoutSize)).to.equal(initialSize);
  parent.appendChild(el);
  await waitUntil(() => state.geometryObserver !== undefined);
  const wrapper = el.shadowRoot!.querySelector<HTMLElement>('[part="image-wrapper"]')!;
  wrapper.style.width = '240px';
  wrapper.style.height = '180px';
  await waitUntil(() => state.mediaLayoutSize?.width === 240 && state.mediaLayoutSize.height === 180);
  expect(el.rotation).to.equal(90);
});


it('rejects a retired geometry observer after adoption into a new owner window', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const nextWindow = iframe.contentWindow! as Window & typeof globalThis;
  const records: Array<{ callback: ResizeObserverCallback; observer: ResizeObserver; owner: Window }> = [];
  const original = window.ResizeObserver;
  const nextOriginal = nextWindow.ResizeObserver;
  const instrument = (owner: Window, Constructor: typeof ResizeObserver): typeof ResizeObserver =>
    class extends Constructor {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        records.push({ callback, observer: this, owner });
      }
    };
  window.ResizeObserver = instrument(window, original);
  nextWindow.ResizeObserver = instrument(nextWindow, nextOriginal);
  let el: LyraImageViewer | undefined;
  try {
    el = await viewer([region('geometry', { x: 0.1, y: 0.1, width: 0.2, height: 0.2 })]);
    const state = el as unknown as { geometryObserver?: ResizeObserver; geometryFrame?: number };
    await waitUntil(() => state.geometryObserver !== undefined);
    const retired = records.find(record => record.observer === state.geometryObserver)!;
    iframe.contentDocument!.adoptNode(el);
    iframe.contentDocument!.body.append(el);
    await el.updateComplete;
    await waitUntil(() => state.geometryObserver !== undefined && state.geometryObserver !== retired.observer);
    const current = records.find(record => record.observer === state.geometryObserver)!;
    expect(current.owner === nextWindow).to.equal(true);
    const target = el.shadowRoot!.querySelector<HTMLElement>('[part="image-wrapper"]')!;
    const before = state.geometryFrame;
    retired.callback([{ target, contentRect: { width: 999, height: 777 } } as unknown as ResizeObserverEntry], retired.observer);
    expect(state.geometryFrame).to.equal(before);
  } finally {
    el?.remove();
    window.ResizeObserver = original;
    nextWindow.ResizeObserver = nextOriginal;
  }
});

it('ignores a retired geometry frame without clearing the adopted owner frame', async () => {
  const el = await viewer([region('geometry', { x: 0.1, y: 0.1, width: 0.2, height: 0.2 })]);
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const nextWindow = iframe.contentWindow!;
  const state = el as unknown as {
    geometryFrame?: number;
    geometryFrameOwner?: Window;
    mediaLayoutSize: { width: number; height: number } | null;
    scheduleMediaLayoutSize(width: number, height: number): void;
  };
  const records: Array<{ owner: Window; handle: number; callback: FrameRequestCallback }> = [];
  const original = window.requestAnimationFrame;
  const nextOriginal = nextWindow.requestAnimationFrame;
  const instrument = (owner: Window, request: typeof requestAnimationFrame): typeof requestAnimationFrame =>
    callback => {
      const handle = request.call(owner, callback);
      records.push({ owner, handle, callback });
      return handle;
    };
  window.requestAnimationFrame = instrument(window, original);
  nextWindow.requestAnimationFrame = instrument(nextWindow, nextOriginal);
  try {
    state.scheduleMediaLayoutSize(321, 123);
    const retired = records.find(record => record.owner === window && record.handle === state.geometryFrame)!;
    iframe.contentDocument!.adoptNode(el);
    iframe.contentDocument!.body.append(el);
    await el.updateComplete;
    state.scheduleMediaLayoutSize(222, 111);
    const current = records.find(record => record.owner === nextWindow && record.handle === state.geometryFrame)!;
    const before = JSON.stringify(state.mediaLayoutSize);
    retired.callback(0);
    expect(JSON.stringify(state.mediaLayoutSize)).to.equal(before);
    expect(state.geometryFrame).to.equal(current.handle);
    expect(state.geometryFrameOwner === nextWindow).to.equal(true);
    current.callback(1);
    expect(state.mediaLayoutSize).to.deep.equal({ width: 222, height: 111 });
    expect(state.geometryFrame === undefined).to.equal(true);
  } finally {
    el.remove();
    for (const record of records) record.owner.cancelAnimationFrame(record.handle);
    window.requestAnimationFrame = original;
    nextWindow.requestAnimationFrame = nextOriginal;
  }
});
