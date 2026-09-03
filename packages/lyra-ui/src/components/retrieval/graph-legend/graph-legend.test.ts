import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './graph-legend.js';
import type { LyraGraphLegend } from './graph-legend.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function sinkElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  );
}

function sinkTexts(): string[] {
  return Array.from(sinkElement()?.children ?? []).map(
    (child) => child.textContent ?? ''
  );
}

const types = [
  { id: 'person', label: 'Person' },
  {
    id: 'org',
    label: 'Organization',
    color: '#7c3aed',
    shape: 'square' as const,
  },
];

it('defaults to empty types/counts/hiddenTypes, interactive=true, empty label', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  expect(el.types).to.deep.equal([]);
  expect(el.counts).to.equal(undefined);
  expect(el.hiddenTypes).to.deep.equal([]);
  expect(el.interactive).to.be.true;
  expect(el.label).to.equal('');
});

it('renders one [part="item"] button per type, with visible text = label (+ count when given)', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.types = types;
  el.counts = { person: 3 };
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[part~="item"]');
  expect(items.length).to.equal(2);
  expect(items[0]!.textContent).to.include('Person');
  expect(items[0]!.textContent).to.include('3');
  expect(items[1]!.textContent).to.include('Organization');
  expect(items[1]!.textContent).to.not.match(/\d/); // no count entry for 'org'
});

it('omits malformed or blank type labels while retaining a valid neighboring type', async () => {
  const el = await fixture<LyraGraphLegend>(
    html`<lr-graph-legend></lr-graph-legend>`
  );
  (el as unknown as { types: unknown }).types = [
    { id: 'empty', label: '' },
    { id: 'blank', label: '   ' },
    { id: 'numeric', label: 42 },
    { id: 'valid', label: 'Valid type' },
  ];
  await el.updateComplete;

  const items = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="item"]'),
  ];
  expect(items.map((item) => item.textContent?.trim())).to.deep.equal([
    'Valid type',
  ]);
  await expect(el).to.be.accessible();
});

it("uses a type's own color for its swatch when set, and a palette fallback otherwise", async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.types = types;
  await el.updateComplete;
  const swatches = el.shadowRoot!.querySelectorAll('[part~="swatch"]');
  expect(
    swatches[1]!.getAttribute('fill') ??
      swatches[1]!.querySelector('[fill]')?.getAttribute('fill')
  ).to.equal('#7c3aed');
  // 'person' has no explicit color -- falls back to the categorical palette. The design tokens
  // define `--lr-graph-cat-1` (specialist-tokens.styles.ts), so the computed style resolves to
  // that real token value rather than this component's own hardcoded FALLBACK_PALETTE[0].
  const personFill =
    swatches[0]!.getAttribute('fill') ??
    swatches[0]!.querySelector('[fill]')?.getAttribute('fill');
  expect(personFill).to.equal('#8250df');
});

it('rejects url paint servers and falls back to the categorical palette', async () => {
  const el = await fixture<LyraGraphLegend>(
    html`<lr-graph-legend></lr-graph-legend>`
  );
  el.types = [
    {
      id: 'unsafe',
      label: 'Unsafe',
      color: 'url("data:image/svg+xml,<svg/>")',
    },
  ];
  await el.updateComplete;
  const swatch = el.shadowRoot!.querySelector('[part~="swatch"]')!;
  const fill =
    swatch.getAttribute('fill') ??
    swatch.querySelector('[fill]')?.getAttribute('fill');
  expect(fill).to.equal('#8250df');
});

it('toggles hiddenTypes and emits lr-visibility-change with the full updated array on click', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.types = types;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelectorAll(
    '[part~="item"]'
  )[0] as HTMLButtonElement;
  expect(button.getAttribute('aria-pressed')).to.equal('true');

  const listener = oneEvent(el, 'lr-visibility-change');
  button.click();
  const event = await listener;
  expect(event.detail.hiddenTypes).to.deep.equal(['person']);
  expect(el.hiddenTypes).to.deep.equal(['person']);
  await el.updateComplete;
  expect(button.getAttribute('aria-pressed')).to.equal('false');

  const listener2 = oneEvent(el, 'lr-visibility-change');
  button.click();
  const event2 = await listener2;
  expect(event2.detail.hiddenTypes).to.deep.equal([]);
});

