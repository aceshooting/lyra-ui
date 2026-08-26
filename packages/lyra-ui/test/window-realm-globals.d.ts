/**
 * lib.dom types the ambient `window` value as `Window & typeof globalThis`, but properties such
 * as `iframe.contentWindow` and `document.defaultView` as plain `Window`. Real browsing-context
 * windows own the same platform constructors. Tests intentionally use the constructor from the
 * component's document realm, so model that browser contract instead of casting every access back
 * to `typeof globalThis`.
 */
declare global {
  var __LYRA_WTR_STRICT_CONSOLE__: boolean | undefined;
  var __LYRA_WTR_COVERAGE__: boolean | undefined;

  interface Window {
    AbortController: typeof AbortController;
    AbortSignal: typeof AbortSignal;
    Array: typeof Array;
    AudioContext: typeof AudioContext;
    Blob: typeof Blob;
    CSS: typeof CSS;
    CustomEvent: typeof CustomEvent;
    DOMException: typeof DOMException;
    DOMParser: typeof DOMParser;
    DOMRect: typeof DOMRect;
    Date: typeof Date;
    DragEvent: typeof DragEvent;
    ElementInternals: typeof ElementInternals;
    Event: typeof Event;
    File: typeof File;
    FocusEvent: typeof FocusEvent;
    FormData: typeof FormData;
    Function: typeof Function;
    HTMLAnchorElement: typeof HTMLAnchorElement;
    HTMLCanvasElement: typeof HTMLCanvasElement;
    HTMLElement: typeof HTMLElement;
    HTMLInputElement: typeof HTMLInputElement;
    HTMLMediaElement: typeof HTMLMediaElement;
    HTMLVideoElement: typeof HTMLVideoElement;
    Image: typeof Image;
    InputEvent: typeof InputEvent;
    IntersectionObserver: typeof IntersectionObserver;
    JSON: typeof JSON;
    KeyboardEvent: typeof KeyboardEvent;
    MouseEvent: typeof MouseEvent;
    MutationObserver: typeof MutationObserver;
    Option: typeof Option;
    PointerEvent: typeof PointerEvent;
    Promise: typeof Promise;
    ResizeObserver: typeof ResizeObserver;
    SVGElement: typeof SVGElement;
    URL: typeof URL;
    WheelEvent: typeof WheelEvent;
    XMLSerializer: typeof XMLSerializer;
  }
}

export {};
