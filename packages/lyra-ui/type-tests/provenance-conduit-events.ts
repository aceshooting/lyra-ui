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
  const id: string = event.detail.id;
  void id;
});
dossier.addEventListener('lr-entity-open', (event) => {
  const id: string = event.detail.id;
  void id;
});
dossier.addEventListener('lr-entity-activate', (event) => {
  const id: string = event.detail.id;
  void id;
});
dossier.addEventListener('lr-relation-activate', (event) => {
  const relation: string = event.detail.relation;
  const sourceId: string | undefined = event.detail.sourceId;
  const targetId: string | undefined = event.detail.targetId;
  void relation;
  void sourceId;
  void targetId;
});

panel.addEventListener('lr-drill', (event) => {
  const id: string = event.detail.id;
  void id;
});
panel.addEventListener('lr-entity-open', (event) => {
  const id: string = event.detail.id;
  void id;
});
panel.addEventListener('lr-entity-activate', (event) => {
  const id: string = event.detail.id;
  void id;
});
panel.addEventListener('lr-relation-activate', (event) => {
  const relation: string = event.detail.relation;
  const sourceId: string | undefined = event.detail.sourceId;
  const targetId: string | undefined = event.detail.targetId;
  void relation;
  void sourceId;
  void targetId;
});

const dossierDrill: LyraEntityDossierEventMap['lr-drill'] | undefined = undefined;
const dossierOpen: LyraEntityDossierEventMap['lr-entity-open'] | undefined = undefined;
const dossierRelation: LyraEntityDossierEventMap['lr-relation-activate'] | undefined = undefined;
const panelDrill: LyraProvenancePanelEventMap['lr-drill'] | undefined = undefined;
const panelOpen: LyraProvenancePanelEventMap['lr-entity-open'] | undefined = undefined;
const panelRelation: LyraProvenancePanelEventMap['lr-relation-activate'] | undefined = undefined;
void dossierDrill;
void dossierOpen;
void dossierRelation;
void panelDrill;
void panelOpen;
void panelRelation;
