import { expect, html, oneEvent } from '@open-wc/testing';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridColumn, DataGridCsvOptions, DataGridExportOptions } from './data-grid-types.js';
import { rowsAsDelimited } from './data-grid-processing.js';
import { type Person, columns, rows, dataGrid, sinkTexts, dataCells } from '../../../../test/data-grid.js';


it("routes the copy announcement into the shared light-DOM sink, leaving the shadow part a mirror", async () => {
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  let resolveWrite!: () => void;
  const write = new Promise<void>((resolve) => {
    resolveWrite = resolve;
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => write },
  });
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  expect(
    sinkTexts("polite"),
    "mounting must not announce a resting state"
  ).to.deep.equal([]);

  try {
    let emitted = false;
    element.addEventListener("lr-copy", () => {
      emitted = true;
    });
    const success = oneEvent(element, "lr-copy");
    element.copySelectedRows({ includeHeaders: false });
    await Promise.resolve();
    expect(emitted, "copy intent is not clipboard success").to.equal(false);
    expect(sinkTexts("polite")).to.deep.equal([]);

    resolveWrite();
    const event = (await success) as CustomEvent<{
      readonly ok: true;
      readonly text: string;
    }>;
    expect(Object.isFrozen(event.detail)).to.equal(true);
    expect(event.detail.ok).to.equal(true);
    await element.updateComplete;
    expect(sinkTexts("polite")).to.deep.equal(["Copied!"]);
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }

  const region = element.shadowRoot!.querySelector('[part="live-region"]')!;
  // The retained part is a styling/inspection mirror only -- a live region inside a shadow root is
  // not reliably announced, and leaving it live would double-announce where it *is* honored.
  expect(region.getAttribute("role")).to.equal(null);
  expect(region.getAttribute("aria-live")).to.equal(null);
  expect(region.getAttribute("aria-hidden")).to.equal("true");
  expect(region.textContent).to.equal("Copied!");
});

