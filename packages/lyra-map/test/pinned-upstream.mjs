import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

/** Root of the pinned MapLibre package that the build transforms. */
export const upstreamRoot = dirname(require.resolve('maplibre-gl/package.json'));

/** The upstream modules the build rewrites, as `dist/provenance.json` lists them. */
export const CHANGED_SOURCE_FILES = [
  'data/bucket/symbol_bucket.ts',
  'geo/projection/projection_factory.ts',
  'render/image_atlas.ts',
  'render/image_manager.ts',
  'render/painter.ts',
  'render/subdivision.ts',
  'render/subdivision_granularity_settings.ts',
  'shaders/shaders.ts',
  'source/load_tilejson.ts',
  'source/protocol_crud.ts',
  'source/source.ts',
  'source/worker.ts',
  'source/worker_tile.ts',
  'style/create_style_layer.ts',
  'style/load_sprite.ts',
  'style/style.ts',
  'tile/tile.ts',
  'ui/map.ts',
  'util/actor_messages.ts',
  'util/config.ts',
  'util/web_worker_transfer.ts',
  'webgl/draw/index.ts',
  'webgl/program/program_uniforms.ts',
  'webgl/render_to_texture.ts',
];

/** Every TypeScript module of the pinned upstream source tree, as source-relative paths. */
export async function upstreamModules() {
  const source = join(upstreamRoot, 'src');
  const entries = await readdir(source, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(entry.parentPath, entry.name).slice(source.length + 1))
    .sort();
}
