import { expect } from '@open-wc/testing';
import type { ReactiveControllerHost } from 'lit';
import { DropSessionController, readFileList, type DropSessionHost } from './drop-session-controller.js';

function controllerHost(isConnected = true): DropSessionHost {
  const base: ReactiveControllerHost = {
    addController: () => {},
    removeController: () => {},
    requestUpdate: () => {},
    updateComplete: Promise.resolve(true),
  };
  return Object.assign(base, { isConnected });
}

function fakeDragEvent(dataTransfer?: Partial<DataTransfer>): { calls: number; event: DragEvent } {
  const state = { calls: 0 };
  const event = {
    preventDefault: () => { state.calls++; },
    dataTransfer,
  } as unknown as DragEvent;
  return { calls: state.calls, event };
}

function fileItem(kind = 'file'): DataTransferItem {
  return { kind } as DataTransferItem;
}

it('previews accept/reject on drag-enter and resets to default once nested depth returns to zero', () => {
  const stateChanges: string[] = [];
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false,
    previewRejects: () => false,
    onStateChange: () => stateChanges.push(controller.state),
  });

  const enter = fakeDragEvent({ items: [fileItem()] } as unknown as DataTransfer);
  controller.onDragEnter(enter.event);
  expect(controller.state).to.equal('accept');
  expect(controller.dragging).to.equal(true);

  // A nested child fires a second dragenter before the ancestor's dragleave.
  controller.onDragEnter(enter.event);
  const leave = fakeDragEvent();
  controller.onDragLeave(leave.event);
  expect(controller.state, 'still dragging: only one of two nested enters left').to.equal('accept');

  controller.onDragLeave(leave.event);
  expect(controller.state, 'nested depth reached zero').to.equal('default');
  expect(controller.dragging).to.equal(false);
  expect(stateChanges).to.deep.equal(['accept', 'accept', 'default']);
});

it('previews reject when previewRejects reports a rejection', () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false,
    previewRejects: () => true,
    onStateChange: () => {},
  });
  controller.onDragEnter(fakeDragEvent({ items: [fileItem()] } as unknown as DataTransfer).event);
  expect(controller.state).to.equal('reject');
});

it('suppresses the browser default on every handler even while disabled, but takes no session action', () => {
  let stateChangeCount = 0;
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => true,
    previewRejects: () => false,
    onStateChange: () => { stateChangeCount++; },
  });

  const enter = fakeDragEvent({ items: [fileItem()] } as unknown as DataTransfer);
  let prevented = false;
  (enter.event as unknown as { preventDefault: () => void }).preventDefault = () => { prevented = true; };
  controller.onDragEnter(enter.event);
  expect(prevented, 'dragenter default must still be suppressed while disabled').to.equal(true);
  expect(controller.state).to.equal('default');
  expect(stateChangeCount).to.equal(0);

  expect(controller.beginDrop(fakeDragEvent().event), 'beginDrop takes no action while disabled').to.equal(undefined);
});

it('onDragOver always suppresses the browser default, including while disabled', () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => true,
    previewRejects: () => false,
    onStateChange: () => {},
  });
  let prevented = false;
  const event = { preventDefault: () => { prevented = true; } } as unknown as DragEvent;
  controller.onDragOver(event);
  expect(prevented).to.equal(true);
});

it('beginDrop separates synchronously available files from top-level directory entries and resets the session', () => {
  const stateChanges: string[] = [];
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false,
    previewRejects: () => false,
    onStateChange: () => stateChanges.push(controller.state),
  });
  controller.onDragEnter(fakeDragEvent({ items: [fileItem()] } as unknown as DataTransfer).event);
  expect(controller.dragging).to.equal(true);

  const file = new File(['x'], 'a.txt', { type: 'text/plain' });
  const folderEntry = { isDirectory: true, name: 'photos' };
  const transfer = {
    files: [file] as unknown as FileList,
    items: [
      { kind: 'file', webkitGetAsEntry: () => null },
      { kind: 'file', webkitGetAsEntry: () => folderEntry },
    ],
  } as unknown as DataTransfer;

  const result = controller.beginDrop(fakeDragEvent(transfer).event);
  expect(result?.files.map((f) => f.name)).to.deep.equal(['a.txt']);
  expect(result?.folders).to.deep.equal([folderEntry]);
  expect(result?.overLimit).to.equal(false);
  expect(controller.dragging, 'beginDrop always resets the session first').to.equal(false);
  expect(stateChanges.at(-1)).to.equal('default');
});

