import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './heatmap.js';
import { resolveRgb, type LyraHeatmap } from './heatmap.js';

type MatrixData = Extract<LyraHeatmap['data'], { kind: 'matrix' }>;
function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const dpr = window.devicePixelRatio || 1;
  return [...canvas.getContext('2d')!.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data];
}

let warningAttempt = 0;
it('gates invalid authored color warnings in production without consuming development diagnostics', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'litIssuedWarnings');
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    Object.defineProperty(globalThis, 'litIssuedWarnings', { configurable: true, writable: true, value: undefined });
    const color = `remediation-invalid-authored-color-${warningAttempt++}`;
    expect(resolveRgb(color, '#123456')).to.deep.equal([18, 52, 86, 1]);
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap style=${`--lr-heatmap-scale-lo: ${color}-rendered`}
      .data=${{ kind: 'matrix', rowLabels: ['Row'], colLabels: ['Value'], values: [[1]] }}
    ></lr-heatmap>`);
    await waitUntil(() => element.matrixGeometry !== undefined);
    expect(warnings.length).to.equal(0);
    const reference = await fixture<LyraHeatmap>(html`<lr-heatmap style="--lr-heatmap-scale-lo: #cde2fb" .data=${element.data}></lr-heatmap>`);
    const geometry = element.matrixGeometry!;
    const x = geometry.padLeft + geometry.cellSize / 2;
    const y = geometry.padTop + geometry.cellSize / 2;
    expect(pixel(element.shadowRoot!.querySelector('canvas')!, x, y)).to.deep.equal(pixel(reference.shadowRoot!.querySelector('canvas')!, x, y));
    Object.defineProperty(globalThis, 'litIssuedWarnings', { configurable: true, writable: true, value: new Set<string>() });
    expect(resolveRgb(color, '#123456')).to.deep.equal([18, 52, 86, 1]);
    resolveRgb(color, '#123456');
    expect(warnings.length).to.equal(1);
    expect(warnings[0]?.join(' ')).to.contain(color);
    expect(resolveRgb('rgb(1, 2, 3)', '#123456')).to.deep.equal([1, 2, 3, 1]);
    expect(warnings.length).to.equal(1);
  } finally {
    console.warn = originalWarn;
    if (descriptor) Object.defineProperty(globalThis, 'litIssuedWarnings', descriptor);
    else Reflect.deleteProperty(globalThis, 'litIssuedWarnings');
  }
});

for (const axis of ['domain', 'midpoint'] as const) {
  for (const missing of ['absent', 'undefined', 'null'] as const) {
    it(`preserves ${missing} matrix no-data across live ${axis} changes in paint, text, callbacks and events`, async () => {
      const values: (number | null | undefined)[] = missing === 'absent' ? [] : [missing === 'null' ? null : undefined];
      values[1] = -2;
      const data = { kind: 'matrix', rowLabels: ['Row'], colLabels: ['Missing', 'Negative'], values: [values] } as unknown as MatrixData;
      const callbackValues: number[] = [];
      const element = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells .data=${data}
        .cellColor=${(pos: { row?: number; col?: number }, value: number) => { if (pos.col === 0) callbackValues.push(value); return undefined; }}
      ></lr-heatmap>`);
      const canvas = element.shadowRoot!.querySelector('canvas')!;
      await waitUntil(() => element.matrixGeometry !== undefined);
      const geometry = element.matrixGeometry!;
      const sample = () => pixel(canvas, geometry.padLeft + geometry.cellSize / 2, geometry.padTop + geometry.cellSize / 2);
      const initialPixel = sample();
      const cells = () => [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]')];
      expect(cells()[0]!.getAttribute('aria-label')).to.contain('no data');
      expect(callbackValues.at(-1)).to.equal(-1);
      const events: number[] = [];
      element.addEventListener('lr-cell-click', (event) => events.push((event as CustomEvent<{ value: number }>).detail.value));
      cells()[0]!.click();
      expect(events.at(-1)).to.equal(-1);
      if (axis === 'domain') element.domain = [-5, 5];
      else element.midpoint = 0;
      await element.updateComplete;
      expect(element.data === data).to.equal(true);
      expect(cells()[0]!.getAttribute('aria-label')).to.contain('no data');
      expect(cells()[1]!.getAttribute('aria-label')).to.contain('-2');
      expect(Number.isNaN(callbackValues.at(-1))).to.equal(true);
      // Sample away from the focus ring introduced by the preceding click.
      expect(sample()).to.deep.equal(initialPixel);
      cells()[0]!.click();
      expect(Number.isNaN(events.at(-1))).to.equal(true);
      if (axis === 'domain') element.domain = undefined;
      else element.midpoint = undefined;
      await element.updateComplete;
      expect(cells()[0]!.getAttribute('aria-label')).to.contain('no data');
      expect(callbackValues.at(-1)).to.equal(-1);
      cells()[0]!.click();
      expect(events.at(-1)).to.equal(-1);
    });
  }
}

