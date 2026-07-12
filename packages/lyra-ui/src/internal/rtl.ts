/**
 * Whether `el` resolves to RTL text direction. Logical CSS properties
 * (`inset-inline-start`, etc.) already flip visual layout for free, but
 * pointer/keyboard math that reasons about physical left/right (drag ratios,
 * arrow-key direction) has to consult this explicitly to match.
 */
export function isRtl(el: Element): boolean {
  return getComputedStyle(el).direction === 'rtl';
}
