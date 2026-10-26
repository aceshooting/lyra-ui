import { A2uiProcessor, a2uiClientCapabilities, createA2uiCatalog } from '../../../../dist/adapters/a2ui.js';
import { createCatalog, initialCatalog } from '../../../../dist/catalog.js';
import { reportCatalogId } from '../extended-report.ts';

export const extensionUri = 'https://a2ui.org/a2a-extension/a2ui/v0.9.1';
export const metadataKey = 'a2uiClientCapabilities';

// This is the owned report host's policy, not a general AG-UI/A2A negotiation implementation.
export function admitCapabilities(value, allowedCatalogIds = [reportCatalogId]) {
  const object = item => item !== null && typeof item === 'object' && !Array.isArray(item);
  if (!object(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value, 'v0.9')) {
    throw new Error('Unsupported capability version');
  }
  const version = value['v0.9'];
  if (!object(version) || Object.keys(version).length !== 1 || !Object.hasOwn(version, 'supportedCatalogIds')) {
    throw new Error('Unsupported capability fields');
  }
  const ids = version.supportedCatalogIds;
  if (!Array.isArray(ids) || ids.length > 16 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    throw new Error('Invalid catalog identities');
  }
  if (ids.some(id => !allowedCatalogIds.includes(id))) throw new Error('Unqualified catalog identity');
  return ids[0] ?? null;
}

export function activateReportExtension(context, advertisedExtensions = [extensionUri]) {
  if (!advertisedExtensions.includes(extensionUri) || !context.requestedExtensions?.includes(extensionUri)) {
    throw new Error('Report extension was not negotiated');
  }
  context.addActivatedExtension(extensionUri);
}

export function reportProcessor({ qualified = false } = {}) {
  const viewCatalog = createCatalog({
    id: 'lyra-report-fixture', version: '1',
    components: Object.fromEntries(['stack', 'text', 'chart', 'table', 'stat', 'citation'].map(role => [role, initialCatalog.components[role]])),
    actions: { 'inspect-source': { payload: { type: 'object', properties: { sourceId: { type: 'string' } }, required: ['sourceId'], additionalProperties: false } } },
  });
  const catalog = createA2uiCatalog(viewCatalog);
  return new A2uiProcessor({ catalogs: [catalog], ...(qualified ? { qualifiedCatalogIds: [reportCatalogId] } : {}) });
}

export function reportCapabilities(processor) {
  return { [metadataKey]: a2uiClientCapabilities(processor) };
}
