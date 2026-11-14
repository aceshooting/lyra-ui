import { expect, fixture, html } from '@open-wc/testing';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

const cases = [
  { property: 'legend', initial: [{ label: 'Initial', color: '#000000', pattern: 'solid' }],
    next: [{ label: 'Current', color: '#ff0000', pattern: 'dots', group: 'Current group' }],
    old: [{ label: 'Obsolete', color: '#ffffff', pattern: 'solid' }] },
  { property: 'legendGradient', initial: [[0, '#000000'], [100, '#ffffff']],
    next: [[0, '#ff0000'], [200, '#0000ff']], old: [[0, '#00ff00'], [300, '#000000']] },
  { property: 'legendGradientTicks', initial: [{ value: 25, label: 'Initial' }],
    next: [{ value: 75, label: 'Current' }], old: [{ value: 50, label: 'Obsolete' }] },
  { property: 'hiddenCategories', initial: ['initial'], next: ['current'], old: ['obsolete'] },
] as const;

type LegendProperty = typeof cases[number]['property'];
async function mount(property: LegendProperty) {
  const element = await fixture<LyraMap>(html`<lr-map initialization="interaction" engine="maplibre"
    legend-interactive legend-control-role="checkbox"></lr-map>`);
  if (property === 'legendGradientTicks') element.legendGradient = [[0, '#000000'], [100, '#ffffff']];
  if (property === 'hiddenCategories') element.legend = ['initial', 'current', 'obsolete'].map(value => ({
    label: value, value, color: '#000000', pattern: 'solid',
  }));
  return element;
}

function assertRendered(element: LyraMap, property: LegendProperty, outcome: 'new' | 'clear' | 'same' | 'throw'): void {
  const clear = outcome === 'clear', current = outcome !== 'same';
  if (property === 'legend') {
    expect(element.legendProjection.inputCount).to.equal(clear ? 0 : 1);
    expect(element.legendProjection.renderedCount).to.equal(clear ? 0 : 1);
    expect(element.legendProjection.omittedCount).to.equal(0);
    const panel = element.shadowRoot!.querySelector('[part="legend"]')?.textContent ?? '';
    if (clear) expect(panel).to.equal('');
    else {
      expect(panel).to.include(current ? 'Current' : 'Initial');
      expect(panel).not.to.include('Obsolete');
      if (current) expect(panel).to.include('Current group');
    }
  } else if (property === 'legendGradient') {
    expect(element.shadowRoot!.querySelectorAll('[part="legend-gradient"]').length).to.equal(clear ? 0 : 1);
    if (!clear) expect(element.shadowRoot!.querySelector('[part="legend-hi"]')?.textContent).to.equal(current ? '200' : '100');
  } else if (property === 'legendGradientTicks') {
    const ticks = [...element.shadowRoot!.querySelectorAll('[part="legend-tick"]')].map(tick => tick.textContent);
    expect(ticks).to.deep.equal(clear ? [] : [current ? 'Current' : 'Initial']);
  } else {
    const states = [...element.shadowRoot!.querySelectorAll('[part~="legend-toggle"]')].map(row => row.getAttribute('aria-checked'));
    expect(states).to.deep.equal(clear ? ['true', 'true', 'true'] : current ? ['true', 'false', 'true'] : ['false', 'true', 'true']);
  }
}

for (const entry of cases) {
  for (const outcome of ['new', 'clear', 'same', 'throw'] as const) {
    it(`preserves ${outcome} ${entry.property} intent while an older input is being read`, async () => {
      const element = await mount(entry.property);
      Reflect.set(element, entry.property, entry.initial);
      await element.updateComplete;
      const held: unknown = Reflect.get(element, entry.property);
      const expected = outcome === 'clear' ? [] : outcome === 'same' ? held : entry.next;
      let replaced = false;
      const replace = () => {
        if (replaced) return;
        replaced = true;
        Reflect.set(element, entry.property, expected);
        if (outcome === 'throw') throw new Error('Obsolete legend input unavailable');
      };
      const obsolete = new Proxy([...entry.old], {
        get(target, key, receiver) { replace(); return Reflect.get(target, key, receiver); },
        getOwnPropertyDescriptor(target, key) { replace(); return Reflect.getOwnPropertyDescriptor(target, key); },
      });
      Reflect.set(element, entry.property, obsolete);
      expect(replaced).to.equal(true);
      expect(Reflect.get(element, entry.property)).to.deep.equal(expected);
      if (outcome === 'same' && entry.property !== 'legendGradientTicks') expect(Reflect.get(element, entry.property) === held).to.equal(true);
      await element.updateComplete;
      assertRendered(element, entry.property, outcome);
      // A canceled proposal must remain assignable once its caller stops replacing it.
      Reflect.set(element, entry.property, obsolete);
      expect(Reflect.get(element, entry.property)).to.deep.equal(entry.old);
      await element.updateComplete;
    });
  }

  it(`allows a caller to repeat the same ${entry.property} input during its own normalization`, async () => {
    const element = await mount(entry.property);
    let repeated = false;
    const repeat = () => { if (!repeated) { repeated = true; Reflect.set(element, entry.property, source); } };
    const source = new Proxy([...entry.next], {
      get(target, key, receiver) { repeat(); return Reflect.get(target, key, receiver); },
      getOwnPropertyDescriptor(target, key) { repeat(); return Reflect.getOwnPropertyDescriptor(target, key); },
    });
    Reflect.set(element, entry.property, source);
    expect(repeated).to.equal(true);
    expect(Reflect.get(element, entry.property)).to.deep.equal(entry.next);
    await element.updateComplete;
    assertRendered(element, entry.property, 'new');
  });
}