it('emits a frozen cancelable proposal before assigning, announcing, and posting an accepted visibility change', async () => {
  const el = await fixture<LyraGraphLegend>(html`<lr-graph-legend .types=${types}></lr-graph-legend>`);
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="item"]')!;
  const announcementsBefore = sinkTexts().length;
  let preEvent: CustomEvent<{ hiddenTypes: string[] }> | undefined;
  let preSawCurrentState = false;
  let postSawCommittedState = false;
  let postSawAnnouncement = false;
  let proposals = 0;
  let commits = 0;
  el.addEventListener('lr-before-visibility-change', (event) => {
    proposals += 1;
    preEvent = event as CustomEvent<{ hiddenTypes: string[] }>;
    preSawCurrentState = el.hiddenTypes.length === 0 && sinkTexts().length === announcementsBefore;
    try {
      preEvent.detail.hiddenTypes.push('mutated');
    } catch {
      // A frozen proposal may throw in strict mode; either outcome must leave the detail unchanged.
    }
  });
  el.addEventListener('lr-visibility-change', () => {
    commits += 1;
    postSawCommittedState = el.hiddenTypes.join(',') === 'person';
    postSawAnnouncement = sinkTexts().length === announcementsBefore + 1;
  });

  button.click();
  await el.updateComplete;

  expect(preEvent === undefined).to.equal(false);
  expect(preEvent!.bubbles).to.equal(true);
  expect(preEvent!.composed).to.equal(true);
  expect(preEvent!.cancelable).to.equal(true);
  expect(Object.isFrozen(preEvent!.detail)).to.equal(true);
  expect(Object.isFrozen(preEvent!.detail.hiddenTypes)).to.equal(true);
  expect(preEvent!.detail.hiddenTypes).to.deep.equal(['person']);
  expect(preSawCurrentState).to.equal(true);
  expect(postSawCommittedState).to.equal(true);
  expect(postSawAnnouncement).to.equal(true);
  expect(proposals).to.equal(1);
  expect(commits).to.equal(1);
  expect(el.hiddenTypes).to.deep.equal(['person']);

  el.hiddenTypes = ['org'];
  await el.updateComplete;
  expect(proposals).to.equal(1);
  expect(commits).to.equal(1);
  expect(sinkTexts().length).to.equal(announcementsBefore + 1);
  await expect(el).to.be.accessible();
});

it('lets only a canceled proposal veto the child mutation, announcement, and post event', async () => {
  const el = await fixture<LyraGraphLegend>(html`<lr-graph-legend .types=${types}></lr-graph-legend>`);
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="item"]')!;
  const announcementsBefore = sinkTexts().length;
  let proposals = 0;
  let commits = 0;
  el.addEventListener('lr-before-visibility-change', (event) => {
    proposals += 1;
    event.preventDefault();
  });
  el.addEventListener('lr-visibility-change', () => commits += 1);

  button.click();
  await el.updateComplete;

  expect(proposals).to.equal(1);
  expect(commits).to.equal(0);
  expect(el.hiddenTypes).to.deep.equal([]);
  expect(sinkTexts().length).to.equal(announcementsBefore);
  expect(button.getAttribute('aria-pressed')).to.equal('true');
});

it('uses the same proposal and commit sequence for native pointer and keyboard activation', async () => {
  const el = await fixture<LyraGraphLegend>(html`<lr-graph-legend .types=${types}></lr-graph-legend>`);
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="item"]')!;
  const proposals: string[][] = [];
  const commits: string[][] = [];
  el.addEventListener('lr-before-visibility-change', (event) => {
    proposals.push([...(event as CustomEvent<{ hiddenTypes: string[] }>).detail.hiddenTypes]);
  });
  el.addEventListener('lr-visibility-change', (event) => {
    commits.push([...(event as CustomEvent<{ hiddenTypes: string[] }>).detail.hiddenTypes]);
  });
  try {
    await resetMouse();
    button.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = button.getBoundingClientRect();
    await sendMouse({
      type: 'click',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(() => el.hiddenTypes.join(',') === 'person', 'native pointer activation did not commit');

    button.focus();
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => el.hiddenTypes.length === 0, 'keyboard activation did not commit');
  } finally {
    await resetMouse();
  }
  expect(proposals).to.deep.equal([['person'], []]);
  expect(commits).to.deep.equal([['person'], []]);
});

