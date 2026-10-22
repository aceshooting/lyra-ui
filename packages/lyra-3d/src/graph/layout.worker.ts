import { serveLyra3dTask } from '../core/worker.js';
import { createGraphTaskKernel } from './layout-task.js';

serveLyra3dTask(createGraphTaskKernel);
