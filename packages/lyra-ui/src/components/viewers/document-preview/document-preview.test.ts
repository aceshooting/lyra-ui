import { fixture, expect, html, oneEvent, aTimeout } from "@open-wc/testing";
import "./document-preview.js";
import type { LyraDocumentPreview } from "./document-preview.js";
import { styles } from "./document-preview.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from "../../../internal/announcer.js";

const IMAGE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/** Stubs `window.fetch` for the duration of one test, restoring the original
 *  afterward. `@sinonjs/fake-timers` is unavailable in this test environment
 *  (see `<lr-stream-status>`'s test file), but this needs no timers at
 *  all -- a plain function swap is enough to control a real fetch() call. */
function stubFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response>
): () => void {
  const original = window.fetch;
  window.fetch = ((url: string, init?: RequestInit) =>
    impl(url, init)) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

function textResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Not Found",
    text: () => Promise.resolve(body),
  } as Response;
}

describe("defaults", () => {
  it('defaults to status="idle" (reflected) with every optional prop unset', async () => {
    const el = (await fixture(
      html`<lr-document-preview></lr-document-preview>`
    )) as LyraDocumentPreview;
    expect(el.status).to.equal("idle");
    expect(el.getAttribute("status")).to.equal("idle");
    expect(el.src).to.equal("");
    expect(el.mimeType).to.equal("");
    expect(el.filename).to.equal("");
    expect(el.progress).to.be.undefined;
    expect(el.errorText).to.equal("");
  });

  it("hides the header entirely when filename is unset", async () => {
    const el = (await fixture(
      html`<lr-document-preview></lr-document-preview>`
    )) as LyraDocumentPreview;
    const header = el.shadowRoot!.querySelector(
      '[part="header"]'
    ) as HTMLElement;
    expect(header.hidden).to.be.true;
  });

  it("shows the header and filename text when filename is set", async () => {
    const el = (await fixture(
      html`<lr-document-preview filename="report.txt"></lr-document-preview>`
    )) as LyraDocumentPreview;
    const header = el.shadowRoot!.querySelector(
      '[part="header"]'
    ) as HTMLElement;
    expect(header.hidden).to.be.false;
    expect(
      el.shadowRoot!.querySelector('[part="filename"]')!.textContent
    ).to.equal("report.txt");
  });

  it("reflects status changes onto the host attribute", async () => {
    const el = (await fixture(
      html`<lr-document-preview></lr-document-preview>`
    )) as LyraDocumentPreview;
    el.status = "ready";
    await el.updateComplete;
    expect(el.getAttribute("status")).to.equal("ready");
  });
});

it("validates maxHeight before assigning the base custom property", async () => {
  const el = await fixture<LyraDocumentPreview>(
    html`<lr-document-preview></lr-document-preview>`
  );
  el.maxHeight = "10rem;position:fixed";
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal("");
  expect(
    base.style.getPropertyValue("--lr-document-preview-max-height")
  ).to.equal("");
  el.maxHeight = "calc(10rem + 2px)";
  await el.updateComplete;
  expect(
    base.style.getPropertyValue("--lr-document-preview-max-height")
  ).to.equal("calc(10rem + 2px)");
});

it("filters invalid public region rectangles before rendering highlight geometry", async () => {
  const el = await fixture<LyraDocumentPreview>(
    html`<lr-document-preview></lr-document-preview>`
  );
  el.highlights = [
    {
      id: "unsafe",
      anchor: {
        kind: "region",
        rect: { x: Number.NaN, y: 0, width: 10, height: 10 },
      },
    },
    {
      id: "safe",
      anchor: { kind: "region", rect: { x: 10, y: 20, width: 30, height: 40 } },
    },
  ];
  const highlights = (
    el as unknown as { regionHighlights(): Array<{ id: string }> }
  ).regionHighlights();
  expect(highlights.map((highlight) => highlight.id)).to.deep.equal(["safe"]);
});

