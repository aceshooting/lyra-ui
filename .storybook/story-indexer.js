import { toId } from 'storybook/internal/csf';

export const FAMILY_LABELS = Object.freeze({
  'agent-tools': 'Agent tools',
  charts: 'Charts',
  conversation: 'Conversation',
  data: 'Data',
  forms: 'Forms',
  layout: 'Layout',
  media: 'Media',
  overlays: 'Overlays',
  retrieval: 'Retrieval',
  utility: 'Utility',
  viewers: 'Viewers',
});

function familyLabel(fileName) {
  const normalized = fileName.replaceAll('\\', '/');
  const match = normalized.match(/\/src\/components\/([^/]+)\//);
  return match ? FAMILY_LABELS[match[1]] : undefined;
}

export function groupedStoryTitle(fileName, title) {
  const family = familyLabel(fileName);
  if (!family || !title) return title;
  return title === family || title.startsWith(`${family}/`) ? title : `${family}/${title}`;
}

/**
 * Wrap Storybook's CSF indexer so the sidebar title gains a source-family prefix while the
 * original meta id remains stable. Stable ids preserve existing story/docs URLs and visual
 * baseline names even though the displayed hierarchy becomes grouped.
 */
export function createGroupedStoryIndexer(csfIndexer) {
  return {
    test: csfIndexer.test,
    async createIndex(fileName, options) {
      const inputs = await csfIndexer.createIndex(fileName, options);
      return inputs.map((input) => {
        const originalTitle = input.title ?? options.makeTitle();
        const title = groupedStoryTitle(fileName, originalTitle);
        if (title === originalTitle) return input;
        return {
          ...input,
          title,
          metaId: input.metaId ?? toId(originalTitle),
        };
      });
    },
  };
}
