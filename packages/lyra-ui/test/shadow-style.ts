/** Resolves a style declaration inside the component's own shadow tree. */
export function resolvedInShadow(el: HTMLElement, declaration: string, property: string, preventFlexShrink = false): string {
  const doc = el.ownerDocument;
  const probe = doc.createElement('span');
  probe.setAttribute('style', declaration);
  if (preventFlexShrink) probe.style.flexShrink = '0';
  el.shadowRoot!.append(probe);
  try {
    return doc.defaultView!.getComputedStyle(probe).getPropertyValue(property);
  } finally {
    probe.remove();
  }
}

/** Resolves a declaration without flex shrink distorting a probe inside a flex host. */
export function resolvedInShadowUnshrunk(el: HTMLElement, declaration: string, property: string): string {
  return resolvedInShadow(el, declaration, property, true);
}

/** Resolves a color in the exact inheritance scope used by a rendered assertion. */
export function resolvedColorIn(scope: Element | ShadowRoot, value: string): string {
  const doc = scope.ownerDocument;
  const probe = doc.createElement('span');
  probe.style.color = value;
  scope.append(probe);
  try {
    return doc.defaultView!.getComputedStyle(probe).color;
  } finally {
    probe.remove();
  }
}

/** Resolves an inherited length token where component shadow styles are active. */
export function resolvedMaxInlineSizeInShadow(el: HTMLElement, expression: string): string {
  const doc = el.ownerDocument;
  const probe = doc.createElement('span');
  probe.style.position = 'absolute';
  probe.style.maxInlineSize = expression;
  el.shadowRoot!.append(probe);
  try {
    return doc.defaultView!.getComputedStyle(probe).maxInlineSize;
  } finally {
    probe.remove();
  }
}

/** Resolves several custom properties against one probe in the component shadow tree. */
export function resolveDeclarationsInShadow(el: HTMLElement, declarations: readonly (readonly [string, string])[]): Record<string, string> {
  const doc = el.ownerDocument;
  const probe = doc.createElement('div');
  for (const [property, value] of declarations) probe.style.setProperty(property, value);
  el.shadowRoot!.append(probe);
  try {
    const computed = doc.defaultView!.getComputedStyle(probe);
    return Object.fromEntries(declarations.map(([property]) => [property, computed.getPropertyValue(property)]));
  } finally {
    probe.remove();
  }
}
