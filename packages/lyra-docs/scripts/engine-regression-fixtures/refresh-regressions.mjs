import { createDocxEditor } from 'virtual:docx-engine/editor/docx-editor.ts';
import { blankDocumentBytes } from 'virtual:docx-engine/editor/blank-document.ts';
import { refreshHostFor } from 'virtual:docx-engine/editor/document-refresh-host.ts';
import { refreshGuardSet } from 'virtual:docx-engine/editor/refresh-write-guard.ts';
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
window.runEngineRegression = async (name) => {
    if (name === 'refresh-preparation-rejection')
        await refreshRegression(true);
    else if (name === 'refresh-preparation-cancellation')
        await refreshRegression(false);
    else if (name === 'table-preparation')
        await tablePreparationRegression();
    else
        throw new Error(`Unknown engine regression ${name}`);
};
