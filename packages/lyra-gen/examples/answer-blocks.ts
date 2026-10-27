/** Opt in to the composite answer blocks; the overlay has its own catalog identity. */
import { answerBlocksCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { buildCatalogPrompt } from '@aceshooting/lyra-gen/prompts.js';
import { validateView } from '@aceshooting/lyra-gen/runtime.js';
import type { LyraGenView } from '@aceshooting/lyra-gen/types.js';

export const blocksCatalog = answerBlocksCatalog();
export const blocksPrompt = buildCatalogPrompt(blocksCatalog);

/** One node per block; the runtime expands each into primitives with ids `<id>--<index>`. */
export const answerBlocksView: LyraGenView = {
  version: '1',
  catalog: { id: blocksCatalog.id, version: blocksCatalog.version },
  surfaceId: 'answer-blocks',
  revision: 0,
  root: { id: 'answer', type: 'stack', children: [
    { id: 'kpis', type: 'kpi-row', props: { items: [{ label: 'Orders', value: 1240, deltaPercent: 6.2 }, { label: 'Returns', value: 31, deltaPercent: 1.1, goodDirection: 'down' }] } },
    { id: 'plans', type: 'comparison', props: { caption: 'Plan comparison', columns: ['Basic', 'Pro'], rows: [{ label: 'Seats', values: [1, 10] }, { label: 'Support', values: ['Email', 'Priority'] }] } },
    { id: 'rollout', type: 'steps', props: { label: 'Rollout progress', items: [{ label: 'Plan' }, { label: 'Build', description: 'In progress' }, { label: 'Ship' }], current: 1 } },
  ] },
};

/** Validate with the overlay catalog; the result holds the expanded primitive tree when `ok`. */
export const admittedAnswerBlocks = validateView(answerBlocksView, blocksCatalog);
