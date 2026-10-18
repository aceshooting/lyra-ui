import '../../../translations/fr/shared.js';
import '../../../translations/fr/retrieval.js';
import '../../../translations/fr/layout.js';
import { registerLyraLocale, resolveLyraString } from '../../../localization.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraNeighborList } from './neighbor-list.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
it('retains the sorted projection on presentation changes across 1,000 neighbors', async () => {
 const rows=Array.from({length:1000},(_,i)=>({relation:'links',direction:'out',node:{id:`n${i}`,label:`Node ${i}`}}));
 const el=await fixture<LyraNeighborList>(html`<lr-neighbor-list .rows=${rows} group-by-relation></lr-neighbor-list>`);
 const seam=el as unknown as {computeSortedRows():unknown};const original=seam.computeSortedRows;let sorts=0;
 seam.computeSortedRows=function(){sorts++;return original.call(this);};
 try {el.expandable=true;await el.updateComplete;recordScaleMeasurement('lr-neighbor-list','presentation@1000',{sorts});expect(sorts).to.equal(0);}
 finally {seam.computeSortedRows=original;}
});
it('refreshes virtual group text and rows after a string override', async () => {
 const rows=Array.from({length:110},(_,i)=>({relation:'links',direction:'out',node:{id:`n${i}`,label:`Node ${i}`}}));
 const el=await fixture<LyraNeighborList>(html`<lr-neighbor-list .rows=${rows} group-by-relation expandable></lr-neighbor-list>`);
 await customElements.whenDefined('lr-virtual-list');
 const list=el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;await list.updateComplete;
 el.strings={neighborGroupHeader:'Updated {relation}',neighborExpand:'Expand newest {label}'};await el.updateComplete;await list.updateComplete;
 await waitUntil(()=>list.shadowRoot!.querySelector('[part="group"]')!==null);
 expect(list.shadowRoot!.textContent).to.contain('Updated links');
 expect(list.shadowRoot!.querySelector('[part="expand-button"]')?.getAttribute('aria-label')).to.contain('Expand newest');
});

it('refreshes same-locale registered group messages and restores the catalog', async () => {
 const rows=Array.from({length:110},(_,i)=>({relation:'links',direction:'out',node:{id:`n${i}`,label:`Node ${i}`}}));
 const el=await fixture<LyraNeighborList>(html`<lr-neighbor-list locale="fr" .rows=${rows} group-by-relation></lr-neighbor-list>`);
 await customElements.whenDefined('lr-virtual-list');
 const list=el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;await list.updateComplete;
 const original=resolveLyraString(el,'neighborGroupHeader');
 const before=list.shadowRoot!.querySelector('[part="group"]')?.textContent;
 try {registerLyraLocale('fr',{neighborGroupHeader:'Fresh {relation}'});el.label='Named update';await el.updateComplete;await list.updateComplete;
 expect(list.shadowRoot!.querySelector('[part="group"]')?.textContent).to.contain('Fresh links');}
 finally {registerLyraLocale('fr',{neighborGroupHeader:original});await el.updateComplete;await list.updateComplete;}
 expect(list.shadowRoot!.querySelector('[part="group"]')?.textContent).to.equal(before);
});
it('forwards an explicit row-renderer closure refresh coalesced with a named write', async () => {
 const rows=Array.from({length:110},(_,i)=>({relation:'links',direction:'out',node:{id:`n${i}`,label:`Node ${i}`}}));
 const el=await fixture<LyraNeighborList>(html`<lr-neighbor-list .rows=${rows}></lr-neighbor-list>`);
 await customElements.whenDefined('lr-virtual-list');
 const list=el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;await list.updateComplete;
 let text='Initial';
 (el as unknown as {renderNeighborRow(row:unknown):unknown}).renderNeighborRow=()=>html`<span>${text}</span>`;
 el.requestUpdate();await el.updateComplete;await list.updateComplete;
 expect(list.shadowRoot!.textContent).to.contain('Initial');
 text='Refreshed';el.label='Changed';el.requestUpdate();await el.updateComplete;await list.updateComplete;
 expect(list.shadowRoot!.textContent).to.contain('Refreshed');
});
