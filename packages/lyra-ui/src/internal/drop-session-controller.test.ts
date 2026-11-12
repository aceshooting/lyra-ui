import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveControllerHost } from 'lit';
import { DropSessionController, isFileValue, readFileList, type DropSessionHost } from './drop-session-controller.js';

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

it('beginDrop ignores values that are not real Files in dataTransfer.files', () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false,
    previewRejects: () => false,
    onStateChange: () => {},
  });
  const real = new File(['x'], 'a.txt', { type: 'text/plain' });
  const transfer = { files: [{ name: 'not-a-file' }, real] as unknown as FileList, items: [] } as unknown as DataTransfer;
  expect(controller.beginDrop(fakeDragEvent(transfer).event)?.files.map((f) => f.name)).to.deep.equal(['a.txt']);
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

it('rejects a spoofed File tag while accepting genuine files from another realm', () => {
  const fake = {
    [Symbol.toStringTag]: 'File', name: 'pretend.png', lastModified: 0,
    size: 0, type: 'image/png', slice: Blob.prototype.slice,
  };
  expect(isFileValue(fake)).to.equal(false);
  expect(isFileValue(new File(['x'], 'local.txt'))).to.equal(true);
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const ForeignFile = (frame.contentWindow as unknown as { File: typeof File }).File;
    expect(isFileValue(new ForeignFile(['x'], 'foreign.txt'))).to.equal(true);
  } finally {
    frame.remove();
  }
});


it('treats a reader creation failure after session withdrawal as cancellation', async () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false, previewRejects: () => false, onStateChange: () => {},
  });
  const folder = { isDirectory: true, isFile: false, name: 'retired', createReader() {
    controller.reset(); throw new Error('Retired directory unavailable');
  } } as unknown as FileSystemEntry;
  const begin = controller.beginDrop(fakeDragEvent().event)!;
  expect(await controller.readFolders([folder], begin.token)).to.deep.equal({ status: 'cancelled' });
  const replacement = controller.beginDrop(fakeDragEvent().event)!;
  expect(await controller.readFolders([], replacement.token)).to.deep.equal({ status: 'complete', files: [] });
});

for (const operation of ['file', 'directory'] as const) {
  for (const withdrawal of ['reset', 'disable', 'disconnect'] as const) {
    it(`ignores a late ${operation} read error after ${withdrawal} and accepts a new drop`, async () => {
      let disabled = false, fail: (() => void) | undefined;
      const controller = new DropSessionController(controllerHost(), {
        isDisabled: () => disabled, previewRejects: () => false, onStateChange: () => {},
      });
      const file = { isDirectory: false, isFile: true, name: 'pending.txt',
        file(_success: (value: File) => void, error: () => void) { fail = error; } };
      let batches = 0;
      const folder = { isDirectory: true, isFile: false, name: 'pending', createReader: () => ({
        readEntries(success: (entries: unknown[]) => void, error: () => void) {
          if (operation === 'directory') fail = error;
          else success(++batches === 1 ? [file] : []);
        },
      }) } as unknown as FileSystemEntry;
      const begin = controller.beginDrop(fakeDragEvent().event)!;
      const pending = controller.readFolders([folder], begin.token);
      await waitUntil(() => fail !== undefined, 'the file-system read must be pending');
      if (withdrawal === 'reset') controller.reset();
      else if (withdrawal === 'disable') disabled = true;
      else controller.hostDisconnected();
      fail!();
      expect(await pending).to.deep.equal({ status: 'cancelled' });
      expect(controller.isCurrent(begin.token)).to.equal(false);
      disabled = false;
      const replacement = controller.beginDrop(fakeDragEvent().event)!;
      expect(await controller.readFolders([], replacement.token)).to.deep.equal({ status: 'complete', files: [] });
    });
  }

  for (const withdraw of [false, true]) {
    it(`contains a synchronous ${operation} read exception ${withdraw ? 'after withdrawal' : 'in the active session'}`, async () => {
      const controller = new DropSessionController(controllerHost(), {
        isDisabled: () => false, previewRejects: () => false, onStateChange: () => {},
      });
      const reject = () => { if (withdraw) controller.reset(); throw new Error('Native read failed'); };
      const file = { isDirectory: false, isFile: true, name: 'broken.txt', file: reject };
      let batches = 0;
      const folder = { isDirectory: true, isFile: false, name: 'broken', createReader: () => ({
        readEntries(success: (entries: unknown[]) => void) {
          if (operation === 'directory') reject();
          else success(++batches === 1 ? [file] : []);
        },
      }) } as unknown as FileSystemEntry;
      const begin = controller.beginDrop(fakeDragEvent().event)!;
      expect(await controller.readFolders([folder], begin.token)).to.deep.equal(withdraw
        ? { status: 'cancelled' } : { status: 'error', name: operation === 'file' ? 'broken.txt' : 'broken' });
      const replacement = controller.beginDrop(fakeDragEvent().event)!;
      expect(await controller.readFolders([], replacement.token)).to.deep.equal({ status: 'complete', files: [] });
    });
  }
}

it('rejects a root directory list above the traversal budget before opening any reader', async () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false, previewRejects: () => false, onStateChange: () => {},
  });
  let reads = 0;
  const folders = Array.from({ length: 10_001 }, (_, index) => ({
    isDirectory: true, isFile: false, name: `folder-${index}`,
    createReader() { reads++; return { readEntries: (success: (entries: unknown[]) => void) => success([]) }; },
  })) as unknown as FileSystemEntry[];
  const begin = controller.beginDrop(fakeDragEvent().event)!;
  expect(await controller.readFolders(folders, begin.token)).to.deep.equal({ status: 'limit', name: 'folder-10000' });
  expect(reads).to.equal(0);
  expect(await controller.readFolders(folders.slice(0, 1), begin.token)).to.deep.equal({ status: 'complete', files: [] });
  expect(reads).to.equal(1);
});

it('does not open any directory readers for an already retired session', async () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false, previewRejects: () => false, onStateChange: () => {},
  });
  let reads = 0;
  const folder = { isDirectory: true, isFile: false, name: 'stale', createReader() {
    reads++; return { readEntries: (success: (entries: unknown[]) => void) => success([]) };
  } } as unknown as FileSystemEntry;
  const begin = controller.beginDrop(fakeDragEvent().event)!; controller.reset();
  expect(await controller.readFolders([folder], begin.token)).to.deep.equal({ status: 'cancelled' });
  expect(reads).to.equal(0);
});


it('stops before reading a directory whose creation withdraws the session', async () => {
  const controller = new DropSessionController(controllerHost(), {
    isDisabled: () => false, previewRejects: () => false, onStateChange: () => {},
  });
  let reads = 0;
  const folder = { isDirectory: true, isFile: false, name: 'retired', createReader() {
    controller.reset();
    return { readEntries(success: (entries: unknown[]) => void) { reads++; success([]); } };
  } } as unknown as FileSystemEntry;
  const begin = controller.beginDrop(fakeDragEvent().event)!;
  expect(await controller.readFolders([folder], begin.token)).to.deep.equal({ status: 'cancelled' });
  expect(reads).to.equal(0);
});
