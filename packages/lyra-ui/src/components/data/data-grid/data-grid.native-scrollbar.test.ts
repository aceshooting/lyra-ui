import { expect, waitUntil } from '@open-wc/testing';

import { resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridColumn } from './data-grid-types.js';

const nativeScrollbarVerification = (
  globalThis as typeof globalThis & {
    __LYRA_WTR_NATIVE_SCROLLBAR__?: boolean;
  }
).__LYRA_WTR_NATIVE_SCROLLBAR__ === true;

if (!nativeScrollbarVerification) {
  throw new Error(
    'data-grid.native-scrollbar.test.ts requires WTR_NATIVE_SCROLLBAR=1.',
  );
}

interface ScrollbarRow {
  readonly id: number;
  readonly name: string;
  readonly team: string;
  readonly score: number;
}

const rows: readonly ScrollbarRow[] = [
  { id: 1, name: 'Ada', team: 'Compiler', score: 7 },
  { id: 2, name: 'Lin', team: 'Runtime', score: 10 },
  { id: 3, name: 'Grace', team: 'Compiler', score: 9 },
];

const columns: readonly DataGridColumn<ScrollbarRow>[] = [
  {
    field: 'name',
    label: 'Name',
    width: 80,
    footer: 'Names',
    pinned: 'left',
  },
  { field: 'team', label: 'Team', width: 600, footer: 'Teams' },
  {
    field: 'score',
    label: 'Score',
    width: 80,
    footer: 'Scores',
    pinned: 'right',
  },
];