describe("text/* and application/json dispatch", () => {
  it("fetches src as text and renders it in a scrollable <pre>", async () => {
    const unstub = stubFetch(() =>
      Promise.resolve(textResponse("line one\nline two"))
    );
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      const pre = el.shadowRoot!.querySelector(
        '[part="body"] pre'
      ) as HTMLElement;
      expect(pre != null).to.equal(true);
      expect(pre.textContent).to.equal("line one\nline two");
    } finally {
      unstub();
    }
  });

  it("treats application/json the same as a text/* prefix", async () => {
    const unstub = stubFetch(() => Promise.resolve(textResponse('{"a":1}')));
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.json"
          mime-type="application/json"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="body"] pre')!.textContent
      ).to.equal('{"a":1}');
    } finally {
      unstub();
    }
  });

  it("shows the indeterminate spinner while the fetch is in flight", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const unstub = stubFetch(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      const spinner = el.shadowRoot!.querySelector(
        '[part="spinner"]'
      ) as HTMLElement;
      expect(spinner != null).to.equal(true);
      expect(spinner.getAttribute("role")).to.equal(null);
      expect(spinner.querySelector(".sr-only")!.textContent).to.equal(
        "Loading document…"
      );
      resolveFetch(textResponse("done"));
      await aTimeout(20);
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="body"] pre')!.textContent
      ).to.equal("done");
    } finally {
      unstub();
    }
  });

  it('renders [part="error"] and fires lr-render-error on a non-ok response', async () => {
    // The element mounts first (with fetch still un-stubbed/inert), then the
    // listener is registered *before* the src assignment that synchronously
    // triggers willUpdate -> fetchText() -- registering oneEvent only after
    // an already-connected-with-src fixture resolves would race the fetch's
    // own microtask chain (a stubbed fetch() can resolve in under a tick).
    const el = (await fixture(
      html`<lr-document-preview mime-type="text/plain"></lr-document-preview>`
    )) as LyraDocumentPreview;
    const unstub = stubFetch(() =>
      Promise.resolve(textResponse("", false, 404))
    );
    try {
      const eventPromise = oneEvent(el, "lr-render-error");
      el.src = "https://example.test/missing.txt";
      const ev = await eventPromise;
      expect(ev.detail.error).to.exist;
      await el.updateComplete;
      const error = el.shadowRoot!.querySelector(
        '[part="error"]'
      ) as HTMLElement;
      expect(error != null).to.equal(true);
      expect(error.getAttribute("role")).to.equal(null);
      expect(error.textContent).to.equal("Failed to load document.");
      // A fetch failure is this component's own rendering concern, not the
      // host-owned status prop -- it stays whatever the host set it to.
      expect(el.status).to.equal("idle");
    } finally {
      unstub();
    }
  });

  it("refetches when src changes", async () => {
    const urls: string[] = [];
    const unstub = stubFetch((url) => {
      urls.push(url);
      return Promise.resolve(textResponse(`content for ${url}`));
    });
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      el.src = "https://example.test/b.txt";
      await aTimeout(20);
      await el.updateComplete;
      expect(
        el.shadowRoot!.querySelector('[part="body"] pre')!.textContent
      ).to.equal("content for https://example.test/b.txt");
      expect(urls).to.deep.equal([
        "https://example.test/a.txt",
        "https://example.test/b.txt",
      ]);
    } finally {
      unstub();
    }
  });

  it("aborts the stale in-flight fetch when src changes", async () => {
    let firstSignal: AbortSignal | undefined;
    const unstub = stubFetch((url, init) => {
      if (url.endsWith("/a.txt")) {
        firstSignal = init?.signal ?? undefined;
        return new Promise(() => {
          /* superseded request intentionally stays pending */
        });
      }
      return Promise.resolve(textResponse("fresh content"));
    });
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      expect(firstSignal).to.exist;
      expect(firstSignal!.aborted).to.be.false;

      el.src = "https://example.test/b.txt";
      await el.updateComplete;
      expect(firstSignal!.aborted).to.be.true;
      await aTimeout(20);
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector("pre")?.textContent).to.equal(
        "fresh content"
      );
    } finally {
      unstub();
    }
  });

  it("aborts the in-flight fetch on disconnect, via the shared LyraElement load-cancellation helper", async () => {
    let signal: AbortSignal | undefined;
    const unstub = stubFetch((_url, init) => {
      signal = init?.signal ?? undefined;
      return new Promise(() => {
        /* never resolves -- disconnect should abort it, not settle it */
      });
    });
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      expect(signal).to.exist;
      expect(signal!.aborted).to.be.false;
      el.remove();
      expect(signal!.aborted).to.be.true;
    } finally {
      unstub();
    }
  });

  it("skips the fetch and renders an empty-state message when src is absent", async () => {
    const unstub = stubFetch(() =>
      Promise.reject(new Error("should not be called"))
    );
    try {
      const el = (await fixture(
        html`<lr-document-preview mime-type="text/plain"></lr-document-preview>`
      )) as LyraDocumentPreview;
      await aTimeout(10);
      expect(el.shadowRoot!.querySelector('[part="spinner"]') == null).to.be
        .true;
      expect(el.shadowRoot!.querySelector('[part="body"] pre') == null).to.be
        .true;
      const emptyNote = el.shadowRoot!.querySelector(
        '[part="body"] .empty-note'
      );
      expect(emptyNote != null).to.equal(true);
      expect(emptyNote!.textContent).to.equal("No document to display.");
    } finally {
      unstub();
    }
  });

  it("refetches once status leaves converting/error and a text src was already set but never fetched", async () => {
    let callCount = 0;
    const urls: string[] = [];
    const unstub = stubFetch((url) => {
      callCount++;
      urls.push(url);
      return Promise.resolve(textResponse("recovered content"));
    });
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
          status="converting"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      expect(callCount).to.equal(0);

      el.status = "ready";
      await aTimeout(20);
      await el.updateComplete;

      expect(callCount).to.equal(1);
      expect(urls).to.deep.equal(["https://example.test/a.txt"]);
      expect(
        el.shadowRoot!.querySelector('[part="body"] pre')!.textContent
      ).to.equal("recovered content");
    } finally {
      unstub();
    }
  });

  it("never fetches a URL whose normalized scheme is unsafe", async () => {
    let called = false;
    const unstub = stubFetch(() => {
      called = true;
      return Promise.resolve(textResponse("should not load"));
    });
    try {
      const el = (await fixture(html`
        <lr-document-preview
          .src=${"java\tscript:alert(1)"}
          mime-type="text/plain"
          filename="payload.txt"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      expect(called).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="error"]') !== null).to.be
        .true;
    } finally {
      unstub();
    }
  });

  it("emits exactly one render error when a text source URL is rejected", async () => {
    const el = (await fixture(html`
      <lr-document-preview mime-type="text/plain"></lr-document-preview>
    `)) as LyraDocumentPreview;
    let count = 0;
    el.addEventListener("lr-render-error", () => {
      count++;
    });
    const eventPromise = oneEvent(el, "lr-render-error");
    el.src = "javascript:alert(1)";
    await eventPromise;
    await el.updateComplete;
    await aTimeout(0);
    expect(count).to.equal(1);
  });

  it("refetches the same text source after a disconnect/reconnect", async () => {
    let fetchCount = 0;
    const unstub = stubFetch(() => {
      fetchCount++;
      return Promise.resolve(textResponse(`load ${fetchCount}`));
    });
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      const parent = el.parentElement!;
      el.remove();
      parent.append(el);
      await aTimeout(20);
      expect(fetchCount).to.equal(2);
      expect(el.shadowRoot!.querySelector("pre")!.textContent).to.equal(
        "load 2"
      );
    } finally {
      unstub();
    }
  });

  it("keeps data:text URLs available for safe inline text previews", async () => {
    const urls: string[] = [];
    const unstub = stubFetch((url) => {
      urls.push(url);
      return Promise.resolve(textResponse("inline data"));
    });
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="data:text/plain,inline%20data"
          mime-type="text/plain"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      expect(urls).to.deep.equal(["data:text/plain,inline%20data"]);
      expect(el.shadowRoot!.querySelector("pre")?.textContent).to.equal(
        "inline data"
      );
    } finally {
      unstub();
    }
  });

  it('does not fetch while status="converting", even with a text src already set', async () => {
    let called = false;
    const unstub = stubFetch(() => {
      called = true;
      return Promise.resolve(textResponse("x"));
    });
    try {
      await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
          status="converting"
        ></lr-document-preview>
      `);
      await aTimeout(20);
      expect(called).to.be.false;
    } finally {
      unstub();
    }
  });
});

