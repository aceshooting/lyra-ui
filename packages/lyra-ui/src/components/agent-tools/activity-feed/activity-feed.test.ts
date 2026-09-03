import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './activity-feed.js';
import type { LyraActivityFeed, ActivityEntry } from './activity-feed.js';

async function twoFrames(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

function makeEntries(count: number): ActivityEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    text: `Entry ${i}`,
  }));
}

type RelationshipName = 'aria-describedby' | 'aria-labelledby';

function relationshipElements(owner: HTMLElement, relationship: RelationshipName): readonly Element[] | null {
  const property = relationship === 'aria-describedby' ? 'ariaDescribedByElements' : 'ariaLabelledByElements';
  if (!Reflect.has(owner, property)) return null;
  const reflected = Reflect.get(owner, property) as Iterable<Element> | null;
  return reflected === null ? [] : [...reflected];
}

function relationshipIds(owner: HTMLElement, relationship: RelationshipName): string[] {
  const reflected = relationshipElements(owner, relationship);
  if (reflected !== null) return reflected.map((element) => element.id);
  return owner.getAttribute(relationship)?.match(/\S+/g) ?? [];
}

async function semanticListOwner(el: LyraActivityFeed): Promise<HTMLElement> {
  await el.updateComplete;
  const virtualList = el.shadowRoot!.querySelector('lr-virtual-list') as
    | (HTMLElement & {
        scrollContainer?: HTMLElement;
        updateComplete: Promise<unknown>;
      })
    | null;
  if (virtualList) {
    await virtualList.updateComplete;
    await twoFrames();
    const owner = virtualList.scrollContainer;
    if (!owner) throw new Error('The virtual list did not create its semantic list owner.');
    return owner;
  }
  const owner = el.shadowRoot!.querySelector<HTMLElement>('[part="body"][role="list"]');
  if (!owner) throw new Error('The plain activity feed did not create its semantic list owner.');
  return owner;
}

it('defaults to entries=[], mode="live", follow=true, expanded=false, and a localized Activity label', async () => {
  const el = (await fixture(html`<lr-activity-feed></lr-activity-feed>`)) as LyraActivityFeed;
  expect(el.entries).to.deep.equal([]);
  expect(el.mode).to.equal('live');
  expect(el.follow).to.be.true;
  expect(el.hasAttribute('follow')).to.be.true;
  expect(el.expanded).to.be.false;
  expect(el.label).to.be.undefined;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Activity');
  expect(el.showTimestamps).to.be.false;
  expect(el.virtualizeAt).to.equal(199);
});

it('renders one [part="entry"] row per entry, carrying data-variant', async () => {
  const el = (await fixture(
    html`<lr-activity-feed
      expanded
      .entries=${[
        { id: '1', text: 'Searching the web…', variant: 'brand' },
        { id: '2', text: 'Read src/index.ts' },
      ]}
    ></lr-activity-feed>`,
  )) as LyraActivityFeed;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="entry"]')] as HTMLElement[];
  expect(rows.length).to.equal(2);
  expect(rows[0]!.dataset['variant']).to.equal('brand');
  expect(rows[1]!.dataset['variant']).to.equal('neutral');
  expect(rows[0]!.querySelector('[part="entry-text"]')!.textContent!.trim()).to.equal('Searching the web…');
});

it('clips the cross axis instead of creating a phantom horizontal scrollbar for long content', async () => {
  const el = (await fixture(html`<lr-activity-feed
    expanded
    .entries=${[{ id: 'long', text: 'x'.repeat(2_000) }]}
  ></lr-activity-feed>`)) as LyraActivityFeed;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(getComputedStyle(body).overflowX).to.equal('hidden');
  expect(body.scrollWidth).to.equal(body.clientWidth);
});

it('keeps a long public label contained without collapsing the live summary at 320px', async () => {
  const wrapper = await fixture(html`
    <div style="inline-size:320px">
      <lr-activity-feed
        label=${`activity-${'unbroken'.repeat(40)}`}
        .entries=${[{ id: 'latest', text: 'Latest step remains visible' }]}
      ></lr-activity-feed>
    </div>
  `);
  const el = wrapper.querySelector('lr-activity-feed') as LyraActivityFeed;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const summary = el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement;
  const headerRect = header.getBoundingClientRect();
  const labelRect = label.getBoundingClientRect();
  const summaryRect = summary.getBoundingClientRect();
  expect(labelRect.right).to.be.at.most(Math.ceil(headerRect.right));
  expect(summaryRect.width).to.be.greaterThan(24);
  expect(summary.textContent!.trim()).to.equal('Latest step remains visible');
});

it('renders a literal icon hint when set, a variant dot otherwise', async () => {
  const el = (await fixture(
    html`<lr-activity-feed
      expanded
      .entries=${[
        { id: '1', text: 'With icon', icon: '🔍' },
        { id: '2', text: 'No icon' },
      ]}
    ></lr-activity-feed>`,
  )) as LyraActivityFeed;
  const rows = [...el.shadowRoot!.querySelectorAll('[part="entry"]')] as HTMLElement[];
  expect(rows[0]!.querySelector('[part="entry-icon"]')!.textContent!.trim()).to.equal('🔍');
  expect(rows[1]!.querySelectorAll('[part="entry-icon"] [part~="variant-dot"]').length).to.equal(1);
});

it('shows the latest entry as a one-line ticker in the header while mode="live"', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="live" .entries=${makeEntries(3)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Entry 2');
});

it('lets a live feed retheme only its own status dot', async () => {
  const wrapper = await fixture(html`
    <div style="--lr-theme-color-brand-fill-loud: rgb(4, 5, 6);">
      <lr-activity-feed mode="live" style="--lr-activity-feed-live-status-color: rgb(1, 2, 3);"></lr-activity-feed>
      <lr-activity-feed mode="live"></lr-activity-feed>
    </div>
  `);
  const [overridden, defaulted] = [...wrapper.querySelectorAll('lr-activity-feed')] as LyraActivityFeed[];
  const overriddenDot = overridden!.shadowRoot!.querySelector('[part="status-dot"]') as HTMLElement;
  const defaultedDot = defaulted!.shadowRoot!.querySelector('[part="status-dot"]') as HTMLElement;

  expect(getComputedStyle(overriddenDot).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(defaultedDot).backgroundColor).to.equal('rgb(4, 5, 6)');
});

it('shows a localized "Completed N steps" summary in the header while mode="post-hoc"', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="post-hoc" .entries=${makeEntries(14)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Completed 14 steps');
});