it('keeps pinned header, body, and footer columns aligned after a physical horizontal scrollbar drag', async () => {
  for (const direction of ['ltr', 'rtl'] as const) {
    const element = document.createElement(
      'lr-data-grid',
    ) as unknown as LyraDataGrid<ScrollbarRow>;
    const scrollbarFixtureStyle = document.createElement('style');
    scrollbarFixtureStyle.textContent = `
      [part="body"] {
        block-size: 100px;
        overflow: scroll !important;
        scrollbar-gutter: stable !important;
      }

      [part="body"]::-webkit-scrollbar {
        -webkit-appearance: none;
        display: block;
        height: 20px;
        width: 20px;
      }
    `;
    element.dir = direction;
    element.label = `Native ${direction} scrollbar grid`;
    element.style.cssText = 'inline-size: 200px; --transition-duration: 0s';
    element.columns = columns;
    element.data = rows;
    document.body.append(element);
    try {
      await element.updateComplete;
      element.shadowRoot!.append(scrollbarFixtureStyle);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
      const header = element.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
      const footer = element.shadowRoot!.querySelector<HTMLElement>('[part="footer-row"]')!;
      const columnIds = columns.map((column) => column.field!);
      const logicalOffset = (): number =>
        direction === 'rtl' ? -body.scrollLeft : body.scrollLeft;
      const maximum = body.scrollWidth - body.clientWidth;
      const scrollbarThickness = body.offsetHeight - body.clientHeight;
      const expectAligned = async (stage: string): Promise<void> => {
        const pairs = columnIds.map((id) => {
          const headerCell = header.querySelector<HTMLElement>(
            `[data-column-id="${id}"]`,
          )!;
          const bodyCell = body.querySelector<HTMLElement>(
            `[part~="cell"][data-column-id="${id}"]`,
          )!;
          const footerCell = footer.querySelector<HTMLElement>(
            `[data-column-id="${id}"]`,
          )!;
          return [headerCell, bodyCell, footerCell] as const;
        });
        const startPinnedCells = pairs[0]!;
        const endPinnedCells = pairs.at(-1)!;
        const pinnedEdgesMatchScrollport = (): boolean => {
          const bodyRect = body.getBoundingClientRect();
          const inlineEndScrollbarGutter = body.offsetWidth - body.clientWidth;
          const physicalInlineStart =
            direction === 'rtl' ? bodyRect.right : bodyRect.left;
          const physicalInlineEnd =
            direction === 'rtl'
              ? bodyRect.left + inlineEndScrollbarGutter
              : bodyRect.right - inlineEndScrollbarGutter;
          const startEdge = direction === 'rtl' ? 'right' : 'left';
          const endEdge = direction === 'rtl' ? 'left' : 'right';
          return (
            startPinnedCells.every(
              (cell) =>
                Math.abs(
                  cell.getBoundingClientRect()[startEdge] - physicalInlineStart,
                ) <= 1,
            ) &&
            endPinnedCells.every(
              (cell) =>
                Math.abs(
                  cell.getBoundingClientRect()[endEdge] - physicalInlineEnd,
                ) <= 1,
            )
          );
        };
        expect(
          startPinnedCells.every((cell) => cell.dataset['pin'] === 'left'),
          `${direction} logical-start cells must retain data-pin=left`,
        ).to.equal(true);
        expect(
          endPinnedCells.every((cell) => cell.dataset['pin'] === 'right'),
          `${direction} logical-end cells must retain data-pin=right`,
        ).to.equal(true);
        const expectedTranslation = `${direction === 'rtl' ? logicalOffset() : -logicalOffset()}px`;
        await waitUntil(
          () =>
            header.style.getPropertyValue('--data-grid-scroll-translation') ===
              expectedTranslation &&
            footer.style.getPropertyValue('--data-grid-scroll-translation') ===
              expectedTranslation &&
            pairs.every(([headerCell, bodyCell, footerCell]) => {
              const bodyRect = bodyCell.getBoundingClientRect();
              const headerRect = headerCell.getBoundingClientRect();
              const footerRect = footerCell.getBoundingClientRect();
              return (
                Math.abs(headerRect.left - bodyRect.left) <= 1 &&
                Math.abs(headerRect.right - bodyRect.right) <= 1 &&
                Math.abs(headerRect.width - bodyRect.width) <= 1 &&
                Math.abs(footerRect.left - bodyRect.left) <= 1 &&
                Math.abs(footerRect.right - bodyRect.right) <= 1 &&
                Math.abs(footerRect.width - bodyRect.width) <= 1
              );
            }) &&
            pinnedEdgesMatchScrollport(),
          `${direction} ${stage} did not keep columns aligned and pinned to their logical edges`,
        );
      };

      expect(maximum, `${direction} grid must overflow horizontally`).to.be.greaterThan(0);
      expect(
        Math.abs(logicalOffset()),
        `${direction} grid must begin at its logical inline start`,
      ).to.be.at.most(1);
      expect(
        body.scrollHeight - body.clientHeight,
        `${direction} grid must overflow vertically so its native scrollbar corner is physical`,
      ).to.be.greaterThan(0);
      expect(
        scrollbarThickness,
        `${direction} native horizontal scrollbar must reserve a physical thumb hit target`,
      ).to.be.greaterThan(0);
      await expectAligned('at logical start');

      let trustedDragScrolls = 0;
      body.addEventListener('scroll', (event) => {
        if (event.isTrusted) trustedDragScrolls += 1;
      });

      const scrollbarRect = body.getBoundingClientRect();
      // `getBoundingClientRect()` includes a simultaneously visible vertical scrollbar, whose
      // side differs by direction. `clientLeft` starts the actual horizontal track after it.
      const trackLeft = scrollbarRect.left + body.clientLeft;
      const trackWidth = body.clientWidth;
      const trackRight = trackLeft + trackWidth;
      // Native engines impose different minimum thumb lengths. Hit a physical track endpoint for
      // start/end instead of estimating the thumb centre, then retain a middle coordinate only
      // while the thumb is known to cover it.
      const nativeThumbHitInset = Math.max(
        4,
        Math.ceil(scrollbarThickness / 2),
      );
      const physicalTrackStart = Math.ceil(trackLeft + nativeThumbHitInset);
      const physicalTrackEnd = Math.floor(trackRight - nativeThumbHitInset);
      const logicalStartTrackEdge =
        direction === 'rtl' ? physicalTrackEnd : physicalTrackStart;
      const logicalEndTrackEdge =
        direction === 'rtl' ? physicalTrackStart : physicalTrackEnd;
      const middleThumbCenter = (trackLeft + trackRight) / 2;
      const scrollbarY = Math.round(scrollbarRect.bottom - scrollbarThickness / 2);
      // A physical CSS-pixel thumb has integer coordinates; its endpoint is therefore within one
      // source-pixel-to-scroll-distance quantum rather than necessarily the exact JS maximum.
      const physicalEndpointTolerance = Math.ceil(body.scrollWidth / trackWidth);

      await sendMouse({
        type: 'move',
        position: [Math.round(logicalStartTrackEdge), scrollbarY],
      });
      const offsetBeforePointerDown = logicalOffset();
      const trustedScrollsBeforePointerDown = trustedDragScrolls;
      await sendMouse({ type: 'down' });
      await settlePointer();
      // A press on the track can page immediately and later auto-repeat. Keep the pointer still
      // through a generous native repeat window, so only subsequent held-pointer movement can
      // account for the trusted scroll below.
      await new Promise<void>((resolve) => setTimeout(resolve, 700));
      expect(
        Math.abs(logicalOffset() - offsetBeforePointerDown),
        `${direction} pointerdown changed the scrollbar before its thumb moved`,
      ).to.be.at.most(1);
      expect(
        trustedDragScrolls,
        `${direction} pointerdown emitted a scroll before its thumb moved`,
      ).to.equal(trustedScrollsBeforePointerDown);

      const moveHeldThumb = async (
        from: number,
        to: number,
        stage: string,
        expectedLogicalDirection: -1 | 1,
        complete: () => boolean,
      ): Promise<void> => {
        const offsetBeforeMove = logicalOffset();
        const trustedScrollsBeforeMove = trustedDragScrolls;
        await sendMouse({
          type: 'move',
          position: [Math.round(from + (to - from) / 3), scrollbarY],
        });
        await waitUntil(
          () =>
            trustedDragScrolls > trustedScrollsBeforeMove &&
            Math.abs(logicalOffset() - offsetBeforeMove) > 1,
          `${direction} ${stage} pointer movement did not drag the physical scrollbar thumb`,
        );
        expect(
          Math.sign(logicalOffset() - offsetBeforeMove),
          `${direction} ${stage} thumb movement used the wrong logical direction`,
        ).to.equal(expectedLogicalDirection);
        await sendMouse({
          type: 'move',
          position: [Math.round(from + ((to - from) * 2) / 3), scrollbarY],
        });
        await sendMouse({ type: 'move', position: [Math.round(to), scrollbarY] });
        await waitUntil(complete, `${direction} ${stage} did not reach its target offset`);
        await expectAligned(stage);
      };

      await moveHeldThumb(
        logicalStartTrackEdge,
        middleThumbCenter,
        'physical drag to a middle horizontal offset',
        1,
        () => logicalOffset() > 0 && logicalOffset() < maximum,
      );

      await moveHeldThumb(
        middleThumbCenter,
        logicalEndTrackEdge,
        'physical drag to logical end',
        1,
        () =>
          Math.abs(logicalOffset() - maximum) <= physicalEndpointTolerance,
      );
      await moveHeldThumb(
        logicalEndTrackEdge,
        logicalStartTrackEdge,
        'physical drag back to logical start',
        -1,
        () => Math.abs(logicalOffset()) <= physicalEndpointTolerance,
      );
      await sendMouse({ type: 'up' });
      expect(getComputedStyle(body).overflowX).to.equal('scroll');
      expect(getComputedStyle(header).overflowX).to.not.equal('scroll');
      expect(getComputedStyle(footer).overflowX).to.not.equal('scroll');
    } finally {
      try {
        await resetMouse();
      } finally {
        scrollbarFixtureStyle.remove();
        element.remove();
      }
    }
  }
});