it('wires the Default story to visible hide and restore feedback', async () => {
  const { Default } = await import('./graph-legend.stories.js');
  const root = (await fixture(
    Default.render!({}, null as never)
  )) as HTMLElement;
  const legend = root.querySelector<LyraGraphLegend>('lr-graph-legend')!;
  const feedback = root.querySelector<HTMLElement>(
    '[data-visibility-feedback]'
  )!;
  const first =
    legend.shadowRoot!.querySelector<HTMLButtonElement>('[part~="item"]')!;

  expect(feedback.textContent?.trim()).to.equal('All types are visible.');
  first.click();
  await legend.updateComplete;
  expect(feedback.textContent?.trim()).to.equal('Hidden types: person');
  first.click();
  await legend.updateComplete;
  expect(feedback.textContent?.trim()).to.equal('All types are visible.');
});

it('shows the controlled story vetoing first and accepting a later proposal', async () => {
  const { ControlledVisibility } = await import('./graph-legend.stories.js');
  const root = (await fixture(ControlledVisibility.render!({}, null as never))) as HTMLElement;
  const legend = root.querySelector<LyraGraphLegend>('lr-graph-legend')!;
  const allow = root.querySelector<HTMLInputElement>('[data-allow-visibility]')!;
  const feedback = root.querySelector<HTMLElement>('[data-controlled-visibility-feedback]')!;
  const first = legend.shadowRoot!.querySelector<HTMLButtonElement>('[part~="item"]')!;

  first.click();
  await legend.updateComplete;
  expect(legend.hiddenTypes).to.deep.equal([]);
  expect(feedback.textContent?.trim()).to.equal('Change vetoed before it was applied.');

  allow.checked = true;
  first.click();
  await legend.updateComplete;
  expect(legend.hiddenTypes).to.deep.equal(['person']);
  expect(feedback.textContent?.trim()).to.equal('Accepted hidden types: person');
});

it('announces the toggle through the shared light-DOM region and keeps the shadow part inert', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.types = types;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelectorAll(
    '[part~="item"]'
  )[0] as HTMLButtonElement;
  button.click();
  await el.updateComplete;
  const live = el.shadowRoot!.querySelector('[part="live-region"]')!;
  expect(live.textContent).to.equal('Person hidden');
  expect(live.getAttribute('role')).to.equal(null);
  expect(live.getAttribute('aria-live')).to.equal(null);
  expect(live.getAttribute('aria-hidden')).to.equal('true');
  expect(sinkTexts()).to.deep.equal(['Person hidden']);
});

it('releases and reacquires its shared announcement sink across disconnect and reconnect', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  expect(sinkElement() !== null).to.be.true;
  el.remove();
  expect(sinkElement() === null).to.be.true;
  document.body.append(el);
  expect(sinkElement() !== null).to.be.true;
  el.remove();
  expect(sinkElement() === null).to.be.true;
});

it('renders plain (non-interactive) items with no button and no toggling when interactive=false', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.types = types;
  el.interactive = false;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('button[part~="item"]').length
  ).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part~="item"]').length).to.equal(2);
});

it('names the group from label, falling back to the localized default', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Graph legend');
  el.label = 'Entity types';
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Entity types');
});

it('keeps exactly one owner across explicit-empty and dynamic host naming', async () => {
  const el = (await fixture(
    html`<lr-graph-legend label="Entity types" aria-label=""></lr-graph-legend>`
  )) as LyraGraphLegend;
  const group = () =>
    el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

  expect(el.hasAttribute('aria-label')).to.equal(true);
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(group().getAttribute('aria-label')).to.equal('');
  expect(group().getAttribute('role')).to.equal('group');

  el.setAttribute('aria-label', 'Author legend');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Author legend');
  expect(group().getAttribute('aria-label')).to.equal(null);
  expect(group().getAttribute('role')).to.equal(null);

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal(null);
  expect(group().getAttribute('aria-label')).to.equal('Entity types');
  expect(group().getAttribute('role')).to.equal('group');
});

