import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import './context-meter.js';
import type {
  ContextMeterSegment,
  LyraContextMeter,
  LyraContextMeterSegmentActivateDetail,
} from './context-meter.js';

const SEGMENTS: ContextMeterSegment[] = [
  { label: 'Received', value: 2000, tone: 'neutral' },
  { label: 'Reviewing', value: 5000, tone: 'brand' },
  { label: 'Blocked', value: 1000, tone: 'warning' },
];

function segments(el: LyraContextMeter): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="segment"]')];
}
function legendItems(el: LyraContextMeter): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="legend-item"]')];
}
function texts(el: LyraContextMeter, part: string): string[] {
  return [...el.shadowRoot!.querySelectorAll(`[part~="${part}"]`)].map(
    (node) => node.textContent?.trim() ?? '',
  );
}
function tagNames(nodes: Element[]): string[] {
  return nodes.map((node) => node.localName);
}
function pressedStates(nodes: Element[]): (string | null)[] {
  return nodes.map((node) => node.getAttribute('aria-pressed'));
}
function activations(el: LyraContextMeter): LyraContextMeterSegmentActivateDetail[] {
  const seen: LyraContextMeterSegmentActivateDetail[] = [];
  el.addEventListener('lr-segment-activate', (event) => {
    seen.push((event as CustomEvent<LyraContextMeterSegmentActivateDetail>).detail);
  });
  return seen;
}
async function meter(
  attrs: { interactive?: boolean; legend?: boolean; shape?: 'bar' | 'ring' } = {},
): Promise<LyraContextMeter> {
  const el = (await fixture(html`<lr-context-meter
    total="10000"
    shape=${attrs.shape ?? 'bar'}
    ?interactive=${attrs.interactive ?? false}
    ?show-legend=${attrs.legend ?? false}
    .segments=${SEGMENTS}
  ></lr-context-meter>`)) as LyraContextMeter;
  await el.updateComplete;
  return el;
}

describe('lr-context-meter legendDisplay', () => {
  it('renders labels only by default, exactly as before the property existed', async () => {
    const el = await meter({ legend: true });
    expect(el.legendDisplay, 'the default is label-only').to.equal('label');
    expect(texts(el, 'legend-label'), 'each row shows its label').to.deep.equal([
      'Received',
      'Reviewing',
      'Blocked',
    ]);
    expect(texts(el, 'legend-value').length, 'no value spans render').to.equal(0);
    expect(texts(el, 'legend-percent').length, 'no percent spans render').to.equal(0);
  });

  it('adds each segment value under label-value', async () => {
    const el = await meter({ legend: true });
    el.legendDisplay = 'label-value';
    await el.updateComplete;
    expect(texts(el, 'legend-value'), 'each row shows its own count').to.deep.equal([
      (2000).toLocaleString(),
      (5000).toLocaleString(),
      (1000).toLocaleString(),
    ]);
    expect(texts(el, 'legend-percent').length, 'no percent spans render').to.equal(0);
  });

  it('adds each segment share under label-percent', async () => {
    const el = await meter({ legend: true });
    el.legendDisplay = 'label-percent';
    await el.updateComplete;
    expect(texts(el, 'legend-value').length, 'no value spans render').to.equal(0);
    expect(texts(el, 'legend-percent').length, 'each row shows its own share').to.equal(3);
    expect(
      texts(el, 'legend-percent')[0]!.replace(/\s/g, ''),
      'the share is the painted ratio',
    ).to.equal('20%');
  });

  it('shows both under label-value-percent', async () => {
    const el = await meter({ legend: true });
    el.legendDisplay = 'label-value-percent';
    await el.updateComplete;
    expect(texts(el, 'legend-value').length, 'every row shows its count').to.equal(3);
    expect(texts(el, 'legend-percent').length, 'every row shows its share').to.equal(3);
  });

  it('reports the clamped share the bar actually paints, never an over-total one', async () => {
    const el = await meter({ legend: true });
    el.legendDisplay = 'label-percent';
    el.segments = [
      { label: 'Huge', value: 9000 },
      { label: 'Overflowing', value: 9000 },
    ];
    await el.updateComplete;
    const painted = segments(el).map((node) => parseFloat(node.style.flexBasis));
    const shown = texts(el, 'legend-percent').map((text) =>
      parseFloat(text.replace(/[^\d.]/g, '')),
    );
    expect(shown[0], 'the first share matches its painted band').to.be.closeTo(painted[0]!, 0.2);
    expect(shown[1], 'the truncated band reports its truncated share').to.be.closeTo(
      painted[1]!,
      0.2,
    );
    expect(shown[0]! + shown[1]!, 'the shares never sum past the full bar').to.be.at.most(100.5);
  });

  it('formats the share through the effective locale', async () => {
    const el = (await fixture(html`<lr-context-meter
      locale="de-DE"
      show-legend
      legend-display="label-percent"
      total="10000"
      .segments=${SEGMENTS}
    ></lr-context-meter>`)) as LyraContextMeter;
    await el.updateComplete;
    expect(
      texts(el, 'legend-percent')[0]!.includes('%'),
      'the German percent format still renders a percent',
    ).to.equal(true);
    expect(
      texts(el, 'legend-percent')[0] !== (0.2).toLocaleString('en', { style: 'percent' }),
      'and it is not the English formatting',
    ).to.equal(true);
  });

  it('normalizes a foreign legend-display attribute to labels only', async () => {
    const el = (await fixture(html`<lr-context-meter
      show-legend
      legend-display="everything"
      total="10000"
      .segments=${SEGMENTS}
    ></lr-context-meter>`)) as LyraContextMeter;
    await el.updateComplete;
    expect(el.legendDisplay, 'the foreign value normalizes').to.equal('label');
    expect(texts(el, 'legend-value').length, 'nothing extra renders').to.equal(0);
  });
});

