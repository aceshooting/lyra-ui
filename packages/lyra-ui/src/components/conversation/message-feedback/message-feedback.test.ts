import {
  fixture,
  expect,
  html,
  oneEvent,
  aTimeout,
  waitUntil,
} from "@open-wc/testing";
import "./message-feedback.js";
import type { LyraMessageFeedback } from "./message-feedback.js";
import type { LyraChip } from "../../overlays/chip/chip.class.js";
import { hoverUntilMatched, resetMouse } from "../../../../test/wtr-mouse.js";

const reasons = [
  { id: "wrong", label: "Factually wrong" },
  { id: "unhelpful", label: "Not helpful" },
];

it('defaults to rating=null, no detail configuration, detailFor="down", and not pending', async () => {
  const el = (await fixture(
    html`<lr-message-feedback></lr-message-feedback>`
  )) as LyraMessageFeedback;
  expect(el.rating).to.equal(null);
  expect(el.detail).to.be.undefined;
  expect(el.detailFor).to.equal("down");
  expect(el.pending).to.be.false;
});

it("localizes thumb accessible names with the built-in English fallback and via .strings override", async () => {
  const el = (await fixture(
    html`<lr-message-feedback></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const up = el.shadowRoot!.querySelector(
    '[part="up-button"]'
  ) as HTMLButtonElement;
  const down = el.shadowRoot!.querySelector(
    '[part="down-button"]'
  ) as HTMLButtonElement;
  expect(up.getAttribute("aria-label")).to.equal("Good response");
  expect(down.getAttribute("aria-label")).to.equal("Bad response");

  el.strings = {
    feedbackPositive: "Bonne réponse",
    feedbackNegative: "Mauvaise réponse",
  };
  await el.updateComplete;
  expect(up.getAttribute("aria-label")).to.equal("Bonne réponse");
  expect(down.getAttribute("aria-label")).to.equal("Mauvaise réponse");
});

describe("thumbs-only (no detail configuration)", () => {
  it("toggles rating and emits one terminal submit on click, with no panel ever rendered", async () => {
    const el = (await fixture(
      html`<lr-message-feedback></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const up = el.shadowRoot!.querySelector(
      '[part="up-button"]'
    ) as HTMLButtonElement;

    const first = oneEvent(el, "lr-feedback-change");
    const firstSubmit = oneEvent(el, "lr-feedback-submit");
    up.click();
    expect((await first).detail).to.deep.equal({ rating: "up" });
    expect((await firstSubmit).detail).to.deep.equal({
      rating: "up",
      reasonIds: [],
      comment: "",
    });
    expect(el.rating).to.equal("up");
    expect(el.shadowRoot!.querySelector('[part="panel"]') == null).to.be.true;

    const second = oneEvent(el, "lr-feedback-change");
    const secondSubmit = oneEvent(el, "lr-feedback-submit");
    up.click(); // re-activating the pressed thumb clears it
    expect((await second).detail).to.deep.equal({ rating: null });
    expect((await secondSubmit).detail).to.deep.equal({
      rating: null,
      reasonIds: [],
      comment: "",
    });
    expect(el.rating).to.equal(null);
  });

  it("uses the same cancelable pending/finalize/revert transaction as detailed feedback", async () => {
    const el = (await fixture(
      html`<lr-message-feedback></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const up = el.shadowRoot!.querySelector(
      '[part="up-button"]'
    ) as HTMLButtonElement;
    const submissions: CustomEvent[] = [];
    el.addEventListener("lr-feedback-submit", (event) => {
      submissions.push(event as CustomEvent);
      event.preventDefault();
    });

    up.click();
    expect(submissions).to.have.length(1);
    expect(submissions[0]!.cancelable).to.be.true;
    expect(el.pending).to.be.true;
    expect(el.rating).to.equal("up");

    el.revertPendingSubmit();
    await el.updateComplete;
    expect(el.pending).to.be.false;
    expect(el.rating).to.equal(null);

    up.click();
    expect(el.pending).to.be.true;
    el.finalizePendingSubmit();
    await el.updateComplete;
    expect(el.pending).to.be.false;
    expect(el.rating).to.equal("up");
  });

  it("reflects aria-pressed both true and false", async () => {
    const el = (await fixture(
      html`<lr-message-feedback></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    expect(down.getAttribute("aria-pressed")).to.equal("false");
    down.click();
    await el.updateComplete;
    expect(down.getAttribute("aria-pressed")).to.equal("true");
  });
});

describe('detail panel (reasons + commentable, detailFor "down")', () => {
  it("opens the panel only for the thumb detailFor applies to", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ reasons, commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const up = el.shadowRoot!.querySelector(
      '[part="up-button"]'
    ) as HTMLButtonElement;
    up.click();
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.false;

    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.true;
  });

  it("supports explicit up-only, both, and no-detail ownership from one detail object", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        detail-for="up"
        .detail=${{ reasons, commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const up = el.shadowRoot!.querySelector(
      '[part="up-button"]'
    ) as HTMLButtonElement;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;

    up.click();
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.true;

    el.detailFor = "none";
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.false;
    expect(up.hasAttribute("aria-controls")).to.be.false;
    expect(down.hasAttribute("aria-controls")).to.be.false;

    el.detailFor = "both";
    await el.updateComplete;
    expect(up.getAttribute("aria-controls")).to.exist;
    expect(down.getAttribute("aria-controls")).to.exist;
  });

  it("toggles reason chips and includes only selected ids in lr-feedback-submit", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{
          reasons: [
            null,
            { id: '', label: 'Missing identity' },
            { id: '   ', label: 'Blank identity' },
            ...reasons,
            { id: 'wrong', label: 'Duplicate reason' },
          ],
        } as unknown}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    down.click();
    await el.updateComplete;

    const chips = el.shadowRoot!.querySelectorAll('[part="reasons"] lr-chip');
    expect(chips.length).to.equal(2);
    (chips[0] as HTMLElement).dispatchEvent(
      new CustomEvent("lr-chip-select", {
        detail: { selected: true },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;

    const submitPromise = oneEvent(el, "lr-feedback-submit");
    (
      el.shadowRoot!.querySelector(
        '[part="submit-button"]'
      ) as HTMLButtonElement
    ).click();
    const ev = await submitPromise;
    expect(ev.detail).to.deep.equal({
      rating: "down",
      reasonIds: ["wrong"],
      comment: "",
    });
  });

  it("includes the trimmed comment in lr-feedback-submit when commentable", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    down.click();
    await el.updateComplete;

    const textarea = el.shadowRoot!.querySelector(
      '[part="comment"]'
    ) as HTMLTextAreaElement;
    textarea.value = "  too slow  ";
    textarea.dispatchEvent(new Event("input"));
    await el.updateComplete;

    const submitPromise = oneEvent(el, "lr-feedback-submit");
    (
      el.shadowRoot!.querySelector(
        '[part="submit-button"]'
      ) as HTMLButtonElement
    ).click();
    const ev = await submitPromise;
    expect(ev.detail).to.deep.equal({
      rating: "down",
      reasonIds: [],
      comment: "too slow",
    });
  });

  it("holds a prevented submit pending until the host finalizes or reverts it", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector(
      '[part="comment"]'
    ) as HTMLTextAreaElement;
    textarea.value = "persist me";
    textarea.dispatchEvent(new Event("input"));

    let submitCancelable = false;
    el.addEventListener("lr-feedback-submit", (event) => {
      submitCancelable = event.cancelable;
      event.preventDefault();
    });
    const submit = el.shadowRoot!.querySelector(
      '[part="submit-button"]'
    ) as HTMLButtonElement;
    submit.click();
    await el.updateComplete;

    expect(submitCancelable).to.equal(true);
    expect(el.pending).to.equal(true);
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.equal(true);
    expect(textarea.disabled).to.equal(true);
    const liveText = (): string =>
      el
        .shadowRoot!.querySelector("lr-live-region")!
        .shadowRoot!.querySelector('[part="region"]')!.textContent ?? "";
    expect(liveText()).to.equal("");

    el.revertPendingSubmit();
    await el.updateComplete;
    expect(el.pending).to.equal(false);
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.equal(true);
    expect(textarea.disabled).to.equal(false);
    expect(textarea.value).to.equal("persist me");

    submit.click();
    await el.updateComplete;
    expect(el.pending).to.equal(true);
    el.finalizePendingSubmit();
    await el.updateComplete;
    await aTimeout(20);
    expect(el.pending).to.equal(false);
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.equal(false);
    expect(liveText()).to.equal("Feedback submitted");
    expect(el.shadowRoot!.activeElement === down).to.equal(true);
  });

  it("installs the transaction before dispatch so synchronous finalize/revert resolves exactly once", async () => {
    const finalized = (await fixture(
      html`<lr-message-feedback
        .detail=${{ commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    (
      finalized.shadowRoot!.querySelector(
        '[part="down-button"]'
      ) as HTMLButtonElement
    ).click();
    await finalized.updateComplete;
    let pendingDuringDispatch = false;
    finalized.addEventListener("lr-feedback-submit", (event) => {
      pendingDuringDispatch = finalized.pending;
      event.preventDefault();
      finalized.finalizePendingSubmit();
    });
    (
      finalized.shadowRoot!.querySelector(
        '[part="submit-button"]'
      ) as HTMLButtonElement
    ).click();
    await finalized.updateComplete;
    expect(pendingDuringDispatch).to.be.true;
    expect(finalized.pending).to.be.false;
    expect(
      finalized
        .shadowRoot!.querySelector('[part="panel"]')!
        .hasAttribute("data-open")
    ).to.be.false;

    const reverted = (await fixture(
      html`<lr-message-feedback></lr-message-feedback>`
    )) as LyraMessageFeedback;
    reverted.addEventListener("lr-feedback-submit", (event) => {
      event.preventDefault();
      reverted.revertPendingSubmit();
    });
    (
      reverted.shadowRoot!.querySelector(
        '[part="up-button"]'
      ) as HTMLButtonElement
    ).click();
    await reverted.updateComplete;
    expect(reverted.pending).to.be.false;
    expect(reverted.rating).to.equal(null);
  });

  it("closes the panel and returns focus to the active thumb on submit", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    (
      el.shadowRoot!.querySelector(
        '[part="submit-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.false;
    expect(el.rating).to.equal("down"); // submit does not clear the rating
    expect(el.shadowRoot!.activeElement === down).to.equal(true);
  });

  it("closes the panel on Escape, keeps rating, and returns focus to the active thumb", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    el.shadowRoot!.querySelector('[part="panel"]')!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.false;
    expect(el.rating).to.equal("down");
    expect(el.shadowRoot!.activeElement === down).to.equal(true);
  });

  it("re-opens the panel with the prior draft intact when the pressed thumb is clicked again after Escape", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ reasons, commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector(
      '[part="comment"]'
    ) as HTMLTextAreaElement;
    textarea.value = "draft in progress";
    textarea.dispatchEvent(new Event("input"));
    await el.updateComplete;

    el.shadowRoot!.querySelector('[part="panel"]')!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.false;

    let changeFired = false;
    el.addEventListener("lr-feedback-change", () => (changeFired = true));
    down.click(); // re-open, not toggle-off, since the panel was closed
    await el.updateComplete;
    expect(
      changeFired,
      "rating did not change, so lr-feedback-change must not re-fire"
    ).to.be.false;
    expect(el.rating).to.equal("down");
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.true;
    expect(
      (el.shadowRoot!.querySelector('[part="comment"]') as HTMLTextAreaElement)
        .value
    ).to.equal("draft in progress");
  });

  it("clears rating when the pressed thumb with its panel already open is clicked again", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.true;

    const changePromise = oneEvent(el, "lr-feedback-change");
    down.click(); // panel is open -- this click is the toggle-off gesture
    expect((await changePromise).detail).to.deep.equal({ rating: null });
    expect(el.rating).to.equal(null);
  });

  it("resets drafts when switching from one thumb to the other", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ reasons, commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement;
    down.click();
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector(
      '[part="comment"]'
    ) as HTMLTextAreaElement;
    textarea.value = "stale draft";
    textarea.dispatchEvent(new Event("input"));
    await el.updateComplete;

    const up = el.shadowRoot!.querySelector(
      '[part="up-button"]'
    ) as HTMLButtonElement;
    up.click(); // up has no detail panel (detailFor defaults to 'down'), but still switches rating
    await el.updateComplete;
    down.click(); // back to down -- should show a fresh, empty draft, not the stale one
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="comment"]') as HTMLTextAreaElement)
        .value
    ).to.equal("");
  });

  it("prunes selected draft reasons when the controlled reasons collection changes", async () => {
    const el = (await fixture(
      html`<lr-message-feedback .detail=${{ reasons }}></lr-message-feedback>`
    )) as LyraMessageFeedback;
    (
      el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector("lr-chip") as HTMLElement).dispatchEvent(
      new CustomEvent("lr-chip-select", {
        detail: { selected: true },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;

    el.detail = { reasons: [{ id: "new", label: "New reason" }] };
    await el.updateComplete;
    const submitted = oneEvent(el, "lr-feedback-submit");
    (
      el.shadowRoot!.querySelector(
        '[part="submit-button"]'
      ) as HTMLButtonElement
    ).click();

    expect((await submitted).detail.reasonIds).to.deep.equal([]);
  });

  it("clears a hidden comment draft when commentable is revoked", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ reasons, commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    (
      el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector(
      '[part="comment"]'
    ) as HTMLTextAreaElement;
    textarea.value = "must not leak";
    textarea.dispatchEvent(new Event("input"));

    el.detail = { reasons, commentable: false };
    await el.updateComplete;
    const submitted = oneEvent(el, "lr-feedback-submit");
    (
      el.shadowRoot!.querySelector(
        '[part="submit-button"]'
      ) as HTMLButtonElement
    ).click();

    expect((await submitted).detail.comment).to.equal("");
  });

  it("closes and clears an open draft when rating or detail ownership changes externally", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ reasons, commentable: true }}
        detail-for="both"
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    (
      el.shadowRoot!.querySelector('[part="up-button"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.true;

    el.detailFor = "down";
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.false;

    el.detailFor = "both";
    el.rating = "down";
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
    ).to.be.false;
  });
});

it("respects a host-set disabled rating as a read-only display", async () => {
  const el = (await fixture(
    html`<lr-message-feedback rating="up" disabled></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const up = el.shadowRoot!.querySelector(
    '[part="up-button"]'
  ) as HTMLButtonElement;
  expect(up.disabled).to.be.true;
  let fired = false;
  el.addEventListener("lr-feedback-change", () => (fired = true));
  up.click();
  expect(fired).to.be.false;
});

it("disables the comment textarea and submit button (not just the thumbs) once disabled is set while the panel is already open", async () => {
  const el = (await fixture(
    html`<lr-message-feedback
      .detail=${{ commentable: true }}
    ></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const down = el.shadowRoot!.querySelector(
    '[part="down-button"]'
  ) as HTMLButtonElement;
  down.click(); // detailFor defaults to 'down' -- opens the panel
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
  ).to.be.true;

  // Host locks the whole control down mid-interaction, panel still open.
  el.disabled = true;
  await el.updateComplete;

  const textarea = el.shadowRoot!.querySelector(
    '[part="comment"]'
  ) as HTMLTextAreaElement;
  const submit = el.shadowRoot!.querySelector(
    '[part="submit-button"]'
  ) as HTMLButtonElement;
  expect(textarea.disabled).to.be.true;
  expect(submit.disabled).to.be.true;
});

it("keeps the collapsed detail panel out of focus and the accessibility tree with no visible chrome", async () => {
  const el = (await fixture(
    html`<lr-message-feedback
      .detail=${{ reasons, commentable: true }}
    ></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.inert).to.be.true;
  expect(panel.getAttribute("aria-hidden")).to.equal("true");
  expect(panel.getBoundingClientRect().height).to.equal(0);
  expect(getComputedStyle(panel).borderTopWidth).to.equal("0px");
});

it("contains a long unbroken localized submit label inside a 319px panel", async () => {
  const el = (await fixture(html`
    <lr-message-feedback
      style="inline-size:319px;--lr-transition-base:0ms;"
      .detail=${{ commentable: true }}
      .strings=${{ feedbackSubmit: "Persist".repeat(600) }}
    ></lr-message-feedback>
  `)) as LyraMessageFeedback;
  (
    el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement
  ).click();
  await el.updateComplete;

  const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;
  const submit = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="submit-button"]'
  )!;
  const panelRect = panel.getBoundingClientRect();
  const submitRect = submit.getBoundingClientRect();
  expect(submitRect.left).to.be.at.least(panelRect.left);
  expect(submitRect.right).to.be.at.most(panelRect.right);
  expect(submitRect.width).to.be.at.most(panelRect.width);
});

it("host click activates the current thumb and is inert while disabled", async () => {
  const el = (await fixture(
    html`<lr-message-feedback></lr-message-feedback>`
  )) as LyraMessageFeedback;
  el.click();
  await el.updateComplete;
  expect(el.rating).to.equal("up");

  el.rating = "down";
  await el.updateComplete;
  el.click();
  await el.updateComplete;
  expect(el.rating).to.equal(null);

  el.disabled = true;
  await el.updateComplete;
  el.click();
  expect(el.rating).to.equal(null);
});

it("disables reason chips and ignores their events while the whole control is disabled", async () => {
  const el = (await fixture(
    html`<lr-message-feedback
      rating="down"
      .detail=${{ reasons }}
      disabled
    ></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const chip = el.shadowRoot!.querySelector("lr-chip") as LyraChip;
  expect(chip.disabled).to.be.true;
  expect(
    chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!
      .disabled
  ).to.be.true;
  chip.dispatchEvent(
    new CustomEvent("lr-chip-select", { bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(chip.selected).to.be.false;
});

it("stops the internal lr-chip-select event from leaking past the host in the reason-chip handler", async () => {
  const el = (await fixture(
    html`<lr-message-feedback .detail=${{ reasons }}></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const down = el.shadowRoot!.querySelector(
    '[part="down-button"]'
  ) as HTMLButtonElement;
  down.click();
  await el.updateComplete;

  let leaked = false;
  el.addEventListener("lr-chip-select", () => (leaked = true));
  const chip = el.shadowRoot!.querySelector(
    '[part="reasons"] lr-chip'
  ) as HTMLElement;
  chip.dispatchEvent(
    new CustomEvent("lr-chip-select", {
      detail: { selected: true },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(leaked).to.be.false;
});

it("lets a consumer comment-part hover override win in rendered computed style", async () => {
  const wrapper = (await fixture(html`
    <div class="comment-hover-case">
      <style>
        .comment-hover-case lr-message-feedback::part(comment):hover {
          background-color: rgb(1, 2, 3);
        }
      </style>
      <lr-message-feedback
        style="--lr-transition-fast: 0s"
        .detail=${{ commentable: true }}
      ></lr-message-feedback>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector(
    "lr-message-feedback"
  ) as LyraMessageFeedback;
  (
    el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement
  ).click();
  await el.updateComplete;
  const comment = el.shadowRoot!.querySelector(
    '[part="comment"]'
  ) as HTMLTextAreaElement;

  try {
    await hoverCentre(el, comment);
    await waitUntil(
      () => getComputedStyle(comment).backgroundColor === "rgb(1, 2, 3)"
    );
    expect(getComputedStyle(comment).backgroundColor).to.equal("rgb(1, 2, 3)");
  } finally {
    await resetMouse();
  }
});

describe("comment textarea blur/focus bubbling", () => {
  it("re-dispatches a bubbling, composed focus event when the comment textarea focuses", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    (
      el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector(
      '[part="comment"]'
    ) as HTMLTextAreaElement;

    const eventPromise = oneEvent(el, "focus");
    textarea.focus();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it("re-dispatches a bubbling, composed blur event when the comment textarea blurs", async () => {
    const el = (await fixture(
      html`<lr-message-feedback
        .detail=${{ commentable: true }}
      ></lr-message-feedback>`
    )) as LyraMessageFeedback;
    (
      el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector(
      '[part="comment"]'
    ) as HTMLTextAreaElement;
    textarea.focus();

    const eventPromise = oneEvent(el, "blur");
    textarea.blur();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe("thumb-button hover specificity", () => {
  it("lets a consumer thumb-part hover override win in rendered computed style", async () => {
    const wrapper = (await fixture(html`
      <div class="thumb-hover-case">
        <style>
          .thumb-hover-case lr-message-feedback::part(up-button):hover {
            background-color: rgb(4, 5, 6);
          }
        </style>
        <lr-message-feedback
          style="--lr-transition-fast: 0s"
        ></lr-message-feedback>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector(
      "lr-message-feedback"
    ) as LyraMessageFeedback;
    const up = el.shadowRoot!.querySelector(
      '[part="up-button"]'
    ) as HTMLButtonElement;

    try {
      await hoverCentre(el, up);
      await waitUntil(
        () => getComputedStyle(up).backgroundColor === "rgb(4, 5, 6)"
      );
      expect(getComputedStyle(up).backgroundColor).to.equal("rgb(4, 5, 6)");
    } finally {
      await resetMouse();
    }
  });
});

it("never conveys rating by color alone -- aria-pressed is present for both thumbs regardless of state", async () => {
  const el = (await fixture(
    html`<lr-message-feedback rating="up"></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const up = el.shadowRoot!.querySelector('[part="up-button"]')!;
  const down = el.shadowRoot!.querySelector('[part="down-button"]')!;
  expect(up.getAttribute("aria-pressed")).to.equal("true");
  expect(down.getAttribute("aria-pressed")).to.equal("false");
});

it("focus() delegates to the thumb matching the current rating", async () => {
  const el = (await fixture(
    html`<lr-message-feedback rating="down"></lr-message-feedback>`
  )) as LyraMessageFeedback;
  el.focus();
  expect(
    el.shadowRoot!.activeElement ===
      el.shadowRoot!.querySelector('[part="down-button"]')
  ).to.equal(true);
});

it("gives the up/down thumb buttons the shared minimum hit area", async () => {
  const el = (await fixture(
    html`<lr-message-feedback></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const up = el.shadowRoot!.querySelector('[part="up-button"]') as HTMLElement;
  const down = el.shadowRoot!.querySelector(
    '[part="down-button"]'
  ) as HTMLElement;

  expect(getComputedStyle(up).minInlineSize).to.equal("40px");
  expect(getComputedStyle(up).minBlockSize).to.equal("40px");
  expect(getComputedStyle(down).minInlineSize).to.equal("40px");
  expect(getComputedStyle(down).minBlockSize).to.equal("40px");
});

/** Resolve a declaration value (var()s, color-mix() and all) for `property` inside the component's
 *  shadow scope, returning the browser's computed value for `readProperty`. Rendering it rather than
 *  reading the stylesheet is the point: a broken var() chain or an unregistered token computes to
 *  something else entirely, and only the browser can tell us which. */
function resolveInShadow(
  el: HTMLElement,
  property: string,
  value: string,
  readProperty = property
): string {
  const probe = document.createElement("span");
  probe.style.setProperty(property, value);
  el.shadowRoot!.appendChild(probe);
  const computed = getComputedStyle(probe).getPropertyValue(readProperty);
  probe.remove();
  return computed;
}

/** The computed background `selector`'s own rule paints, resolved in the component's shadow scope. */
function renderedRuleBackground(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = "";
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector)
      ) {
        const value =
          rule.style.getPropertyValue("background") ||
          rule.style.getPropertyValue("background-color");
        if (value) declared = value;
      }
    }
  }
  return resolveInShadow(el, "background", declared, "background-color");
}

/** The computed filter `selector`'s own rule applies, resolved the same way. `none` means none. */
function renderedRuleFilter(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = "";
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.filter
      ) {
        declared = rule.style.filter;
      }
    }
  }
  return resolveInShadow(el, "filter", declared);
}

it("escalates the submit button from resting to hover to pressed with the shared colour-mix tokens", async () => {
  const el = (await fixture(
    html`<lr-message-feedback
      rating="down"
      .detail=${{ reasons, commentable: true }}
    ></lr-message-feedback>`
  )) as LyraMessageFeedback;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('[part="submit-button"]').length
  ).to.equal(1);

  const resting = resolveInShadow(
    el,
    "background",
    "var(--lr-color-brand)",
    "background-color"
  );
  const hovered = renderedRuleBackground(
    el,
    ":where([part='submit-button']):hover:where(:not(:disabled))"
  );
  const pressed = renderedRuleBackground(
    el,
    ":where([part='submit-button']):active:where(:not(:disabled))"
  );

  // Each step actually moves. The middle assertion is the one that matters most: an :active rule
  // byte-identical to its :hover rule is the same "no pressed state" defect wearing a costume.
  expect(hovered).to.not.equal(resting);
  expect(pressed).to.not.equal(hovered);
  expect(pressed).to.not.equal(resting);

  // ...and each step is exactly the shared token's mix of the resting brand fill, so hover is the
  // 12% step and pressed the 22% one -- provably a stronger press, and both retintable at once.
  expect(hovered).to.equal(
    resolveInShadow(
      el,
      "background",
      "color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-hover))",
      "background-color"
    )
  );
  expect(pressed).to.equal(
    resolveInShadow(
      el,
      "background",
      "color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))",
      "background-color"
    )
  );

  // No filter in either state: brightness() applies to the subtree, so it would dim the label along
  // with the fill -- and does nothing at all to a pure white or pure black brand colour.
  expect(renderedRuleFilter(el, "[part='submit-button']:hover")).to.equal(
    "none"
  );
  expect(renderedRuleFilter(el, "[part='submit-button']:active")).to.equal(
    "none"
  );
});

it("is accessible in every configuration", async () => {
  const plain = (await fixture(
    html`<lr-message-feedback></lr-message-feedback>`
  )) as LyraMessageFeedback;
  await expect(plain).to.be.accessible();

  const withPanel = (await fixture(
    html`<lr-message-feedback
      rating="down"
      .detail=${{ reasons, commentable: true }}
    ></lr-message-feedback>`
  )) as LyraMessageFeedback;
  await expect(withPanel).to.be.accessible();
});

it("is accessible with the detail panel genuinely open, not just present with unopened content", async () => {
  const el = (await fixture(
    html`<lr-message-feedback
      .detail=${{ reasons, commentable: true }}
    ></lr-message-feedback>`
  )) as LyraMessageFeedback;
  (
    el.shadowRoot!.querySelector('[part="down-button"]') as HTMLButtonElement
  ).click();
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute("data-open")
  ).to.be.true;
  await expect(el).to.be.accessible();
});

// `::part(up-button)[aria-pressed='true']` is invalid CSS -- Shadow Parts forbids an attribute
// selector after `::part()` -- so before these hatches the only way to retint a pressed thumb was
// to override the shared `--lr-color-success`/`--lr-color-danger`, which repainted every other
// surface reading them. The hatches are deliberately not declared on `:host`, so a value set on an
// ancestor reaches them; the override tests below set the property on a wrapper, not the element.
describe("pressed-state cssprops", () => {
  it("lets an ancestor retint the pressed thumbs-up without touching --lr-color-success", async () => {
    const host = (await fixture(html`
      <div
        style="--lr-message-feedback-up-active-color: rgb(1, 2, 3);
               --lr-message-feedback-up-active-bg: rgb(4, 5, 6);
               --lr-message-feedback-up-active-border: rgb(7, 8, 9);"
      >
        <lr-message-feedback rating="up"></lr-message-feedback>
      </div>
    `)) as HTMLElement;
    const el = host.querySelector("lr-message-feedback") as LyraMessageFeedback;
    await el.updateComplete;
    const up = el.shadowRoot!.querySelector(
      '[part="up-button"]'
    ) as HTMLElement;
    expect(up.getAttribute("aria-pressed")).to.equal("true");
    expect(getComputedStyle(up).color).to.equal("rgb(1, 2, 3)");
    expect(getComputedStyle(up).backgroundColor).to.equal("rgb(4, 5, 6)");
    expect(getComputedStyle(up).borderTopColor).to.equal("rgb(7, 8, 9)");
  });

  it("lets an ancestor retint the pressed thumbs-down independently", async () => {
    const host = (await fixture(html`
      <div style="--lr-message-feedback-down-active-bg: rgb(10, 11, 12);">
        <lr-message-feedback rating="down"></lr-message-feedback>
      </div>
    `)) as HTMLElement;
    const el = host.querySelector("lr-message-feedback") as LyraMessageFeedback;
    await el.updateComplete;
    const down = el.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLElement;
    expect(getComputedStyle(down).backgroundColor).to.equal("rgb(10, 11, 12)");
  });

  it("renders byte-identically to the shared tokens when the hatches are unset", async () => {
    const el = (await fixture(
      html`<lr-message-feedback rating="up"></lr-message-feedback>`
    )) as LyraMessageFeedback;
    await el.updateComplete;
    const up = el.shadowRoot!.querySelector(
      '[part="up-button"]'
    ) as HTMLElement;
    // Resolve the tokens inside the shadow root -- they are declared on :host, so a light-DOM
    // probe would see none of them.
    const probe = document.createElement("span");
    probe.style.cssText =
      "color: var(--lr-color-success); background: var(--lr-color-success-quiet);";
    el.shadowRoot!.appendChild(probe);
    const expected = getComputedStyle(probe);
    expect(getComputedStyle(up).color).to.equal(expected.color);
    expect(getComputedStyle(up).backgroundColor).to.equal(
      expected.backgroundColor
    );
    probe.remove();
  });
});

it("renders the comment field's placeholder in the live quiet-text token color", async () => {
  const el = (await fixture(html`
    <lr-message-feedback
      .detail=${{ commentable: true }}
      style="--lr-color-text-quiet: rgb(12, 34, 56)"
    ></lr-message-feedback>
  `)) as LyraMessageFeedback;
  await el.updateComplete;
  const textarea = el.shadowRoot!.querySelector(
    '[part="comment"]'
  ) as HTMLTextAreaElement;

  expect(getComputedStyle(textarea, "::placeholder").color).to.equal(
    "rgb(12, 34, 56)"
  );
});

it("blur() releases whichever vote button held focus", async () => {
  const el = (await fixture(
    html`<lr-message-feedback></lr-message-feedback>`
  )) as LyraMessageFeedback;
  await el.updateComplete;
  el.focus();
  expect(el.shadowRoot!.activeElement != null).to.equal(true);
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);

  el.rating = "down";
  await el.updateComplete;
  el.focus();
  expect(
    el.shadowRoot!.activeElement != null,
    "focus follows the current vote"
  ).to.equal(true);
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it("dims the panel submit button and comment field while pending, and stops both reacting to hover", async () => {
  const el = (await fixture(
    html`<lr-message-feedback
      .detail=${{ reasons, commentable: true }}
    ></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const down = el.shadowRoot!.querySelector(
    '[part="down-button"]'
  ) as HTMLButtonElement;
  down.click();
  await el.updateComplete;
  // A host that holds `lr-feedback-submit` open while it persists asynchronously leaves the panel visible
  // and interactive-looking for as long as the write takes -- that is the state under test.
  el.pending = true;
  await el.updateComplete;

  const submit = el.shadowRoot!.querySelector(
    '[part="submit-button"]'
  ) as HTMLButtonElement;
  const comment = el.shadowRoot!.querySelector(
    '[part="comment"]'
  ) as HTMLTextAreaElement;
  expect(
    submit.disabled,
    "the submit button is disabled while pending"
  ).to.equal(true);
  expect(
    comment.disabled,
    "the comment field is disabled while pending"
  ).to.equal(true);

  // The thumb buttons are disabled by the same state and already carry the shared treatment, so
  // they are the reference value: whatever --lr-opacity-disabled resolves to in this theme.
  const dimmed = getComputedStyle(down).opacity;
  expect(dimmed).to.not.equal("1");
  expect(
    getComputedStyle(submit).opacity,
    "submit button is dimmed like the thumbs"
  ).to.equal(dimmed);
  expect(
    getComputedStyle(comment).opacity,
    "comment field is dimmed like the thumbs"
  ).to.equal(dimmed);
  expect(getComputedStyle(submit).cursor).to.equal("not-allowed");
  expect(getComputedStyle(comment).cursor).to.equal("not-allowed");
});

/** Parks a real pointer over `target`'s centre, first waiting for it to actually be the element
 *  hit-tested there -- the detail panel opens through a 0fr/1fr grid transition behind
 *  `overflow: hidden`, so its controls have a non-zero box for several frames before they are
 *  reachable by a pointer. */
async function hoverCentre(
  host: HTMLElement,
  target: HTMLElement
): Promise<void> {
  const centre = (): [number, number] => {
    const box = target.getBoundingClientRect();
    return [
      Math.round(box.left + box.width / 2),
      Math.round(box.top + box.height / 2),
    ];
  };
  await waitUntil(() => {
    const box = target.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return false;
    const hit = host.shadowRoot!.elementFromPoint(...centre());
    return hit === target || (hit != null && target.contains(hit));
  }, "the target became hit-testable");
  await hoverUntilMatched(target, "the target never registered :hover");
}

it("stops the submit button reacting to a real hover the moment it becomes disabled", async function () {
  // The hover wait below can run up to 15000ms under a loaded CI runner; mocha's own suite-wide
  // 6000ms default (see web-test-runner.config.js) would otherwise cut the test off first.
  this.timeout(20000);
  const el = (await fixture(
    html`<lr-message-feedback
      .detail=${{ reasons, commentable: true }}
    ></lr-message-feedback>`
  )) as LyraMessageFeedback;
  const down = el.shadowRoot!.querySelector(
    '[part="down-button"]'
  ) as HTMLButtonElement;
  down.click();
  await el.updateComplete;

  const submit = el.shadowRoot!.querySelector(
    '[part="submit-button"]'
  ) as HTMLButtonElement;
  const resting = getComputedStyle(submit).backgroundColor;

  try {
    await hoverCentre(el, submit);
    // Polled, not asserted once: the synthesized mouse move's underlying CDP command completing
    // (what sendMouse()'s returned promise actually waits on) does not guarantee the browser has
    // gone on to process the resulting native pointer event and recompute :hover-driven styles,
    // especially under a loaded CI runner -- the same class of flake already hardened for
    // av-player.test.ts's, image-viewer.test.ts's, and media-card.test.ts's equivalent waits.
    await waitUntil(
      () => getComputedStyle(submit).backgroundColor !== resting,
      "the pointer really is over the enabled submit button",
      { timeout: 15000 }
    );

    // The pointer never moves; only `pending` flips. :hover keeps matching a disabled control, so
    // the rule's own :not(:disabled) gate is the only thing that can take the hover fill back off.
    el.pending = true;
    await el.updateComplete;
    expect(getComputedStyle(submit).backgroundColor).to.equal(resting);
  } finally {
    await resetMouse();
  }
});