it('is accessible with types, counts, and a hidden type', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.types = types;
  el.counts = { person: 3 };
  el.hiddenTypes = ['org'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('honors a .strings override of graphLegendLabel on the group aria-label', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.strings = { graphLegendLabel: 'Étiquette du graphe' };
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Étiquette du graphe');
});

it('honors a .strings override of legendTypeHidden/legendTypeShown in the live-region announcement', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.strings = {
    legendTypeHidden: '{label} masqué',
    legendTypeShown: '{label} affiché',
  };
  el.types = types;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelectorAll(
    '[part~="item"]'
  )[0] as HTMLButtonElement;
  const live = el.shadowRoot!.querySelector('[part="live-region"]')!;

  button.click();
  await el.updateComplete;
  expect(live.textContent).to.equal('Person masqué');

  button.click();
  await el.updateComplete;
  expect(live.textContent).to.equal('Person affiché');
  expect(sinkTexts()).to.deep.equal(['Person masqué', 'Person affiché']);
});

it('interactive="false" (plain HTML attribute) renders a read-only legend, matching the .interactive=false property path', async () => {
  const el = (await fixture(
    html`<lr-graph-legend interactive="false"></lr-graph-legend>`
  )) as LyraGraphLegend;
  expect(el.interactive).to.be.false;
  el.types = types;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('button[part~="item"]').length
  ).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part~="item"]').length).to.equal(2);
});

it('declares a --lr-graph-legend-hidden-color cssprop indirection layer for a hidden row, independent of the shared quiet-text token', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.types = types;
  el.hiddenTypes = ['person'];
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part~="item"][data-hidden] [part="label"]'
  ) as HTMLElement;

  const unset = getComputedStyle(label).color;
  el.style.setProperty('--lr-graph-legend-hidden-color', 'rgb(10, 20, 30)');
  expect(getComputedStyle(label).color).to.equal('rgb(10, 20, 30)');

  el.style.setProperty(
    '--lr-graph-legend-hidden-color',
    'var(--lr-color-text-quiet)'
  );
  expect(getComputedStyle(label).color).to.equal(unset);
});

it('contains an unbroken public type label within a 320px allocation', async () => {
  const wrapper = await fixture(html`
    <div style="box-sizing:border-box; inline-size:320px; overflow:auto;">
      <lr-graph-legend></lr-graph-legend>
    </div>
  `);
  const el = wrapper.querySelector('lr-graph-legend') as LyraGraphLegend;
  el.types = [{ id: 'long', label: `entity-${'classification'.repeat(32)}` }];
  await el.updateComplete;
  const item = el.shadowRoot!.querySelector('[part~="item"]') as HTMLElement;
  const label = item.querySelector('[part="label"]') as HTMLElement;

  expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  expect(item.getBoundingClientRect().width).to.be.at.most(
    el.getBoundingClientRect().width
  );
  expect(label.getBoundingClientRect().width).to.be.at.most(
    item.getBoundingClientRect().width
  );
});

it('exposes the hidden swatch opacity through a component-scoped theme token', async () => {
  const el = (await fixture(
    html`<lr-graph-legend></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.types = types;
  el.hiddenTypes = ['person'];
  await el.updateComplete;
  const swatch = el.shadowRoot!.querySelector(
    '[part~="item"][data-hidden] [part="swatch"]'
  ) as SVGElement;

  expect(getComputedStyle(swatch).opacity).to.equal('0.5');
  el.style.setProperty('--lr-graph-legend-hidden-swatch-opacity', '0.23');
  expect(getComputedStyle(swatch).opacity).to.equal('0.23');
});

it('formats visible counts with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-graph-legend lang="ar-EG"></lr-graph-legend>`
  )) as LyraGraphLegend;
  el.types = types;
  el.counts = { person: 1234 };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="count"]')!.textContent).to.equal(
    new Intl.NumberFormat('ar-EG').format(1234)
  );
});

it('normalizes non-finite public counts to a finite non-negative fallback', async () => {
  const el = await fixture<LyraGraphLegend>(
    html`<lr-graph-legend></lr-graph-legend>`
  );
  el.types = types;
  el.counts = { person: Number.NaN, org: Number.POSITIVE_INFINITY };
  await el.updateComplete;

  expect(
    [...el.shadowRoot!.querySelectorAll('[part="count"]')].map(
      (count) => count.textContent
    )
  ).to.deep.equal(['0', '0']);
});