describe("image/* dispatch", () => {
  it("renders a contained <img> with src and a sensible alt", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/photo.png"
        mime-type="image/png"
        filename="photo.png"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const img = el.shadowRoot!.querySelector(
      '[part="body"] img'
    ) as HTMLImageElement;
    expect(img != null).to.equal(true);
    expect(img.getAttribute("src")).to.equal("https://example.test/photo.png");
    expect(img.getAttribute("alt")).to.equal("photo.png");
  });

  it("never calls fetch for an image", async () => {
    let called = false;
    const unstub = stubFetch(() => {
      called = true;
      return Promise.resolve(textResponse("x"));
    });
    try {
      await fixture(html`
        <lr-document-preview
          src="https://example.test/photo.png"
          mime-type="image/png"
        ></lr-document-preview>
      `);
      await aTimeout(20);
      expect(called).to.be.false;
    } finally {
      unstub();
    }
  });

  it("never assigns an unsafe normalized URL to an image src", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        .src=${"java\tscript:alert(1)"}
        mime-type="image/png"
        filename="payload.png"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    expect(el.shadowRoot!.querySelector('[part="body"] img') === null).to.be
      .true;
    expect(el.shadowRoot!.querySelector('[part="download-link"]') === null).to
      .be.true;
    expect(
      el.shadowRoot!.querySelector(".fallback-text")?.textContent
    ).to.contain("payload.png");
  });

  it("keeps data:image URLs available for inline image previews", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        .src=${IMAGE_DATA_URI}
        mime-type="image/png"
        filename="pixel.png"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    expect(el.shadowRoot!.querySelector("img")?.getAttribute("src")).to.equal(
      IMAGE_DATA_URI
    );
  });

  it("lets an explicit alt override the filename-derived image description", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/chart.png"
        mime-type="image/png"
        filename="chart.png"
        alt="Revenue increased throughout the quarter"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    expect(el.shadowRoot!.querySelector("img")?.getAttribute("alt")).to.equal(
      "Revenue increased throughout the quarter"
    );
  });

  it("preserves an explicit empty alt for a decorative image preview", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/decoration.png"
        mime-type="image/png"
        filename="decoration.png"
        alt=""
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    expect(el.shadowRoot!.querySelector("img")?.getAttribute("alt")).to.equal(
      ""
    );
  });
});

describe("generic-download fallback", () => {
  it("lets a composing shell suppress the duplicate download action through the public property", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.com/report.pdf"
        filename="report.pdf"
        mime-type="application/pdf"
        .suppressDownload=${true}
      ></lr-document-preview>
    `)) as LyraDocumentPreview;

    expect(el.suppressDownload).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="download-link"]') === null).to
      .be.true;

    el.suppressDownload = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="download-link"]') !== null).to
      .be.true;
  });

  it("renders a file glyph, message, and download link for an unrecognized mime-type", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/report.pdf"
        mime-type="application/pdf"
        filename="report.pdf"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const link = el.shadowRoot!.querySelector(
      '[part="download-link"]'
    ) as HTMLAnchorElement;
    expect(link != null).to.equal(true);
    expect(link.getAttribute("href")).to.equal(
      "https://example.test/report.pdf"
    );
    expect(link.getAttribute("download")).to.equal("report.pdf");
    expect(
      el.shadowRoot!.querySelector(".fallback-text")!.textContent
    ).to.contain("report.pdf");
  });

  it("also falls back for an empty/unset mime-type", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        src="https://example.test/x"
        filename="x"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    expect(el.shadowRoot!.querySelector('[part="download-link"]')).to.exist;
  });

  it("omits the download link entirely when src is unset", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        mime-type="application/pdf"
        filename="report.pdf"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    expect(el.shadowRoot!.querySelector('[part="download-link"]') == null).to.be
      .true;
  });

  it("fails closed when the src attribute is removed at runtime", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/report.pdf"
        mime-type="application/pdf"
        filename="report.pdf"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    el.removeAttribute("src");
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="download-link"]') === null).to
      .be.true;
  });

  it("omits the download link for unsafe or active-document URL schemes", async () => {
    for (const src of [
      "javascript:alert(1)",
      "java\tscript:alert(1)",
      " \rJaVa\nScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "data:image/svg+xml,<svg onload=alert(1)></svg>",
      "vbscript:msgbox(1)",
    ]) {
      const el = (await fixture(html`
        <lr-document-preview
          .src=${src}
          mime-type="application/pdf"
          filename="payload.pdf"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      expect(
        el.shadowRoot!.querySelector('[part="download-link"]') === null,
        src
      ).to.be.true;
      expect(
        el.shadowRoot!.querySelector(".fallback-text")?.textContent,
        src
      ).to.contain("payload.pdf");
    }
  });

  it("fires lr-download with { src, filename } when the link is activated", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/report.pdf"
        mime-type="application/pdf"
        filename="report.pdf"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const link = el.shadowRoot!.querySelector(
      '[part="download-link"]'
    ) as HTMLAnchorElement;
    // Prevent the actual navigation/download inside the test runner while
    // still exercising the real click -> handler -> emit path.
    link.addEventListener("click", (e) => e.preventDefault());
    setTimeout(() => link.click());
    const ev = await oneEvent(el, "lr-download");
    expect(ev.detail).to.deep.equal({
      src: "https://example.test/report.pdf",
      filename: "report.pdf",
    });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe("unsupported slot escape hatch", () => {
  it("renders slotted content instead of the download fallback for an unsupported mime-type", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/report.pdf"
        mime-type="application/pdf"
      >
        <div slot="unsupported" id="custom-viewer">Custom PDF viewer</div>
      </lr-document-preview>
    `)) as LyraDocumentPreview;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="download-link"]') == null).to.be
      .true;
    const slot = el.shadowRoot!.querySelector(
      'slot[name="unsupported"]'
    ) as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned).to.have.lengthOf(1);
    expect(assigned[0].id).to.equal("custom-viewer");
  });

  it("falls back to the download link once the unsupported slot is emptied", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/report.pdf"
        mime-type="application/pdf"
      >
        <div slot="unsupported" id="custom-viewer">Custom PDF viewer</div>
      </lr-document-preview>
    `)) as LyraDocumentPreview;
    await el.updateComplete;
    el.querySelector("#custom-viewer")!.remove();
    // slotchange is async relative to the mutation.
    await aTimeout(20);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="download-link"]')).to.exist;
  });
});

