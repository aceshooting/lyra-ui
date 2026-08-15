// `<lr-provenance-panel>` and `<lr-entity-dossier>` are documented as pure event conduits, so the
// events their embedded entity chips, community cards and relationship path strips raise have to be
// part of their typed surface. They bubble and compose regardless; without the declarations a host
// building handlers off the documented event map never learns those affordances exist.
import type {
  LyraEntityDossier,
  LyraEntityDossierEventMap,
} from '../src/components/retrieval/entity-dossier/entity-dossier.js';
import type {
  LyraProvenancePanel,
  LyraProvenancePanelEventMap,
} from '../src/components/retrieval/provenance-panel/provenance-panel.js';

declare const dossier: LyraEntityDossier;
declare const panel: LyraProvenancePanel;

dossier.addEventListener('lr-drill', (event) => {
  const communityId: string = event.detail.communityId;
  void communityId;
});
dossier.addEventListener('lr-entity-open', (event) => {
  const entityId: string = event.detail.entityId;
  void entityId;
});
dossier.addEventListener('lr-entity-activate', (event) => {
  const entityId: string = event.detail.entityId;
  const occurrenceIndex: number | undefined = event.detail.occurrenceIndex;
  void entityId;
  void occurrenceIndex;
});
dossier.addEventListener('lr-relation-activate', (event) => {
  const relation: string = event.detail.relation;
  const sourceNodeId: string | undefined = event.detail.sourceNodeId;
  const targetNodeId: string | undefined = event.detail.targetNodeId;
  const occurrenceIndex: number = event.detail.occurrenceIndex;
  void relation;
  void sourceNodeId;
  void targetNodeId;
  void occurrenceIndex;
});

panel.addEventListener('lr-drill', (event) => {
  const communityId: string = event.detail.communityId;
  void communityId;
});
panel.addEventListener('lr-entity-open', (event) => {
  const entityId: string = event.detail.entityId;
  void entityId;
});
panel.addEventListener('lr-entity-activate', (event) => {
  const entityId: string = event.detail.entityId;
  const occurrenceIndex: number | undefined = event.detail.occurrenceIndex;
  void entityId;
  void occurrenceIndex;
});
panel.addEventListener('lr-relation-activate', (event) => {
  const relation: string = event.detail.relation;
  const sourceNodeId: string | undefined = event.detail.sourceNodeId;
  const targetNodeId: string | undefined = event.detail.targetNodeId;
  const occurrenceIndex: number = event.detail.occurrenceIndex;
  void relation;
  void sourceNodeId;
  void targetNodeId;
  void occurrenceIndex;
});
panel.addEventListener('lr-chunk-open', (event) => {
  const chunkId: string = event.detail.chunkId;
  const sourceId: string = event.detail.sourceId;
  void chunkId;
  void sourceId;
});
panel.addEventListener('lr-expand', (event) => {
  const chunkId: string = event.detail.chunkId;
  const expanded: boolean = event.detail.expanded;
  void chunkId;
  void expanded;
});

const dossierDrill: LyraEntityDossierEventMap['lr-drill'] | undefined =
  undefined;
const dossierOpen: LyraEntityDossierEventMap['lr-entity-open'] | undefined =
  undefined;
const dossierRelation:
  | LyraEntityDossierEventMap['lr-relation-activate']
  | undefined = undefined;
const panelDrill: LyraProvenancePanelEventMap['lr-drill'] | undefined =
  undefined;
const panelOpen: LyraProvenancePanelEventMap['lr-entity-open'] | undefined =
  undefined;
const panelRelation:
  | LyraProvenancePanelEventMap['lr-relation-activate']
  | undefined = undefined;
void dossierDrill;
void dossierOpen;
void dossierRelation;
void panelDrill;
void panelOpen;
void panelRelation;
