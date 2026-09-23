import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import "./reorder-list.js";
import "./reorder-item.js";
import type { LyraReorderList } from "./reorder-list.class.js";
import type { LyraReorderItem } from "./reorder-item.class.js";

describe("<lr-reorder-list>", () => {
  const threeItems = html`
    <lr-reorder-list>
      <lr-reorder-item value="a">Row A</lr-reorder-item>
      <lr-reorder-item value="b">Row B</lr-reorder-item>
      <lr-reorder-item value="c">Row C</lr-reorder-item>
    </lr-reorder-list>
  `;
  const itemsOf = (el: LyraReorderList) =>
    [...el.querySelectorAll("lr-reorder-item")] as LyraReorderItem[];
  const waitForCommittedFocusRestore = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

  it('renders role="list" on its internal base and forwards label to aria-label', async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list label="Steps"
        ><lr-reorder-item>Row</lr-reorder-item></lr-reorder-list
      >
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("role")).to.equal("list");
    expect(base.getAttribute("aria-label")).to.equal("Steps");
  });

  it("lets a host aria-label override the label prop on the internal list", async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list label="Visible steps" aria-label="Author steps">
        <lr-reorder-item>Row</lr-reorder-item>
      </lr-reorder-list>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("aria-label")).to.equal("Author steps");
  });

  it("honors an explicitly empty host aria-label instead of falling back to the label prop", async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list label="Visible steps" aria-label="">
        <lr-reorder-item>Row</lr-reorder-item>
      </lr-reorder-list>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute("aria-label")).to.equal("");
  });

  it('completes a move without an uncaught error when the active-element getter throws (e.g. happy-dom with nothing focused)', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const middle = itemsOf(el)[1]!;
    const upButton = middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    upButton.focus();
    Object.defineProperty(el.ownerDocument, 'activeElement', {
      configurable: true,
      get(): never {
        throw new TypeError("Cannot read properties of undefined (reading 'getRootNode')");
      },
    });
    try {
      upButton.click();
      await el.updateComplete;
    } finally {
      delete (el.ownerDocument as unknown as Record<string, unknown>)['activeElement'];
    }
    expect(itemsOf(el).map((item) => item.value)).to.deep.equal(['b', 'a', 'c']);
  });

  it('coalesces same-tick identity changes on multiple owned items into one boundary reconciliation', async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list>
        <lr-reorder-item value="a">Row A</lr-reorder-item>
        <lr-reorder-item value="b">Row B</lr-reorder-item>
        <lr-reorder-item value="c">Row C</lr-reorder-item>
        <lr-reorder-item value="d">Row D</lr-reorder-item>
      </lr-reorder-list>
    `);
    const items = itemsOf(el);
    let calls = 0;
    const original = (
      el as unknown as { syncBoundaryState: () => void }
    ).syncBoundaryState.bind(el);
    (el as unknown as { syncBoundaryState: () => void }).syncBoundaryState = () => {
      calls++;
      original();
    };

    for (const [index, item] of items.entries()) item.value = `${item.value}${index}-2`;
    await Promise.all(items.map((item) => item.updateComplete));
    await el.updateComplete;
    // Flush a macrotask boundary so any coalesced microtask work has definitely settled.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(calls).to.equal(1);
  });

  it("marks the first item atStart and the last item atEnd after initial slotchange", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const items = itemsOf(el);
    expect(items[0]!.atStart).to.be.true;
    expect(items[0]!.atEnd).to.be.false;
    expect(items[1]!.atStart).to.be.false;
    expect(items[1]!.atEnd).to.be.false;
    expect(items[2]!.atStart).to.be.false;
    expect(items[2]!.atEnd).to.be.true;
  });

  it("moves the middle item up on a move-up button click and emits lr-reorder with the new order", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const middle = itemsOf(el)[1]!;
    const upButton = middle.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;

    const listener = oneEvent(el, "lr-reorder");
    upButton.click();
    const event = (await listener) as CustomEvent<{
      order: string[];
      fromIndex: number;
      toIndex: number;
    }>;

    expect(event.detail).to.deep.equal({
      order: ["b", "a", "c"],
      fromIndex: 1,
      toIndex: 0,
    });
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(["b", "a", "c"]);
    expect(itemsOf(el)[0]!.atStart).to.be.true;
    expect(itemsOf(el)[1]!.atStart).to.be.false;
  });

  it(
    "contains a child move request at its owning list while exposing one public reorder event",
    async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div>${threeItems}</div>`);
      const el = wrapper.querySelector("lr-reorder-list") as LyraReorderList;
      const item = itemsOf(el)[1]!;
      const upButton = item.shadowRoot!.querySelector(
        '[part="move-up-button"]'
      ) as HTMLButtonElement;
      let itemRequests = 0;
      let listRequests = 0;
      let ancestorRequests = 0;
      let publicReorders = 0;
      item.addEventListener("lr-move-request", () => itemRequests++);
      el.addEventListener("lr-move-request", () => listRequests++);
      wrapper.addEventListener("lr-move-request", () => ancestorRequests++);
      wrapper.addEventListener("lr-reorder", () => publicReorders++);

      const reordered = oneEvent(el, "lr-reorder");
      upButton.click();
      await reordered;

      expect(itemRequests).to.equal(1);
      expect(listRequests).to.equal(0);
      expect(ancestorRequests).to.equal(0);
      expect(publicReorders).to.equal(1);
    }
  );

  it("does not contain a request from a nested item the list does not own", async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-reorder-list>
          <lr-reorder-item value="outer">
            Outer row
            <lr-reorder-item value="nested">Nested row</lr-reorder-item>
          </lr-reorder-item>
          <lr-reorder-item value="other">Other row</lr-reorder-item>
        </lr-reorder-list>
      </div>
    `);
    const el = wrapper.querySelector("lr-reorder-list") as LyraReorderList;
    const nestedItem = itemsOf(el)[0]!.querySelector(
      "lr-reorder-item"
    ) as LyraReorderItem;
    const nestedDownButton = nestedItem.shadowRoot!.querySelector(
      '[part="move-down-button"]'
    ) as HTMLButtonElement;
    let ancestorRequests = 0;
    wrapper.addEventListener("lr-move-request", () => ancestorRequests++);

    nestedDownButton.click();

    expect(ancestorRequests).to.equal(1);
  });

  it("lr-reorder is cancelable: preventDefault() holds the move, marks the item pending, and applies nothing yet", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const middle = itemsOf(el)[1]!;
    const upButton = middle.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;

    el.addEventListener("lr-reorder", (e) => e.preventDefault());
    upButton.click();
    await el.updateComplete;

    // Nothing moved yet.
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(["a", "b", "c"]);
    expect(middle.pending).to.be.true;
  });

  it('projects held state as busy, disables every move action, and announces both outcomes', async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    el.strings = {
      reorderMovePending: 'Move held',
      reorderMoveCancelled: 'Move discarded',
    };
    await el.updateComplete;
    el.addEventListener('lr-reorder', (event) => event.preventDefault());

    (itemsOf(el)[1]!.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement).click();
    await Promise.all([el.updateComplete, ...itemsOf(el).map((item) => item.updateComplete)]);

    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-busy')).to.equal('true');
    expect(itemsOf(el)[1]!.pending).to.equal(true);
    expect(
      itemsOf(el).every((item) =>
        [...item.shadowRoot!.querySelectorAll('button')].every((button) => button.disabled),
      ),
    ).to.equal(true);
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;
    expect(region.shadowRoot!.textContent).to.contain('Move held');

    el.revertPendingMove();
    await Promise.all([el.updateComplete, region.updateComplete]);
    expect(base.getAttribute('aria-busy')).to.equal('false');
    expect(region.shadowRoot!.textContent).to.contain('Move discarded');
  });

  it('honors synchronous finalize/revert calls made while the cancelable request dispatches', async () => {
    const finalized = await fixture<LyraReorderList>(threeItems);
    finalized.addEventListener('lr-reorder', (event) => {
      event.preventDefault();
      finalized.finalizePendingMove();
    }, { once: true });
    (itemsOf(finalized)[1]!.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement).click();
    expect(itemsOf(finalized).map((item) => item.value)).to.deep.equal(['b', 'a', 'c']);
    expect(itemsOf(finalized)[0]!.pending).to.equal(false);

    const reverted = await fixture<LyraReorderList>(threeItems);
    reverted.addEventListener('lr-reorder', (event) => {
      event.preventDefault();
      reverted.revertPendingMove();
    }, { once: true });
    (itemsOf(reverted)[1]!.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement).click();
    expect(itemsOf(reverted).map((item) => item.value)).to.deep.equal(['a', 'b', 'c']);
    expect(itemsOf(reverted)[1]!.pending).to.equal(false);
  });

  it('aborts an accepted proposal after synchronous listener removal, reorder, or disabling', async () => {
    for (const mutation of ['remove', 'reorder', 'disable-mover', 'disable-target'] as const) {
      const el = await fixture<LyraReorderList>(threeItems);
      const before = itemsOf(el);
      const mover = before[1]!;
      const target = before[0]!;
      el.addEventListener('lr-reorder', () => {
        if (mutation === 'remove') mover.remove();
        if (mutation === 'reorder') el.append(target);
        if (mutation === 'disable-mover') mover.disabled = true;
        if (mutation === 'disable-target') target.disabled = true;
      }, { once: true });

      (mover.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement).click();

      if (mutation === 'remove') {
        expect(itemsOf(el).map((item) => item.value)).to.deep.equal(['a', 'c']);
      } else if (mutation === 'reorder') {
        expect(itemsOf(el).map((item) => item.value)).to.deep.equal(['b', 'c', 'a']);
      } else {
        expect(itemsOf(el).map((item) => item.value)).to.deep.equal(['a', 'b', 'c']);
      }
      expect(el.contains(mover)).to.equal(mutation !== 'remove');
    }
  });

  it('requires unique nonempty stable values and emits immutable identity snapshots', async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list>
        <lr-reorder-item value="a">A</lr-reorder-item>
        <lr-reorder-item>Missing</lr-reorder-item>
        <lr-reorder-item value="a">Duplicate</lr-reorder-item>
        <lr-reorder-item value="b">B</lr-reorder-item>
      </lr-reorder-list>
    `);
    const all = itemsOf(el);
    await Promise.all(all.map((item) => item.updateComplete));
    expect(
      [all[1]!, all[2]!].every((item) =>
        [...item.shadowRoot!.querySelectorAll('button')].every((button) => button.disabled),
      ),
    ).to.equal(true);
    let detail: { readonly order: readonly string[] } | undefined;
    el.addEventListener('lr-reorder', (event) => {
      detail = event.detail;
    }, { once: true });
    (all[3]!.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement).click();
    expect(detail?.order).to.deep.equal(['b', 'a']);
    expect(Object.isFrozen(detail)).to.equal(true);
    expect(Object.isFrozen(detail?.order)).to.equal(true);
  });

  it("finalizePendingMove() applies a held move", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const middle = itemsOf(el)[1]!;
    const upButton = middle.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;

    el.addEventListener("lr-reorder", (e) => e.preventDefault());
    upButton.click();
    await el.updateComplete;

    el.finalizePendingMove();
    await el.updateComplete;

    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(["b", "a", "c"]);
    expect(middle.pending).to.be.false;
  });

  it("revertPendingMove() discards a held move, leaving the list at its prior order", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const middle = itemsOf(el)[1]!;
    const upButton = middle.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;

    el.addEventListener("lr-reorder", (e) => e.preventDefault());
    upButton.click();
    await el.updateComplete;

    el.revertPendingMove();
    await el.updateComplete;

    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(["a", "b", "c"]);
    expect(middle.pending).to.be.false;
  });

  it("finalizePendingMove()/revertPendingMove() are no-ops when nothing is pending", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    el.finalizePendingMove();
    el.revertPendingMove();
    await el.updateComplete;
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(["a", "b", "c"]);
  });

  it("cancels a pending move if item membership changes before finalization", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const middle = itemsOf(el)[1]!;
    el.addEventListener("lr-reorder", (event) => event.preventDefault());
    (
      middle.shadowRoot!.querySelector(
        '[part="move-up-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(middle.pending).to.be.true;

    itemsOf(el)[0]!.remove();
    el.finalizePendingMove();
    await el.updateComplete;

    expect(middle.pending).to.be.false;
    expect(itemsOf(el).map((item) => item.value)).to.deep.equal(["b", "c"]);
  });

  it("cancels a pending move if the same members are externally reordered before finalization", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const middle = itemsOf(el)[1]!;
    el.addEventListener("lr-reorder", (event) => event.preventDefault());
    (
      middle.shadowRoot!.querySelector(
        '[part="move-up-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;

    el.append(itemsOf(el)[0]!);
    el.finalizePendingMove();
    await el.updateComplete;

    expect(middle.pending).to.be.false;
    expect(itemsOf(el).map((item) => item.value)).to.deep.equal([
      "b",
      "c",
      "a",
    ]);
  });

  it("refuses to start a second move anywhere in the list while one is pending", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const items = itemsOf(el);
    el.addEventListener("lr-reorder", (e) => e.preventDefault());

    const middleUp = items[1]!.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;
    middleUp.click();
    await el.updateComplete;

    let secondEventFired = false;
    el.addEventListener("lr-reorder", () => {
      secondEventFired = true;
    });
    const lastUp = itemsOf(el)[2]!.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;
    lastUp.click();
    await el.updateComplete;

    expect(
      secondEventFired,
      "no second lr-reorder while one move is still pending"
    ).to.be.false;
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(["a", "b", "c"]);
  });

  it("event.detail.order reflects the move that WOULD happen, computed before any DOM change", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const middle = itemsOf(el)[1]!;
    const upButton = middle.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;

    let detail:
      | { order: string[]; fromIndex: number; toIndex: number }
      | undefined;
    el.addEventListener("lr-reorder", (e) => {
      detail = (
        e as CustomEvent<{
          order: string[];
          fromIndex: number;
          toIndex: number;
        }>
      ).detail;
      // The DOM must NOT have moved yet at the moment this listener runs.
      expect(itemsOf(el).map((i) => i.value)).to.deep.equal(["a", "b", "c"]);
      e.preventDefault();
    });
    upButton.click();

    expect(detail).to.deep.equal({
      order: ["b", "a", "c"],
      fromIndex: 1,
      toIndex: 0,
    });
  });

  it("moves the middle item down via Ctrl+ArrowDown from focus inside the row", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const downButton = itemsOf(el)[1]!.shadowRoot!.querySelector(
      '[part="move-down-button"]'
    ) as HTMLButtonElement;
    downButton.focus();

    const listener = oneEvent(el, "lr-reorder");
    downButton.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        ctrlKey: true,
        bubbles: true,
        composed: true,
      })
    );
    const event = (await listener) as CustomEvent<{
      order: string[];
      fromIndex: number;
      toIndex: number;
    }>;

    expect(event.detail).to.deep.equal({
      order: ["a", "c", "b"],
      fromIndex: 1,
      toIndex: 2,
    });
  });

  it("moves the middle item down via Ctrl+ArrowDown when focus is on the move button's own nested native control", async () => {
    // Regression test: the move buttons are composed <lr-icon-button>s, so real DOM focus during
    // normal keyboard use lands on the NATIVE <button> one shadow boundary deeper than the
    // `[part="move-down-button"]` host -- unlike the test above, which dispatches directly on that
    // host and so never exercises the nested boundary at all.
    const el = await fixture<LyraReorderList>(threeItems);
    const downIconButton = itemsOf(el)[1]!.shadowRoot!.querySelector(
      '[part="move-down-button"]'
    ) as HTMLElement;
    const nativeButton = downIconButton.shadowRoot!.querySelector(
      'button'
    ) as HTMLButtonElement;
    nativeButton.focus();

    const listener = oneEvent(el, "lr-reorder");
    nativeButton.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        ctrlKey: true,
        bubbles: true,
        composed: true,
      })
    );
    const event = (await listener) as CustomEvent<{
      order: string[];
      fromIndex: number;
      toIndex: number;
    }>;

    expect(event.detail).to.deep.equal({
      order: ["a", "c", "b"],
      fromIndex: 1,
      toIndex: 2,
    });
  });

  it('does not consume no-op or nested-control modifier arrows', async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list>
        <lr-reorder-item value="a"><input aria-label="Edit A" /></lr-reorder-item>
        <lr-reorder-item value="b">B</lr-reorder-item>
      </lr-reorder-list>
    `);
    const input = el.querySelector('input')!;
    const nested = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      ctrlKey: true,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    input.dispatchEvent(nested);
    expect(nested.defaultPrevented).to.equal(false);
    expect(itemsOf(el).map((item) => item.value)).to.deep.equal(['a', 'b']);

    const boundary = itemsOf(el)[0]!.shadowRoot!.querySelector(
      '[part="move-up-button"]',
    ) as HTMLButtonElement;
    const noOp = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      ctrlKey: true,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    boundary.dispatchEvent(noOp);
    expect(noOp.defaultPrevented).to.equal(false);
  });

  it("restores focus to a still-enabled button after the move", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const items = itemsOf(el);
    const lastUpButton = items[2]!.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;
    lastUpButton.click();
    await waitForCommittedFocusRestore();
    // "c" moved from index 2 to index 1 -- still has a move-up available, focus should land there.
    // Re-query rather than reuse the stale `items` array: `items[1]` is a frozen reference to the
    // original "b" element and never moves, so checking it would test the wrong node's shadow root.
    const activeInShadow = itemsOf(el)[1]!.shadowRoot!.activeElement;
    expect(activeInShadow?.getAttribute("part")).to.equal("move-up-button");
  });

  it("restores focus to a real button inside the moved item after a boundary-crossing move on a 2-item list", async () => {
    // Regression test for a focus-loss bug: on a 2-item list, clicking the FIRST item's
    // move-down button makes that item (now at index 1) the new atEnd boundary -- the exact
    // "fallback to the opposite-direction button" case where the chosen refocus target
    // (move-up-button) was disabled BEFORE this move and only becomes enabled once Lit's
    // deferred render actually clears the `disabled` attribute in the live DOM.
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list>
        <lr-reorder-item value="a">Row A</lr-reorder-item>
        <lr-reorder-item value="b">Row B</lr-reorder-item>
      </lr-reorder-list>
    `);
    const firstDownButton = itemsOf(el)[0]!.shadowRoot!.querySelector(
      '[part="move-down-button"]'
    ) as HTMLButtonElement;

    firstDownButton.focus();
    firstDownButton.click();
    await waitForCommittedFocusRestore();

    const movedItem = itemsOf(el)[1]!; // "a" moved from index 0 to index 1
    expect(movedItem.value).to.equal("a");
    const active = movedItem.shadowRoot!.activeElement;
    expect((active) != null, "focus lands on a real element inside the moved item, not lost to document.body").to.equal(true);
    expect(active?.localName).to.equal("lr-icon-button");
    expect(
      (active as HTMLElement & { disabled?: boolean }).disabled,
      "the focused button is not disabled"
    ).to.equal(false);
    expect(active?.getAttribute("part")).to.equal("move-up-button");
    expect(
      document.activeElement === el || el.contains(document.activeElement),
      "active element resolves into the list, not document.body"
    ).to.be.true;
  });

  it("restores focus to a real button inside the moved item after a boundary-crossing move via Ctrl/Cmd+ArrowDown on a 2-item list", async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list>
        <lr-reorder-item value="a">Row A</lr-reorder-item>
        <lr-reorder-item value="b">Row B</lr-reorder-item>
      </lr-reorder-list>
    `);
    const firstDownButton = itemsOf(el)[0]!.shadowRoot!.querySelector(
      '[part="move-down-button"]'
    ) as HTMLButtonElement;
    firstDownButton.focus();

    const listener = oneEvent(el, "lr-reorder");
    firstDownButton.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        ctrlKey: true,
        bubbles: true,
        composed: true,
      })
    );
    await listener;
    await waitForCommittedFocusRestore();

    const movedItem = itemsOf(el)[1]!; // "a" moved from index 0 to index 1
    expect(movedItem.value).to.equal("a");
    const active = movedItem.shadowRoot!.activeElement;
    expect((active) != null, "focus lands on a real element inside the moved item, not lost to document.body").to.equal(true);
    expect(active?.localName).to.equal("lr-icon-button");
    expect(
      (active as HTMLElement & { disabled?: boolean }).disabled,
      "the focused button is not disabled"
    ).to.equal(false);
    expect(active?.getAttribute("part")).to.equal("move-up-button");
  });

  it("is a no-op at a boundary: no event, item stays put", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const first = itemsOf(el)[0]!;
    const upButton = first.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;
    expect(upButton.disabled).to.be.true;

    let emitted = false;
    el.addEventListener("lr-reorder", () => {
      emitted = true;
    });
    upButton.click();
    await el.updateComplete;
    expect(emitted).to.be.false;
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(["a", "b", "c"]);
  });

  it("is a no-op on a disabled item, even via the keyboard shortcut", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    itemsOf(el)[1]!.disabled = true;
    await el.updateComplete;

    let emitted = false;
    el.addEventListener("lr-reorder", () => {
      emitted = true;
    });
    const downButton = itemsOf(el)[1]!.shadowRoot!.querySelector(
      '[part="move-down-button"]'
    ) as HTMLButtonElement;
    downButton.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        ctrlKey: true,
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    expect(emitted).to.be.false;
  });

  it("cascades list-level disabled to every item's buttons without mutating the item's own disabled attribute", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    el.disabled = true;
    await el.updateComplete;
    for (const item of itemsOf(el)) {
      const up = item.shadowRoot!.querySelector(
        '[part="move-up-button"]'
      ) as HTMLButtonElement;
      const down = item.shadowRoot!.querySelector(
        '[part="move-down-button"]'
      ) as HTMLButtonElement;
      expect(
        up.disabled || down.disabled,
        "at least one button disabled while list-disabled"
      ).to.be.true;
      expect(item.disabled, "item's own disabled attribute untouched").to.be
        .false;
    }
    el.disabled = false;
    await el.updateComplete;
    const middleUp = itemsOf(el)[1]!.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;
    expect(middleUp.disabled).to.be.false;
  });

  it("announces the move through an internal live region", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    const region = el.shadowRoot!.querySelector(
      "lr-live-region"
    ) as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    expect((region) != null, "renders a live region").to.equal(true);
    await region.updateComplete;

    const upButton = itemsOf(el)[1]!.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;
    upButton.click();
    await el.updateComplete;

    const text =
      region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? "";
    expect(text).to.contain("1");
    expect(text).to.contain("3");
  });

  it("honors a .strings override for the reorderItemMoved announcement", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    el.strings = {
      reorderItemMoved: "Déplacé en position {index} sur {total}",
    };
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector(
      "lr-live-region"
    ) as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;

    const upButton = itemsOf(el)[1]!.shadowRoot!.querySelector(
      '[part="move-up-button"]'
    ) as HTMLButtonElement;
    upButton.click();
    await el.updateComplete;

    const text =
      region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? "";
    expect(text).to.contain("Déplacé en position 1 sur 3");
  });

  it("focuses the most recently moved item after two rapid consecutive moves fired with no await in between", async () => {
    // Reproduces a fast double-click / Ctrl+Arrow key-repeat outrunning a render tick: two moves
    // fired back-to-back, with NO `await` between them, so the second move's own focus-restore
    // bookkeeping is set up before the first move's has had any chance to resolve.
    const el = await fixture<LyraReorderList>(threeItems);
    const itemA = itemsOf(el)[0]!;
    const itemB = itemsOf(el)[1]!;

    // Move 1: "a" moves down, [a, b, c] -> [b, a, c]. Targets "a" for focus restoration.
    const aDownButton = itemA.shadowRoot!.querySelector(
      '[part="move-down-button"]'
    ) as HTMLButtonElement;
    aDownButton.click();

    // Move 2, fired immediately (no await): "b" moves down, [b, a, c] -> [a, b, c]. This is the
    // most recent move and should be the one that ends up owning focus.
    const bDownButton = itemB.shadowRoot!.querySelector(
      '[part="move-down-button"]'
    ) as HTMLButtonElement;
    bDownButton.click();

    await waitForCommittedFocusRestore();

    const activeInB = itemB.shadowRoot!.activeElement;
    expect(
      activeInB?.getAttribute("part"),
      'focus lands on a button inside "b", the second (most recent) move\'s target'
    ).to.equal("move-down-button");
    expect((itemA.shadowRoot!.activeElement) === null, 'the stale first move\'s target, "a", must not hold or steal focus').to.equal(true);
  });

  it("abandons a scheduled focus restore across disconnect and reconnect", async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-reorder-list>
          <lr-reorder-item value="a">Row A</lr-reorder-item>
          <lr-reorder-item value="b">Row B</lr-reorder-item>
        </lr-reorder-list>
      </div>
    `);
    const el = wrapper.querySelector("lr-reorder-list") as LyraReorderList;
    const firstDownButton = itemsOf(el)[0]!.shadowRoot!.querySelector(
      '[part="move-down-button"]'
    ) as HTMLButtonElement;

    firstDownButton.focus();
    firstDownButton.click();
    el.remove();
    wrapper.append(el);
    await waitForCommittedFocusRestore();

    const movedItem = itemsOf(el)[1]!;
    expect((movedItem.shadowRoot!.activeElement) === null).to.equal(true);
  });

  it("is accessible in a populated state", async () => {
    const el = await fixture<LyraReorderList>(threeItems);
    await expect(el).to.be.accessible();
  });

  it('renders correctly under dir="rtl" (up/down reorder is not a directional concept)', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div dir="rtl">${threeItems}</div>`
    );
    const el = wrapper.querySelector("lr-reorder-list") as LyraReorderList;
    await expect(el).to.be.accessible();
  });
});

it("formats move positions with the effective locale", async () => {
  const el = await fixture<LyraReorderList>(html`
    <lr-reorder-list lang="ar-EG">
      <lr-reorder-item value="a">Row A</lr-reorder-item>
      <lr-reorder-item value="b">Row B</lr-reorder-item>
      <lr-reorder-item value="c">Row C</lr-reorder-item>
    </lr-reorder-list>
  `);
  const region = el.shadowRoot!.querySelector("lr-live-region") as HTMLElement & {
    updateComplete: Promise<boolean>;
  };
  await region.updateComplete;
  const upButton = el.querySelectorAll('lr-reorder-item')[1]!.shadowRoot!.querySelector(
    '[part="move-up-button"]'
  ) as HTMLButtonElement;
  upButton.click();
  await el.updateComplete;
  const text = region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? "";
  const number = new Intl.NumberFormat("ar-EG");
  expect(text).to.include(number.format(1));
  expect(text).to.include(number.format(3));
});

it("contains long localized rows in exact 320px LTR and RTL reorder lists", async () => {
  for (const direction of ["ltr", "rtl"] as const) {
    const wrapper = await fixture<HTMLElement>(html`
      <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
        <lr-reorder-list label="Ordered fields" style="inline-size: 100%;">
          <lr-reorder-item value="first">InternationalizedReorderListRowWithoutAnyNaturalBreakOpportunity</lr-reorder-item>
          <lr-reorder-item value="second">InternationalizedSecondaryReorderListRowWithoutAnyNaturalBreakOpportunity</lr-reorder-item>
        </lr-reorder-list>
      </div>
    `);
    const el = wrapper.querySelector("lr-reorder-list") as LyraReorderList;
    const reorderItems = [
      ...el.querySelectorAll("lr-reorder-item"),
    ] as LyraReorderItem[];
    await Promise.all([el.updateComplete, ...reorderItems.map((item) => item.updateComplete)]);
    const base = el.shadowRoot!.querySelector<HTMLElement>("[part='base']")!;
    const content = reorderItems.map(
      (item) => item.shadowRoot!.querySelector<HTMLElement>("[part='content']")!
    );

    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);
    expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
    expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
    expect(content.every((part) => part.scrollWidth <= part.clientWidth + 1)).to.equal(true);
    expect(getComputedStyle(base).direction).to.equal(direction);
  }
});

describe('<lr-reorder-list controlled>', () => {
  const itemsOf = (el: LyraReorderList) =>
    [...el.querySelectorAll('lr-reorder-item')] as LyraReorderItem[];
  const threeControlledItems = html`
    <lr-reorder-list controlled>
      <lr-reorder-item value="a">Row A</lr-reorder-item>
      <lr-reorder-item value="b">Row B</lr-reorder-item>
      <lr-reorder-item value="c">Row C</lr-reorder-item>
    </lr-reorder-list>
  `;

  it('defaults to false and reflects as an attribute', async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list><lr-reorder-item value="a">A</lr-reorder-item></lr-reorder-list>
    `);
    expect(el.controlled).to.equal(false);
    expect(el.hasAttribute('controlled')).to.equal(false);
    el.controlled = true;
    await el.updateComplete;
    expect(el.hasAttribute('controlled')).to.equal(true);
  });

  it('does not move the DOM itself on an uncanceled lr-reorder, and completes once the host reorders its own children to match', async () => {
    const el = await fixture<LyraReorderList>(threeControlledItems);
    const middle = itemsOf(el)[1]!;
    let detail: { order: readonly string[] } | undefined;
    el.addEventListener('lr-reorder', (e) => {
      detail = (e as CustomEvent<{ order: readonly string[] }>).detail;
    });
    const upButton = middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    upButton.click();
    await el.updateComplete;

    // Nothing moved yet -- the list is waiting for the host's own re-render.
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['a', 'b', 'c']);
    expect(middle.pending).to.equal(true);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-busy')).to.equal('true');
    expect(detail?.order).to.deep.equal(['b', 'a', 'c']);

    // The host applies its own reorder, reusing the same element instances -- matching what a
    // keyed `repeat()` re-render would produce.
    el.insertBefore(middle, itemsOf(el)[0]!);
    await waitUntil(() => !middle.pending);

    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['b', 'a', 'c']);
    expect(base.getAttribute('aria-busy')).to.equal('false');
  });

  it('reconciles by value, restoring focus and announcing, even when the host recreates the moved item as a new element instance', async () => {
    const el = await fixture<LyraReorderList>(threeControlledItems);
    el.strings = { reorderItemMoved: 'Moved to {index} of {total}' };
    await el.updateComplete;
    const originalMiddle = itemsOf(el)[1]!;
    const upButton = originalMiddle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    upButton.click();
    await el.updateComplete;
    expect(originalMiddle.pending).to.equal(true);

    // The host applies the reorder by recreating the moved row from its own backing data
    // (e.g. a non-keyed template), rather than moving the existing element instance.
    const newB = document.createElement('lr-reorder-item') as LyraReorderItem;
    newB.value = 'b';
    newB.textContent = 'Row B';
    originalMiddle.remove();
    el.prepend(newB);
    await waitUntil(() => itemsOf(el).map((i) => i.value).join(',') === 'b,a,c' && !newB.pending);

    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;
    expect(region.shadowRoot!.textContent).to.contain('Moved to');

    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await newB.updateComplete;
    expect(['move-up-button', 'move-down-button']).to.include(
      newB.shadowRoot!.activeElement?.getAttribute('part'),
    );
  });

  it('leaves the move pending when a host mutation does not reach the expected order, and completes once a later one does', async () => {
    const el = await fixture<LyraReorderList>(threeControlledItems);
    const middle = itemsOf(el)[1]!;
    const upButton = middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    upButton.click();
    await el.updateComplete;

    // An unrelated host mutation (disables the last row) does not reach the expected b,a,c order.
    itemsOf(el)[2]!.disabled = true;
    await el.updateComplete;
    expect(middle.pending).to.equal(true);
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['a', 'b', 'c']);

    el.insertBefore(middle, itemsOf(el)[0]!);
    await waitUntil(() => !middle.pending);
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['b', 'a', 'c']);
  });

  it('cancels silently, with no announcement, when a host mutation drops the moved value entirely', async () => {
    const el = await fixture<LyraReorderList>(threeControlledItems);
    el.strings = { reorderMoveCancelled: 'Move discarded', reorderItemMoved: 'Moved' };
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    const middle = itemsOf(el)[1]!;
    const upButton = middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    upButton.click();
    await el.updateComplete;
    expect(base.getAttribute('aria-busy')).to.equal('true');

    middle.remove();
    await waitUntil(() => base.getAttribute('aria-busy') === 'false');

    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;
    expect(region.shadowRoot!.textContent ?? '').to.not.contain('Move discarded');
    expect(region.shadowRoot!.textContent ?? '').to.not.contain('Moved');
  });

  it('refuses to start a second move anywhere in the list while a controlled reconciliation is pending', async () => {
    const el = await fixture<LyraReorderList>(threeControlledItems);
    const items = itemsOf(el);
    const middleUp = items[1]!.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    middleUp.click();
    await el.updateComplete;
    expect(items[1]!.pending).to.equal(true);

    let secondEventFired = false;
    el.addEventListener('lr-reorder', () => {
      secondEventFired = true;
    });
    const lastUp = itemsOf(el)[2]!.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    lastUp.click();
    await el.updateComplete;

    expect(secondEventFired, 'no second lr-reorder while a controlled reconciliation is pending').to.equal(false);
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['a', 'b', 'c']);
  });

  it('reconciles via a plain value property rewrite on the SAME element instances (no DOM reordering, no attribute mutation)', async () => {
    // The realistic non-keyed-template host gotcha: `Array.map()` into the default slot without
    // `repeat()` reuses each POSITION's existing element and just rewrites its `value` PROPERTY
    // (never the attribute), rather than moving any node. Reconciliation must still key by value.
    const el = await fixture<LyraReorderList>(threeControlledItems);
    const [itemAtPos0, itemAtPos1] = itemsOf(el);
    const middle = itemAtPos1!;
    const upButton = middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement;
    upButton.click();
    await el.updateComplete;
    expect(middle.pending).to.equal(true);

    itemAtPos0!.value = 'b';
    itemAtPos1!.value = 'a';
    await waitUntil(() => !itemAtPos0!.pending);

    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['b', 'a', 'c']);
    // Reconciliation is keyed by value, so it completed against whichever element instance now
    // holds "b" -- the element that used to sit at position 0, never the originally clicked one.
    expect(itemAtPos0!.pending).to.equal(false);
    expect(middle.pending).to.equal(false);
  });

  it('finalizePendingMove() starts a controlled reconciliation instead of moving the DOM itself', async () => {
    const el = await fixture<LyraReorderList>(threeControlledItems);
    const middle = itemsOf(el)[1]!;
    el.addEventListener('lr-reorder', (e) => e.preventDefault());
    (middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    el.finalizePendingMove();
    await el.updateComplete;

    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['a', 'b', 'c']);
    expect(middle.pending).to.equal(true);

    el.insertBefore(middle, itemsOf(el)[0]!);
    await waitUntil(() => !middle.pending);
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['b', 'a', 'c']);
  });

  it('preserves a deliberate external focus choice made during a pending controlled reconciliation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        ${threeControlledItems}
        <button>External</button>
      </div>
    `);
    const el = wrapper.querySelector('lr-reorder-list') as LyraReorderList;
    const externalButton = wrapper.querySelector('button') as HTMLButtonElement;
    const middle = itemsOf(el)[1]!;
    el.addEventListener('lr-reorder', (e) => e.preventDefault());
    (middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(middle.pending).to.equal(true);

    // The consumer deliberately moves focus elsewhere BEFORE resolving the held move and BEFORE
    // the host's own re-render settles the controlled reconciliation.
    externalButton.focus();
    expect(document.activeElement === externalButton).to.be.true;

    el.finalizePendingMove();
    await el.updateComplete;
    expect(middle.pending, "now waiting on the host's own re-render").to.equal(true);

    // The host applies its own reorder, reusing the same element instance.
    el.insertBefore(middle, itemsOf(el)[0]!);
    await waitUntil(() => !middle.pending);

    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['b', 'a', 'c']);
    expect(
      document.activeElement === externalButton,
      'the deliberately-focused external button must not be stolen back',
    ).to.be.true;
  });

  it("still restores focus to the moved row's move button when focus was not moved away during a pending controlled reconciliation", async () => {
    const el = await fixture<LyraReorderList>(threeControlledItems);
    const middle = itemsOf(el)[1]!;
    el.addEventListener('lr-reorder', (e) => e.preventDefault());
    (middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(middle.pending).to.equal(true);

    el.finalizePendingMove();
    await el.updateComplete;
    expect(middle.pending).to.equal(true);

    el.insertBefore(middle, itemsOf(el)[0]!);
    await waitUntil(() => !middle.pending);
    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['b', 'a', 'c']);

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await middle.updateComplete;
    expect(['move-up-button', 'move-down-button']).to.include(
      middle.shadowRoot!.activeElement?.getAttribute('part'),
    );
  });

  it('turning controlled off while a reconciliation is pending drops it instead of leaving the list stuck busy', async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list controlled>
        <lr-reorder-item value="a">Row A</lr-reorder-item>
        <lr-reorder-item value="b">Row B</lr-reorder-item>
      </lr-reorder-list>
    `);
    const first = itemsOf(el)[0]!;
    (first.shadowRoot!.querySelector('[part="move-down-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(first.pending).to.equal(true);

    el.controlled = false;
    await el.updateComplete;

    expect(first.pending).to.equal(false);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(base.getAttribute('aria-busy')).to.equal('false');
  });
});