it('preserves a reaffirmed map style during older reflection and allows the canceled proposal to be assigned later', async () => {
  const element = await fixture<LyraMap>(html`<lr-map initialization="interaction" engine="maplibre"></lr-map>`);
  element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, name: 'Current style' };
  const current = element.mapStyle;
  let replaced = false;
  const obsolete = new Proxy({ ...LYRA_MAP_EMPTY_STYLE, name: 'Obsolete style' }, {
    getOwnPropertyDescriptor(target, key) {
      if (!replaced) { replaced = true; element.mapStyle = current; }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  element.mapStyle = obsolete;
  expect(replaced).to.equal(true);
  expect(element.mapStyle === current).to.equal(true);
  await element.updateComplete;
  element.mapStyle = obsolete;
  expect(element.mapStyle).to.deep.equal(obsolete);
  await element.updateComplete;
});

it('allows a map style to reaffirm its own pending assignment without discarding it', async () => {
  const element = await fixture<LyraMap>(html`<lr-map initialization="interaction" engine="maplibre"></lr-map>`);
  let repeated = false;
  const source = new Proxy({ ...LYRA_MAP_EMPTY_STYLE, name: 'Current style' }, {
    getOwnPropertyDescriptor(target, key) {
      if (!repeated) { repeated = true; element.mapStyle = source; }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  element.mapStyle = source;
  expect(repeated).to.equal(true);
  expect(element.mapStyle).to.deep.equal({ ...LYRA_MAP_EMPTY_STYLE, name: 'Current style' });
  await element.updateComplete;
});

for (const derived of [false, true]) {
  for (const timing of ['before', 'during'] as const) {
    it(`contains tick-array revocation ${timing} admission with ${derived ? 'derived' : 'explicit'} gradient and recovers`, async () => {
      const element = await fixture<LyraMap>(html`<lr-map initialization="interaction" engine="maplibre"></lr-map>`);
      if (derived) {
        element.choroplethLegend = true;
        element.choropleth = { sourceId: 'regions', geojson: { type: 'FeatureCollection', features: [] }, field: 'value',
          stops: [[0, '#000000'], [50, '#ff0000'], [100, '#ffffff']] };
      } else element.legendGradient = [[0, '#000000'], [100, '#ffffff']];
      element.legendGradientTicks = [{ value: 25, label: 'Initial' }];
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('[part="legend-tick"]')?.textContent).to.equal('Initial');
      const source = Proxy.revocable([{ value: 75, label: 'Unavailable' }], {
        getOwnPropertyDescriptor(target, key) {
          const result = Reflect.getOwnPropertyDescriptor(target, key);
          source.revoke();
          return result;
        },
      });
      if (timing === 'before') source.revoke();
      expect(() => { element.legendGradientTicks = source.proxy; }).not.to.throw();
      expect(element.legendGradientTicks.length).to.equal(0);
      await element.updateComplete;
      const ticks = () => [...element.shadowRoot!.querySelectorAll('[part="legend-tick"]')].map(tick => tick.textContent);
      expect(ticks()).to.deep.equal(derived ? ['50'] : []);
      element.legendGradientTicks = [];
      await element.updateComplete;
      expect(ticks()).to.deep.equal([]);
      element.legendGradientTicks = [{ value: 75, label: 'Recovered' }];
      await element.updateComplete;
      expect(ticks()).to.deep.equal(['Recovered']);
    });
  }
}

for (const ticks of [[], [Number.NaN]] as const) {
  it(`replaces visible derived ticks with an explicit ${ticks.length ? 'rejected-entry' : 'empty'} list`, async () => {
    const element = await fixture<LyraMap>(html`<lr-map initialization="interaction" engine="maplibre" choropleth-legend></lr-map>`);
    element.choropleth = { sourceId: 'regions', geojson: { type: 'FeatureCollection', features: [] }, field: 'value',
      stops: [[0, '#000000'], [50, '#ff0000'], [100, '#ffffff']] };
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="legend-tick"]')?.textContent).to.equal('50');
    element.legendGradientTicks = ticks;
    expect(element.legendGradientTicks.length).to.equal(0);
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part="legend-tick"]').length).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[part="legend-gradient"]').length).to.equal(1);
  });
}
