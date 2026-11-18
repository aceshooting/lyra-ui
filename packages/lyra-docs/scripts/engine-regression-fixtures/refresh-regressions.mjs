import { createDocxEditor } from 'virtual:docx-engine/editor/docx-editor.ts';
import { blankDocumentBytes } from 'virtual:docx-engine/editor/blank-document.ts';
import { refreshHostFor } from 'virtual:docx-engine/editor/document-refresh-host.ts';
import { refreshGuardSet } from 'virtual:docx-engine/editor/refresh-write-guard.ts';
import { capturePointPosition } from 'virtual:docx-engine/editor/editor-point-target.ts';
import { featureIsPrepared } from 'virtual:docx-engine/features/prepared-runtime.ts';
import { gateNextPreparation } from 'virtual:docx-preparation-gate';
import { tablePreparationRegression } from './table-preparation-regressions.mjs';
function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}
async function bounded(promise, message) {
    let timer;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(message)), 5000);
            })]);
    }
    finally {
        clearTimeout(timer);
    }
}
async function refreshRegression(rejectPreparation) {
    const container = document.createElement('div');
    container.style.cssText = 'width:900px;height:700px;overflow:auto';
    document.body.append(container);
    const editor = createDocxEditor({ container, document: blankDocumentBytes() });
    try {
        await bounded(editor.save(), 'document save readiness did not settle');
        const original = editor.surface;
        assert(original, 'initial document must mount before refresh');
        const host = refreshHostFor(editor);
        const gate = gateNextPreparation();
        const replacement = host.replace(blankDocumentBytes(), 'refresh');
        await bounded(gate.started, 'refresh never entered mandatory preparation');
        assert(refreshGuardSet(container), 'pending refresh must own the write guard');
        if (rejectPreparation) {
            gate.reject(new Error('Deliberate capability preparation failure'));
            assert(await bounded(replacement, 'failed preparation left refresh pending') === false, 'failed preparation must refuse refresh');
            assert(!refreshGuardSet(container), 'failed preparation must release the write guard');
            assert(!editor.snapshot().isOpening, 'failed preparation must settle opening state');
        }
        else {
            host.cancel();
            assert(await bounded(replacement, 'cancelled refresh remained pending') === false, 'cancelled refresh must resolve false');
            assert(!refreshGuardSet(container), 'cancellation must release the write guard');
            gate.release();
            await bounded(gate.finished, 'released preparation did not finish');
            // A task boundary lets the actual load continuation run before observing the owner.
            await new Promise(resolve => setTimeout(resolve, 0));
            await bounded(editor.save(), 'document save readiness did not settle');
            assert(editor.surface === original, 'late preparation mounted cancelled refresh bytes');
            assert(!editor.snapshot().isOpening, 'cancellation must settle opening state');
        }
    }
    finally {
        editor.destroy();
        container.remove();
    }
}
async function chartPasteRegression() {
    const container = document.body.appendChild(document.createElement('div'));
    const editor = createDocxEditor({ container, document: blankDocumentBytes() });
    try {
        await bounded(editor.save(), 'blank document did not mount');
        const surface = editor.surface;
        assert(surface && !featureIsPrepared('drawings'), 'blank document must start without drawings');
        const revision = surface.session.packageRevision();
        const staleChart = '<span data-docx-editor-chart="00000000000000000000000000000000">Chart</span>';
        assert(!await surface.pasteRichPrepared('Chart', staleChart), 'stale chart must refuse the paste');
        assert(surface.session.packageRevision() === revision, 'stale chart must leave the document untouched');
        assert(featureIsPrepared('drawings') && !featureIsPrepared('clipboard-html'),
            'a chart token must prepare drawings without loading the generic HTML parser');

        assert((await editor.execPrepared({ type: 'insertChart', chartType: 'columnClustered' })).ok,
            'chart must be available to copy');
        const { text, html } = surface.copyFlavours();
        assert(html?.includes('data-docx-editor-chart='), 'selected chart must produce a chart token');
        const original = editor.snapshot().chart.drawingNodeId;
        assert(await surface.pasteRichPrepared(text, html), 'a copied chart must paste');
        const pasted = editor.snapshot().chart;
        assert(pasted && pasted.drawingNodeId !== original, 'the pasted chart must be independently selectable');
        const parts = [...surface.session.currentPackage().parts.keys()];
        assert(parts.filter(name => /^\/word\/charts\/chart\d+\.xml$/u.test(name)).length === 2,
            'copy and paste must preserve both chart parts');
    } finally {
        editor.destroy();
        container.remove();
    }
}
async function imageDropRegression() {
    const container = document.body.appendChild(document.createElement('div'));
    const movedHost = document.body.appendChild(document.createElement('div'));
    const editor = createDocxEditor({ container, document: blankDocumentBytes() });
    try {
        await bounded(editor.save(), 'blank document did not mount');
        const surface = editor.surface;
        assert(surface && !featureIsPrepared('drawings'), 'blank document must start without drawings');
        const at = capturePointPosition(surface, surface.state().selection.anchor);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const data = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), char => char.charCodeAt(0));
        const command = { type: 'insertImage', at, data, mime: 'image/png', widthPoints: 10, heightPoints: 10 };
        const pending = editor.executeImageCommand({ ...command, at: undefined });
        const revision = surface.session.packageRevision();
        editor.attach(movedHost);
        const moved = await pending;
        assert(!moved.ok && surface.session.packageRevision() === revision,
            'moving the same surface to a new host must cancel a pending caret insertion');
        command.at = capturePointPosition(surface, surface.state().selection.anchor);
        const copied = await editor.executeImageCommand({ ...command, at: { ...command.at } });
        assert(!copied.ok && copied.code === 'notFound', 'a copied drop point must be refused');
        assert(surface.session.packageRevision() === revision, 'a forged drop point must leave the document untouched');
        const inserted = editor.executeImageCommand(command);
        command.data.fill(0);
        assert((await inserted).ok, 'the original drop point must accept the snapshotted image bytes');
        assert(surface.session.packageRevision() > revision, 'the image must be committed at the drop point');
        const stale = await editor.execPrepared(command);
        assert(!stale.ok && stale.code === 'notFound', 'the used drop point must expire after the edit');
    } finally {
        editor.destroy();
        container.remove();
        movedHost.remove();
    }
}
window.runEngineRegression = async (name) => {
    if (name === 'refresh-preparation-rejection')
        await refreshRegression(true);
    else if (name === 'refresh-preparation-cancellation')
        await refreshRegression(false);
    else if (name === 'image-drop-preparation')
        await imageDropRegression();
    else if (name === 'chart-paste-preparation')
        await chartPasteRegression();
    else if (name === 'table-preparation')
        await tablePreparationRegression();
    else
        throw new Error(`Unknown engine regression ${name}`);
};