describe('status="converting"', () => {
  it("shows the indeterminate spinner regardless of mime-type/src when no progress is given", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        status="converting"
        src="https://example.test/a.pdf"
        mime-type="application/pdf"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const spinner = el.shadowRoot!.querySelector(
      '[part="spinner"]'
    ) as HTMLElement;
    expect(spinner != null).to.equal(true);
    expect(spinner.getAttribute("role")).to.equal(null);
    expect(spinner.querySelector(".sr-only")!.textContent).to.equal(
      "Converting document…"
    );
    expect(el.shadowRoot!.querySelector('[part="download-link"]') == null).to.be
      .true;
  });

  it('shows a determinate role="progressbar" once progress is set', async () => {
    const el = (await fixture(html`
      <lr-document-preview
        status="converting"
        progress="42"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const spinner = el.shadowRoot!.querySelector(
      '[part="spinner"]'
    ) as HTMLElement;
    expect(spinner.getAttribute("role")).to.equal("progressbar");
    expect(spinner.getAttribute("aria-valuenow")).to.equal("42");
    expect(spinner.getAttribute("aria-valuemin")).to.equal("0");
    expect(spinner.getAttribute("aria-valuemax")).to.equal("100");
    expect(spinner.querySelector(".spinner-text")!.textContent).to.equal("42%");
  });

  it("keeps determinate progress self-describing and announces only a later indeterminate transition", async () => {
    const el = await fixture<LyraDocumentPreview>(html`
      <lr-document-preview status="ready"></lr-document-preview>
    `);
    const selector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`;

    el.status = "converting";
    el.progress = 42;
    await el.updateComplete;
    expect(document.querySelector(selector)?.childElementCount).to.equal(0);

    el.progress = undefined;
    await el.updateComplete;
    expect(document.querySelector(selector)?.textContent).to.equal(
      "Converting document…"
    );
    expect(document.querySelector(selector)?.childElementCount).to.equal(1);
  });

  it("keeps the determinate ring mask opaque when a consumer themes the shadow color translucent", async () => {
    // The regression this guards: the mask punching the hole out of the progress ring used
    // var(--lr-color-shadow) for its opaque stop, a documented consumer theming input. A mask
    // reads alpha only, so a translucent shadow theme -- entirely reasonable for a shadow color --
    // faded the entire ring rather than just cutting its centre out.
    const el = (await fixture(html`
      <lr-document-preview
        status="converting"
        progress="42"
        style="--lr-theme-color-shadow: rgb(0 0 0 / 0.25)"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const ring = el.shadowRoot!.querySelector(
      ".ring.determinate"
    ) as HTMLElement;
    const computed = getComputedStyle(ring);
    const mask =
      computed.getPropertyValue("mask-image") ||
      computed.getPropertyValue("-webkit-mask-image");
    expect(mask).to.contain("radial-gradient");
    // The transparent stop resolves to rgba(0, 0, 0, 0); a leaked 0.25 would be the themed
    // shadow alpha reaching the opaque stop.
    expect(mask).to.not.contain("0.25");
  });

  it("clamps an out-of-range progress value into [0, 100]", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        status="converting"
        progress="150"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const spinner = el.shadowRoot!.querySelector(
      '[part="spinner"]'
    ) as HTMLElement;
    expect(spinner.getAttribute("aria-valuenow")).to.equal("100");
  });

  it("clamps a negative progress value into [0, 100]", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        status="converting"
        progress="-20"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const spinner = el.shadowRoot!.querySelector(
      '[part="spinner"]'
    ) as HTMLElement;
    expect(spinner.getAttribute("aria-valuenow")).to.equal("0");
  });

  it("shows the indeterminate spinner (not a crash) when progress is set to an invalid value (NaN)", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        status="converting"
        progress="not-a-number"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    expect(Number.isNaN(el.progress)).to.be.true;
    const spinner = el.shadowRoot!.querySelector(
      '[part="spinner"]'
    ) as HTMLElement;
    expect(spinner.getAttribute("role")).to.equal(null);
  });
});

describe('status="error"', () => {
  it("renders errorText as ordinary visible text, regardless of mime-type", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        status="error"
        error-text="Conversion failed: unsupported source encoding."
        mime-type="text/plain"
        src="https://example.test/a.txt"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error != null).to.equal(true);
    expect(error.getAttribute("role")).to.equal(null);
    expect(error.textContent).to.equal(
      "Conversion failed: unsupported source encoding."
    );
    expect(el.shadowRoot!.querySelector("pre") == null).to.equal(true);
  });

  // 9.0.0 renamed `errorMessage`/`error-message` -> `errorText`/`error-text`, the spelling every
  // other component carrying caller-supplied failure copy already uses.
  it("exposes the failure copy only as errorText; the removed error-message spelling is inert", async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    let el: LyraDocumentPreview;
    try {
      el = (await fixture(html`
        <lr-document-preview
          status="error"
          error-message="Legacy failure"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
    } finally {
      console.warn = originalWarn;
    }
    expect("errorMessage" in el).to.equal(false);
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.textContent).to.equal("Something went wrong.");

    el.errorText = "Current failure";
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="error"]')?.textContent
    ).to.equal("Current failure");
  });

  it("suppresses a mounted error, then announces a later identical transition in light DOM", async () => {
    const el = await fixture<LyraDocumentPreview>(html`
      <lr-document-preview
        status="error"
        error-text="Conversion failed."
      ></lr-document-preview>
    `);
    const selector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`;
    const sink = document.querySelector(selector);
    expect(sink?.childElementCount).to.equal(0);

    el.status = "ready";
    await el.updateComplete;
    el.status = "error";
    await el.updateComplete;

    expect(document.querySelector(selector)?.textContent).to.equal(
      "Conversion failed."
    );
    expect(
      el.shadowRoot!.querySelectorAll(
        '[role="alert"], [role="status"], [aria-live]'
      ).length
    ).to.equal(0);
  });
});

describe("max-height", () => {
  it('sets the --lr-document-preview-max-height custom property on [part="base"] when given', async () => {
    const el = (await fixture(
      html`<lr-document-preview max-height="12rem"></lr-document-preview>`
    )) as LyraDocumentPreview;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(
      base.style.getPropertyValue("--lr-document-preview-max-height").trim()
    ).to.equal("12rem");
  });
});

describe("motion", () => {
  it("routes spinner timing through a documented custom property and stops it for reduced motion", async () => {
    const css = styles.cssText.replace(/\s+/g, " ");
    expect(css).to.include(
      "--_lr-document-preview-spin-duration: var(--lr-transition-ambient);"
    );
    expect(css).to.match(
      /animation:\s*lr-document-preview-spin\s+var\(\s*--lr-document-preview-spin-duration,\s*var\(--_lr-document-preview-spin-duration\)\s*\)\s+infinite;/
    );
    expect(css).to.include("@media (prefers-reduced-motion: reduce)");
    expect(css).to.include(".ring { animation: none !important; }");
  });

  it("spins from an inherited public duration, lets the host win, and stops under reduced motion", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-document-preview-spin-duration: 3s linear">
        <lr-document-preview status="converting"></lr-document-preview>
      </div>
    `);
    const el = wrapper.querySelector(
      "lr-document-preview"
    ) as LyraDocumentPreview;
    const ring = el.shadowRoot!.querySelector(".ring") as HTMLElement;
    let computed = getComputedStyle(ring);
    expect(computed.animationName).to.equal("lr-document-preview-spin");
    expect(computed.animationDuration).to.equal("3s");
    expect(computed.animationTimingFunction).to.equal("linear");

    el.style.setProperty("--lr-document-preview-spin-duration", "2s ease-in");
    computed = getComputedStyle(ring);
    expect(computed.animationDuration).to.equal("2s");
    expect(computed.animationTimingFunction).to.equal("ease-in");

    // Same technique as <lr-spinner>'s reduced-motion test: forcing
    // window.matchMedia has no effect on a real @media (prefers-reduced-motion)
    // rule already adopted by the shadow root, so the CSSOM media condition
    // itself is flipped to force the rule active, then restored.
    const reducedRule = el
      .shadowRoot!.adoptedStyleSheets.flatMap((sheet) => [...sheet.cssRules])
      .find(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText === "(prefers-reduced-motion: reduce)" &&
          [...rule.cssRules].some(
            (nested) =>
              nested instanceof CSSStyleRule &&
              nested.selectorText.includes("ring")
          )
      );
    expect(reducedRule?.conditionText).to.equal(
      "(prefers-reduced-motion: reduce)"
    );
    const originalCondition = reducedRule!.media.mediaText;
    try {
      reducedRule!.media.mediaText = "all";
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      expect(getComputedStyle(ring).animationName).to.equal("none");
    } finally {
      reducedRule!.media.mediaText = originalCondition;
    }
  });
});

