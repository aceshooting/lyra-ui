/** `aria-hidden` is an ASCII case-insensitive true/false token in HTML. */
export function isAriaTrue(value: string | null): boolean {
  return value?.trim().toLowerCase() === 'true';
}
