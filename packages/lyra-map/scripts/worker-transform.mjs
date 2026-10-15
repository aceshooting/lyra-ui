/**
 * Add lazy worker feature loading to the pinned MapLibre source distribution.
 * Exact source anchors reject incompatible upstream changes during the build.
 *
 * @param {string} code Upstream TypeScript source.
 * @param {string} relativePath Path relative to the upstream src directory.
 * @returns {string | undefined} Transformed source, or undefined for other modules.
 */
export function transformWorker(code, relativePath) {
  const supportedPaths = [
    'source/worker.ts',
    'util/actor_messages.ts',
    'render/subdivision.ts',
    'render/subdivision_granularity_settings.ts'
  ];
  if (!supportedPaths.includes(relativePath)) return undefined;
  const replace = (from, to, expected = 1) => {
    const actual = code.split(from).length - 1;
    if (actual !== expected) {
      throw new Error(`Worker transform match count ${actual} != ${expected} in ${relativePath}: ${from.slice(0, 90)}`);
    }
    code = code.split(from).join(to);
  };
  if (relativePath === 'render/subdivision.ts') {
    replace("import {register} from '../util/web_worker_transfer.ts';\n", '');
    replace(
      "register('SubdivisionGranularityExpression', SubdivisionGranularityExpression);\nregister('SubdivisionGranularitySetting', SubdivisionGranularitySetting);\n",
      ''
    );
    return code;
  }
  if (relativePath === 'render/subdivision_granularity_settings.ts') {
    replace('export class SubdivisionGranularityExpression {', 'export class SubdivisionGranularityExpression {');
    replace('export class SubdivisionGranularitySetting {', 'export class SubdivisionGranularitySetting {');
    return (
      "import {register} from '../util/web_worker_transfer.ts';\n" +
      code +
      "\nregister('SubdivisionGranularityExpression', SubdivisionGranularityExpression);\nregister('SubdivisionGranularitySetting', SubdivisionGranularitySetting);\n"
    );
  }
  if (relativePath === 'util/actor_messages.ts') {
    replace("    setLayers = 'SL',", "    prepareFeatures = 'PF',\n    setLayers = 'SL',");
    replace(
      '    [MessageType.setLayers]: [LayerSpecification[], void];',
      '    [MessageType.prepareFeatures]: [{layers: LayerSpecification[]; sources?: string[]}, void];\n    [MessageType.setLayers]: [LayerSpecification[], void];'
    );
    return code;
  }
  replace(
    'import {Actor, type ActorTarget, type IActor}',
    'import {Actor, type ActorTarget, type IActor, type MessageHandler}'
  );
  replace(
    "import {StyleLayerIndex} from '../style/style_layer_index.ts';",
    "import {StyleLayerIndex} from '../style/style_layer_index.ts';\nimport '../render/subdivision_granularity_settings.ts';"
  );
  replace("import {VectorTileWorkerSource} from './vector_tile_worker_source.ts';", '');
  replace(
    "import {RasterDEMTileWorkerSource} from './raster_dem_tile_worker_source.ts';",
    "import type {RasterDEMTileWorkerSource} from './raster_dem_tile_worker_source.ts';\nimport {prepareStyleLayers} from '../style/create_style_layer.ts';"
  );
  replace(
    'import {GeoJSONWorkerSource, type LoadGeoJSONParameters}',
    'import type {GeoJSONWorkerSource, LoadGeoJSONParameters}'
  );
  replace(
    '/**\n * Loads an external script',
    `const workerSourceConstructors: Record<string, WorkerSourceConstructor> = Object.create(null);
const workerSourceLoaders: Record<string, () => Promise<WorkerSourceConstructor>> = {
    vector: () => import('./vector_tile_worker_source.ts').then(module => module.VectorTileWorkerSource),
    geojson: () => import('./geojson_worker_source.ts').then(module => module.GeoJSONWorkerSource)
};
const workerSourceLoads: Record<string, Promise<void>> = Object.create(null);
let demWorkerConstructor: typeof RasterDEMTileWorkerSource;
let demWorkerLoad: Promise<void> | undefined;
async function prepareWorkerSource(type: string): Promise<void> {
    if (!Object.hasOwn(workerSourceLoaders, type)) return;
    await (workerSourceLoads[type] ??= workerSourceLoaders[type]().then(constructor => {
        workerSourceConstructors[type] = constructor;
    }).catch(error => { delete workerSourceLoads[type]; throw error; }));
}
async function prepareDEMWorkerSource(): Promise<void> {
    await (demWorkerLoad ??= import('./raster_dem_tile_worker_source.ts').then(module => {
        demWorkerConstructor = module.RasterDEMTileWorkerSource;
    }).catch(error => { demWorkerLoad = undefined; throw error; }));
}

/**
 * Loads an external script`
  );
  replace(
    '    globalStates: Map<string, Record<string, any>>;',
    `    globalStates: Map<string, Record<string, any>>;
    private featureAdmissions = new Map<string | number, Promise<void>>();
`
  );
  // Capture registration sites before inserting the implementation that calls Actor itself.
  replace('this.actor.registerMessageHandler(', 'this._registerFeatureHandler(', 19);
  replace(
    '        this.self.makeRequest = makeRequest;',
    `        this.self.makeRequest = makeRequest;

        // Preflight only: module registration cannot modify an active map's layer index.
        this.actor.registerMessageHandler(MessageType.prepareFeatures, async (_mapId, params) => {
            await Promise.all([
                prepareStyleLayers(params.layers),
                ...[...new Set(params.sources ?? [])].map(type => type === 'raster-dem'
                    ? prepareDEMWorkerSource() : prepareWorkerSource(type))
            ]);
        });`
  );
  replace(
    '    private _getGlobalState(',
    `    private _registerFeatureHandler<T extends MessageType>(type: T, handler: MessageHandler<T>): void {
        // Global script/referrer/plugin operations retain their upstream scheduling.
        if (type === MessageType.importScript || type === MessageType.setReferrer || type === MessageType.syncRTLPluginState) {
            this.actor.registerMessageHandler(type, handler);
            return;
        }
        this.actor.registerMessageHandler(type, (mapId, params, abortController) => {
            const previous = this.featureAdmissions.get(mapId) ?? Promise.resolve();
            // Full replacement is an explicit recovery boundary after a failed import.
            const prior = type === MessageType.setLayers || type === MessageType.removeMap
                ? previous.catch(() => {}) : previous;
            let operationStarted = false;
            const admission = prior.then(async () => {
                abortController?.signal.throwIfAborted();
                if (type === MessageType.setLayers) {
                    await prepareStyleLayers(params as LayerSpecification[]);
                } else if (type === MessageType.updateLayers) {
                    await prepareStyleLayers((params as UpdateLayersParameters).layers);
                } else if (type === MessageType.loadDEMTile || type === MessageType.removeDEMTile) {
                    await prepareDEMWorkerSource();
                } else if (type === MessageType.loadTile || type === MessageType.reloadTile ||
                           type === MessageType.abortTile || type === MessageType.removeTile ||
                           type === MessageType.loadData || type === MessageType.getClusterExpansionZoom ||
                           type === MessageType.getClusterChildren || type === MessageType.getClusterLeaves) {
                    await prepareWorkerSource((params as WorkerTileParameters).type);
                }
                abortController?.signal.throwIfAborted();
                // Do not await operation completion: aborts and worker-to-main callbacks
                // must continue while tile/network work is pending.
                operationStarted = true;
                const result = handler(mapId, params, abortController);
                if (type === MessageType.setLayers || type === MessageType.updateLayers) await result;
                return {result};
            });
            const tail = admission.then(() => {}, error => {
                // A canceled admission made no mutation and does not poison later work.
                if (operationStarted || !abortController?.signal.aborted) throw error;
            });
            this.featureAdmissions.set(mapId, tail);
            void tail.then(() => {
                if (this.featureAdmissions.get(mapId) === tail) this.featureAdmissions.delete(mapId);
            }, () => {});
            return admission.then(({result}) => result);
        });
    }

    private _getGlobalState(`
  );
  replace('new VectorTileWorkerSource(actor,', 'new (workerSourceConstructors.vector)(actor,');
  replace('new GeoJSONWorkerSource(actor,', 'new (workerSourceConstructors.geojson)(actor,');
  replace('new RasterDEMTileWorkerSource();', 'new demWorkerConstructor();');
  return code;
}
