import { expect } from '@open-wc/testing';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import { parseVCards } from './vcard.js';

const CARD = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:John Q. Public', 'N:Public;John;Quinlan;Mr.;Esq.', 'ORG:ABC\\, Inc.;Division', 'TEL;TYPE=work,voice:+1-404', 'EMAIL;TYPE=work:john@example.com', 'ADR;TYPE=work:;;Main Street;Town;CA;123;USA', 'END:VCARD'].join('\r\n');

function first<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error('Expected a parsed vCard value');
  return value;
}

describe('parseVCards', () => {
  it('parses names, organization, typed values, and structured addresses', () => {
    const contact = first(parseVCards(CARD));
    expect(contact.fn).to.equal('John Q. Public');
    expect(contact.n!.familyNames).to.equal('Public');
    expect(contact.org).to.deep.equal(['ABC, Inc.', 'Division']);
    expect(contact.tel).to.deep.equal([{ value: '+1-404', types: ['work', 'voice'] }]);
    expect(first(contact.adr).streetAddress).to.equal('Main Street');
  });
  it('unfolds lines, unescapes values, and parses multiple cards', () => {
    const text = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Folded', 'NOTE:long', ' value', 'END:VCARD', 'BEGIN:VCARD', 'VERSION:2.1', 'FN:Second', 'END:VCARD'].join('\r\n');
    expect(parseVCards(text).map((contact) => contact.fn)).to.deep.equal(['Folded', 'Second']);
    expect(first(parseVCards('BEGIN:VCARD\nVERSION:4.0\nFN:A\\, B\\; C\\nD\nEND:VCARD')).fn).to.equal('A, B; C\nD');
  });
  it('ignores an empty physical line inside a framed card', () => {
    expect(first(parseVCards('BEGIN:VCARD\nVERSION:4.0\n\nFN:Blank tolerant\nEND:VCARD')).fn)
      .to.equal('Blank tolerant');
  });
  it('returns an empty array only for an actually empty document', () => {
    expect(parseVCards(' \r\n\t')).to.deep.equal([]);
    expect(() => parseVCards('plain text')).to.throw(/data outside/);
  });
  it('rejects contacts beyond the retained-entry ceiling while scanning', () => {
    expect(() => parseVCards(`${CARD}\r\n${CARD}`, 1)).to.throw(LyraResourceLimitError);
  });
  it('matches framing markers only as complete lines without Unicode index drift', () => {
    const unicode = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:Straße İpek', 'NOTE:not BEGIN:VCARD or END:VCARD', 'END:VCARD'].join('\r\n');
    expect(first(parseVCards(unicode)).fn).to.equal('Straße İpek');
    expect(() => parseVCards(`prefixßBEGIN:VCARD\r\n${CARD}`)).to.throw(/data outside/);
    expect(() => parseVCards('BEGIN:VCARD\r\nVERSION:4.0\r\nNOTE:END:VCARD')).to.throw(/missing END/);
  });
  it('supports 2.1 bare/quoted parameters and quoted-printable charset decoding', () => {
    const source = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'FN;CHARSET=ISO-8859-1;ENCODING=QUOTED-PRINTABLE:J=F6rg=20=',
      ' M=FCller',
      'TEL;HOME;VOICE:+352',
      'EMAIL;TYPE="INTERNET,WORK":j@example.test',
      'END:VCARD',
    ].join('\r\n');
    const contact = first(parseVCards(source));
    expect(contact.fn).to.equal('Jörg Müller');
    expect(first(contact.tel).types).to.deep.equal(['home', 'voice']);
    expect(first(contact.email).types).to.deep.equal(['internet', 'work']);
  });
  it('honors escaped backslashes in parameters and unindented quoted-printable soft lines', () => {
    const source = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'FN;CHARSET=ISO-8859-1;ENCODING=QUOTED-PRINTABLE:J=F6rg=',
      'M=FCller',
      'TEL;TYPE="work\\\\phone":+352',
      'END:VCARD',
    ].join('\r\n');
    const contact = first(parseVCards(source));

    expect(contact.fn).to.equal('JörgMüller');
    expect(contact.tel).to.deep.equal([{ value: '+352', types: ['work\\phone'] }]);
  });
  it('rejects malformed blocks, profiles, parameters, encodings and quoted-printable input', () => {
    for (const source of [
      'BEGIN:VCARD\r\nFN:Missing version\r\nEND:VCARD',
      'BEGIN:VCARD\r\nVERSION:5.0\r\nFN:Future\r\nEND:VCARD',
      'BEGIN:VCARD\r\nVERSION:4.0\r\nFN;TYPE="work:Broken\r\nEND:VCARD',
      'BEGIN:VCARD\r\nVERSION:2.1\r\nFN;ENCODING=BASE64:AAAA\r\nEND:VCARD',
      'BEGIN:VCARD\r\nVERSION:2.1\r\nFN;ENCODING=QUOTED-PRINTABLE:Bad=QZ\r\nEND:VCARD',
      'BEGIN:VCARD\r\nVERSION:4.0\r\nBEGIN:VCARD\r\nEND:VCARD',
      'END:VCARD',
    ]) expect(() => parseVCards(source)).to.throw();
  });
  it('normalizes adversarial numeric limits before enforcing the hard ceiling', () => {
    const two = `${CARD}\r\n${CARD}`;
    expect(parseVCards(two, Number.NaN)).to.have.lengthOf(2);
    expect(parseVCards(two, Number.POSITIVE_INFINITY)).to.have.lengthOf(2);
    expect(() => parseVCards(CARD, -1)).to.throw(LyraResourceLimitError);
    expect(() => parseVCards(two, 1.9)).to.throw(LyraResourceLimitError);
    expect(() => parseVCards(two, { maxContacts: 1 })).to.throw(LyraResourceLimitError);
    expect(() => parseVCards(Array.from({ length: 251 }, () => CARD).join('\r\n')))
      .to.throw(LyraResourceLimitError);
  });
  it('treats 8BIT encoding as a pass-through with no quoted-printable decoding', () => {
    const source = ['BEGIN:VCARD', 'VERSION:2.1', 'FN;ENCODING=8BIT:Plain=20Text', 'END:VCARD'].join('\r\n');
    expect(first(parseVCards(source)).fn).to.equal('Plain=20Text');
  });
  it('rejects a non-UTF-8/US-ASCII CHARSET parameter without quoted-printable encoding', () => {
    const source = ['BEGIN:VCARD', 'VERSION:2.1', 'FN;CHARSET=ISO-8859-1:Test', 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(/requires quoted-printable encoding/);
  });
  it('rejects an unrecognized CHARSET label during quoted-printable decoding', () => {
    const source = ['BEGIN:VCARD', 'VERSION:2.1', 'FN;CHARSET=BOGUS-CHARSET;ENCODING=QUOTED-PRINTABLE:A', 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(/unsupported or invalid charset/);
  });
  it('rejects a parameter value with trailing characters after a closing quote', () => {
    const source = ['BEGIN:VCARD', 'VERSION:4.0', 'FN;X="ab"cd:value', 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(/unterminated quoted parameter/);
  });
  it('rejects a parameter name that is not a valid token', () => {
    const source = ['BEGIN:VCARD', 'VERSION:4.0', 'FN;1BAD=x:value', 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(/invalid parameter name/);
  });
  it('rejects an empty parameter slot between semicolons', () => {
    const source = ['BEGIN:VCARD', 'VERSION:4.0', 'FN;;TYPE=work:value', 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(/empty parameter/);
  });
  it('rejects an empty bare type token', () => {
    const source = ['BEGIN:VCARD', 'VERSION:2.1', 'TEL;"":+1', 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(/empty type parameter/);
  });
  it('rejects a TYPE parameter with no values', () => {
    const source = ['BEGIN:VCARD', 'VERSION:4.0', 'TEL;TYPE=:value', 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(/empty TYPE parameter/);
  });
  it('rejects a property name that is not a valid token', () => {
    const source = ['BEGIN:VCARD', 'VERSION:4.0', '1FN:value', 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(/invalid property name/);
  });
  it('rejects NUL input and a property without a value delimiter', () => {
    expect(() => parseVCards(`BEGIN:VCARD\nVERSION:4.0\nFN:A\0B\nEND:VCARD`))
      .to.throw(/NUL byte/);
    expect(() => parseVCards('BEGIN:VCARD\nVERSION:4.0\nFN\nEND:VCARD'))
      .to.throw(/missing its value delimiter/);
  });
  it('strips a leading group label from a grouped property name', () => {
    const source = ['BEGIN:VCARD', 'VERSION:3.0', 'item1.TEL:+1-555-0100', 'item1.X-ABLabel:Mobile', 'END:VCARD'].join('\r\n');
    const contact = first(parseVCards(source));
    expect(contact.tel).to.deep.equal([{ value: '+1-555-0100', types: [] }]);
  });
  it('rejects a duplicate VERSION property', () => {
    const source = ['BEGIN:VCARD', 'VERSION:4.0', 'VERSION:3.0', 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(/duplicate VERSION/);
  });
  it('rejects a folded continuation line with no preceding property', () => {
    const source = 'BEGIN:VCARD\r\n VERSION:4.0\r\nEND:VCARD';
    expect(() => parseVCards(source)).to.throw(/orphan folded line/);
  });
  it('pads a structured N value that has fewer components than expected', () => {
    const source = ['BEGIN:VCARD', 'VERSION:4.0', 'N:Doe', 'END:VCARD'].join('\r\n');
    const contact = first(parseVCards(source));
    expect(contact.n).to.deep.equal({
      familyNames: 'Doe',
      givenNames: '',
      additionalNames: '',
      honorificPrefixes: '',
      honorificSuffixes: '',
    });
  });
  it('rejects a single property line larger than the per-property character ceiling', () => {
    const huge = `FN:${'a'.repeat(1_048_600)}`;
    const source = ['BEGIN:VCARD', 'VERSION:4.0', huge, 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(LyraResourceLimitError);
  });
  it('rejects a document with more physical lines than the line ceiling', () => {
    const source = Array.from({ length: 100_001 }, () => '').join('\n');
    expect(() => parseVCards(source)).to.throw(LyraResourceLimitError);
  });
  it('rejects a contact with more properties than the per-contact ceiling', () => {
    const lines = ['BEGIN:VCARD', 'VERSION:4.0', ...Array.from({ length: 10_001 }, () => 'X:1'), 'END:VCARD'];
    expect(() => parseVCards(lines.join('\r\n'))).to.throw(LyraResourceLimitError);
  });
  it('rejects a card whose raw line count exceeds the block scanning ceiling before END is reached', () => {
    const lines = ['BEGIN:VCARD', 'VERSION:4.0', ...Array.from({ length: 20_001 }, () => 'X:1')];
    expect(() => parseVCards(lines.join('\r\n'))).to.throw(LyraResourceLimitError);
  });
  it('rejects a contact whose combined rendered text exceeds the per-contact character ceiling', () => {
    const fn = `FN:${'a'.repeat(1_000_000)}`;
    const org = `ORG:${'b'.repeat(1_000_000)}`;
    const tel = `TEL:${'c'.repeat(200_000)}`;
    const source = ['BEGIN:VCARD', 'VERSION:4.0', fn, org, tel, 'END:VCARD'].join('\r\n');
    expect(() => parseVCards(source)).to.throw(LyraResourceLimitError);
  });
});

describe('parseVCards delimiter and framing edge cases', () => {
  it('keeps escaped parameter delimiters inside one parameter value', () => {
    const source = [
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN;X-NOTE=alpha\\;beta:Escaped parameter',
      'END:VCARD',
    ].join('\r\n');

    expect(parseVCards(source)[0]!.fn).to.equal('Escaped parameter');
  });

  it('joins a quoted-printable soft line even when the continuation has no leading whitespace', () => {
    const source = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'FN;ENCODING=QUOTED-PRINTABLE:A=20=',
      'B',
      'END:VCARD',
    ].join('\r\n');

    expect(parseVCards(source)[0]!.fn).to.equal('A B');
  });

  it('rejects NUL bytes before attempting block parsing', () => {
    expect(() => parseVCards(`BEGIN:VCARD\r\nVERSION:4.0\r\nFN:A\0B\r\nEND:VCARD`))
      .to.throw(/NUL byte/);
  });
});
