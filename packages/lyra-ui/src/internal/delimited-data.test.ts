import { expect } from '@open-wc/testing';
import {
  delimitedCellText,
  delimitedColumnCount,
  parseDelimitedGrid,
  parseDelimitedRecords,
} from './delimited-data.js';

const parser = {
  parse(_text: string, options: Record<string, unknown>) {
    return options['header']
      ? { data: [{ name: 'Ada' }], meta: { fields: ['name'] }, errors: [] }
      : { data: [['name'], ['Ada']], meta: {}, errors: [{ code: 'sample' }] };
  },
};

it('normalizes grid parsing configuration and derived dimensions', () => {
  const result = parseDelimitedGrid(parser, 'name\\nAda');
  expect(result.data).to.deep.equal([['name'], ['Ada']]);
  expect(result.errors).to.have.length(1);
  expect(delimitedColumnCount([['a'], ['b', 'c']])).to.equal(2);
  expect(delimitedCellText(null)).to.equal('');
});

it('normalizes header-record parsing and fields', () => {
  expect(parseDelimitedRecords(parser, 'name\\nAda')).to.deep.equal({
    fields: ['name'],
    rows: [{ name: 'Ada' }],
    errors: [],
  });
});

