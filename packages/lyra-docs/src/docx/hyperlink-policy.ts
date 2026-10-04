import { isDocxXmlText } from './xml-text.js';

/** Shared authoring and package-admission policy, without fetching the destination. */
export function isSafeDocxHyperlink(value: string): boolean {
  if (!isDocxXmlText(value) || /[\x00-\x20\x7f\\]/.test(value)) return false;
  if (value.startsWith('#')) return true;
  try {
    const url = new URL(value);
    return ((url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname) && !url.username && !url.password) ||
      url.protocol === 'mailto:';
  } catch { return false; }
}
