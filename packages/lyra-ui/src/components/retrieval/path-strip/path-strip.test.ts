import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './path-strip.js';
import type { LyraPathStrip, LyraPathElement } from './path-strip.js';
import { styles } from './path-strip.styles.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

const motionMatchMedia = (matches: boolean): typeof window.matchMedia =>
  ((query: string) =>
    ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as MediaQueryList)) as typeof window.matchMedia;

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

const path: LyraPathElement[] = [
  { kind: 'node', node: { id: 'e1', label: 'Marie Curie' } },
  { kind: 'edge', relation: 'discovered', directed: true },
  { kind: 'node', node: { id: 'e2', label: 'Polonium' } },
];

it('defaults to an empty path and an unset label', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  expect(el.path).to.deep.equal([]);
  expect(el.label).to.be.undefined;
});

it('keeps an explicitly empty label genuinely empty instead of falling back to the localized default', async () => {
  const el = (await fixture(
    html`<lr-path-strip label="" .path=${path}></lr-path-strip>`
  )) as LyraPathStrip;
  await el.updateComplete;
  expect(el.label).to.equal('');
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('');
});

it('renders one control per path element, in order', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const nodes = el.shadowRoot!.querySelectorAll('[part="node"]');
  const relations = el.shadowRoot!.querySelectorAll('[part="relation"]');
  expect(nodes.length).to.equal(2);
  expect(relations.length).to.equal(1);
  expect(nodes[0]!.textContent).to.include('Marie Curie');
  expect(relations[0]!.textContent).to.include('discovered');
  expect(nodes[1]!.textContent).to.include('Polonium');
});

it('keeps the host as the overall owner while retaining the nested scroll region', async () => {
  const el = (await fixture(
    html`<lr-path-strip
      label="Path fallback"
      aria-label="Author reasoning path"
      .path=${path}
    ></lr-path-strip>`
  )) as LyraPathStrip;
  const scroller = el.shadowRoot!.querySelector(
    'lr-scroller'
  ) as HTMLElement & {
    updateComplete: Promise<boolean>;
  };
  await scroller.updateComplete;
  const viewport = scroller.shadowRoot!.querySelector('[part="viewport"]')!;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal(null);
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')
  ).to.equal(null);
  expect(el.getAttribute('aria-label')).to.equal('Author reasoning path');
  expect(viewport.getAttribute('role')).to.equal('region');
  expect(viewport.getAttribute('aria-label')).to.equal('Scrollable content');
});

it('keeps one stable owner across explicit-empty and dynamic host naming', async () => {
  const el = (await fixture(
    html`<lr-path-strip
      label="Reasoning path"
      aria-label=""
      .path=${path}
    ></lr-path-strip>`
  )) as LyraPathStrip;
  const shell = () =>
    el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect([
    shell().getAttribute('role'),
    shell().getAttribute('aria-label'),
  ]).to.deep.equal(['group', '']);
  expect(el.getAttribute('aria-label')).to.equal('');

  el.path = [];
  await el.updateComplete;
  expect([
    shell().getAttribute('role'),
    shell().getAttribute('aria-label'),
  ]).to.deep.equal(['group', '']);

  el.setAttribute('aria-label', 'Author path');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Author path');
  expect(shell().getAttribute('aria-label')).to.equal(null);
  expect(shell().getAttribute('role')).to.equal(null);

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal(null);
  expect(shell().getAttribute('aria-label')).to.equal('Reasoning path');
  expect(shell().getAttribute('role')).to.equal('group');
});

it('emits lr-entity-activate when a node element is activated', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-entity-activate');
  (
    el.shadowRoot!.querySelectorAll('[part="node"]')[0] as HTMLButtonElement
  ).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({ entityId: 'e1', occurrenceIndex: 0 });
});

it('emits lr-relation-activate with source/target resolved from adjacent node elements', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-relation-activate');
  (
    el.shadowRoot!.querySelectorAll('[part="relation"]')[0] as HTMLButtonElement
  ).click();
  const event = await listener;
  expect(event.detail).to.deep.equal({
    relation: 'discovered',
    sourceNodeId: 'e1',
    targetNodeId: 'e2',
    occurrenceIndex: 1,
  });
});