for (const mode of ['matrix', 'calendar'] as const) {
  it(`restores the neighboring ${mode} fill when native keyboard focus moves`, async () => {
    const data: LyraHeatmap['data'] = mode === 'matrix'
      ? { kind: 'matrix', rowLabels: ['Row'], colLabels: ['First', 'Second'], values: [[1, 2]] }
      : { kind: 'calendar', firstDayOfWeek: 1, days: [{ date: '2026-09-07', value: 1 }, { date: '2026-09-14', value: 2 }] };
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${data}></lr-heatmap>`);
    const canvas = element.shadowRoot!.querySelector('canvas')!;
    await waitUntil(() => canvas.width > 0 && canvas.height > 0);
    await aTimeout(100);
    const geometry = element.matrixGeometry;
    const x = mode === 'matrix' ? geometry!.padLeft + geometry!.cellSize - 2 : 38;
    const y = mode === 'matrix' ? geometry!.padTop + geometry!.cellSize / 2 : 21;
    const initial = pixel(canvas, x, y);
    expect(initial[3]).to.equal(255);
    canvas.focus();
    expect(element.shadowRoot!.activeElement?.tagName).to.equal('CANVAS');
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    const afterFocus = pixel(canvas, x, y);
    expect(afterFocus).to.deep.equal(initial);
    element.colorSteps = [...(element.colorSteps ?? [])];
    await element.updateComplete;
    expect(pixel(canvas, x, y)).to.deep.equal(afterFocus);
  });
}

for (const mode of ['matrix', 'calendar'] as const) {
  it(`keeps ${mode} focus restoration bounded to a small neighborhood`, async () => {
    const data: LyraHeatmap['data'] = mode === 'matrix'
      ? { kind: 'matrix', rowLabels: Array.from({ length: 20 }, (_, index) => String(index)), colLabels: Array.from({ length: 20 }, (_, index) => String(index)), values: Array.from({ length: 20 }, () => Array<number>(20).fill(1)) }
      : { kind: 'calendar', firstDayOfWeek: 1, days: [{ date: '2026-09-07', value: 1 }, { date: '2027-06-07', value: 2 }] };
    let fills = 0;
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${data} .cellColor=${() => { fills++; return undefined; }}></lr-heatmap>`);
    await aTimeout(100);
    expect(fills).to.be.greaterThan(200);
    fills = 0;
    const canvas = element.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    expect(fills).to.be.greaterThan(0);
    expect(fills).to.be.lessThan(100);
  });
}

for (const mode of ['matrix', 'calendar'] as const) {
  it(`matches full ${mode} repaint after native focus with fractional cell sizes and overlays`, async () => {
    const data: LyraHeatmap['data'] = mode === 'matrix'
      ? { kind: 'matrix', rowLabels: ['a', 'b', 'c'], colLabels: ['a', 'b', 'c'], values: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }
      : { kind: 'calendar', firstDayOfWeek: 1, days: Array.from({ length: 14 }, (_, index) => ({ date: `2026-09-${String(7 + index).padStart(2, '0')}`, value: index })) };
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="4.5" .data=${data}
      .annotations=${mode === 'matrix' ? [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }] : [{ date: '2026-09-08' }]}
      .selectedCell=${mode === 'matrix' ? { row: 1, col: 1 } : { date: '2026-09-09' }}
    ></lr-heatmap>`);
    await compareFocusWithFullRepaint(element);
  });
}

for (const decoration of ['annotation', 'selection'] as const) {
  for (const cellSize of [1, 12]) {
    it(`omits ${decoration} rings on absent calendar records during ${cellSize}px focus repaint`, async () => {
      const element = await fixture<LyraHeatmap>(html`<lr-heatmap .cellSize=${cellSize}
        .data=${{ kind: 'calendar', firstDayOfWeek: 1, days: [{ date: '2026-09-07', value: 1 }, { date: '2026-09-14', value: 2 }] }}
        .annotations=${decoration === 'annotation' ? [{ date: '2026-09-08' }] : []}
        .selectedCell=${decoration === 'selection' ? { date: '2026-09-08' } : undefined}
      ></lr-heatmap>`);
      await compareFocusWithFullRepaint(element);
    });
  }
}

async function compareFocusWithFullRepaint(element: LyraHeatmap): Promise<void> {
  await aTimeout(100);
  const canvas = element.shadowRoot!.querySelector('canvas')!;
  canvas.focus();
  await sendKeys({ press: 'ArrowRight' });
  await element.updateComplete;
  await sendKeys({ press: 'ArrowRight' });
  await element.updateComplete;
  const context = canvas.getContext('2d')!;
  const partial = context.getImageData(0, 0, canvas.width, canvas.height).data;
  element.colorSteps = [...(element.colorSteps ?? [])];
  await element.updateComplete;
  const full = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let differingPixels = 0;
  for (let index = 0; index < partial.length; index += 4) {
    if (partial.slice(index, index + 4).some((value, channel) => value !== full[index + channel])) differingPixels++;
  }
  expect(differingPixels).to.equal(0);
}