it('formats the completed count for the effective locale while retaining the raw count for plural selection', async () => {
  const count = 12;
  const el = (await fixture(
    html`<lr-activity-feed lang="ar-EG" mode="post-hoc" .entries=${makeEntries(count)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  const formattedCount = new Intl.NumberFormat('ar-EG').format(count);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal(
    `Completed ${formattedCount} steps`,
  );
});

it('uses the singular form for exactly one completed step', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="post-hoc" .entries=${makeEntries(1)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('Completed 1 step');
});

it('uses string overrides for the header label and completed-steps summary', async () => {
  const el = (await fixture(
    html`<lr-activity-feed mode="post-hoc" .entries=${makeEntries(3)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  el.strings = {
    activityFeedLabel: 'Activité',
    activityFeedCompletedSteps: '{count} étapes terminées',
  };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim()).to.equal('Activité');
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()).to.equal('3 étapes terminées');
});

it('distinguishes an omitted label from explicit English and empty overrides', async () => {
  const labels: string[] = [];
  for (const template of [
    html`<lr-activity-feed .strings=${{ activityFeedLabel: 'Activité' }}></lr-activity-feed>`,
    html`<lr-activity-feed label="Activity" .strings=${{ activityFeedLabel: 'Activité' }}></lr-activity-feed>`,
    html`<lr-activity-feed label="" .strings=${{ activityFeedLabel: 'Activité' }}></lr-activity-feed>`,
  ]) {
    const el = (await fixture(template)) as LyraActivityFeed;
    labels.push(el.shadowRoot!.querySelector('[part="label"]')!.textContent!.trim());
  }
  expect(labels).to.deep.equal(['Activité', 'Activity', '']);
});

describe('accessible list and header naming', () => {
  for (const [path, virtualizeAt] of [
    ['plain', 99],
    ['virtualized', 0],
  ] as const) {
    it(`keeps a blank visible label while localizing blank header and list names in the ${path} path`, async () => {
      const el = (await fixture(html`
        <lr-activity-feed
          expanded
          label=""
          virtualize-at=${virtualizeAt}
          .strings=${{ activityFeedLabel: 'Activité' }}
          .entries=${makeEntries(1)}
        ></lr-activity-feed>
      `)) as LyraActivityFeed;
      const header = el.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
      const label = el.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
      const owner = await semanticListOwner(el);

      expect(label.textContent).to.equal('');
      expect(owner.getAttribute('aria-label')).to.equal('Activité');
      // The live summary supplies the header name while present, without duplicating it in an
      // aria-label. Once it becomes blank too, the localized fallback names the button.
      expect(header.getAttribute('aria-label')).to.equal(null);
      el.entries = [];
      await el.updateComplete;
      expect(header.getAttribute('aria-label')).to.equal('Activité');

      el.label = 'Run activity';
      await el.updateComplete;
      expect(label.textContent).to.equal('Run activity');
      expect(header.getAttribute('aria-label')).to.equal(null);
      expect((await semanticListOwner(el)).getAttribute('aria-label')).to.equal('Activité');

      el.label = '  ';
      await el.updateComplete;
      expect(label.textContent).to.equal('  ');
      expect(header.getAttribute('aria-label')).to.equal('Activité');
    });

    it(`keeps an authored host aria-label, including empty and removed values, on the ${path} list owner`, async () => {
      const el = (await fixture(html`
        <lr-activity-feed
          expanded
          label=""
          aria-label="Author activity"
          virtualize-at=${virtualizeAt}
          .strings=${{ activityFeedLabel: 'Activité' }}
          .entries=${makeEntries(1)}
        ></lr-activity-feed>
      `)) as LyraActivityFeed;

      expect(el.getAttribute('aria-label')).to.equal('Author activity');
      expect((await semanticListOwner(el)).getAttribute('aria-label')).to.equal('Author activity');
      el.setAttribute('aria-label', '');
      await el.updateComplete;
      expect(el.getAttribute('aria-label')).to.equal('');
      expect((await semanticListOwner(el)).getAttribute('aria-label')).to.equal('');
      el.removeAttribute('aria-label');
      await el.updateComplete;
      expect(el.hasAttribute('aria-label')).to.equal(false);
      expect((await semanticListOwner(el)).getAttribute('aria-label')).to.equal('Activité');
    });
  }
});

describe('external list relationships', () => {
  for (const [path, virtualizeAt] of [
    ['plain', 99],
    ['virtualized', 0],
  ] as const) {
    it(`projects live labelledby and describedby sources onto the ${path} list owner`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`
        <div>
          <span id="feed-name">Original activity name</span>
          <span id="feed-second-name">Second name</span>
          <span id="feed-description">Original activity description</span>
          <lr-activity-feed
            expanded
            virtualize-at=${virtualizeAt}
            aria-labelledby="feed-name feed-second-name feed-name"
            aria-describedby="feed-description feed-second-name feed-description"
            .entries=${makeEntries(1)}
          ></lr-activity-feed>
        </div>
      `);
      const el = wrapper.querySelector<LyraActivityFeed>('lr-activity-feed')!;
      const owner = await semanticListOwner(el);
      const name = wrapper.querySelector<HTMLElement>('#feed-name')!;
      const secondName = wrapper.querySelector<HTMLElement>('#feed-second-name')!;
      const description = wrapper.querySelector<HTMLElement>('#feed-description')!;

      expect(el.getAttribute('aria-labelledby')).to.equal('feed-name feed-second-name feed-name');
      expect(el.getAttribute('aria-describedby')).to.equal('feed-description feed-second-name feed-description');
      if (
        relationshipElements(owner, 'aria-labelledby') === null ||
        relationshipElements(owner, 'aria-describedby') === null
      ) {
        // Engines without cross-shadow element-reference reflection cannot serialize these IDs into
        // the target shadow root; the host source remains intact and the bridge fails closed.
        expect(relationshipIds(owner, 'aria-labelledby')).to.deep.equal([]);
        expect(relationshipIds(owner, 'aria-describedby')).to.deep.equal([]);
        return;
      }

      expect(relationshipIds(owner, 'aria-labelledby')).to.deep.equal(['feed-name', 'feed-second-name']);
      expect(relationshipIds(owner, 'aria-describedby')).to.deep.equal(['feed-description', 'feed-second-name']);
      expect(relationshipElements(owner, 'aria-labelledby')?.[0] === name).to.equal(true);
      expect(relationshipElements(owner, 'aria-describedby')?.[0] === description).to.equal(true);
      expect(relationshipElements(owner, 'aria-labelledby')?.[1] === secondName).to.equal(true);

      name.textContent = 'Updated activity name';
      await Promise.resolve();
      expect(relationshipElements(owner, 'aria-labelledby')?.[0]?.textContent).to.equal('Updated activity name');

      const replacement = document.createElement('span');
      replacement.id = name.id;
      replacement.textContent = 'Replacement activity name';
      name.replaceWith(replacement);
      await waitUntil(
        () => relationshipElements(owner, 'aria-labelledby')?.[0] === replacement,
        'the same-id label replacement was not projected onto the list owner',
      );

      replacement.remove();
      await waitUntil(
        () => relationshipIds(owner, 'aria-labelledby').join(' ') === 'feed-second-name',
        'the removed label source was retained by the list owner',
      );
      wrapper.prepend(replacement);
      await waitUntil(
        () => relationshipElements(owner, 'aria-labelledby')?.[0] === replacement,
        'the reinserted label source was not projected onto the list owner',
      );

      const replacementDescription = document.createElement('span');
      replacementDescription.id = description.id;
      replacementDescription.textContent = 'Replacement activity description';
      description.replaceWith(replacementDescription);
      await waitUntil(
        () => relationshipElements(owner, 'aria-describedby')?.[0] === replacementDescription,
        'the same-id description replacement was not projected onto the list owner',
      );

      replacementDescription.remove();
      await waitUntil(
        () => relationshipIds(owner, 'aria-describedby').join(' ') === 'feed-second-name',
        'the removed description source was retained by the list owner',
      );
      wrapper.prepend(replacementDescription);
      await waitUntil(
        () => relationshipElements(owner, 'aria-describedby')?.[0] === replacementDescription,
        'the reinserted description source was not projected onto the list owner',
      );

      el.setAttribute('aria-labelledby', 'feed-late-name feed-second-name');
      await waitUntil(
        () => relationshipIds(owner, 'aria-labelledby').join(' ') === 'feed-second-name',
        'the unresolved label ID was serialized into the target shadow root',
      );
      const late = document.createElement('span');
      late.id = 'feed-late-name';
      late.textContent = 'Late activity name';
      wrapper.prepend(late);
      await waitUntil(
        () => relationshipElements(owner, 'aria-labelledby')?.[0] === late,
        'the late label source was not projected onto the list owner',
      );
    });

    it(`retargets host relationships across the ${path} and alternate rendering paths`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`
        <div>
          <span id="feed-path-name">Path name</span>
          <span id="feed-path-description">Path description</span>
          <lr-activity-feed
            expanded
            virtualize-at=${virtualizeAt}
            aria-labelledby="feed-path-name"
            aria-describedby="feed-path-description"
            .entries=${makeEntries(2)}
          ></lr-activity-feed>
        </div>
      `);
      const el = wrapper.querySelector<LyraActivityFeed>('lr-activity-feed')!;
      let owner = await semanticListOwner(el);
      const name = wrapper.querySelector<HTMLElement>('#feed-path-name')!;
      const description = wrapper.querySelector<HTMLElement>('#feed-path-description')!;

      if (
        relationshipElements(owner, 'aria-labelledby') === null ||
        relationshipElements(owner, 'aria-describedby') === null
      ) {
        expect(relationshipIds(owner, 'aria-labelledby')).to.deep.equal([]);
        expect(relationshipIds(owner, 'aria-describedby')).to.deep.equal([]);
        return;
      }

      expect(relationshipElements(owner, 'aria-labelledby')?.[0] === name).to.equal(true);
      expect(relationshipElements(owner, 'aria-describedby')?.[0] === description).to.equal(true);
      el.virtualizeAt = virtualizeAt === 0 ? 99 : 0;
      owner = await semanticListOwner(el);
      await waitUntil(
        () =>
          relationshipElements(owner, 'aria-labelledby')?.[0] === name &&
          relationshipElements(owner, 'aria-describedby')?.[0] === description,
        'the replacement list owner did not receive the external relationships',
      );
    });

    it(`is accessible while populated with external relationships in the ${path} path`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`
        <div>
          <span id="feed-axe-name">Recent activity</span>
          <span id="feed-axe-description">Agent run details</span>
          <lr-activity-feed
            expanded
            virtualize-at=${virtualizeAt}
            aria-labelledby="feed-axe-name"
            aria-describedby="feed-axe-description"
            .entries=${[
              {
                id: 'search',
                text: 'Searching the repository',
                icon: '🔍',
                variant: 'brand',
              },
              { id: 'read', text: 'Read package.json', variant: 'success' },
            ]}
          ></lr-activity-feed>
        </div>
      `);
      const el = wrapper.querySelector<LyraActivityFeed>('lr-activity-feed')!;
      const owner = await semanticListOwner(el);
      if (relationshipElements(owner, 'aria-labelledby') !== null) {
        expect(relationshipIds(owner, 'aria-labelledby')).to.deep.equal(['feed-axe-name']);
        expect(relationshipIds(owner, 'aria-describedby')).to.deep.equal(['feed-axe-description']);
      }
      await expect(el).to.be.accessible();
    });

    it(`restores projected relationships after reconnect and adoption in the ${path} path`, async () => {
      let wrapper: HTMLDivElement | undefined;
      let frame: HTMLIFrameElement | undefined;
      try {
        wrapper = await fixture<HTMLDivElement>(html`
          <div>
            <span id="feed-adopted-name">Original adopted name</span>
            <span id="feed-adopted-description">Original adopted description</span>
            <lr-activity-feed
              expanded
              virtualize-at=${virtualizeAt}
              aria-labelledby="feed-adopted-name"
              aria-describedby="feed-adopted-description"
              .entries=${makeEntries(1)}
            ></lr-activity-feed>
          </div>
        `);
        const el = wrapper.querySelector<LyraActivityFeed>('lr-activity-feed')!;
        let owner = await semanticListOwner(el);
        const name = wrapper.querySelector<HTMLElement>('#feed-adopted-name')!;
        const description = wrapper.querySelector<HTMLElement>('#feed-adopted-description')!;

        if (
          relationshipElements(owner, 'aria-labelledby') === null ||
          relationshipElements(owner, 'aria-describedby') === null
        ) {
          expect(relationshipIds(owner, 'aria-labelledby')).to.deep.equal([]);
          expect(relationshipIds(owner, 'aria-describedby')).to.deep.equal([]);
          return;
        }

        el.remove();
        wrapper.append(el);
        owner = await semanticListOwner(el);
        await waitUntil(
          () =>
            relationshipElements(owner, 'aria-labelledby')?.[0] === name &&
            relationshipElements(owner, 'aria-describedby')?.[0] === description,
          'the reconnected activity feed did not restore its external relationships',
        );

        frame = document.createElement('iframe');
        document.body.append(frame);
        const foreignDocument = frame.contentDocument;
        if (!foreignDocument) throw new Error('The iframe document was unavailable.');
        foreignDocument.adoptNode(wrapper);
        foreignDocument.body.append(wrapper);
        owner = await semanticListOwner(el);
        await waitUntil(
          () =>
            relationshipElements(owner, 'aria-labelledby')?.[0] === name &&
            relationshipElements(owner, 'aria-describedby')?.[0] === description,
          'the adopted activity feed did not restore its external relationships',
        );

        const replacement = foreignDocument.createElement('span');
        replacement.id = name.id;
        replacement.textContent = 'Replacement adopted name';
        name.replaceWith(replacement);
        await waitUntil(
          () => relationshipElements(owner, 'aria-labelledby')?.[0] === replacement,
          'the adopted document did not refresh a replacement label source',
        );
      } finally {
        if (wrapper && wrapper.ownerDocument !== document) document.adoptNode(wrapper);
        wrapper?.remove();
        frame?.remove();
      }
    });
  }
});

