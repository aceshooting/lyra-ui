import { expect, waitUntil } from '@open-wc/testing';

interface LegendVisibilityElement extends HTMLElement {
  hiddenDatasets?: readonly number[];
  updateComplete: Promise<unknown>;
}

interface LegendVisibilityChart {
  isDatasetVisible(index: number): boolean;
}

/** Shared request, veto, and compatibility-event contracts for chart-family DOM legends. */
export function testLegendVisibilityEvents(
  label: string,
  createElement: (controlledHidden?: boolean) => Promise<LegendVisibilityElement>,
): void {
  const chartFor = (element: LegendVisibilityElement): LegendVisibilityChart =>
    (element as unknown as { chart: LegendVisibilityChart }).chart;
  const legendButton = (element: LegendVisibilityElement): HTMLElement =>
    element.shadowRoot!.querySelector<HTMLElement>('[part~="legend-item"]')!;
  const waitForChart = (element: LegendVisibilityElement) =>
    waitUntil(() => chartFor(element) != null);

  it(`${label} keeps a controlled hidden series hidden when its show proposal is canceled`, async () => {
    const element = await createElement(true);
    await waitForChart(element);
    const chart = chartFor(element);
    const button = legendButton(element);
    const proposals: unknown[] = [];
    let commits = 0;
    const veto = (event: Event): void => {
      proposals.push((event as CustomEvent).detail);
      event.preventDefault();
    };
    element.addEventListener('lr-legend-visibility-change-request', veto);
    element.addEventListener('lr-legend-visibility-change', () => commits++);
    try {
      button.click();
      await element.updateComplete;
      expect(proposals).to.deep.equal([{ datasetIndex: 0, visible: true, hiddenDatasets: [] }]);
      expect(commits).to.equal(0);
      expect(element.hiddenDatasets).to.deep.equal([0]);
      expect(chart.isDatasetVisible(0)).to.be.false;
      expect(button.getAttribute('aria-pressed')).to.equal('false');
    } finally {
      element.removeEventListener('lr-legend-visibility-change-request', veto);
    }
  });

  it(`${label} emits one canonical legend request and ignores the removed veto alias`, async () => {
    const element = await createElement();
    await element.updateComplete;
    await waitForChart(element);
    const button = legendButton(element);
    const requests: CustomEvent[] = [];
    let removedAliasEvents = 0;
    let commits = 0;
    element.addEventListener('lr-legend-visibility-change-request', (event) =>
      requests.push(event as CustomEvent),
    );
    element.addEventListener('lr-before-legend-visibility-change', (event) => {
      removedAliasEvents++;
      event.preventDefault();
    });
    element.addEventListener('lr-legend-visibility-change', () => commits++);
    button.click();
    await element.updateComplete;
    expect(requests.length).to.equal(1);
    expect(removedAliasEvents).to.equal(0);
    expect(requests[0]?.detail).to.deep.equal({ datasetIndex: 0, visible: false, hiddenDatasets: [0] });
    expect(requests[0]?.cancelable).to.equal(true);
    expect(commits).to.equal(1);
    expect(element.hiddenDatasets).to.deep.equal([0]);
  });

  it(`${label} honors cancellation of only the canonical request event`, async () => {
    const element = await createElement();
    await element.updateComplete;
    await waitForChart(element);
    let commits = 0;
    element.addEventListener('lr-legend-visibility-change-request', (event) => event.preventDefault());
    element.addEventListener('lr-legend-visibility-change', () => commits++);
    legendButton(element).click();
    await element.updateComplete;
    expect(commits).to.equal(0);
    expect(element.hiddenDatasets).to.equal(undefined);
  });
}
