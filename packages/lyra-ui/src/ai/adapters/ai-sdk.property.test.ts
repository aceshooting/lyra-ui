import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../test/property-options.js';
import { adaptAiSdkMessage } from './ai-sdk.js';

it('documented undefined SDK optionals have exactly the same meaning as absent optionals', () => {
  fc.assert(fc.property(
    fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/u), fc.oneof(
      fc.string({ maxLength: 40 }), fc.integer(), fc.boolean(), fc.constant(null),
    ), { maxKeys: 6 }),
    input => {
      const part = { type: 'tool-show_view', toolCallId: 'call', state: 'input-streaming', input };
      const minimal = adaptAiSdkMessage({ id: 'message', role: 'assistant', parts: [part] });
      const sdkSnapshot = adaptAiSdkMessage({ id: 'message', role: 'assistant', metadata: undefined, parts: [{
        ...part, output: undefined, errorText: undefined, rawInput: undefined, title: undefined,
        providerExecuted: undefined, preliminary: undefined, toolMetadata: undefined,
        callProviderMetadata: undefined, resultProviderMetadata: undefined,
      }] });
      expect(minimal === null).to.equal(false);
      expect(sdkSnapshot).to.deep.equal(minimal);
    },
  ), propertyRuns());
});
