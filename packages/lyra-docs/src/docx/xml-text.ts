/** XML 1.0 text, including complete supplementary Unicode characters and XML whitespace. */
export function isDocxXmlText(value: string): boolean {
  return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/u.test(value);
}