describe("accessibility", () => {
  it("is accessible in the default (idle, empty) state", async () => {
    const el = await fixture(html`<lr-document-preview></lr-document-preview>`);
    await expect(el).to.be.accessible();
  });

  it("is accessible with a populated text preview", async () => {
    const unstub = stubFetch(() =>
      Promise.resolve(textResponse("hello world"))
    );
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
          filename="a.txt"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      await aTimeout(20);
      await el.updateComplete;
      await expect(el).to.be.accessible();
    } finally {
      unstub();
    }
  });

  it("is accessible in the converting state with progress", async () => {
    const el = await fixture(html`
      <lr-document-preview
        status="converting"
        progress="55"
        filename="deck.pptx"
      ></lr-document-preview>
    `);
    await expect(el).to.be.accessible();
  });

  it("is accessible in the error state", async () => {
    const el = await fixture(html`
      <lr-document-preview
        status="error"
        error-text="Conversion failed."
        filename="deck.pptx"
      ></lr-document-preview>
    `);
    await expect(el).to.be.accessible();
  });

  it("is accessible in the generic download fallback state", async () => {
    const el = await fixture(html`
      <lr-document-preview
        src="https://example.test/report.pdf"
        mime-type="application/pdf"
        filename="report.pdf"
      ></lr-document-preview>
    `);
    await expect(el).to.be.accessible();
  });
});

