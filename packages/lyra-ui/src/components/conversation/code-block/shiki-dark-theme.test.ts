import { expect, fixture, html } from "@open-wc/testing";
import { resolveIsDarkTheme, watchDarkTheme } from "./shiki-dark-theme.js";

it("returns an inert reusable cleanup for a disconnected host", () => {
  const host = document.createElement("div");
  let changes = 0;
  const cleanup = watchDarkTheme(host, () => changes++);
  cleanup();
  cleanup();
  expect(changes).to.equal(0);
});

it("resolves computed colors and color grammar through the adopted owner realm", async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");
  const host = frameDocument.createElement("div");
  host.setAttribute(
    "style",
    "color:white; --lr-color-text:currentColor; --lr-color-surface:oklch(12% 0 0)"
  );
  frameDocument.body.append(host);
  const ambientGetComputedStyle = window.getComputedStyle;
  const ownerGetComputedStyle = frameWindow.getComputedStyle;
  const ownerCreateElement = frameDocument.createElement;
  let ownerStyleReads = 0;
  let ownerCanvasCreations = 0;

  try {
    window.getComputedStyle = () => {
      throw new Error("ambient getComputedStyle must not be used");
    };
    frameWindow.getComputedStyle = (
      element: Element,
      pseudoElement?: string | null
    ) => {
      ownerStyleReads += 1;
      return ownerGetComputedStyle.call(frameWindow, element, pseudoElement);
    };
    frameDocument.createElement = function (
      localName: string,
      options?: ElementCreationOptions
    ): HTMLElement {
      if (localName.toLowerCase() === "canvas") ownerCanvasCreations += 1;
      return ownerCreateElement.call(frameDocument, localName, options);
    } as typeof frameDocument.createElement;

    expect(resolveIsDarkTheme(host)).to.be.true;
    expect(ownerStyleReads).to.equal(1);
    expect(ownerCanvasCreations).to.equal(1);
  } finally {
    frameDocument.createElement = ownerCreateElement;
    frameWindow.getComputedStyle = ownerGetComputedStyle;
    window.getComputedStyle = ambientGetComputedStyle;
    host.remove();
    frame.remove();
  }
});

it("watches and cleans the exact owner theme resources while rejecting stale callbacks", async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");
  const host = frameDocument.createElement("div");
  frameDocument.body.append(host);
  const ambientObserverDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "MutationObserver"
  );
  const ownerObserverDescriptor = Object.getOwnPropertyDescriptor(
    frameWindow,
    "MutationObserver"
  );
  const matchMediaDescriptor = Object.getOwnPropertyDescriptor(
    frameWindow,
    "matchMedia"
  );
  let ambientObserverConstructions = 0;
  let mediaAdded: EventListener | undefined;
  let mediaRemoved: EventListener | undefined;
  const observers: Array<{
    callback: MutationCallback;
    observer: MutationObserver;
    targets: Node[];
    disconnects: number;
  }> = [];
  let cleanup: (() => void) | undefined;

  class AmbientMutationObserverTrap implements MutationObserver {
    constructor(_callback: MutationCallback) {
      ambientObserverConstructions += 1;
      throw new Error("ambient MutationObserver must not be used");
    }
    disconnect(): void {}
    observe(): void {}
    takeRecords(): MutationRecord[] {
      return [];
    }
  }

  class OwnerMutationObserver implements MutationObserver {
    private readonly record: (typeof observers)[number];
    constructor(callback: MutationCallback) {
      this.record = { callback, observer: this, targets: [], disconnects: 0 };
      observers.push(this.record);
    }
    disconnect(): void {
      this.record.disconnects += 1;
    }
    observe(target: Node): void {
      this.record.targets.push(target);
    }
    takeRecords(): MutationRecord[] {
      return [];
    }
  }

  try {
    Object.defineProperty(window, "MutationObserver", {
      configurable: true,
      value: AmbientMutationObserverTrap,
    });
    Object.defineProperty(frameWindow, "MutationObserver", {
      configurable: true,
      value: OwnerMutationObserver,
    });
    Object.defineProperty(frameWindow, "matchMedia", {
      configurable: true,
      value: () =>
        ({
          addEventListener(type: string, listener: EventListener): void {
            if (type === "change") mediaAdded = listener;
          },
          removeEventListener(type: string, listener: EventListener): void {
            if (type === "change" && listener === mediaAdded)
              mediaRemoved = listener;
          },
        } as unknown as MediaQueryList),
    });

    let changes = 0;
    cleanup = watchDarkTheme(host, () => {
      changes += 1;
    });
    expect(ambientObserverConstructions).to.equal(0);
    expect(observers).to.have.lengthOf(1);
    expect(observers[0]!.targets).to.include(host);
    expect(mediaAdded).to.exist;

    observers[0]!.callback([], observers[0]!.observer);
    mediaAdded!(new Event("change"));
    expect(changes).to.equal(2);

    document.body.append(document.adoptNode(host));
    observers[0]!.callback([], observers[0]!.observer);
    mediaAdded!(new Event("change"));
    expect(changes).to.equal(2);

    cleanup();
    cleanup = undefined;
    expect(observers[0]!.disconnects).to.equal(1);
    expect(mediaRemoved).to.equal(mediaAdded);
    observers[0]!.callback([], observers[0]!.observer);
    expect(changes).to.equal(2);
  } finally {
    cleanup?.();
    host.remove();
    if (ambientObserverDescriptor) {
      Object.defineProperty(
        window,
        "MutationObserver",
        ambientObserverDescriptor
      );
    } else {
      Reflect.deleteProperty(window, "MutationObserver");
    }
    if (ownerObserverDescriptor) {
      Object.defineProperty(
        frameWindow,
        "MutationObserver",
        ownerObserverDescriptor
      );
    } else {
      Reflect.deleteProperty(frameWindow, "MutationObserver");
    }
    if (matchMediaDescriptor)
      Object.defineProperty(frameWindow, "matchMedia", matchMediaDescriptor);
    else Reflect.deleteProperty(frameWindow, "matchMedia");
    frame.remove();
  }
});