it("announces a second identical copy again instead of silently rewriting one text node", async () => {
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.resolve() },
  });
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  try {
    let success = oneEvent(element, "lr-copy");
    element.copySelectedRows({ includeHeaders: false });
    await success;
    success = oneEvent(element, "lr-copy");
    element.copySelectedRows({ includeHeaders: false });
    await success;
    await element.updateComplete;
    expect(
      sinkTexts("polite"),
      "an identical repeat must be a second addition so assistive tech reads it again"
    ).to.deep.equal(["Copied!", "Copied!"]);
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

it("honors exact CSV/copy/export options, compatibility aliases, and formula escaping", async () => {
  const exportColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name" },
    {
      field: "team",
      label: "Team",
      formatter: (value) => String(value).toLocaleUpperCase("en"),
    },
    {
      field: "score",
      label: "Score",
      formatter: (value) => html`<strong>${value}</strong>`,
    },
  ];
  const dangerous: Person[] = [
    { id: 1, name: "=1+1", team: "@compiler", score: 7 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Export people"
      row-key="id"
      .columns=${exportColumns}
      .data=${dangerous}
      .selectedKeys=${[1]}
    ></lr-data-grid>
  `);
  expect(
    element.getDataAsCsv({
      columnIds: ["name", "score"],
      includeHeaders: false,
      delimiter: ";",
    })
  ).to.equal("'=1+1;7");
  expect(
    element.getDataAsCsv({
      columnIds: ["name"],
      includeHeaders: false,
      escapeFormulas: false,
    })
  ).to.equal("=1+1");
  expect(element.getDataAsCsv({ columnIds: ["team"] })).to.equal(
    "Team\r\n'@COMPILER"
  );

  let copied = "";
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  try {
    expect(
      element.copySelectedRows({
        columnIds: ["name"],
        includeHeaders: false,
        format: "csv",
      })
    ).to.equal(1);
    await Promise.resolve();
    expect(copied).to.equal("'=1+1");
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }

  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  let downloaded = "";
  URL.createObjectURL = () => "blob:data-grid-test";
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click(): void {
    downloaded = this.download;
  };
  try {
    element.exportDataAsCsv({ fileName: "people.csv", columnIds: ["name"] });
    expect(downloaded).to.equal("people.csv");
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }
});

it("no longer resolves the removed `columns`/`filename` export option spellings", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Export people"
      row-key="id"
      .columns=${columns}
      .data=${rows.slice(0, 1)}
      .selectedKeys=${[1]}
    ></lr-data-grid>
  `);
  // The Lyra-only aliases were removed in 9.0.0; `wa-data-grid` never had them. A stale caller
  // still passing them gets the documented default behavior (every visible column, `data.csv`),
  // never a silent half-migration.
  const legacyCsvOptions = { columns: ["team"] } as unknown as DataGridCsvOptions;
  expect(element.getDataAsCsv(legacyCsvOptions)).to.equal(
    element.getDataAsCsv({})
  );
  expect(element.getDataAsCsv({ columnIds: ["team"] })).to.not.equal(
    element.getDataAsCsv({})
  );
  expect(rowsAsDelimited(rows.slice(0, 1), columns, legacyCsvOptions)).to.equal(
    rowsAsDelimited(rows.slice(0, 1), columns, {})
  );

  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  let downloaded = "";
  URL.createObjectURL = () => "blob:data-grid-test";
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click(): void {
    downloaded = this.download;
  };
  try {
    element.exportDataAsCsv({
      filename: "legacy.csv",
    } as unknown as DataGridExportOptions);
    expect(downloaded).to.equal("data.csv");
    element.exportDataAsCsv({ fileName: "current.csv" });
    expect(downloaded).to.equal("current.csv");
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }
});

it("honors an explicit copy delimiter over the format default", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Copy people"
      row-key="id"
      .columns=${columns}
      .data=${rows}
      .selectedKeys=${[1]}
    ></lr-data-grid>
  `);
  let copied = "";
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value: string) => {
        copied = value;
      },
    },
  });
  try {
    expect(
      element.copySelectedRows({
        columnIds: ["name", "score"],
        includeHeaders: false,
        format: "csv",
        delimiter: ";",
      })
    ).to.equal(1);
    await Promise.resolve();
    expect(copied).to.equal("Ada;7");
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

it("uses the adopted owner realm for clipboard, fallback DOM, Blob, URL, and download anchor", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const element = await dataGrid(html`
    <lr-data-grid
      label="Owner export"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const mainClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const frameClipboard = Object.getOwnPropertyDescriptor(
    frameWindow.navigator,
    "clipboard"
  );
  const originalMainCreate = URL.createObjectURL;
  const originalMainRevoke = URL.revokeObjectURL;
  const originalFrameCreate = frameWindow.URL.createObjectURL;
  const originalFrameRevoke = frameWindow.URL.revokeObjectURL;
  const originalFrameBlob = frameWindow.Blob;
  const originalFrameClick = frameWindow.HTMLAnchorElement.prototype.click;
  const originalMainExec = document.execCommand;
  const originalFrameExec = frameDocument.execCommand;
  let mainWrites = 0;
  const frameWrites: string[] = [];
  let frameBlobConstructions = 0;
  let mainObjectUrls = 0;
  let frameObjectUrls = 0;
  let revoked = "";
  let downloaded = "";
  let fallbackText = "";

  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: () => {
        mainWrites++;
        return Promise.resolve();
      },
    },
  });
  Object.defineProperty(frameWindow.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        frameWrites.push(text);
        return Promise.resolve();
      },
    },
  });
  URL.createObjectURL = () => {
    mainObjectUrls++;
    return "blob:wrong-realm";
  };
  URL.revokeObjectURL = () => undefined;
  frameWindow.Blob = new Proxy(originalFrameBlob, {
    construct(target, args, newTarget) {
      frameBlobConstructions++;
      return Reflect.construct(target, args, newTarget);
    },
  }) as typeof Blob;
  frameWindow.URL.createObjectURL = () => {
    frameObjectUrls++;
    return "blob:owner-data-grid";
  };
  frameWindow.URL.revokeObjectURL = (url: string) => {
    revoked = url;
  };
  frameWindow.HTMLAnchorElement.prototype.click = function click(): void {
    downloaded = `${this.ownerDocument === frameDocument ? "owner" : "wrong"}:${
      this.download
    }`;
  };

  try {
    frameDocument.body.append(frameDocument.adoptNode(element));
    await element.updateComplete;
    element.copySelectedRows({ includeHeaders: false });
    await Promise.resolve();
    expect(mainWrites).to.equal(0);
    expect(frameWrites).to.have.length(1);

    element.exportDataAsCsv({ fileName: "owner.csv" });
    expect(mainObjectUrls).to.equal(0);
    expect(frameObjectUrls).to.equal(1);
    expect(frameBlobConstructions).to.equal(1);
    expect(downloaded).to.equal("owner:owner.csv");
    expect(revoked).to.equal("blob:owner-data-grid");

    Object.defineProperty(frameWindow.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = (() => {
      throw new Error("ambient document used");
    }) as typeof document.execCommand;
    frameDocument.execCommand = ((command: string): boolean => {
      if (command === "copy") {
        fallbackText =
          frameDocument.body.querySelector<HTMLTextAreaElement>(
            ":scope > textarea"
          )?.value ?? "";
      }
      return true;
    }) as typeof frameDocument.execCommand;
    const fallbackSuccess = oneEvent(element, "lr-copy");
    element.copySelectedRows({ includeHeaders: false });
    await fallbackSuccess;
    expect(fallbackText).to.include("Ada\tCompiler\t7");
    expect(
      frameDocument.body.querySelector(":scope > textarea") === null
    ).to.equal(true);
  } finally {
    element.remove();
    if (mainClipboard)
      Object.defineProperty(navigator, "clipboard", mainClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
    if (frameClipboard)
      Object.defineProperty(frameWindow.navigator, "clipboard", frameClipboard);
    else Reflect.deleteProperty(frameWindow.navigator, "clipboard");
    URL.createObjectURL = originalMainCreate;
    URL.revokeObjectURL = originalMainRevoke;
    frameWindow.URL.createObjectURL = originalFrameCreate;
    frameWindow.URL.revokeObjectURL = originalFrameRevoke;
    frameWindow.Blob = originalFrameBlob;
    frameWindow.HTMLAnchorElement.prototype.click = originalFrameClick;
    document.execCommand = originalMainExec;
    frameDocument.execCommand = originalFrameExec;
    frame.remove();
  }
});

