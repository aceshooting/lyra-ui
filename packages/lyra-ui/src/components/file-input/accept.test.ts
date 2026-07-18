import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { matchesAccept } from './accept.js';

const file = (name: string, type: string) => new File(['x'], name, { type });

it('matches by extension', () => {
  expect(matchesAccept(file('a.csv', 'text/csv'), '.csv,.xlsx')).to.be.true;
  expect(matchesAccept(file('a.png', 'image/png'), '.csv,.xlsx')).to.be.false;
});

it('matches by exact MIME type', () => {
  expect(matchesAccept(file('a', 'text/csv'), 'text/csv')).to.be.true;
  expect(matchesAccept(file('a', 'image/png'), 'text/csv')).to.be.false;
});

it('matches a MIME wildcard', () => {
  expect(matchesAccept(file('a.jpg', 'image/jpeg'), 'image/*')).to.be.true;
  expect(matchesAccept(file('a.pdf', 'application/pdf'), 'image/*')).to.be.false;
});

it('accepts anything when accept is empty', () => {
  expect(matchesAccept(file('a.exe', 'application/x-msdownload'), '')).to.be.true;
});

it('matches any file against the bare */* wildcard', () => {
  expect(matchesAccept(file('a.png', 'image/png'), '*/*')).to.be.true;
  expect(matchesAccept(file('a.csv', 'text/csv'), '*/*')).to.be.true;
});

it('does not throw and does not match an extension pattern when name is unavailable', () => {
  // Simulates a DataTransferItem cast as File (dragenter preview, pre-drop): has
  // `.type` but no `.name`.
  const nameless = { type: 'text/csv' } as File;
  expect(() => matchesAccept(nameless, '.csv,.xlsx')).to.not.throw();
  expect(matchesAccept(nameless, '.csv,.xlsx')).to.be.false;
  expect(matchesAccept(nameless, 'text/csv')).to.be.true;
});

it('treats an unresolved extension pattern as a match when assumeExtensionMatch is true', () => {
  const nameless = { type: 'text/csv' } as File;
  expect(matchesAccept(nameless, '.csv,.xlsx', true)).to.be.true;
  // A pattern that isn't extension-based is unaffected by the flag.
  expect(matchesAccept(nameless, 'image/*', true)).to.be.false;
});

it('handles arbitrary file metadata and accept strings without throwing', () => {
  fc.assert(fc.property(fc.string(), fc.string(), fc.string(), (name, type, accept) => {
    const result = matchesAccept(file(name, type), accept);
    expect(result).to.be.a('boolean');
  }));
});