describe('<lr-reorder-list> revertPendingMove({ silent })', () => {
  const itemsOf = (el: LyraReorderList) =>
    [...el.querySelectorAll('lr-reorder-item')] as LyraReorderItem[];

  it('discards a held move without the built-in cancellation announcement when passed { silent: true }', async () => {
    const el = await fixture<LyraReorderList>(html`
      <lr-reorder-list>
        <lr-reorder-item value="a">Row A</lr-reorder-item>
        <lr-reorder-item value="b">Row B</lr-reorder-item>
        <lr-reorder-item value="c">Row C</lr-reorder-item>
      </lr-reorder-list>
    `);
    el.strings = { reorderMoveCancelled: 'Move discarded' };
    await el.updateComplete;
    const middle = itemsOf(el)[1]!;
    el.addEventListener('lr-reorder', (e) => e.preventDefault());
    (middle.shadowRoot!.querySelector('[part="move-up-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(middle.pending).to.equal(true);

    el.revertPendingMove({ silent: true });
    await el.updateComplete;

    expect(itemsOf(el).map((i) => i.value)).to.deep.equal(['a', 'b', 'c']);
    expect(middle.pending).to.equal(false);
    const region = el.shadowRoot!.querySelector('lr-live-region') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await region.updateComplete;
    expect(region.shadowRoot!.textContent ?? '').to.not.contain('Move discarded');
  });
});