it("does not use ambient clipboard or object URLs from an ownerless document", () => {
  const ownerlessDocument =
    document.implementation.createHTMLDocument("ownerless");
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  const originalCreateObjectUrl = URL.createObjectURL;
  let writes = 0;
  let objectUrls = 0;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: () => {
        writes++;
        return Promise.resolve();
      },
    },
  });
  URL.createObjectURL = () => {
    objectUrls++;
    return "blob:ambient";
  };
  try {
    const element = document.createElement(
      "lr-data-grid"
    ) as unknown as LyraDataGrid<Person>;
    ownerlessDocument.adoptNode(element);
    element.columns = columns;
    element.data = rows;
    element.copySelectedRows({ includeHeaders: false });
    element.exportDataAsCsv();
    expect(writes).to.equal(0);
    expect(objectUrls).to.equal(0);
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
    URL.createObjectURL = originalCreateObjectUrl;
  }
});

it("falls back to a temporary textarea when the async clipboard is unavailable", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  const originalExecCommand = document.execCommand;
  let copied: string | null = null;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
  document.execCommand = ((command: string): boolean => {
    if (command === "copy") {
      copied =
        document.body.querySelector<HTMLTextAreaElement>(":scope > textarea")
          ?.value ?? null;
    }
    return true;
  }) as typeof document.execCommand;
  try {
    const success = oneEvent(element, "lr-copy");
    expect(element.copySelectedRows({ includeHeaders: false })).to.equal(3);
    await success;
  } finally {
    document.execCommand = originalExecCommand;
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
  expect(copied).to.equal(
    "Ada\tCompiler\t7\nLin\tRuntime\t10\nGrace\tCompiler\t9"
  );
  expect((document.body.querySelector(":scope > textarea")) == null).to.be.true;
});

it("announces a localized clipboard failure and emits only the settled typed failure", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .strings=${{ copyFailed: "Unable to copy these rows" }}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  const originalExecCommand = document.execCommand;
  const error = new Error("raw platform failure must not be announced");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.reject(error) },
  });
  document.execCommand = (() => false) as typeof document.execCommand;
  try {
    let succeeded = false;
    element.addEventListener("lr-copy", () => {
      succeeded = true;
    });
    const compatibility = oneEvent(element, "lr-error");
    const failed = oneEvent(element, "lr-copy-error");
    element.copySelectedRows({ includeHeaders: false });
    const [, event] = (await Promise.all([
      compatibility,
      failed,
    ])) as [Event, CustomEvent<{
      readonly ok: false;
      readonly text: string;
      readonly reason: string;
      readonly error: unknown;
    }>];
    await element.updateComplete;

    expect(succeeded).to.equal(false);
    expect(event.detail.ok).to.equal(false);
    expect(event.detail.reason).to.equal("failed");
    expect(event.detail.error).to.equal(error);
    expect(Object.isFrozen(event.detail)).to.equal(true);
    expect(sinkTexts("polite")).to.deep.equal(["Unable to copy these rows"]);
    expect(sinkTexts("polite").join(" ")).not.to.include(error.message);
    expect(
      element.shadowRoot!.querySelector('[part="live-region"]')!.textContent
    ).to.equal("Unable to copy these rows");
  } finally {
    document.execCommand = originalExecCommand;
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});

