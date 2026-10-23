import { BackSide, ClampToEdgeWrapping, Color, InstancedMesh, LinearFilter, Matrix4, Mesh, MeshBasicMaterial, RepeatWrapping, ShaderMaterial, SphereGeometry, SRGBColorSpace, Texture } from 'three';
import { LYRA_3D_CONTRACT, type Lyra3dHost, type Lyra3dState, type Lyra3dStyle } from '../core/contract.js';
import { createPickColors, createPickMaterial } from '../core/picking.js';
import type { Lyra3dOrbitCamera } from '../core/orbit.js';
import { DEFAULT_LYRA_3D_STYLE } from '../core/style.js';
import { createLyra3dViewport, type Lyra3dViewport } from '../core/viewport.js';
import { normalizePanoramaCamera, panoramaOrbit, panoramaPoint, projectPanoramaPoint } from './camera.js';
import { inspectPanoramaMedia, probePanoramaMedia, type PanoramaMedia } from './media.js';
import { watchPanoramaVideo } from './video.js';
import type { PanoramaData, PanoramaEngine } from './types.js';
interface PanoramaEngineServices { viewport?: typeof createLyra3dViewport; inspectMedia?: typeof inspectPanoramaMedia; probe?: typeof probePanoramaMedia }
interface Admitted { input: PanoramaData; media: PanoramaMedia; angles: Float32Array; sizes?: Float32Array; categories?: Uint16Array }
/** Uses native video uploads; watchPanoramaVideo exclusively owns frame observation. */
class ObservedVideoTexture extends Texture {
  readonly isVideoTexture = true;
  update(): void {
    const video = this.image as HTMLVideoElement;
    // A paused seek can become uploadable after its last presentation notification.
    // Refresh on an already requested render without scheduling stationary playback.
    if (video.paused && video.readyState >= 2 && !video.seeking) this.needsUpdate = true;
  }
}
function admit(input: PanoramaData, inspect: typeof inspectPanoramaMedia, probe: typeof probePanoramaMedia): Admitted {
  const angles = input.hotspotAngles ?? new Float32Array();
  if (!(angles instanceof Float32Array) || !(angles.buffer instanceof ArrayBuffer) || angles.length % 2 || angles.length > 20000) throw new RangeError('Invalid panorama hotspot angles');
  for (let i = 0; i < angles.length; i++) if (!Number.isFinite(angles[i]) || (i % 2 === 1 && Math.abs(angles[i]!) > Math.fround(Math.PI / 2))) throw new RangeError('Invalid panorama hotspot angle');
  const sizes = input.hotspotSizes, categories = input.hotspotCategories;
  if (sizes !== undefined && (!(sizes instanceof Float32Array) || !(sizes.buffer instanceof ArrayBuffer) || sizes.length !== angles.length / 2)) throw new RangeError('Invalid panorama hotspot sizes');
  if (sizes) for (const size of sizes) if (!Number.isFinite(size) || size < 0 || size > 256) throw new RangeError('Invalid panorama hotspot size');
  if (categories !== undefined && (!(categories instanceof Uint16Array) || !(categories.buffer instanceof ArrayBuffer) || categories.length !== angles.length / 2)) throw new RangeError('Invalid panorama hotspot categories');
  const media = inspect(input.source); probe(media);
  return { input: { source: input.source.kind === 'image' ? { kind: 'image', image: input.source.image } : { kind: 'video', video: input.source.video } }, media, angles: angles.slice(), sizes: sizes?.slice(), categories: categories?.slice() };
}
/** Renders loaded equirectangular media without taking ownership of playback or the source. */
export function createPanoramaEngine(services: PanoramaEngineServices = {}): PanoramaEngine {
  const inspect = services.inspectMedia ?? inspectPanoramaMedia;
  let viewport: Lyra3dViewport | undefined, host: Lyra3dHost | undefined;
  let mounted = false, disposed = false, failed = false, revision = -1, generation = 0, visible = true;
  let data: Admitted | undefined, camera = normalizePanoramaCamera({}), style = DEFAULT_LYRA_3D_STYLE;
  let state: Lyra3dState = { selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 };
  let texture: Texture | undefined, sphere: Mesh<SphereGeometry, ShaderMaterial> | undefined;
  let hotspots: InstancedMesh<SphereGeometry, MeshBasicMaterial> | undefined, picks: InstancedMesh<SphereGeometry, MeshBasicMaterial> | undefined;
  let watcher: ReturnType<typeof watchPanoramaVideo> | undefined, observer: IntersectionObserver | undefined, unframe: (() => void) | undefined;
  const stopVideo = () => { generation++; watcher?.dispose(); watcher = undefined; };
  const fail = () => { if (failed || disposed) return; failed = true; stopVideo(); if (sphere) sphere.visible = false; if (hotspots) hotspots.visible = false; if (picks) picks.visible = false; host?.lost('error', 'Panorama media is no longer available'); };
  const positionOf = (item: number) => data && Number.isInteger(item) && item >= 0 && item < data.angles.length / 2 ? panoramaPoint(data.angles[item * 2]!, Math.max(-Math.PI / 2, Math.min(Math.PI / 2, data.angles[item * 2 + 1]!))) : null;
  const frame = () => {
    if (!viewport || disposed || failed) return;
    if (data && (data.media.kind !== 'video' || (data.media.element as HTMLVideoElement).readyState >= 2)) {
      try { const current = inspect(data.input.source); if (current.width !== data.media.width || current.height !== data.media.height) { fail(); return; } }
      catch { fail(); return; }
    }
    viewport.camera.fov = camera.fieldOfView; viewport.camera.updateProjectionMatrix();
    if (!data || !hotspots || !picks) return;
    const matrix = new Matrix4(), color = new Color(), currentStyle = viewport.style;
    for (let i = 0; i < data.angles.length / 2; i++) {
      const point = positionOf(i)!; const projected = projectPanoramaPoint(point, camera, viewport);
      const size = data.sizes?.[i] ?? Math.min(256, currentStyle.pointSize);
      const radius = projected ? size / (2 * projected.scale) : 0;
      matrix.makeScale(radius, radius, radius); matrix.setPosition(point.x, point.y, point.z);
      hotspots.setMatrixAt(i, matrix); picks.setMatrixAt(i, matrix);
      const rgba = i === state.focus ? currentStyle.focus : state.selected.has(i) || i === state.hover ? currentStyle.accent : !currentStyle.forcedColors && state.dimmed.has(i) ? currentStyle.muted : currentStyle.forcedColors ? currentStyle.foreground : currentStyle.palette[(data.categories?.[i] ?? 0) % currentStyle.palette.length]!;
      color.setRGB(rgba.r, rgba.g, rgba.b, SRGBColorSpace); hotspots.setColorAt(i, color);
    }
    hotspots.instanceMatrix.needsUpdate = true; picks.instanceMatrix.needsUpdate = true;
    if (hotspots.instanceColor) hotspots.instanceColor.needsUpdate = true;
  };
  const startVideo = () => {
    stopVideo(); if (!viewport || !data || data.media.kind !== 'video' || failed || disposed || viewport.lost) return;
    const token = generation; const current = data;
    watcher = watchPanoramaVideo(current.media.element as HTMLVideoElement, (current.media.element as HTMLVideoElement).ownerDocument, () => {
      if (token !== generation || disposed || failed) return;
      try { const next = inspect(current.input.source); if (next.width !== current.media.width || next.height !== current.media.height) { fail(); return; } if (texture) texture.needsUpdate = true; viewport?.invalidate(); } catch { fail(); }
    });
    watcher.setVisible(visible);
  };
  const clear = () => {
    stopVideo(); sphere?.removeFromParent(); sphere?.geometry.dispose(); sphere?.material.dispose(); sphere = undefined;
    texture?.dispose(); texture = undefined;
    hotspots?.removeFromParent(); picks?.removeFromParent(); hotspots?.geometry.dispose(); hotspots?.material.dispose(); picks?.material.dispose(); hotspots?.dispose(); picks?.dispose(); hotspots = undefined; picks = undefined;
  };
  const build = () => {
    clear(); if (!viewport || !data || disposed) return;
    const video = data.media.kind === 'video';
    texture = video ? new ObservedVideoTexture(data.media.element) : new Texture(data.media.element); texture.flipY = false; texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; texture.generateMipmaps = false; texture.wrapS = RepeatWrapping; texture.wrapT = ClampToEdgeWrapping; texture.needsUpdate = true;
    // Video uploads use an unencoded GPU format, so decode source sRGB before output conversion.
    const material = new ShaderMaterial({ side: BackSide, depthWrite: false, defines: video ? { PANORAMA_VIDEO: 1 } : {}, uniforms: { panorama: { value: texture } },
      vertexShader: 'varying vec3 direction; void main(){ direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D panorama; varying vec3 direction;
        void main(){ vec3 d=normalize(direction); vec2 uv=vec2(atan(d.x,-d.z)/6.28318530718+0.5,0.5-asin(clamp(d.y,-1.0,1.0))/3.14159265359); gl_FragColor=texture2D(panorama,uv);
        #ifdef PANORAMA_VIDEO
        gl_FragColor.rgb = mix(gl_FragColor.rgb / 12.92, pow((gl_FragColor.rgb + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), gl_FragColor.rgb));
        #endif
        #include <colorspace_fragment>
        }` });
    sphere = new Mesh(new SphereGeometry(100, 64, 32), material); sphere.renderOrder = -1; viewport.scene.add(sphere);
    const geometry = new SphereGeometry(1, 12, 8), count = data.angles.length / 2;
    hotspots = new InstancedMesh(geometry, new MeshBasicMaterial(), count); picks = new InstancedMesh(geometry, createPickMaterial(), count);
    hotspots.frustumCulled = false; picks.frustumCulled = false;
    const colors = createPickColors(count), color = new Color();
    for (let i = 0; i < count; i++) picks.setColorAt(i, color.setRGB(colors[i * 3]!, colors[i * 3 + 1]!, colors[i * 3 + 2]!));
    viewport.world.add(hotspots); viewport.pickWorld.add(picks); frame(); startVideo(); viewport.invalidate();
  };
  const constrain = (orbit: Lyra3dOrbitCamera) => {
    camera = normalizePanoramaCamera({ yaw: -orbit.yaw, pitch: orbit.pitch, fieldOfView: 360 / Math.PI * Math.atan(Math.tan(camera.fieldOfView * Math.PI / 360) * orbit.distance) });
    return panoramaOrbit(camera);
  };
  const writeCamera = (next: typeof camera) => { camera = normalizePanoramaCamera(next); viewport?.setOrbit(panoramaOrbit(camera)); frame(); viewport?.invalidate(); return camera; };
  return {
    contract: LYRA_3D_CONTRACT,
    async mount(container, nextHost) {
      if (disposed || mounted) throw new Error('Panorama engine cannot be mounted twice'); mounted = true; host = nextHost;
      const current = (services.viewport ?? createLyra3dViewport)(container, {
        hover: (item) => { if (!disposed && !failed) host?.hover(item); }, pick: (item, modifiers) => { if (!disposed && !failed) host?.pick(item, modifiers); },
        camera: () => { if (!disposed && !failed) host?.camera({ ...camera }); },
        rendering: (info) => { if (!disposed) host?.rendering?.(info); },
        lost: (reason, detail) => { if (!disposed) { stopVideo(); host?.lost(reason, detail); } },
        restored: () => { if (!disposed && !failed) { if (texture) texture.needsUpdate = true; startVideo(); frame(); host?.restored?.(); } },
      }, { constrain });
      if (disposed) { current.dispose(); return; } viewport = current; current.setStyle(style); writeCamera(camera); unframe = current.onFrame(frame);
      try { build(); } catch (error) { clear(); current.dispose(); viewport = undefined; throw error; }
      const Observer = container.ownerDocument?.defaultView?.IntersectionObserver;
      if (Observer) { observer = new Observer((entries) => { if (disposed) return; visible = entries.some((entry) => entry.isIntersecting); watcher?.setVisible(visible); }); observer.observe(container); }
    },
    setData(input, nextRevision) {
      if (disposed) return; if (!Number.isSafeInteger(nextRevision) || nextRevision <= revision) throw new RangeError('Panorama revision must increase');
      const next = admit(input, inspect, services.probe ?? probePanoramaMedia);
      data = next; revision = nextRevision; failed = false;
      try { build(); } catch { clear(); fail(); }
    },
    setStyle(next: Lyra3dStyle) { if (!disposed) { style = next; viewport?.setStyle(next); frame(); viewport?.invalidate(); } },
    setState(next) { if (!disposed) { state = { ...next, selected: new Set(next.selected), dimmed: new Set(next.dimmed) }; frame(); viewport?.invalidate(); } },
    setCamera(next) { if (!disposed) writeCamera(next); },
    fit() { return disposed ? camera : writeCamera(normalizePanoramaCamera({})); },
    focus(item, zoom) { if (disposed || !data || !positionOf(item)) return null; return writeCamera({ yaw: data.angles[item * 2]!, pitch: data.angles[item * 2 + 1]!, fieldOfView: zoom ?? camera.fieldOfView }); },
    positionOf,
    project(item) { const point = positionOf(item); return point && viewport && !failed ? projectPanoramaPoint(point, camera, viewport) : null; },
    pick(x, y) { if (failed || disposed) return null; frame(); return viewport?.pickAt(x, y) ?? null; },
    resize(width, height) { viewport?.resize(width, height); frame(); },
    dispose() { if (disposed) return; disposed = true; observer?.disconnect(); unframe?.(); clear(); viewport?.dispose(); viewport = undefined; data = undefined; host = undefined; },
  };
}
