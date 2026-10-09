import { DOCUMENT_TOKEN_SCOPE_SELECTOR, LAYER_CONSUMED_INPUTS } from './document-tokens.generated.js';

const THEME_SCOPE_LIST = `:root,${DOCUMENT_TOKEN_SCOPE_SELECTOR}`;
const LAYER_INPUTS = new Set(LAYER_CONSUMED_INPUTS);

function setsLayerInput(element: Element): boolean {
  const style = (element as Partial<ElementCSSInlineStyle>).style;
  if (!style) return false;
  for (let index = 0; index < style.length; index++) {
    if (LAYER_INPUTS.has(style.item(index))) return true;
  }
  return false;
}

/**
 * Elements under `root` (inclusive, descending into open shadow roots) whose inline style sets a
 * `--lr-theme-*` input that the document token layer consumes, and that are not theme scopes. Such
 * an input no longer re-derives the Lyra components below the element; mark it with
 * `data-lr-theme-scope`. Inputs read on the host itself (the chart, graph and terminal palettes,
 * form-control heights and radius, the icon-button size) work on any element and are not reported.
 *
 * Reads inline styles only and logs nothing, so it is safe in tests and strict-console runs.
 * Stylesheet-applied inputs are reported by the migration tool instead.
 */
export function findUnscopedThemeInputs(root: Document | DocumentFragment | Element = document): Element[] {
  const found: Element[] = [];
  const visit = (scope: Document | DocumentFragment | Element) => {
    if (scope.nodeType === 1) check(scope as Element);
    for (const element of scope.querySelectorAll('*')) check(element);
  };
  const check = (element: Element) => {
    if (setsLayerInput(element) && !element.matches(THEME_SCOPE_LIST)) found.push(element);
    if (element.shadowRoot) visit(element.shadowRoot);
  };
  visit(root);
  return found;
}
