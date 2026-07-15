import { expect } from '@open-wc/testing';
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
    const text = ['BEGIN:VCARD', 'FN:Folded', 'NOTE:long', ' value', 'END:VCARD', 'BEGIN:VCARD', 'FN:Second', 'END:VCARD'].join('\r\n');
    expect(parseVCards(text).map((contact) => contact.fn)).to.deep.equal(['Folded', 'Second']);
    expect(parseVCards('BEGIN:VCARD\nFN:A\\, B\\; C\\nD\nEND:VCARD')[0].fn).to.equal('A, B; C\nD');
  });
  it('returns an empty array without a vCard block', () => { expect(parseVCards('plain text')).to.deep.equal([]); });
});