it('has one roving tab stop across every element, moving forward with ArrowRight in LTR', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const controls = () =>
    [
      ...el.shadowRoot!.querySelectorAll('[part="node"], [part="relation"]'),
    ] as HTMLElement[];
  expect(controls().map((c) => c.tabIndex)).to.deep.equal([0, -1, -1]);

  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(controls().map((c) => c.tabIndex)).to.deep.equal([-1, 0, -1]);
});

it('uses the adopted owner window reduced-motion preference when revealing a roving item', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const ownerDocument = frame.contentDocument!;
  const ownerWindow = frame.contentWindow!;
  const originalTopMatchMedia = window.matchMedia;
  const originalOwnerMatchMedia = ownerWindow.matchMedia;
  const el = document.createElement('lr-path-strip') as LyraPathStrip;
  try {
    window.matchMedia = motionMatchMedia(false);
    ownerWindow.matchMedia = motionMatchMedia(true);
    el.path = path;
    document.body.append(el);
    await el.updateComplete;
    ownerDocument.body.append(ownerDocument.adoptNode(el));
    await el.updateComplete;

    const controls = [
      ...el.shadowRoot!.querySelectorAll('[part="node"], [part="relation"]'),
    ] as HTMLElement[];
    let behavior: ScrollBehavior | undefined;
    controls[1]!.scrollIntoView = ((options?: ScrollIntoViewOptions) => {
      behavior = options?.behavior;
    }) as HTMLElement['scrollIntoView'];
    el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(
      new ownerWindow.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    expect(behavior).to.equal('auto');
  } finally {
    el.remove();
    window.matchMedia = originalTopMatchMedia;
    ownerWindow.matchMedia = originalOwnerMatchMedia;
    frame.remove();
  }
});

it('draws directed-edge arrows as aria-hidden, logical (inline-end unless reverse)', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const arrow = el.shadowRoot!.querySelector('[part="arrow"]')!;
  expect(arrow.getAttribute('aria-hidden')).to.equal('true');
  expect(arrow.textContent).to.equal('→');
});

it('mirrors the directed-edge arrow glyph and swaps ArrowLeft/ArrowRight semantics under dir="rtl"', async () => {
  const el = (await fixture(
    html`<lr-path-strip dir="rtl" .path=${path}></lr-path-strip>`
  )) as LyraPathStrip;
  await el.updateComplete;

  const arrow = el.shadowRoot!.querySelector('[part="arrow"]')!;
  expect(arrow.textContent).to.equal('←');

  const controls = () =>
    [
      ...el.shadowRoot!.querySelectorAll('[part="node"], [part="relation"]'),
    ] as HTMLElement[];
  expect(controls().map((c) => c.tabIndex)).to.deep.equal([0, -1, -1]);

  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(controls().map((c) => c.tabIndex)).to.deep.equal([-1, 0, -1]);

  base.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(controls().map((c) => c.tabIndex)).to.deep.equal([0, -1, -1]);
});

it('shows an empty message when path is empty', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  await el.updateComplete;
  expect(Boolean(el.shadowRoot!.querySelector('[part="empty"]'))).to.be.true;
  await expect(el).to.be.accessible();
});

it('announces node focus through a .strings override for pathNodeStatus, interpolating its placeholders', async () => {
  const el = (await fixture(
    html`<lr-path-strip
      .strings=${{ pathNodeStatus: '{label}, nœud {position} sur {total}' }}
    ></lr-path-strip>`
  )) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;

  (
    el.shadowRoot!.querySelectorAll('[part="node"]')[0] as HTMLButtonElement
  ).focus();
  await el.updateComplete;

  const mirror = el.shadowRoot!.querySelector('.sr-only')!;
  expect(mirror.textContent).to.equal('Marie Curie, nœud 1 sur 3');
  expect(mirror.getAttribute('role')).to.equal(null);
  expect(mirror.getAttribute('aria-live')).to.equal(null);
  expect(mirror.getAttribute('aria-hidden')).to.equal('true');
  expect(sinkTexts().at(-1)).to.equal('Marie Curie, nœud 1 sur 3');
});

it('gives both node and relation pills the shared minimum hit area', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  const node = el.shadowRoot!.querySelector('[part="node"]') as HTMLElement;
  const relation = el.shadowRoot!.querySelector(
    '[part="relation"]'
  ) as HTMLElement;

  expect(getComputedStyle(node).minInlineSize).to.equal('40px');
  expect(getComputedStyle(node).minBlockSize).to.equal('40px');
  expect(getComputedStyle(relation).minInlineSize).to.equal('40px');
  expect(getComputedStyle(relation).minBlockSize).to.equal('40px');
});

