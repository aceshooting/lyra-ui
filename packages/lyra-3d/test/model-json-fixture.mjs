import { readModelJson } from '../dist/model/model-json-work.js';
import { createModelGeneratorWork } from '../dist/model/model-work-generator.js';

export const createModelJsonWork = bytes => createModelGeneratorWork(() => readModelJson(bytes));