describe("localization", () => {
  it('defaults the image alt to "Document preview" when filename is unset', async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/photo.png"
        mime-type="image/png"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const img = el.shadowRoot!.querySelector(
      '[part="body"] img'
    ) as HTMLImageElement;
    expect(img.getAttribute("alt")).to.equal("Document preview");
  });

  it("localizes the image alt fallback via .strings", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        src="https://example.test/photo.png"
        mime-type="image/png"
        .strings=${{ documentPreviewAlt: "Aperçu du document" }}
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const img = el.shadowRoot!.querySelector(
      '[part="body"] img'
    ) as HTMLImageElement;
    expect(img.getAttribute("alt")).to.equal("Aperçu du document");
  });

  it('defaults the loading spinner label to "Loading document…"', async () => {
    const unstub = stubFetch(
      () =>
        new Promise(() => {
          /* never resolves -- keep the spinner up for the assertion */
        })
    );
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      const spinner = el.shadowRoot!.querySelector(
        '[part="spinner"]'
      ) as HTMLElement;
      expect(spinner.querySelector(".sr-only")!.textContent).to.equal(
        "Loading document…"
      );
    } finally {
      unstub();
    }
  });

  it("localizes the loading spinner label via .strings (loadingDocument)", async () => {
    const unstub = stubFetch(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );
    try {
      const el = (await fixture(html`
        <lr-document-preview
          src="https://example.test/a.txt"
          mime-type="text/plain"
          .strings=${{ loadingDocument: "Chargement du document…" }}
        ></lr-document-preview>
      `)) as LyraDocumentPreview;
      const spinner = el.shadowRoot!.querySelector(
        '[part="spinner"]'
      ) as HTMLElement;
      expect(spinner.querySelector(".sr-only")!.textContent).to.equal(
        "Chargement du document…"
      );
    } finally {
      unstub();
    }
  });

  it('defaults to "Document URL is not allowed." for an unsafe text src', async () => {
    const el = (await fixture(html`
      <lr-document-preview
        .src=${"java\tscript:alert(1)"}
        mime-type="text/plain"
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.textContent).to.equal("Document URL is not allowed.");
  });

  it("localizes the unsafe-URL error via .strings (documentPreviewUrlNotAllowed)", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        .src=${"java\tscript:alert(1)"}
        mime-type="text/plain"
        .strings=${{
          documentPreviewUrlNotAllowed:
            "L'URL du document n'est pas autorisée.",
        }}
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.textContent).to.equal(
      "L'URL du document n'est pas autorisée."
    );
  });

  it('defaults to "Failed to load document." when the fetch rejects with a non-Error value', async () => {
    const el = (await fixture(
      html`<lr-document-preview mime-type="text/plain"></lr-document-preview>`
    )) as LyraDocumentPreview;
    const unstub = stubFetch(() => Promise.reject("boom"));
    try {
      const eventPromise = oneEvent(el, "lr-render-error");
      el.src = "https://example.test/a.txt";
      await eventPromise;
      await el.updateComplete;
      const error = el.shadowRoot!.querySelector(
        '[part="error"]'
      ) as HTMLElement;
      expect(error.textContent).to.equal("Failed to load document.");
    } finally {
      unstub();
    }
  });

  it("localizes the non-Error fetch-failure message via .strings (documentPreviewFailedToLoad)", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        mime-type="text/plain"
        .strings=${{
          documentPreviewFailedToLoad: "Échec du chargement du document.",
        }}
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const unstub = stubFetch(() => Promise.reject("boom"));
    try {
      const eventPromise = oneEvent(el, "lr-render-error");
      el.src = "https://example.test/a.txt";
      await eventPromise;
      await el.updateComplete;
      const error = el.shadowRoot!.querySelector(
        '[part="error"]'
      ) as HTMLElement;
      expect(error.textContent).to.equal("Échec du chargement du document.");
    } finally {
      unstub();
    }
  });

  it('defaults status="error" with no error-text to "Something went wrong."', async () => {
    const el = (await fixture(
      html`<lr-document-preview status="error"></lr-document-preview>`
    )) as LyraDocumentPreview;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.textContent).to.equal("Something went wrong.");
  });

  it("localizes the generic error fallback via .strings (documentPreviewGenericError)", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        status="error"
        .strings=${{
          documentPreviewGenericError: "Une erreur s'est produite.",
        }}
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(error.textContent).to.equal("Une erreur s'est produite.");
  });
});

describe("zoomable (image format)", () => {
  it("does not wrap in lr-pan-zoom by default", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("lr-pan-zoom").length).to.equal(0);
  });

  it("wraps the image in lr-pan-zoom when zoomable is set", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        zoomable
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    await el.updateComplete;
    const frame = el.shadowRoot!.querySelector("lr-pan-zoom");
    expect(frame).to.exist;
    expect(frame!.querySelector("img") != null).to.equal(true);
  });

  it("does not expose the internal pan-zoom event", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        zoomable
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    const frame = el.shadowRoot!.querySelector("lr-pan-zoom")!;
    let leaked = 0;
    el.addEventListener("lr-zoom-change", () => leaked++);
    frame.dispatchEvent(
      new CustomEvent("lr-zoom-change", {
        detail: { zoom: 2 },
        bubbles: true,
        composed: true,
      })
    );
    expect(leaked).to.equal(0);
  });
});

describe("region highlights (image format)", () => {
  it("keeps a small visual border while exposing a separate minimum activation target", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        style="--lr-icon-button-size:44px"
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    el.highlights = [
      {
        id: "small",
        anchor: { kind: "region", rect: { x: 50, y: 50, width: 5, height: 5 } },
      },
    ];
    await el.updateComplete;
    const content = el.shadowRoot!.querySelector(
      ".zoom-content"
    ) as HTMLElement;
    content.style.width = "200px";
    content.style.height = "200px";
    const visual = el.shadowRoot!.querySelector(
      '[part="region-highlight"]'
    ) as HTMLElement;
    const target = el.shadowRoot!.querySelector(
      '[part="region-highlight-target"]'
    ) as HTMLElement;
    expect(target !== null).to.be.true;
    const visualBox = visual.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    expect(visualBox.width).to.be.lessThan(20);
    expect(visualBox.height).to.be.lessThan(20);
    expect(targetBox.width).to.be.at.least(44);
    expect(targetBox.height).to.be.at.least(44);
    expect(visualBox.width).to.be.lessThan(targetBox.width);
    expect(visualBox.height).to.be.lessThan(targetBox.height);
    const hit = el.shadowRoot!.elementFromPoint(
      targetBox.left + targetBox.width - 2,
      targetBox.top + targetBox.height / 2
    ) as HTMLElement | null;
    expect(hit?.dataset.highlightId).to.equal("small");
  });

  it("renders a focusable region-highlight and emits lr-highlight-activate", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    el.highlights = [
      {
        id: "h1",
        anchor: { kind: "region", rect: { x: 0, y: 0, width: 20, height: 20 } },
      },
    ];
    await el.updateComplete;
    const listener = oneEvent(el, "lr-highlight-activate");
    (
      el.shadowRoot!.querySelector(
        '[part="region-highlight-target"]'
      ) as HTMLElement
    ).click();
    const event = (await listener) as CustomEvent<{ highlightId: string }>;
    expect(event.detail).to.deep.equal({ highlightId: "h1" });
  });

  it("retains the first unique nonempty region-highlight id across paint, active state, and events", async () => {
    const el = await fixture<LyraDocumentPreview>(html`
      <lr-document-preview
        mime-type="image/png"
        src=${IMAGE_DATA_URI}
      ></lr-document-preview>
    `);
    el.highlights = [
      {
        id: "",
        label: "Empty",
        anchor: { kind: "region", rect: { x: 1, y: 1, width: 2, height: 2 } },
      },
      {
        id: " same ",
        label: "First",
        anchor: { kind: "region", rect: { x: 10, y: 10, width: 2, height: 2 } },
      },
      {
        id: "same",
        label: "Duplicate",
        anchor: { kind: "region", rect: { x: 20, y: 20, width: 2, height: 2 } },
      },
    ];
    el.activeHighlightId = "same";
    await el.updateComplete;

    const visuals = [
      ...el.shadowRoot!.querySelectorAll('[part="region-highlight"]'),
    ];
    expect(visuals).to.have.length(1);
    expect(visuals[0]!.getAttribute("data-id")).to.equal("same");
    expect(visuals[0]!.hasAttribute("data-active")).to.be.true;

    const action = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="region-highlight-target"]'
    )!;
    const activated = oneEvent(el, "lr-highlight-activate");
    action.click();
    expect((await activated).detail).to.deep.equal({ highlightId: "same" });
  });

  it("uses a non-overlapping action list when multiple minimum hit areas would be dense", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        mime-type="image/png"
        src=${IMAGE_DATA_URI}
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    el.highlights = [
      {
        id: "a",
        label: "First",
        anchor: { kind: "region", rect: { x: 50, y: 50, width: 1, height: 1 } },
      },
      {
        id: "b",
        label: "Second",
        anchor: { kind: "region", rect: { x: 51, y: 50, width: 1, height: 1 } },
      },
    ];
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll('[part="region-highlight-target"]').length
    ).to.equal(0);
    const actions = [
      ...el.shadowRoot!.querySelectorAll('[part="region-highlight-action"]'),
    ] as HTMLElement[];
    expect(actions.length).to.equal(2);
    const first = actions[0]!.getBoundingClientRect();
    const second = actions[1]!.getBoundingClientRect();
    expect(first.bottom).to.be.at.most(second.top);
    const eventPromise = oneEvent(el, "lr-highlight-activate");
    actions[1]!.click();
    expect((await eventPromise).detail).to.deep.equal({ highlightId: "b" });
  });

  it("gives unlabeled dense highlight actions distinct ordinal names", async () => {
    const el = await fixture<LyraDocumentPreview>(
      html`<lr-document-preview
        mime-type="image/png"
        src=${IMAGE_DATA_URI}
      ></lr-document-preview>`
    );
    el.highlights = [
      {
        id: "a",
        anchor: { kind: "region", rect: { x: 10, y: 10, width: 2, height: 2 } },
      },
      {
        id: "b",
        anchor: { kind: "region", rect: { x: 20, y: 20, width: 2, height: 2 } },
      },
    ];
    await el.updateComplete;
    const names = [
      ...el.shadowRoot!.querySelectorAll('[part="region-highlight-action"]'),
    ].map((action) => action.getAttribute("aria-label"));
    expect(names).to.deep.equal(["Highlight 1 of 2", "Highlight 2 of 2"]);
  });

  it('positions region highlights with physical left/top under dir="rtl" so they stay over the non-mirroring image', async () => {
    const el = (await fixture(
      html`<lr-document-preview
        dir="rtl"
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    el.highlights = [
      {
        id: "h1",
        anchor: {
          kind: "region",
          rect: { x: 10, y: 20, width: 30, height: 40 },
        },
      },
    ];
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector(
      '[part="region-highlight"]'
    ) as HTMLElement;
    expect(region.style.left).to.equal("10%");
    expect(region.style.top).to.equal("20%");
    expect(region.style.getPropertyValue("inset-inline-start")).to.equal("");
  });

  it("scrollToAnchor() by id scrolls the matching region, not just the first one, when several are rendered", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    el.highlights = [
      {
        id: "h1",
        anchor: { kind: "region", rect: { x: 0, y: 0, width: 10, height: 10 } },
      },
      {
        id: "h2",
        anchor: {
          kind: "region",
          page: 1,
          rect: { x: 50, y: 50, width: 10, height: 10 },
        },
      },
    ];
    await el.updateComplete;
    const regions = Array.from(
      el.shadowRoot!.querySelectorAll('[part="region-highlight"]')
    ) as HTMLElement[];
    const scrolled: string[] = [];
    for (const region of regions) {
      region.scrollIntoView = () => scrolled.push(region.dataset.id!);
    }
    const ok = await el.scrollToAnchor("h2");
    expect(ok).to.be.true;
    expect(scrolled).to.deep.equal(["h2"]);
  });

  it("matches an equal region anchor structurally and returns false for an unmatched anchor", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    el.highlights = [
      {
        id: "h1",
        anchor: { kind: "region", rect: { x: 0, y: 0, width: 10, height: 10 } },
      },
      {
        id: "h2",
        anchor: {
          kind: "region",
          page: 1,
          rect: { x: 50, y: 50, width: 10, height: 10 },
        },
      },
    ];
    await el.updateComplete;
    const regions = Array.from(
      el.shadowRoot!.querySelectorAll('[part="region-highlight"]')
    ) as HTMLElement[];
    const scrolled: string[] = [];
    for (const region of regions)
      region.scrollIntoView = () => scrolled.push(region.dataset.id!);

    expect(
      await el.scrollToAnchor({
        kind: "region",
        page: 1,
        rect: { x: 50, y: 50, width: 10, height: 10 },
      })
    ).to.be.true;
    expect(scrolled).to.deep.equal(["h2"]);
    scrolled.length = 0;
    expect(
      await el.scrollToAnchor({
        kind: "region",
        rect: { x: 90, y: 90, width: 5, height: 5 },
      })
    ).to.be.false;
    expect(scrolled).to.deep.equal([]);
    expect(
      await el.scrollToAnchor({
        kind: "region",
        page: 2,
        rect: { x: 50, y: 50, width: 10, height: 10 },
      })
    ).to.be.false;
    expect(scrolled).to.deep.equal([]);
  });

  it("maps each public highlight tone to its semantic border color", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    const tones = [
      "accent",
      "success",
      "warning",
      "danger",
      "neutral",
    ] as const;
    el.highlights = tones.map((tone, index) => ({
      id: tone,
      tone,
      anchor: {
        kind: "region",
        rect: { x: index * 10, y: 0, width: 5, height: 5 },
      },
    }));
    await el.updateComplete;
    const tokenByTone = {
      accent: "--lr-color-brand",
      success: "--lr-color-success",
      warning: "--lr-color-warning",
      danger: "--lr-color-danger",
      neutral: "--lr-color-neutral",
    };
    for (const tone of tones) {
      const region = el.shadowRoot!.querySelector(
        `[data-id="${tone}"]`
      ) as HTMLElement;
      const probe = document.createElement("span");
      probe.style.color = `var(${tokenByTone[tone]})`;
      el.shadowRoot!.append(probe);
      expect(getComputedStyle(region).borderTopColor).to.equal(
        getComputedStyle(probe).color
      );
      probe.remove();
    }
  });

  it("paints a rendered hover treatment on the clickable region target", async () => {
    const el = (await fixture(html`
      <lr-document-preview
        mime-type="image/png"
        src=${IMAGE_DATA_URI}
      ></lr-document-preview>
    `)) as LyraDocumentPreview;
    el.highlights = [
      {
        id: "h1",
        anchor: {
          kind: "region",
          rect: { x: 0, y: 0, width: 100, height: 100 },
        },
      },
    ];
    await el.updateComplete;
    const target = el.shadowRoot!.querySelector(
      '[part="region-highlight-target"]'
    ) as HTMLElement;
    const region = el.shadowRoot!.querySelector(
      '[part="region-highlight"]'
    ) as HTMLElement;
    const before = getComputedStyle(region).backgroundColor;
    const rect = target.getBoundingClientRect();
    try {
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      expect(getComputedStyle(region).backgroundColor).to.not.equal(before);
    } finally {
      await resetMouse();
    }
  });
});