it('readFolders walks nested directories and resolves the flattened file list', async () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false,
    previewRejects: () => false,
    onStateChange: () => {},
  });
  const nested = new File(['x'], 'nested.csv', { type: 'text/csv' });
  let readCalls = 0;
  const directory = {
    isDirectory: true,
    isFile: false,
    name: 'folder',
    createReader: () => ({
      readEntries: (success: (entries: unknown[]) => void) => {
        readCalls++;
        if (readCalls > 1) return success([]);
        success([{
          isDirectory: false,
          isFile: true,
          name: nested.name,
          file: (onFile: (file: File) => void) => onFile(nested),
        }]);
      },
    }),
  } as unknown as FileSystemEntry;

  const begin = controller.beginDrop(fakeDragEvent({ files: [] as unknown as FileList, items: [] } as unknown as DataTransfer).event);
  const result = await controller.readFolders([directory], begin!.token);
  expect(result.status).to.equal('complete');
  expect(result.status === 'complete' ? result.files.map((f) => f.name) : []).to.deep.equal(['nested.csv']);
});

it('readFolders reports a read error by name when a directory entry fails', async () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false,
    previewRejects: () => false,
    onStateChange: () => {},
  });
  const directory = {
    isDirectory: true,
    isFile: false,
    name: 'broken',
    createReader: () => ({ readEntries: () => { throw new Error('boom'); } }),
  } as unknown as FileSystemEntry;

  const begin = controller.beginDrop(fakeDragEvent({ files: [] as unknown as FileList, items: [] } as unknown as DataTransfer).event);
  const result = await controller.readFolders([directory], begin!.token);
  expect(result).to.deep.equal({ status: 'error', name: 'broken' });
});

it('readFolders cancels an in-flight walk once reset() bumps the token past it', async () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false,
    previewRejects: () => false,
    onStateChange: () => {},
  });
  let resolveEntries: ((entries: unknown[]) => void) | undefined;
  const directory = {
    isDirectory: true,
    isFile: false,
    name: 'slow',
    createReader: () => ({
      readEntries: (success: (entries: unknown[]) => void) => { resolveEntries = success; },
    }),
  } as unknown as FileSystemEntry;

  const begin = controller.beginDrop(fakeDragEvent({ files: [] as unknown as FileList, items: [] } as unknown as DataTransfer).event);
  const pending = controller.readFolders([directory], begin!.token);
  controller.reset();
  resolveEntries?.([]);
  expect(await pending).to.deep.equal({ status: 'cancelled' });
});

it('reset() bumps the token, ending isCurrent() for the previous drop even without a follow-up drop', () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false,
    previewRejects: () => false,
    onStateChange: () => {},
  });
  const begin = controller.beginDrop(fakeDragEvent({ files: [] as unknown as FileList, items: [] } as unknown as DataTransfer).event);
  expect(controller.isCurrent(begin!.token)).to.equal(true);
  controller.reset();
  expect(controller.isCurrent(begin!.token)).to.equal(false);
});

it('hostDisconnected() resets the session', () => {
  const stateChanges: string[] = [];
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false,
    previewRejects: () => false,
    onStateChange: () => stateChanges.push(controller.state),
  });
  controller.onDragEnter(fakeDragEvent({ items: [fileItem()] } as unknown as DataTransfer).event);
  expect(controller.dragging).to.equal(true);
  controller.hostDisconnected();
  expect(controller.dragging).to.equal(false);
});

it('readFileList keeps only real File values from a FileList-shaped object', () => {
  const real = new File(['x'], 'a.txt', { type: 'text/plain' });
  const fake = { name: 'not-a-file' };
  const list = { length: 2, 0: real, 1: fake } as unknown as FileList;
  expect(readFileList(list).map((f) => f.name)).to.deep.equal(['a.txt']);
  expect(readFileList(null)).to.deep.equal([]);
});