it('toggles expanded and fires lr-toggle on header click', async () => {
  const el = (await fixture(html`<lr-activity-feed></lr-activity-feed>`)) as LyraActivityFeed;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLButtonElement;
  let firing = oneEvent(el, 'lr-toggle');
  header.click();
  const event = await firing;
  await el.updateComplete;
  expect(el.expanded).to.be.true;
  expect((event as CustomEvent).detail).to.deep.equal({ expanded: true });
});

it('wires the LiveStreamingDemo story before its first Start run bubbling click', async () => {
  const { LiveStreamingDemo } = await import('./activity-feed.stories.js');
  const root = (await fixture(LiveStreamingDemo.render!({}, null as never))) as HTMLElement;
  const feed = root.querySelector<LyraActivityFeed>('lr-activity-feed')!;
  const start = root.querySelector<HTMLButtonElement>('[data-start]')!;

  start.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await feed.updateComplete;
  expect(feed.expanded).to.be.true;
  expect(feed.mode).to.equal('live');
});

it('ships activity-feed stories for blank semantics and rich virtual entry-text styling', async () => {
  type ActivityFeedStory = {
    render?: (args: Record<string, never>, context: unknown) => ReturnType<typeof html>;
  };
  const stories = (await import('./activity-feed.stories.js')) as unknown as Record<string, ActivityFeedStory>;

  const blankStory = stories['BlankVisibleLabel'];
  expect(blankStory?.render !== undefined).to.equal(true);
  if (!blankStory?.render) return;
  const blank = (await fixture(blankStory.render({}, null))) as LyraActivityFeed;
  const blankHeader = blank.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
  const blankLabel = blank.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
  expect(blank.label).to.equal('');
  expect(blankLabel.textContent).to.equal('');
  expect(blankHeader.getAttribute('aria-label')).to.equal('Activity feed');
  expect((await semanticListOwner(blank)).getAttribute('aria-label')).to.equal('Activity feed');

  const richStory = stories['RichEntryTextWithConsumerPartStyling'];
  expect(richStory?.render !== undefined).to.equal(true);
  if (!richStory?.render) return;
  const richRoot = (await fixture(richStory.render({}, null))) as HTMLElement;
  const rich = richRoot.querySelector<LyraActivityFeed>('lr-activity-feed')!;
  const virtualList = rich.shadowRoot!.querySelector('lr-virtual-list')!;
  const text = (await semanticListOwner(rich)).querySelector<HTMLElement>('[part="entry-text"]')!;

  expect(virtualList.getAttribute('exportparts')).to.contain('entry-text:entry-text');
  expect(text.querySelector('strong')?.textContent).to.equal('Searching the web for recent changes');
  expect(getComputedStyle(text).fontStyle).to.equal('italic');
});