describe("back-compat (image format)", () => {
  it("image rendering is unchanged with zoomable off and highlights empty", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("img") != null).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll("lr-pan-zoom").length).to.equal(0);
  });

  it("text and generic format dispatch are untouched", async () => {
    const el = (await fixture(
      html`<lr-document-preview
        mime-type="text/plain"
        src="https://example.test/notes.txt"
      ></lr-document-preview>`
    )) as LyraDocumentPreview;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("lr-pan-zoom").length).to.equal(0);
  });
});

describe("active-region cssprop escape hatch", () => {
  function resolvedInShadow(
    el: LyraDocumentPreview,
    declaration: string,
    property: string
  ): string {
    const probe = document.createElement("span");
    probe.setAttribute("style", declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function activeRegion(
    style = ""
  ): Promise<{ el: LyraDocumentPreview; region: HTMLElement }> {
    const wrapper = (await fixture(html`<div style=${style}>
      <lr-document-preview
        mime-type="image/png"
        src="https://example.test/photo.png"
      ></lr-document-preview>
    </div>`)) as HTMLElement;
    const el = wrapper.querySelector(
      "lr-document-preview"
    ) as LyraDocumentPreview;
    el.highlights = [
      {
        id: "h1",
        anchor: { kind: "region", rect: { x: 0, y: 0, width: 20, height: 20 } },
      },
    ];
    el.activeHighlightId = "h1";
    await el.updateComplete;
    const region = el.shadowRoot!.querySelector(
      '[part="region-highlight"][data-active]'
    ) as HTMLElement;
    return { el, region };
  }

  it("recolors the active region border from an ancestor via --lr-document-preview-active-border", async () => {
    const { region } = await activeRegion(
      "--lr-document-preview-active-border: rgb(0, 51, 102)"
    );
    expect(getComputedStyle(region).borderTopColor).to.equal("rgb(0, 51, 102)");
  });

  it("renders byte-identical to the warning-token fallback chain when unset", async () => {
    const { el, region } = await activeRegion();
    expect(getComputedStyle(region).borderTopColor).to.equal(
      resolvedInShadow(
        el,
        "border-top-color: var(--lr-color-warning, var(--lr-color-brand))",
        "border-top-color"
      )
    );
  });

  it("is accessible with the active-region prop themed", async () => {
    const { el } = await activeRegion(
      "--lr-document-preview-active-border: rgb(0, 51, 102)"
    );
    await expect(el).to.be.accessible();
  });
});
