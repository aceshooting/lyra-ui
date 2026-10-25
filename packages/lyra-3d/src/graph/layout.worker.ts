import { serveLyra3dTask } from '../core/worker.js';
import { createGraphIncrementalTaskKernel } from './layout-task.js';

serveLyra3dTask((input: Parameters<typeof createGraphIncrementalTaskKernel>[0]) => createGraphIncrementalTaskKernel(input, { operationsPerStep: 4096 }));
