/** Reads the computed accessible name after an accessibility scan has loaded axe. */
export function accessibleName(element: Element): string {
  const axe = (window as Window & { axe?: typeof import('axe-core') }).axe;
  if (!axe) throw new Error('Run an accessibility scan before reading the accessible name.');
  axe.setup(element.ownerDocument);
  try {
    return axe.commons.text.accessibleText(element);
  } finally {
    axe.teardown();
  }
}
