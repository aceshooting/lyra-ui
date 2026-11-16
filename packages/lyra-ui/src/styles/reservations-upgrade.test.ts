import { expect, fixture, html, waitUntil } from '@open-wc/testing';

// Measures the layout shift reservations.css prevents: the same markup is measured while its
// elements are still undefined (only the reservation styles them), then again after their
// definitions load in this same page. Nothing in this file registers these tags up front.
const loadedLinks: HTMLLinkElement[] = [];
async function loadStylesheet(name: 'tokens-root.css' | 'reservations.css'): Promise<void> {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL(`./${name}`, import.meta.url).href;
  const settled = new Promise<void>((resolve, reject) => {
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => reject(new Error(`Failed to load ${name}`)), { once: true });
  });
  document.head.append(link);
  loadedLinks.push(link);
  await settled;
}

after(() => {
  for (const link of loadedLinks) link.remove();
});

const TAGS = ['lr-badge', 'lr-checkbox', 'lr-chat-composer', 'lr-tab-group', 'lr-tab', 'lr-tab-panel'] as const;
type Box = { x: number; y: number; w: number; h: number };

function box(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
}

const MEASURED = ['#first-group', '#first-group-after', '#active-group', '#active-group-after', 'lr-checkbox',
  '#checkbox-after', 'lr-badge', '#badge-line', 'lr-chat-composer', '#composer-after', '#composer-below', '#composer-below-after'] as const;

describe('reservations.css upgrade shift', () => {
  it('reserves tab group, tab, tab panel, checkbox, badge and chat composer (inline and below) at their upgraded size', async () => {
    await loadStylesheet('tokens-root.css');
    await loadStylesheet('reservations.css');
    const root = await fixture<HTMLElement>(html`
      <div style="inline-size: 600px">
        <lr-tab-group id="first-group">
          <lr-tab panel="a">Alpha</lr-tab>
          <lr-tab panel="b">Beta</lr-tab>
          <lr-tab-panel name="a">Content A</lr-tab-panel>
          <lr-tab-panel name="b">Content B<br>second line</lr-tab-panel>
        </lr-tab-group>
        <p id="first-group-after">after</p>
        <lr-tab-group id="active-group">
          <lr-tab panel="a">Alpha</lr-tab>
          <lr-tab panel="b" active>Beta</lr-tab>
          <lr-tab-panel name="a">Content A</lr-tab-panel>
          <lr-tab-panel name="b" active>Content B<br>second line</lr-tab-panel>
        </lr-tab-group>
        <p id="active-group-after">after</p>
        <lr-checkbox>Opt in</lr-checkbox><span id="checkbox-after">after</span>
        <p id="badge-line"><lr-badge>New</lr-badge> after</p>
        <lr-chat-composer></lr-chat-composer>
        <p id="composer-after">after</p>
        <lr-chat-composer id="composer-below" actions-layout="below"></lr-chat-composer>
        <p id="composer-below-after">after</p>
      </div>
    `);
    for (const tagName of TAGS) expect(customElements.get(tagName) === undefined, `${tagName} must start undefined`).to.equal(true);
    const snapshot = (): Record<string, Box> =>
      Object.fromEntries(MEASURED.map((selector) => [selector, box(root.querySelector(selector)!)]));
    const before = snapshot();
    expect(getComputedStyle(root.querySelector('#first-group > lr-tab-panel[name="b"]')!).display).to.equal('none');
    expect(getComputedStyle(root.querySelector('#active-group > lr-tab-panel[name="a"]')!).display).to.equal('none');

    await Promise.all([
      import('../components/lr-tab-group.js'),
      import('../components/lr-tab.js'),
      import('../components/lr-tab-panel.js'),
      import('../components/lr-checkbox.js'),
      import('../components/lr-badge.js'),
      import('../components/lr-chat-composer.js'),
    ]);
    await waitUntil(() => TAGS.every((tagName) => customElements.get(tagName)), 'definitions did not load');
    for (const el of root.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>(TAGS.join(','))) {
      await el.updateComplete;
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const upgraded = snapshot();

    const shifts: string[] = [];
    for (const selector of MEASURED) {
      const a = before[selector]!;
      const b = upgraded[selector]!;
      for (const key of ['x', 'y', 'w', 'h'] as const) {
        // The badge's own block offset inside its line may differ by an engine's baseline rounding;
        // its line (#badge-line) and everything after it are still held to 1px.
        const tolerance = selector === 'lr-badge' && key === 'y' ? 2 : 1;
        if (Math.abs(a[key] - b[key]) > tolerance) shifts.push(`${selector} ${key}: reserved ${a[key]}, upgraded ${b[key]}`);
      }
    }
    expect(shifts).to.deep.equal([]);
  });

  it('lays out a vertical and an ordered timeline before upgrade at their upgraded size', async () => {
    await loadStylesheet('tokens-root.css');
    await loadStylesheet('reservations.css');
    const root = await fixture<HTMLElement>(html`
      <div style="inline-size: 480px">
        <lr-timeline id="steps" ordered aria-label="Steps">
          <lr-timeline-item>Submit the form<span slot="timestamp">3 March</span><span slot="description">Online or at the desk.</span></lr-timeline-item>
          <lr-timeline-item variant="success">Pay the fee<span slot="description">Within ten working days.</span></lr-timeline-item>
          <lr-timeline-item>Collect the permit</lr-timeline-item>
        </lr-timeline>
        <p id="steps-after">after</p>
        <lr-timeline id="events" aria-label="Events">
          <lr-timeline-item>Created</lr-timeline-item>
          <lr-timeline-item>Approved<span slot="timestamp">today</span></lr-timeline-item>
        </lr-timeline>
        <p id="events-after">after</p>
      </div>
    `);
    const tags = ['lr-timeline', 'lr-timeline-item'];
    for (const tagName of tags) expect(customElements.get(tagName) === undefined, `${tagName} must start undefined`).to.equal(true);
    const items = [...root.querySelectorAll('lr-timeline-item')];
    const firstStep = items[0]!;
    expect(getComputedStyle(firstStep, '::before').content).to.include('counter');
    expect(getComputedStyle(firstStep, '::after').content).to.equal('""');
    expect(getComputedStyle(items[2]!, '::after').content).to.equal('none');
    const selectors = ['#steps', '#steps-after', '#events', '#events-after'];
    const snapshot = (): Record<string, Box> => ({
      ...Object.fromEntries(selectors.map((selector) => [selector, box(root.querySelector(selector)!)])),
      ...Object.fromEntries(items.map((item, index) => [`item ${index}`, box(item)])),
    });
    const before = snapshot();

    await import('../components/lr-timeline.js');
    await waitUntil(() => tags.every((tagName) => customElements.get(tagName)), 'definitions did not load');
    for (const el of root.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>(tags.join(','))) {
      await el.updateComplete;
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    for (const el of root.querySelectorAll<HTMLElement & { updateComplete?: Promise<unknown> }>(tags.join(','))) {
      await el.updateComplete;
    }
    const upgraded = snapshot();
    const step = (firstStep.shadowRoot!.querySelector('[part="marker-number"]')?.textContent ?? '').trim();
    expect(step).to.equal('1');

    const shifts: string[] = [];
    for (const [selector, a] of Object.entries(before)) {
      const b = upgraded[selector]!;
      for (const key of ['x', 'y', 'w', 'h'] as const) {
        if (Math.abs(a[key] - b[key]) > 1) shifts.push(`${selector} ${key}: reserved ${a[key]}, upgraded ${b[key]}`);
      }
    }
    expect(shifts).to.deep.equal([]);
  });
});
