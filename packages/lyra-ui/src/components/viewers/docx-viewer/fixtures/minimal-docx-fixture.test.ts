import { expect } from '@open-wc/testing';
import { MINIMAL_DOCX_BASE64 } from './minimal-docx-fixture.js';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

describe('minimal DOCX fixture', () => {
  it('converts through Mammoth with no warnings', async () => {
    const mammothModule = (await import('mammoth/mammoth.browser.js')) as unknown as {
      default: { convertToHtml: (options: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: unknown[] }> };
    };
    const result = await mammothModule.default.convertToHtml({ arrayBuffer: base64ToArrayBuffer(MINIMAL_DOCX_BASE64) });
    expect(result.value).to.contain('<h1>');
    expect(result.value).to.contain('<p>');
    expect(result.messages).to.deep.equal([]);
  });
});
