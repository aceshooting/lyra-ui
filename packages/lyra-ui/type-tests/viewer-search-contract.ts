// Compile-time gate for the shared viewer search contract.
//
// `LyraTextViewerTarget` declares `search(query): Promise<number>` plus
// `searchNext()`/`searchPrevious(): Promise<boolean>`. Four components drifted to
// `searchNext(): void` / `searchPrevious(): void` while still declaring `async search():
// Promise<number>`, so a host driving several viewers through that one typed surface --
// `if (await viewer.searchNext()) { ... }` -- silently read `undefined` from them and took the
// "nothing to move to" branch on every press. Nothing caught it: these components do not adopt the
// mixin (they hand-roll their own search), the interface is structural rather than nominal, and
// `tsconfig.json` excludes test sources. This file is what makes the drift a build error.
import type { LyraTextViewerTarget } from '../src/internal/text-viewer-target.js';
import type { LyraNotebookViewer } from '../src/components/viewers/notebook-viewer/notebook-viewer.class.js';
import type { LyraXmlViewer } from '../src/components/viewers/xml-viewer/xml-viewer.class.js';
import type { LyraAvPlayer } from '../src/components/media/av-player/av-player.class.js';
import type { LyraTerminal } from '../src/components/agent-tools/terminal/terminal.class.js';

/** The subset of `LyraTextViewerTarget` that is purely the search surface. A hand-rolled
 *  implementer owes exactly this much, without also owing `highlights`/`anchor`/`anchorKinds`,
 *  which only the `DocumentAnchorTarget` mixin provides. */
type ViewerSearchSurface = Pick<
  LyraTextViewerTarget,
  'search' | 'searchNext' | 'searchPrevious' | 'clearSearch'
>;

/** Fails to compile if `T` does not structurally satisfy the search surface. */
type AssertSearchable<T extends ViewerSearchSurface> = T;

export type NotebookIsSearchable = AssertSearchable<LyraNotebookViewer>;
export type XmlIsSearchable = AssertSearchable<LyraXmlViewer>;
export type AvPlayerIsSearchable = AssertSearchable<LyraAvPlayer>;
export type TerminalIsSearchable = AssertSearchable<LyraTerminal>;

/** The return types are the part that actually drifted, so pin them explicitly: a `void`-returning
 *  `searchNext()` still satisfies a structural check in some positions, but not this. */
type IsBooleanPromise<T> = T extends () => Promise<boolean> ? true : false;
export const notebookNextResolvesBoolean: IsBooleanPromise<LyraNotebookViewer['searchNext']> = true;
export const xmlNextResolvesBoolean: IsBooleanPromise<LyraXmlViewer['searchNext']> = true;
export const avPlayerNextResolvesBoolean: IsBooleanPromise<LyraAvPlayer['searchNext']> = true;
export const terminalNextResolvesBoolean: IsBooleanPromise<LyraTerminal['searchNext']> = true;
export const notebookPrevResolvesBoolean: IsBooleanPromise<LyraNotebookViewer['searchPrevious']> = true;
export const xmlPrevResolvesBoolean: IsBooleanPromise<LyraXmlViewer['searchPrevious']> = true;
export const avPlayerPrevResolvesBoolean: IsBooleanPromise<LyraAvPlayer['searchPrevious']> = true;
export const terminalPrevResolvesBoolean: IsBooleanPromise<LyraTerminal['searchPrevious']> = true;