it('is accessible with a full path', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  el.path = path;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('gives node and relation a hover state', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='node'\]:hover/);
  expect(css).to.match(/\[part='relation'\]:hover/);
});

it('formats announced positions with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-path-strip lang="ar-u-nu-arab" .path=${path}></lr-path-strip>`
  )) as LyraPathStrip;
  (el.shadowRoot!.querySelector('[part="node"]') as HTMLButtonElement).focus();
  await el.updateComplete;
  expect(sinkTexts().at(-1)).to.contain('١');
  expect(sinkTexts().at(-1)).to.contain('٣');
});

it('releases and reacquires its shared announcement sink across disconnect and reconnect', async () => {
  const el = (await fixture(
    html`<lr-path-strip></lr-path-strip>`
  )) as LyraPathStrip;
  expect(sinkElement() !== null).to.be.true;
  el.remove();
  expect(sinkElement() === null).to.be.true;
  document.body.append(el);
  expect(sinkElement() !== null).to.be.true;
  el.remove();
  expect(sinkElement() === null).to.be.true;
});

it('moves focus to a surviving path control when the focused item is removed', async () => {
  const el = (await fixture(
    html`<lr-path-strip .path=${path}></lr-path-strip>`
  )) as LyraPathStrip;
  (
    el.shadowRoot!.querySelectorAll('[part="node"]')[1] as HTMLButtonElement
  ).focus();
  el.path = path.slice(0, 1);
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('node');
});

it('moves focus to the empty base when the focused path is cleared', async () => {
  const el = (await fixture(
    html`<lr-path-strip .path=${path}></lr-path-strip>`
  )) as LyraPathStrip;
  (
    el.shadowRoot!.querySelector('[part="relation"]') as HTMLButtonElement
  ).focus();

  el.path = [];
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
  expect(el.shadowRoot!.activeElement?.getAttribute('tabindex')).to.equal('-1');
});

it('activates the focused relation from the keyboard', async () => {
  const el = await fixture<LyraPathStrip>(html`<lr-path-strip .path=${path}></lr-path-strip>`);
  const relation = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="relation"]')!;
  relation.focus();
  const activated = oneEvent(el, 'lr-relation-activate');

  relation.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    composed: true,
    cancelable: true,
  }));

  expect((await activated).detail).to.deep.equal({
    relation: 'discovered',
    sourceNodeId: 'e1',
    targetNodeId: 'e2',
    occurrenceIndex: 1,
  });
});

it('moves the roving stop to either endpoint with End and Home', async () => {
  const el = await fixture<LyraPathStrip>(html`<lr-path-strip .path=${path}></lr-path-strip>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const controls = () => [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="node"], [part="relation"]'),
  ];
  controls().forEach((control) => {
    control.scrollIntoView = () => {};
  });

  base.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'End',
    bubbles: true,
    composed: true,
    cancelable: true,
  }));
  await el.updateComplete;
  await Promise.resolve();
  expect(controls().map((control) => control.tabIndex)).to.deep.equal([-1, -1, 0]);
  expect(el.shadowRoot!.activeElement === controls()[2]).to.equal(true);

  base.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Home',
    bubbles: true,
    composed: true,
    cancelable: true,
  }));
  await el.updateComplete;
  await Promise.resolve();
  expect(controls().map((control) => control.tabIndex)).to.deep.equal([0, -1, -1]);
  expect(el.shadowRoot!.activeElement === controls()[0]).to.equal(true);
});

it('mirrors a reverse directed edge in both logical directions', async () => {
  const reversePath: LyraPathElement[] = [
    { kind: 'node', node: { id: 'source' } },
    { kind: 'edge', relation: 'reverse', directed: true, reverse: true },
    { kind: 'node', node: { id: 'target' } },
  ];
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-path-strip .path=${reversePath}></lr-path-strip>
    <lr-path-strip dir="rtl" .path=${reversePath}></lr-path-strip>
  </div>`);
  const [ltr, rtl] = [...wrapper.querySelectorAll('lr-path-strip')] as LyraPathStrip[];

  expect(ltr!.shadowRoot!.querySelector('[part="arrow"]')!.textContent).to.equal('←');
  expect(rtl!.shadowRoot!.querySelector('[part="arrow"]')!.textContent).to.equal('→');
});
