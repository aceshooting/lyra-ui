import { BufferGeometry, Camera, Color, CustomBlending, Float32BufferAttribute, LinearFilter, LinearSRGBColorSpace, Mesh, NoBlending, NoToneMapping,
  OneFactor, OneMinusSrcAlphaFactor, RGBAFormat, Scene, ShaderMaterial, UnsignedByteType, Vector2, Vector4, WebGLRenderTarget,
  type PerspectiveCamera, type WebGLRenderer } from 'three';

export interface Lyra3dGlow {
  readonly storageBytes: number;
  resize(width: number, height: number, pixelRatio: number): void;
  /** Validates native attachments and all shader variants without drawing to the visible target. */
  prepare(scene: Scene, camera: PerspectiveCamera): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

/** Half-resolution halo attachments preserve aspect within a bounded physical allocation. */
export function glowTargetSize(width: number, height: number, pixelRatio: number): { width: number; height: number } {
  if (![width, height, pixelRatio].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Invalid glow dimensions');
  const halfWidth = width * pixelRatio / 2, halfHeight = height * pixelRatio / 2;
  if (!Number.isFinite(halfWidth) || !Number.isFinite(halfHeight)) throw new RangeError('Invalid glow dimensions');
  const scale = Math.min(1, 2048 / halfWidth, 2048 / halfHeight, 1024 / Math.sqrt(halfWidth * halfHeight));
  return { width: Math.max(1, Math.floor(halfWidth * scale)), height: Math.max(1, Math.floor(halfHeight * scale)) };
}

const vertex = `varying vec2 uvPosition;
void main(){ uvPosition=uv; gl_Position=vec4(position,1.0); }`;
const blur = `uniform sampler2D source;
uniform vec2 stepSize;
uniform float weights[9];
varying vec2 uvPosition;
void main(){ vec4 sum=vec4(0.0); for(int i=0;i<9;i++){ sum+=texture2D(source,uvPosition+(float(i)-4.0)*stepSize)*weights[i]; } gl_FragColor=sum; }`;
const composite = `uniform sampler2D source;
varying vec2 uvPosition;
void main(){
  vec4 paint=texture2D(source,uvPosition)*0.6;
  if(paint.a<=0.0){ gl_FragColor=vec4(0.0); return; }
  vec4 encoded=linearToOutputTexel(vec4(paint.rgb/paint.a,paint.a));
  gl_FragColor=vec4(encoded.rgb*paint.a,paint.a);
}`;

/** A graph halo using bounded RGBA8 attachments. Picking never enters this visual pipeline. */
export function createLyra3dGlow(renderer: WebGLRenderer): Lyra3dGlow {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const weights = new Float32Array(9); let sum = 0;
  for (let index = 0; index < 9; index++) { const value = Math.exp(-((index - 4) ** 2) / 8); weights[index] = value; sum += value; }
  for (let index = 0; index < 9; index++) weights[index] = weights[index]! / sum;
  const step = new Vector2();
  const blurMaterial = new ShaderMaterial({ vertexShader: vertex, fragmentShader: blur, depthTest: false, depthWrite: false, blending: NoBlending, toneMapped: false,
    uniforms: { source: { value: null }, stepSize: { value: step }, weights: { value: weights } } });
  const compositeMaterial = new ShaderMaterial({ vertexShader: vertex, fragmentShader: composite, depthTest: false, depthWrite: false, transparent: true,
    toneMapped: false, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
    uniforms: { source: { value: null } } });
  const fullscreen = new Scene(), camera = new Camera(), mesh = new Mesh(geometry, blurMaterial); mesh.frustumCulled = false; fullscreen.add(mesh);
  let targets: [WebGLRenderTarget, WebGLRenderTarget, WebGLRenderTarget] | undefined;
  let cssWidth = 1, cssHeight = 1, disposed = false;
  const target = (width: number, height: number, depth: boolean) => new WebGLRenderTarget(width, height, {
    type: UnsignedByteType, format: RGBAFormat, colorSpace: LinearSRGBColorSpace, minFilter: LinearFilter, magFilter: LinearFilter,
    generateMipmaps: false, depthBuffer: depth, stencilBuffer: false, samples: 0,
  });
  const disposeAll = (operations: readonly (() => void)[]) => {
    let first: unknown; let failed = false;
    for (const operation of operations) try { operation(); } catch (error) { if (!failed) { failed = true; first = error; } }
    if (failed) throw first;
  };
  const cleanup = (values: readonly WebGLRenderTarget[]) => disposeAll(values.map(value => () => value.dispose()));
  const resize = (width: number, height: number, pixelRatio: number) => {
    if (disposed) return;
    const size = glowTargetSize(width, height, pixelRatio); cssWidth = width; cssHeight = height;
    if (targets?.[0].width === size.width && targets[0].height === size.height) return;
    const created: WebGLRenderTarget[] = [];
    try { for (let index = 0; index < 3; index++) created.push(target(size.width, size.height, index === 0)); }
    catch (error) { try { cleanup(created); } catch { /* Preserve the allocation failure after independent cleanup. */ } throw error; }
    const old = targets; targets = created as [WebGLRenderTarget, WebGLRenderTarget, WebGLRenderTarget]; if (old) cleanup(old);
  };
  const draw = (scene: Scene, view: PerspectiveCamera, preparing: boolean) => {
      if (disposed) return;
      if (!targets) resize(cssWidth, cssHeight, 1);
      const [source, scratch, halo] = targets!;
      const savedTarget = renderer.getRenderTarget(), savedColor = renderer.getClearColor(new Color()), savedAlpha = renderer.getClearAlpha();
      const savedViewport = renderer.getViewport(new Vector4()), savedScissor = renderer.getScissor(new Vector4()), savedTest = renderer.getScissorTest();
      const saved = { autoClear: renderer.autoClear, color: renderer.autoClearColor, depth: renderer.autoClearDepth, stencil: renderer.autoClearStencil,
        output: renderer.outputColorSpace, tone: renderer.toneMapping, background: scene.background,
        shaderErrors: renderer.debug?.checkShaderErrors, shaderError: renderer.debug?.onShaderError };
      let shaderFailed = false;
      let shaderArguments: Parameters<NonNullable<WebGLRenderer['debug']['onShaderError']>> | undefined;
      const checkShader = () => {
        if (!shaderFailed) return;
        if (saved.shaderError && shaderArguments) saved.shaderError(...shaderArguments);
        throw new Error('Glow shader compilation failed');
      };
      // Three completes its render/compiler bookkeeping before this boundary rejects.
      const render = (drawScene: Scene, drawCamera: Camera) => { renderer.render(drawScene, drawCamera); checkShader(); };
      const compile = (drawScene: Scene, drawCamera: Camera) => { renderer.compile(drawScene, drawCamera); checkShader(); };
      try {
        if (renderer.debug) { renderer.debug.checkShaderErrors = true; renderer.debug.onShaderError = (...args) => { if (!shaderFailed) shaderArguments = args; shaderFailed = true; }; }
        renderer.autoClear = false; renderer.setScissorTest(false); renderer.toneMapping = NoToneMapping;
        // Render-target programs select the working linear color space; direct programs retain
        // their ordinary output transform when the main target is restored.
        renderer.outputColorSpace = LinearSRGBColorSpace; scene.background = null;
        const bind = (target: WebGLRenderTarget) => {
          renderer.setRenderTarget(target);
          if (preparing) {
            const gl = renderer.getContext();
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Glow framebuffer is incomplete');
          }
        };
        bind(source); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false); render(scene, view);
        mesh.material = blurMaterial; blurMaterial.uniforms['source']!.value = source.texture; step.set(2 / cssWidth, 0);
        bind(scratch); renderer.clear(true, false, false); render(fullscreen, camera);
        blurMaterial.uniforms['source']!.value = scratch.texture; step.set(0, 2 / cssHeight);
        bind(halo); renderer.clear(true, false, false); render(fullscreen, camera);
        renderer.outputColorSpace = saved.output; renderer.toneMapping = saved.tone;
        compositeMaterial.uniforms['source']!.value = halo.texture; mesh.material = compositeMaterial;
        if (preparing) {
          // Compile the actual main-target output variants without issuing a visible draw.
          renderer.setRenderTarget(savedTarget);
          compile(fullscreen, camera); compile(scene, view);
          const gl = renderer.getContext();
          for (const program of renderer.info.programs ?? []) {
            if (!gl.getProgramParameter(program.program as WebGLProgram, gl.LINK_STATUS)) throw new Error('Glow shader linkage failed');
          }
          // The vertical blur has finished reading scratch; reuse it for the final two passes.
          bind(scratch); renderer.setScissorTest(false);
        } else {
          renderer.setRenderTarget(savedTarget); renderer.setViewport(savedViewport); renderer.setScissor(savedScissor);
          renderer.setScissorTest(false);
        }
        renderer.setClearColor(savedColor, savedAlpha); renderer.clear(true, true, false);
        if (!preparing) renderer.setScissorTest(savedTest);
        render(fullscreen, camera); render(scene, view);
      } finally {
        scene.background = saved.background;
        renderer.outputColorSpace = saved.output; renderer.toneMapping = saved.tone;
        renderer.autoClear = saved.autoClear; renderer.autoClearColor = saved.color; renderer.autoClearDepth = saved.depth; renderer.autoClearStencil = saved.stencil;
        if (renderer.debug) { renderer.debug.checkShaderErrors = saved.shaderErrors!; renderer.debug.onShaderError = saved.shaderError!; }
        renderer.setRenderTarget(savedTarget); renderer.setClearColor(savedColor, savedAlpha);
        renderer.setViewport(savedViewport); renderer.setScissor(savedScissor); renderer.setScissorTest(savedTest);
      }
  };
  return {
    get storageBytes() { return targets ? targets[0].width * targets[0].height * 16 : 0; },
    resize,
    prepare(scene, view) { draw(scene, view, true); },
    render(scene, view) { draw(scene, view, false); },
    dispose() {
      if (disposed) return;
      disposed = true; const previous = targets; targets = undefined;
      disposeAll([...(previous ?? []).map(value => () => value.dispose()), () => geometry.dispose(), () => blurMaterial.dispose(),
        () => compositeMaterial.dispose(), () => mesh.removeFromParent()]);
    },
  };
}