describe('lr-context-meter interactive mode', () => {
  it('stays a pure visualization by default', async () => {
    const el = await meter({ legend: true });
    const seen = activations(el);
    expect(el.interactive, 'interactive is opt-in').to.equal(false);
    expect(tagNames(segments(el)), 'segments stay plain spans').to.deep.equal([
      'span',
      'span',
      'span',
    ]);
    expect(
      el.shadowRoot!.querySelector('[part~="legend"]')!.getAttribute('aria-hidden'),
      'the legend stays out of the accessibility tree',
    ).to.equal('true');
    segments(el)[0]!.click();
    legendItems(el)[0]!.click();
    expect(seen.length, 'nothing is emitted').to.equal(0);
  });

  it('turns segments and legend rows into real buttons and exposes the legend', async () => {
    const el = await meter({ interactive: true, legend: true });
    expect(tagNames(segments(el)), 'every segment is a button').to.deep.equal([
      'button',
      'button',
      'button',
    ]);
    expect(tagNames(legendItems(el)), 'every legend row is a button').to.deep.equal([
      'button',
      'button',
      'button',
    ]);
    expect(
      el.shadowRoot!.querySelector('[part~="legend"]')!.hasAttribute('aria-hidden'),
      'the legend is reachable in this mode',
    ).to.equal(false);
    expect(
      pressedStates(segments(el)),
      'an unselected segment renders aria-pressed="false", not a missing attribute',
    ).to.deep.equal(['false', 'false', 'false']);
    expect(pressedStates(legendItems(el)), 'so does an unselected legend row').to.deep.equal([
      'false',
      'false',
      'false',
    ]);
    expect(
      el.shadowRoot!.querySelectorAll('[part~="segment-list"]').length,
      'the static breakdown list steps aside for the buttons',
    ).to.equal(0);
  });

  it('emits a cancelable activation naming the segment, then selects it', async () => {
    const el = await meter({ interactive: true });
    const seen = activations(el);
    let cancelable = false;
    el.addEventListener('lr-segment-activate', (event) => {
      cancelable = event.cancelable;
    });
    segments(el)[1]!.click();
    await el.updateComplete;

    expect(seen.length, 'one activation is emitted').to.equal(1);
    expect(seen[0], 'the detail names the activated band').to.deep.equal({
      index: 1,
      label: 'Reviewing',
      value: 5000,
    });
    expect(cancelable, 'the activation is a real veto point').to.equal(true);
    expect([...el.selectedIndices], 'the component commits the selection').to.deep.equal([1]);
    expect(pressedStates(segments(el)), 'the pressed state follows').to.deep.equal([
      'false',
      'true',
      'false',
    ]);
  });

  it('toggles a selected segment back off', async () => {
    const el = await meter({ interactive: true });
    segments(el)[0]!.click();
    await el.updateComplete;
    segments(el)[0]!.click();
    await el.updateComplete;
    expect([...el.selectedIndices], 'the second activation deselects').to.deep.equal([]);
  });

  it('leaves the selection alone when a listener vetoes the activation', async () => {
    const el = await meter({ interactive: true });
    el.addEventListener('lr-segment-activate', (event) => event.preventDefault());
    segments(el)[2]!.click();
    await el.updateComplete;
    expect([...el.selectedIndices], 'a vetoed activation commits nothing').to.deep.equal([]);
    expect(pressedStates(segments(el))[2], 'and the pressed state does not move').to.equal('false');
  });

  it('honours a controlled selectedIndices assignment', async () => {
    const el = await meter({ interactive: true, legend: true });
    el.selectedIndices = [0, 2];
    await el.updateComplete;
    expect(pressedStates(segments(el)), 'both selected bands read as pressed').to.deep.equal([
      'true',
      'false',
      'true',
    ]);
    expect(pressedStates(legendItems(el)), 'their legend rows agree').to.deep.equal([
      'true',
      'false',
      'true',
    ]);
  });

  it('ignores an out-of-range or fractional selected index instead of throwing', async () => {
    const el = await meter({ interactive: true });
    el.selectedIndices = [99, 1.5, -1, 0];
    await el.updateComplete;
    expect(pressedStates(segments(el)), 'only the real index is pressed').to.deep.equal([
      'true',
      'false',
      'false',
    ]);
  });

  it('keeps a selection that survives the data shrinking, and drops one that does not', async () => {
    const el = await meter({ interactive: true });
    el.selectedIndices = [0, 2];
    await el.updateComplete;
    el.segments = [SEGMENTS[0]!];
    await el.updateComplete;
    expect(pressedStates(segments(el)), 'the surviving band stays pressed').to.deep.equal(['true']);
  });

  it('activates from the keyboard on the focused segment', async () => {
    const el = await meter({ interactive: true });
    const seen = activations(el);
    segments(el)[0]!.focus();
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(seen.map((detail) => detail.index), 'Enter activates the focused band').to.deep.equal([
      0,
    ]);
  });

  it('activates the same segment from its legend row', async () => {
    const el = await meter({ interactive: true, legend: true });
    const seen = activations(el);
    legendItems(el)[2]!.click();
    await el.updateComplete;
    expect(seen[0], 'the legend row names the same band').to.deep.equal({
      index: 2,
      label: 'Blocked',
      value: 1000,
    });
    expect([...el.selectedIndices], 'and commits the same selection').to.deep.equal([2]);
  });

  it('makes ring arcs operable too', async () => {
    const el = await meter({ interactive: true, shape: 'ring' });
    const seen = activations(el);
    const arcs = segments(el);
    expect(
      arcs.map((arc) => arc.getAttribute('role')),
      'an SVG arc cannot be a native button, so it carries the role',
    ).to.deep.equal(['button', 'button', 'button']);
    expect(pressedStates(arcs), 'each arc renders its pressed state').to.deep.equal([
      'false',
      'false',
      'false',
    ]);
    arcs[1]!.focus();
    await sendKeys({ press: ' ' });
    await el.updateComplete;
    expect(seen.map((detail) => detail.index), 'Space activates a focused arc').to.deep.equal([1]);
  });

  it('paints the control affordance the interactive stylesheet promises', async () => {
    const el = await meter({ interactive: true, legend: true });
    el.selectedIndices = [0];
    await el.updateComplete;
    const band = segments(el)[0]!;
    expect(getComputedStyle(band).cursor, 'a band reads as a click target').to.equal('pointer');
    expect(
      getComputedStyle(legendItems(el)[0]!).cursor,
      'so does a legend row',
    ).to.equal('pointer');
    expect(
      getComputedStyle(band).boxShadow !== 'none',
      'a selected band paints its ring inside the clipping track',
    ).to.equal(true);
    expect(
      getComputedStyle(legendItems(el)[0]!).boxShadow !== 'none',
      'and so does its legend row',
    ).to.equal(true);
    expect(
      getComputedStyle(band).outlineStyle,
      'the selected cue is NOT an outline, so the hover/press/focus outlines cannot replace it',
    ).to.equal('none');
    expect(
      getComputedStyle(segments(el)[1]!).boxShadow,
      'an unselected band paints no ring',
    ).to.equal('none');
  });

  it('keeps a selected band selected while it is hovered', async () => {
    const el = await meter({ interactive: true });
    el.selectedIndices = [1];
    await el.updateComplete;
    const band = segments(el)[1]!;
    const selectedRing = getComputedStyle(band).boxShadow;
    expect(selectedRing !== 'none', 'the band starts out painting a selection ring').to.equal(true);
    try {
      await hoverUntilMatched(band, 'the selected band never registered :hover');
      await waitUntil(
        () => getComputedStyle(band).outlineStyle === 'solid',
        'the hover outline never reached the selected band',
      );
      expect(
        getComputedStyle(band).boxShadow,
        'the selection ring survives the hover outline instead of being replaced by it',
      ).to.equal(selectedRing);
    } finally {
      await resetMouse();
    }
  });

  it('keeps a selected band selected while it is keyboard-focused', async () => {
    const el = await meter({ interactive: true });
    el.selectedIndices = [1];
    await el.updateComplete;
    const bands = segments(el);
    const selectedRing = getComputedStyle(bands[1]!).boxShadow;
    expect(selectedRing !== 'none', 'the band starts out painting a selection ring').to.equal(true);
    // Tab from the previous band, so the focus arrives by keyboard and :focus-visible matches.
    bands[0]!.focus();
    await sendKeys({ press: 'Tab' });
    await waitUntil(
      () => bands[1]!.matches(':focus-visible'),
      'the second band never became the keyboard-focused element',
    );
    expect(
      getComputedStyle(bands[1]!).outlineStyle,
      'the focus ring still paints on a selected band',
    ).to.equal('solid');
    expect(
      getComputedStyle(bands[1]!).boxShadow,
      'and the selection ring is still there beside it',
    ).to.equal(selectedRing);
  });

  it('marks a selected ring arc per arc, not with the whole ring bounding box', async () => {
    const el = await meter({ interactive: true, shape: 'ring' });
    el.selectedIndices = [1];
    await el.updateComplete;
    const arcs = segments(el);
    const selected = parseFloat(getComputedStyle(arcs[1]!).strokeWidth);
    const unselected = parseFloat(getComputedStyle(arcs[0]!).strokeWidth);
    expect(
      selected > unselected,
      'the selected arc carries its own stroke cue, which an arc-shaped selection can',
    ).to.equal(true);
    expect(
      getComputedStyle(arcs[1]!).outlineStyle,
      'and not an outline, which would trace the ring identically for every arc',
    ).to.equal('none');
    expect(
      parseFloat(getComputedStyle(arcs[2]!).strokeWidth),
      'an unselected arc keeps the template stroke',
    ).to.equal(unselected);
  });

  it('keeps working across a disconnect and reconnect', async () => {
    const el = await meter({ interactive: true });
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    const seen = activations(el);
    segments(el)[0]!.click();
    await el.updateComplete;
    expect(seen.length, 'activation survives reconnection').to.equal(1);
  });

  it('names each control through the overridable segment string', async () => {
    const el = (await fixture(html`<lr-context-meter
      interactive
      show-legend
      total="10000"
      .strings=${{ contextMeterSegmentLabel: '{label} — {count}' }}
      .segments=${SEGMENTS}
    ></lr-context-meter>`)) as LyraContextMeter;
    await el.updateComplete;
    expect(
      segments(el)[0]!.getAttribute('aria-label'),
      'the override reaches the segment button name',
    ).to.equal('Received — 2,000');
  });

  it('stays accessible with an interactive legend and a selection', async () => {
    const el = await meter({ interactive: true, legend: true });
    el.legendDisplay = 'label-value-percent';
    el.selectedIndices = [1];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('stays accessible under dir="rtl"', async () => {
    const wrapper = await fixture(html`<div dir="rtl">
      <lr-context-meter
        interactive
        show-legend
        legend-display="label-value-percent"
        total="10000"
        .segments=${SEGMENTS}
      ></lr-context-meter>
    </div>`);
    const el = wrapper.querySelector('lr-context-meter') as LyraContextMeter;
    await el.updateComplete;
    expect(
      (el as unknown as { readonly effectiveDirection: string }).effectiveDirection,
      'the meter resolves RTL',
    ).to.equal('rtl');
    expect(texts(el, 'legend-label'), 'the legend keeps source order').to.deep.equal([
      'Received',
      'Reviewing',
      'Blocked',
    ]);
    await expect(el).to.be.accessible();
  });
});