it('renders a visible focus ring on [part="body"] when it is the tabbable scroll region', async () => {
  const el = (await fixture(
    html`<lr-activity-feed expanded .entries=${makeEntries(3)}></lr-activity-feed>`,
  )) as LyraActivityFeed;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  expect(body.getAttribute('tabindex')).to.equal('0');
  expect(getComputedStyle(body).outlineStyle).to.equal('none');
  body.focus();
  expect(el.shadowRoot!.activeElement === body).to.be.true;
  const focused = getComputedStyle(body);
  expect(focused.outlineStyle).to.equal('solid');
  expect(focused.outlineWidth).to.equal('2px'); // --lr-focus-ring-width
  expect(focused.outlineOffset).to.equal('-2px'); // inset: -1 * --lr-focus-ring-offset
});

describe('showTimestamps', () => {
  it('shows no timestamp by default, a formatted <time> when show-timestamps is set', async () => {
    const ts = new Date('2024-01-01T10:30:00Z');
    const withoutFlag = (await fixture(
      html`<lr-activity-feed expanded .entries=${[{ id: '1', text: 'x', timestamp: ts }]}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(withoutFlag.shadowRoot!.querySelector('[part="entry-timestamp"]') == null).to.be.true;

    const withFlag = (await fixture(
      html`<lr-activity-feed
        expanded
        show-timestamps
        .entries=${[{ id: '1', text: 'x', timestamp: ts }]}
      ></lr-activity-feed>`,
    )) as LyraActivityFeed;
    const time = withFlag.shadowRoot!.querySelector('[part="entry-timestamp"]') as HTMLTimeElement;
    expect(time != null).to.equal(true);
    expect(time.getAttribute('datetime')).to.equal(ts.toISOString());
  });

  it('overrides the default hour:minute rendering via formatTimestamp', async () => {
    const ts = new Date('2024-01-01T10:30:00Z');
    const el = (await fixture(
      html`<lr-activity-feed expanded show-timestamps></lr-activity-feed>`,
    )) as LyraActivityFeed;
    el.formatTimestamp = () => 'CUSTOM';
    el.entries = [{ id: '1', text: 'x', timestamp: ts }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="entry-timestamp"]')!.textContent!.trim()).to.equal('CUSTOM');
  });

  it('treats an invalid timestamp string as unset', async () => {
    const el = (await fixture(
      html`<lr-activity-feed
        expanded
        show-timestamps
        .entries=${[{ id: '1', text: 'x', timestamp: 'not-a-date' }]}
      ></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('[part="entry-timestamp"]') == null).to.be.true;
  });
});

describe('renderText', () => {
  it('renders plain entry.text in [part="entry-text"] when unset (default, non-virtualized)', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded .entries=${[{ id: '1', text: 'plain narration' }]}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('[part="entry-text"]')!.textContent!.trim()).to.equal('plain narration');
  });

  it('keeps the stable entry-text part around rich renderText content, non-virtualized', async () => {
    const el = (await fixture(html`<lr-activity-feed expanded></lr-activity-feed>`)) as LyraActivityFeed;
    el.renderText = (entry) =>
      html`<strong class="rich">${entry.text.toUpperCase()}</strong><em class="chip">tool: read</em>`;
    el.entries = [{ id: '1', text: 'narration' }];
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="entry"]') as HTMLElement;
    const text = row.querySelector<HTMLElement>('[part="entry-text"]');
    expect(text !== null).to.be.true;
    expect(text?.querySelector('strong.rich')?.textContent).to.equal('NARRATION');
    expect(text?.querySelector('em.chip')?.textContent).to.equal('tool: read');
    expect(row.querySelector('strong.rich')!.textContent).to.equal('NARRATION');
    expect(row.querySelector('em.chip')!.textContent).to.equal('tool: read');
  });

  it('keeps the stable entry-text part around rich renderText content, virtualized', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-at="0"></lr-activity-feed>`,
    )) as LyraActivityFeed;
    el.renderText = (entry) => html`<strong class="rich">${entry.text}</strong>`;
    el.entries = [
      { id: '1', text: 'virtualized narration' },
      { id: '2', text: 'second' },
    ];
    const owner = await semanticListOwner(el);
    const text = owner.querySelector<HTMLElement>('[part="entry-text"]');
    expect(text !== null).to.be.true;
    expect(text?.querySelector('strong.rich')?.textContent).to.equal('virtualized narration');
  });

  for (const [label, virtualizeAt] of [
    ['plain', 99],
    ['virtualized', 0],
  ] as const) {
    it(`keeps direct entry-text computed styles on rich content in the ${label} path`, async () => {
      const el = (await fixture(html`
        <lr-activity-feed expanded virtualize-at=${virtualizeAt}></lr-activity-feed>
      `)) as LyraActivityFeed;
      el.renderText = (entry) => html`<strong class="rich">${entry.text}</strong>`;
      el.entries = [{ id: '1', text: `${label} rich narration` }];
      const owner = await semanticListOwner(el);
      const text = owner.querySelector<HTMLElement>('[part="entry-text"]');
      expect(text?.querySelector('strong.rich')?.textContent).to.equal(`${label} rich narration`);
      expect(getComputedStyle(text!).flexGrow).to.equal('1');
      expect(getComputedStyle(text!).fontSize).to.equal('13px');
    });
  }
});

describe('follow contract (non-virtualized)', () => {
  async function forceSmallBody(el: LyraActivityFeed): Promise<HTMLElement> {
    el.style.setProperty('--lr-activity-feed-max-height', '48px');
    el.expanded = true;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  }

  it('starts with follow=true and auto-scrolls to the bottom as entries are appended, in live mode', async () => {
    const el = (await fixture(html`<lr-activity-feed mode="live"></lr-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it('schedules and cancels tail-follow frames through the exact owner window across adoption', async () => {
    let el = (await fixture(html`<lr-activity-feed></lr-activity-feed>`)) as LyraActivityFeed;
    await el.updateComplete;
    el.remove();
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalMainRequest = window.requestAnimationFrame;
    const originalMainCancel = window.cancelAnimationFrame;
    const originalFrameRequest = frameWindow.requestAnimationFrame;
    const originalFrameCancel = frameWindow.cancelAnimationFrame;
    const mainFrames = new Map<number, FrameRequestCallback>();
    const frameFrames = new Map<number, FrameRequestCallback>();
    const frameCancellations: number[] = [];
    let mainHandle = 6100;
    let frameHandle = 7100;

    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const handle = ++mainHandle;
      mainFrames.set(handle, callback);
      return handle;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => {
      mainFrames.delete(handle);
    }) as typeof window.cancelAnimationFrame;
    frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const handle = ++frameHandle;
      frameFrames.set(handle, callback);
      return handle;
    }) as typeof frameWindow.requestAnimationFrame;
    frameWindow.cancelAnimationFrame = ((handle: number) => {
      frameCancellations.push(handle);
      frameFrames.delete(handle);
    }) as typeof frameWindow.cancelAnimationFrame;

    try {
      frameDocument.adoptNode(el);
      expect(frameFrames.size, 'detached adoption must not arm a frame').to.equal(0);

      frameDocument.body.append(el);
      el.expanded = true;
      el.entries = makeEntries(3);
      await el.updateComplete;
      expect(mainFrames.size, 'the parent window must not own an iframe feed frame').to.equal(0);
      expect(frameFrames.size, 'the iframe window owns the pending tail-follow frame').to.equal(1);

      const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
      let scrollTop = 0;
      Object.defineProperty(body, 'scrollHeight', {
        configurable: true,
        value: 240,
      });
      Object.defineProperty(body, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value;
        },
      });
      const [oldHandle, staleFrame] = Array.from(frameFrames.entries())[0]!;

      document.adoptNode(el);
      expect(frameCancellations, 'adoption cancels through the retained iframe owner').to.include(oldHandle);
      expect(mainFrames.size, 'detached adoption must not re-arm in the destination').to.equal(0);
      staleFrame(0);
      expect(scrollTop, 'a stale source-realm frame cannot scroll the adopted feed').to.equal(0);

      document.body.append(el);
      expect(mainFrames.size, 'reconnect resumes tail following in the destination window').to.equal(1);
      const [currentHandle, currentFrame] = Array.from(mainFrames.entries())[0]!;
      mainFrames.delete(currentHandle);
      currentFrame(0);
      expect(scrollTop).to.equal(240);
    } finally {
      el.remove();
      window.requestAnimationFrame = originalMainRequest;
      window.cancelAnimationFrame = originalMainCancel;
      frameWindow.requestAnimationFrame = originalFrameRequest;
      frameWindow.cancelAnimationFrame = originalFrameCancel;
      iframe.remove();
    }
  });

  it('releases follow and fires lr-follow-change when the reader scrolls away from the bottom', async () => {
    const el = (await fixture(html`<lr-activity-feed mode="live"></lr-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();

    const firing = oneEvent(el, 'lr-follow-change');
    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ following: false });
    expect(el.follow).to.be.false;

    const scrollTopBefore = body.scrollTop;
    el.entries = [...el.entries, { id: 'new', text: 'A brand new entry' }];
    await twoFrames();
    expect(body.scrollTop, 'must not have been yanked back down while follow is released').to.equal(scrollTopBefore);
  });

  it('re-engages follow once the reader scrolls back near the bottom', async () => {
    const el = (await fixture(html`<lr-activity-feed mode="live"></lr-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();
    body.scrollTop = 0;
    body.dispatchEvent(new Event('scroll'));
    await el.updateComplete;
    expect(el.follow).to.be.false;

    const firing = oneEvent(el, 'lr-follow-change');
    body.scrollTop = body.scrollHeight;
    body.dispatchEvent(new Event('scroll'));
    const event = await firing;
    expect((event as CustomEvent).detail).to.deep.equal({ following: true });
    expect(el.follow).to.be.true;
  });

  it('does not fire lr-follow-change on mount, even when follow="false" is set in markup', async () => {
    const el = (await fixture(html`<lr-activity-feed follow="false"></lr-activity-feed>`)) as LyraActivityFeed;
    let fired = false;
    el.addEventListener('lr-follow-change', () => (fired = true));
    await el.updateComplete;
    expect(el.follow).to.be.false;
    expect(fired).to.be.false;
  });

  it('accepts follow="false" as a plain-HTML attribute string', async () => {
    const el = (await fixture(html`<lr-activity-feed follow="false"></lr-activity-feed>`)) as LyraActivityFeed;
    expect(el.follow).to.be.false;
  });

  it('does not echo direct follow property assignments', async () => {
    const el = await fixture<LyraActivityFeed>(html`<lr-activity-feed></lr-activity-feed>`);
    let events = 0;
    el.addEventListener('lr-follow-change', () => events++);
    el.follow = false;
    await el.updateComplete;
    el.follow = true;
    await el.updateComplete;
    expect(events).to.equal(0);
  });

  it('resets follow to true and jumps to the bottom when expanding an already-populated live feed', async () => {
    const el = (await fixture(
      html`<lr-activity-feed mode="live" .entries=${makeEntries(20)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    el.follow = false;
    await el.updateComplete;
    const body = await forceSmallBody(el);
    await twoFrames();
    expect(el.follow).to.be.true;
    expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
  });

  it('never auto-scrolls in post-hoc mode', async () => {
    const el = (await fixture(html`<lr-activity-feed mode="post-hoc"></lr-activity-feed>`)) as LyraActivityFeed;
    const body = await forceSmallBody(el);
    el.entries = makeEntries(20);
    await twoFrames();
    expect(body.scrollTop).to.equal(0);
  });
});

describe('follow contract (virtualized)', () => {
  it('switches to an internal lr-virtual-list above virtualizeAt', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-at="4" .entries=${makeEntries(5)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="body"][role="list"]') == null).to.be.true;
  });

  it('normalizes a NaN virtualizeAt to the default (199) instead of silently disabling virtualization', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-at="not-a-number" .entries=${makeEntries(5)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(Number.isNaN(el.virtualizeAt)).to.be.true;
    expect(el.shadowRoot!.querySelector('lr-virtual-list') == null).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="entry"]').length).to.equal(5);

    const nativeResizeObserver = window.ResizeObserver;
    class InertResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = InertResizeObserver as unknown as typeof ResizeObserver;
    try {
      el.entries = makeEntries(200);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('lr-virtual-list')).to.exist;
    } finally {
      window.ResizeObserver = nativeResizeObserver;
    }
  });

  it('uses the localized fallback as the internal virtual-list name when no host aria-label is authored', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded label="Steps" virtualize-at="4" .entries=${makeEntries(5)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lr-virtual-list')!.getAttribute('aria-label')).to.equal('Activity');
  });

  it('uses the host aria-label for the internal list in both render paths', async () => {
    const plain = await fixture<LyraActivityFeed>(html`
      <lr-activity-feed aria-label="Recent activity" expanded .entries=${makeEntries(1)}></lr-activity-feed>
    `);
    expect(plain.shadowRoot!.querySelector('[part="body"]')!.getAttribute('aria-label')).to.equal('Recent activity');

    const virtualized = await fixture<LyraActivityFeed>(html`
      <lr-activity-feed
        aria-label="Recent activity"
        expanded
        virtualize-at="0"
        .entries=${makeEntries(1)}
      ></lr-activity-feed>
    `);
    expect(virtualized.shadowRoot!.querySelector('lr-virtual-list')!.getAttribute('aria-label')).to.equal(
      'Recent activity',
    );
  });

  it('does not leak the internal lr-virtual-list lr-visible-range-change event past the host under its own name', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-at="0" .entries=${makeEntries(5)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement;
    let count = 0;
    el.addEventListener('lr-visible-range-change', () => count++);

    list.dispatchEvent(
      new CustomEvent('lr-visible-range-change', {
        detail: { start: 0, end: 1 },
        bubbles: true,
        composed: true,
      }),
    );
    await el.updateComplete;

    expect(count).to.equal(0);
  });

  it('does not leak the internal lr-virtual-scroll compatibility event', async () => {
    const el = await fixture<LyraActivityFeed>(html`
      <lr-activity-feed expanded virtualize-at="0" .entries=${makeEntries(5)}></lr-activity-feed>
    `);
    let count = 0;
    el.addEventListener('lr-virtual-scroll', () => count++);
    el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(
      new CustomEvent('lr-virtual-scroll', {
        bubbles: true,
        composed: true,
        detail: { start: 0, end: 1 },
      }),
    );
    expect(count).to.equal(0);
  });

  it('updates follow from the range-change event without leaking it or firing lr-follow-change twice', async () => {
    const el = (await fixture(
      html`<lr-activity-feed mode="live" expanded virtualize-at="0" .entries=${makeEntries(5)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    // Let the initial tail-anchoring settle first -- while `anchoringVirtualTail` is still true
    // (from the mount-time auto-scroll-to-bottom), the handler returns before touching `follow`
    // at all, which would make this test pass for the wrong reason.
    await twoFrames();
    expect(el.follow).to.be.true;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement;
    let leaked = 0;
    let followChangeCount = 0;
    el.addEventListener('lr-visible-range-change', () => leaked++);
    el.addEventListener('lr-follow-change', () => followChangeCount++);
    const detail = { start: 0, end: 1 };
    list.dispatchEvent(
      new CustomEvent('lr-visible-range-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
    await el.updateComplete;

    expect(leaked).to.equal(0);
    expect(followChangeCount).to.equal(1);
    expect(el.follow).to.be.false;
  });

  it('stays below virtualizeAt using a plain keyed list', async () => {
    const el = (await fixture(
      html`<lr-activity-feed expanded virtualize-at="4" .entries=${makeEntries(4)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(el.shadowRoot!.querySelector('lr-virtual-list') == null).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="entry"]').length).to.equal(4);
  });

  it('keeps following the tail when virtualizeAt switches either rendering path', async () => {
    const VirtualList = customElements.get('lr-virtual-list') as
      | (CustomElementConstructor & {
          prototype: {
            scrollToIndex(index: number, options?: { align?: 'start' | 'end' }): void;
          };
        })
      | undefined;
    expect(VirtualList).to.exist;
    const originalScrollToIndex = VirtualList!.prototype.scrollToIndex;
    const calls: Array<[number, { align?: 'start' | 'end'; behavior?: 'auto' | 'smooth' } | undefined]> = [];
    VirtualList!.prototype.scrollToIndex = function (index, options): void {
      calls.push([index, options]);
      originalScrollToIndex.call(this, index, options);
    };
    try {
      const el = (await fixture(html`
        <lr-activity-feed
          expanded
          mode="live"
          style="--lr-activity-feed-max-height:48px"
          virtualize-at="99"
          .entries=${makeEntries(20)}
        ></lr-activity-feed>
      `)) as LyraActivityFeed;
      await twoFrames();

      el.virtualizeAt = 1;
      await el.updateComplete;
      await twoFrames();
      expect(calls.at(-1)).to.deep.equal([19, { align: 'end', behavior: 'auto' }]);
      expect(el.follow, 'programmatic path switch must not release follow').to.be.true;

      el.virtualizeAt = 99;
      await el.updateComplete;
      await twoFrames();
      const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
      expect(body.scrollHeight - body.scrollTop - body.clientHeight).to.be.lessThan(2);
      expect(el.follow).to.be.true;
    } finally {
      VirtualList!.prototype.scrollToIndex = originalScrollToIndex;
    }
  });

  it('calls scrollToIndex on the virtual-list to follow the latest entry in live mode', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    });
    try {
      const el = (await fixture(
        html`<lr-activity-feed
          expanded
          mode="live"
          style="--lr-activity-feed-max-height:120px"
          virtualize-at="4"
          .entries=${makeEntries(5)}
        ></lr-activity-feed>`,
      )) as LyraActivityFeed;
      await twoFrames();
      const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {
        scrollToIndex: (index: number, options?: { align?: 'start' | 'end' }) => void;
      };
      let called: [number, { align?: 'start' | 'end'; behavior?: 'auto' | 'smooth' } | undefined] | undefined;
      list.scrollToIndex = (index, options) => (called = [index, options]);
      el.entries = [...el.entries, { id: 'new', text: 'Newest entry' }];
      await el.updateComplete;
      await twoFrames();
      expect(called).to.deep.equal([5, { align: 'end', behavior: 'auto' }]);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe('mode transition announcement', () => {
  async function getLiveRegionText(el: LyraActivityFeed): Promise<string> {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return el.shadowRoot!.querySelector('lr-live-region')!.shadowRoot!.querySelector('[part="region"]')!.textContent!;
  }

  it('announces the completed-steps summary once mode flips from live to post-hoc', async () => {
    const el = (await fixture(
      html`<lr-activity-feed mode="live" .entries=${makeEntries(14)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    el.mode = 'post-hoc';
    await el.updateComplete;
    expect(await getLiveRegionText(el)).to.equal('Completed 14 steps');
  });

  it('does not announce anything on mount, even when mode="post-hoc" is set in markup', async () => {
    const el = (await fixture(
      html`<lr-activity-feed mode="post-hoc" .entries=${makeEntries(14)}></lr-activity-feed>`,
    )) as LyraActivityFeed;
    expect(await getLiveRegionText(el)).to.equal('');
  });
});

describe('entry part styling reaches both rendering paths', () => {
  const variantEntries: ActivityEntry[] = [
    { id: 'a', text: 'Neutral step' },
    { id: 'b', text: 'Finished step', variant: 'success' },
    {
      id: 'c',
      text: 'Timestamped step',
      variant: 'danger',
      timestamp: new Date('2024-01-01T10:30:00Z'),
    },
  ];

  /** The shadow tree the entry rows actually live in: this component's own below
   *  `virtualize-at`, the internal `<lr-virtual-list>`'s above it. */
  function entryRoot(el: LyraActivityFeed): ShadowRoot {
    const list = el.shadowRoot!.querySelector('lr-virtual-list');
    return list ? list.shadowRoot! : el.shadowRoot!;
  }

  async function feed(threshold: number, extraHostStyle = ''): Promise<LyraActivityFeed> {
    const el = (await fixture(html`<lr-activity-feed
      expanded
      show-timestamps
      virtualize-at=${threshold}
      style=${`--lr-theme-color-success-fill-loud: rgb(1, 2, 3); --lr-theme-color-text-quiet: rgb(4, 5, 6); ${extraHostStyle}`}
      .entries=${variantEntries}
    ></lr-activity-feed>`)) as LyraActivityFeed;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list');
    if (list) await (list as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await twoFrames();
    return el;
  }

  // 1 => every fixture above virtualizes; 99 => every fixture stays on the plain repeat() path.
  for (const [label, threshold] of [
    ['virtualized', 1],
    ['plain', 99],
  ] as const) {
    it(`lays out [part="entry"] and its icon in the ${label} path`, async () => {
      const el = await feed(threshold);
      expect(el.shadowRoot!.querySelector('lr-virtual-list') !== null).to.equal(label === 'virtualized');
      const entries = [...entryRoot(el).querySelectorAll('[part="entry"]')] as HTMLElement[];
      expect(entries.length).to.be.greaterThan(0);
      expect(getComputedStyle(entries[0]!).display).to.equal('flex');
      expect(getComputedStyle(entries[0]!).flexWrap).to.equal('wrap');
      const icon = entries[0]!.querySelector('[part="entry-icon"]') as HTMLElement;
      // `inline-flex` blockifies to `flex` as a flex item, so assert the icon's own alignment
      // (the entry itself is `baseline`, the default `normal`) rather than its display value.
      expect(getComputedStyle(icon).alignItems).to.equal('center');
      expect(getComputedStyle(icon).flexGrow).to.equal('0');
    });

    it(`tints the variant dot from its entry's variant in the ${label} path`, async () => {
      const el = await feed(threshold);
      const dots = [...entryRoot(el).querySelectorAll('[part~="variant-dot"]')] as HTMLElement[];
      expect(dots.length).to.equal(variantEntries.length);
      // The variant travels in the part list, not a [data-variant] qualifier -- `::part()` cannot be
      // followed by an attribute selector, so a variant-qualified rule would never match.
      expect(dots[0]!.getAttribute('part')).to.equal('variant-dot variant-dot-neutral');
      expect(dots[1]!.getAttribute('part')).to.equal('variant-dot variant-dot-success');
      expect(getComputedStyle(dots[0]!).backgroundColor).to.equal('rgb(4, 5, 6)');
      expect(getComputedStyle(dots[1]!).backgroundColor).to.equal('rgb(1, 2, 3)');
      // The dot is a real circle, not an unstyled inline span.
      expect(getComputedStyle(dots[0]!).display).to.equal('block');
      expect(getComputedStyle(dots[0]!).inlineSize).to.equal('8px');
    });

    it(`styles [part="entry-text"] and [part="entry-timestamp"] in the ${label} path`, async () => {
      const el = await feed(threshold);
      const root = entryRoot(el);
      const text = root.querySelector('[part="entry-text"]') as HTMLElement;
      expect(getComputedStyle(text).flexGrow).to.equal('1');
      const stamp = root.querySelector('[part="entry-timestamp"]') as HTMLElement;
      expect(getComputedStyle(stamp).fontSize).to.equal('12px');
      expect(getComputedStyle(stamp).color).to.equal('rgb(4, 5, 6)');
    });

    it(`is accessible in the ${label} path`, async () => {
      const el = await feed(threshold);
      expect(entryRoot(el).querySelectorAll('[part="entry"]').length).to.be.greaterThan(0);
      await expect(el).to.be.accessible();
    });
  }

  it('exports the virtualized entry parts so a consumer stylesheet can reach them', async () => {
    const wrapper = await fixture(html`
      <div>
        <style>
          lr-activity-feed::part(entry-text) {
            color: rgb(12, 34, 56);
          }
          lr-activity-feed::part(variant-dot) {
            outline-color: rgb(21, 43, 65);
          }
          lr-activity-feed::part(variant-dot-success) {
            background: rgb(33, 55, 77);
          }
        </style>
        <lr-activity-feed expanded virtualize-at="0" .entries=${variantEntries}></lr-activity-feed>
      </div>
    `);
    const el = wrapper.querySelector('lr-activity-feed') as LyraActivityFeed;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    await (list as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await twoFrames();
    expect(list.getAttribute('exportparts')).to.contain('entry:entry');
    expect(list.getAttribute('exportparts')).to.contain('variant-dot:variant-dot');
    expect(list.getAttribute('exportparts')).to.contain('variant-dot-success:variant-dot-success');
    const text = list.shadowRoot!.querySelector('[part="entry-text"]') as HTMLElement;
    const dot = list.shadowRoot!.querySelector('[part~="variant-dot"]') as HTMLElement;
    const successDot = list.shadowRoot!.querySelector('[part~="variant-dot-success"]') as HTMLElement;
    expect(getComputedStyle(text).color).to.equal('rgb(12, 34, 56)');
    expect(getComputedStyle(dot).outlineColor).to.equal('rgb(21, 43, 65)');
    // A consumer can retint exactly one variant -- the whole reason the variant is a part name.
    expect(getComputedStyle(successDot).backgroundColor).to.equal('rgb(33, 55, 77)');
  });

  for (const [path, virtualizeAt, rich] of [
    ['plain text / plain path', 99, false],
    ['rich text / plain path', 99, true],
    ['plain text / virtualized path', 0, false],
    ['rich text / virtualized path', 0, true],
  ] as const) {
    it(`lets consumer ::part(entry-text) styling reach ${path}`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`
        <div>
          <style>
            lr-activity-feed::part(entry-text) {
              color: rgb(12, 34, 56);
            }
          </style>
          <lr-activity-feed expanded virtualize-at=${virtualizeAt}></lr-activity-feed>
        </div>
      `);
      const el = wrapper.querySelector<LyraActivityFeed>('lr-activity-feed')!;
      if (rich) el.renderText = (entry) => html`<strong class="rich">${entry.text}</strong>`;
      el.entries = [{ id: 'entry', text: `${path} narration` }];
      const owner = await semanticListOwner(el);
      const text = owner.querySelector<HTMLElement>('[part="entry-text"]')!;

      expect(text.textContent).to.equal(`${path} narration`);
      expect(text.querySelector('strong.rich') !== null).to.equal(rich);
      expect(getComputedStyle(text).color).to.equal('rgb(12, 34, 56)');
    });
  }
});

it('is accessible collapsed, with no entries', async () => {
  const el = (await fixture(html`<lr-activity-feed></lr-activity-feed>`)) as LyraActivityFeed;
  await expect(el).to.be.accessible();
});

it('is accessible expanded, with entries, icons, variants, and timestamps', async () => {
  const el = (await fixture(
    html`<lr-activity-feed
      expanded
      show-timestamps
      .entries=${[
        {
          id: '1',
          text: 'Searching the web…',
          icon: '🔍',
          variant: 'brand',
          timestamp: new Date(),
        },
        { id: '2', text: 'Read src/index.ts', variant: 'success' },
      ]}
    ></lr-activity-feed>`,
  )) as LyraActivityFeed;
  await expect(el).to.be.accessible();
});

it('normalizes duplicate entry ids first-wins before rendering', async () => {
  const el = await fixture<LyraActivityFeed>(html`
    <lr-activity-feed
      expanded
      .entries=${[
        { id: 'same', text: 'First entry' },
        { id: 'same', text: 'Later duplicate' },
      ]}
    ></lr-activity-feed>
  `);
  const rows = el.shadowRoot!.querySelectorAll('[part~="entry"]');
  expect(rows).to.have.length(1);
  expect(rows[0]!.textContent).to.contain('First entry');
  expect(rows[0]!.textContent).not.to.contain('Later duplicate');
});
