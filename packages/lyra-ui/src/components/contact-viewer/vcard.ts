export interface VCardName { familyNames: string; givenNames: string; additionalNames: string; honorificPrefixes: string; honorificSuffixes: string; }
export interface VCardTypedValue { value: string; types: string[]; }
export interface VCardAddress { poBox: string; extendedAddress: string; streetAddress: string; locality: string; region: string; postalCode: string; country: string; types: string[]; }
export interface VCardContact { fn: string; n?: VCardName; org: string[]; tel: VCardTypedValue[]; email: VCardTypedValue[]; adr: VCardAddress[]; }

function unfoldLines(raw: string): string[] {
  const lines = raw.split(/\r\n|\r|\n/);
  const result: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && result.length) result[result.length - 1] += line.slice(1);
    else if (line) result.push(line);
  }
  return result;
}

function unescapeValue(value: string): string { return value.replace(/\\(\\|,|;|[nN])/g, (_match, char: string) => char.toLowerCase() === 'n' ? '\n' : char); }
function splitUnescaped(value: string, separator: string): string[] {
  const parts: string[] = []; let current = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) { current += value[i] + value[i + 1]; i++; continue; }
    if (value[i] === separator) { parts.push(current); current = ''; } else current += value[i];
  }
  parts.push(current); return parts;
}

function parseProperty(line: string): { name: string; types: string[]; value: string } | null {
  const colon = line.indexOf(':'); if (colon < 0) return null;
  const head = line.slice(0, colon).split(';');
  const namePart = head[0].slice(head[0].lastIndexOf('.') + 1).toUpperCase();
  const types = head.slice(1).flatMap((param) => {
    const [key, value] = param.split(/=(.*)/s); return key.toUpperCase() === 'TYPE' ? value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) : [];
  });
  return { name: namePart, types, value: line.slice(colon + 1) };
}

function structured(value: string, count: number): string[] {
  const parts = splitUnescaped(value, ';').map(unescapeValue); while (parts.length < count) parts.push(''); return parts.slice(0, count);
}

function parseBlock(block: string): VCardContact {
  const contact: VCardContact = { fn: '', org: [], tel: [], email: [], adr: [] };
  for (const line of unfoldLines(block)) {
    const prop = parseProperty(line); if (!prop || ['BEGIN', 'END', 'VERSION'].includes(prop.name)) continue;
    switch (prop.name) {
      case 'FN': contact.fn = unescapeValue(prop.value); break;
      case 'N': { const [familyNames, givenNames, additionalNames, honorificPrefixes, honorificSuffixes] = structured(prop.value, 5); contact.n = { familyNames, givenNames, additionalNames, honorificPrefixes, honorificSuffixes }; break; }
      case 'ORG': contact.org = splitUnescaped(prop.value, ';').map(unescapeValue).filter(Boolean); break;
      case 'TEL': contact.tel.push({ value: unescapeValue(prop.value), types: prop.types }); break;
      case 'EMAIL': contact.email.push({ value: unescapeValue(prop.value), types: prop.types }); break;
      case 'ADR': { const [poBox, extendedAddress, streetAddress, locality, region, postalCode, country] = structured(prop.value, 7); contact.adr.push({ poBox, extendedAddress, streetAddress, locality, region, postalCode, country, types: prop.types }); break; }
      default: break;
    }
  }
  return contact;
}

export function parseVCards(text: string): VCardContact[] {
  return (text.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) ?? []).map(parseBlock);
}
