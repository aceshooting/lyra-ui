import { expect } from '@open-wc/testing';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import { parseVCards } from './vcard.js';

const CARD = ['BEGIN:VCARD', 'VERSION:4.0', 'FN:John Q. Public', 'N:Public;John;Quinlan;Mr.;Esq.', 'ORG:ABC\\, Inc.;Division', 'TEL;TYPE=work,voice:+1-404', 'EMAIL;TYPE=work:john@example.com', 'ADR;TYPE=work:;;Main Street;Town;CA;123;USA', 'END:VCARD'].join('\r\n');

describe('parseVCards', () => {
  it('parses names, organization, typed values, and structured addresses', () => {
    const [contact] = parseVCards(CARD);
    expect(contact.fn).to.equal('John Q. Public');
    expect(contact.n!.familyNames).to.equal('Public');
    expect(contact.org).to.deep.equal(['ABC, Inc.', 'Division']);
    expect(contact.tel).to.deep.equal([{ value: '+1-404', types: ['work', 'voice'] }]);
    expect(contact.adr[0].streetAddress).to.equal('Main Street');
  });
  it('unfolds lines, unescapes values, and parses multiple cards', () => {
    const text = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Folded', 'NOTE:long', ' value', 'END:VCARD', 'BEGIN:VCARD', 'VERSION:2.1', 'FN:Second', 'END:VCARD'].join('\r\n');
    expect(parseVCards(text).map((contact) => contact.fn)).to.deep.equal(['Folded', 'Second']);
    expect(parseVCards('BEGIN:VCARD\nVERSION:4.0\nFN:A\\, B\\; C\\nD\nEND:VCARD')[0].fn).to.equal('A, B; C\nD');
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
    expect(parseVCards(unicode)[0].fn).to.equal('Straße İpek');
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
    const [contact] = parseVCards(source);
    expect(contact.fn).to.equal('Jörg Müller');
    expect(contact.tel[0].types).to.deep.equal(['home', 'voice']);
    expect(contact.email[0].types).to.deep.equal(['internet', 'work']);
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
});