it("copies and raises a context menu from the grid keyboard contract", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  let written = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        written = text;
        return Promise.resolve();
      },
    },
  });
  try {
    const cell = dataCells(element)[0]!;
    const copy = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    cell.dispatchEvent(copy);
    expect(copy.defaultPrevented).to.equal(true);
    expect(written.split("\r\n")).to.deep.equal([
      "Name\tTeam\tScore",
      "Ada\tCompiler\t7",
      "Lin\tRuntime\t10",
      "Grace\tCompiler\t9",
    ]);
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }

  const menu = oneEvent(element, "lr-cell-contextmenu");
  dataCells(element)[0]!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "F10",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  const { detail } = await menu;
  expect(detail.rowKey).to.equal('row-occurrence-1');
  expect(detail.columnId).to.equal('name');
  expect(detail.index).to.equal(0);
  expect(detail.value).to.equal("Ada");
});

for (const [modifier, init] of [
  ["Ctrl", { ctrlKey: true }],
  ["Cmd", { metaKey: true }],
] as const) {
  it(`${modifier} drives every grid-wide select, copy, and endpoint shortcut`, async () => {
    const element = await dataGrid(html`
      <lr-data-grid
        label="People"
        selectable="multiple"
        row-key="id"
        .columns=${columns}
        .data=${rows}
      ></lr-data-grid>
    `);
    const focused = (): HTMLElement =>
      element.shadowRoot!.querySelector<HTMLElement>(
        '[data-focus-cell][tabindex="0"]'
      )!;
    const press = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      focused().dispatchEvent(event);
      return event;
    };

    element.shadowRoot!.querySelector<HTMLElement>(
      '[part~="cell"][data-row-position]'
    )!.focus();
    const selectAll = press("a");
    await element.updateComplete;

    let copyCalls = 0;
    element.copySelectedRows = () => {
      copyCalls += 1;
      return 0;
    };
    const copy = press("c");

    press("Home");
    await element.updateComplete;
    const homeRow = focused().getAttribute("data-row-position") ?? "header";

    press("End");
    await element.updateComplete;
    const endRow = focused().getAttribute("data-row-position") ?? "header";

    expect({
      selectAllPrevented: selectAll.defaultPrevented,
      selectedRows: element.selectedRowKeys.length,
      copyPrevented: copy.defaultPrevented,
      copyCalls,
      homeRow,
      endRow,
    }).to.deep.equal({
      selectAllPrevented: true,
      selectedRows: rows.length,
      copyPrevented: true,
      copyCalls: 1,
      homeRow: "header",
      endRow: String(rows.length - 1),
    });
  });
}

it("falls back to the textarea copy path when reading navigator.clipboard throws", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  const originalExecCommand = document.execCommand;
  let copied: string | null = null;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    get() {
      throw new Error("denied by permissions policy");
    },
  });
  document.execCommand = ((command: string): boolean => {
    if (command === "copy") {
      copied =
        document.body.querySelector<HTMLTextAreaElement>(":scope > textarea")
          ?.value ?? null;
    }
    return true;
  }) as typeof document.execCommand;
  try {
    const success = oneEvent(element, "lr-copy");
    expect(element.copySelectedRows({ includeHeaders: false })).to.equal(3);
    await success;
  } finally {
    document.execCommand = originalExecCommand;
    if (clipboardDescriptor)
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
  expect(copied).to.equal(
    "Ada\tCompiler\t7\nLin\tRuntime\t10\nGrace\tCompiler\t9"
  );
});

it("downloads a CSV export with the default file name when none is supplied", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  let downloaded = "";
  URL.createObjectURL = () => "blob:default-name";
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click(): void {
    downloaded = this.download;
  };
  try {
    element.exportDataAsCsv();
    expect(downloaded).to.equal("data.csv");
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }
});

it("copies with a fallback textarea even when the owner document has no body", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  frameDocument.body.remove();
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(
    frame.contentWindow!.navigator,
    "clipboard"
  );
  Object.defineProperty(frame.contentWindow!.navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
  try {
    const element = document.createElement(
      "lr-data-grid"
    ) as unknown as LyraDataGrid<Person>;
    frameDocument.adoptNode(element);
    element.columns = columns;
    element.data = rows;
    expect(() =>
      element.copySelectedRows({ includeHeaders: false })
    ).to.not.throw();
  } finally {
    if (clipboardDescriptor)
      Object.defineProperty(
        frame.contentWindow!.navigator,
        "clipboard",
        clipboardDescriptor
      );
    else Reflect.deleteProperty(frame.contentWindow!.navigator, "clipboard");
    frame.remove();
  }
});
