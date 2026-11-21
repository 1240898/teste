import { Texture, WebGLRenderer, Vector3 } from 'three';
import { ViewerEngine } from '../../src/visualization/scene/ViewerEngine.js';
import { SceneAssetLoader } from '../../src/visualization/scene/SceneAssetLoader.js';
import { defaultSceneModules } from '../../src/visualization/scene/defaultSceneModules.js';
import { parseActiveConfiguration } from '../../src/visualization/viewer/activeConfigurationParser.js';

const host = document.querySelector('#host');
const results = document.querySelector('#results');
const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));
const percentile = (values, fraction) =>
  values.toSorted((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];

async function trial(layout, textured) {
  // Each request gets a fresh URL, including the configuration and all GLBs.
  const nonce = crypto.randomUUID();
  const start = performance.now();
  const data = await (
    await globalThis.fetch(layout + '.json?run=' + nonce)
  ).json();
  for (const asset of Object.values(data.assets)) {
    const folder = !textured && asset.kind === 'MODEL' ? 'bare' : 'assets';
    asset.url = new URL(
      folder + '/' + asset.filename + '?run=' + nonce,
      location.href,
    ).href;
  }
  const configuration = parseActiveConfiguration(data);
  const files = Object.fromEntries(
    Object.entries(data.assets).filter(
      ([, file]) => textured || file.kind === 'MODEL',
    ),
  );
  const loaded = await new SceneAssetLoader().preloadAll(files);
  const placeholder = new Texture();
  const assets = textured
    ? loaded
    : {
        getModel: (id) => loaded.getModel(id),
        getTexture: () => placeholder,
        dispose(release) {
          loaded.dispose(release);
          release(placeholder);
        },
      };
  const canvas = document.createElement('canvas');
  host.replaceChildren(canvas);
  let renderer, context;
  const engine = ViewerEngine.create(canvas, host, {
    pixelRatio: 2,
    rendererFactory: (element) =>
      (renderer = new WebGLRenderer({
        canvas: element,
        antialias: true,
        alpha: true,
      })),
    onFatalError: (error) => {
      throw error;
    },
  });
  // Retain identical geometry and material scalar values in the control run.
  // Validation sees a texture for each declared slot. No placeholder is drawn.
  const probe = () => ({
    name: 'profile',
    build(ctx) {
      context = ctx;
      if (!textured)
        ctx.scene.traverse((object) => {
          if (!object.isMesh) return;
          for (const material of [].concat(object.material)) {
            for (const slot of [
              'map',
              'roughnessMap',
              'normalMap',
              'bumpMap',
              'metalnessMap',
            ])
              material[slot] = null;
          }
        });
    },
    update() {},
    dispose() {},
  });
  let measurements;
  try {
    await engine.load(configuration, assets, [...defaultSceneModules, probe]);
    if (!engine.start()) throw new Error('First render failed');
    const gl = renderer.getContext();
    // Reading one pixel waits for completion of the first GPU draw.
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const loadMs = performance.now() - start;
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = extension
      ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    renderer.setAnimationLoop(null);
    const { camera, scene } = context;
    const centre = new Vector3(
      0,
      data.content.kitchen.dimensions.height / 2,
      0,
    );
    const offset = camera.position.clone().sub(centre);
    const radius = Math.hypot(offset.x, offset.z);
    const intervals = [];
    let previous = await nextFrame();
    for (let frame = 0; frame < 136; frame++) {
      const angle = (2 * Math.PI * frame) / 120;
      camera.position.set(
        centre.x + radius * Math.cos(angle),
        centre.y + offset.y,
        centre.z + radius * Math.sin(angle),
      );
      camera.lookAt(centre);
      renderer.render(scene, camera);
      const now = await nextFrame();
      if (frame >= 16) intervals.push(now - previous);
      previous = now;
    }
    const fps = (1000 * intervals.length) / intervals.reduce((a, b) => a + b);
    measurements = {
      layout,
      textured,
      loadMs: Math.round(loadMs),
      fps: +fps.toFixed(1),
      p95FrameMs: +percentile(intervals, 0.95).toFixed(1),
      textures: renderer.info.memory.textures,
      gpu,
      buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    };
  } finally {
    engine.dispose();
    canvas.remove();
  }
  return {
    ...measurements,
    texturesAfterDisposal: renderer.info.memory.textures,
  };
}

async function run() {
  const records = [];
  for (let pair = 0; pair < 3; pair++) {
    for (const layout of ['compact', 'extended']) {
      for (const textured of pair % 2 ? [true, false] : [false, true]) {
        records.push(await trial(layout, textured));
        results.textContent = JSON.stringify(
          { browser: navigator.userAgent, records },
          null,
          2,
        );
      }
    }
  }
  results.dataset.complete = 'true';
  results.textContent += '\nCOMPLETE';
}
run().catch((error) => {
  results.textContent += '\nERROR ' + error.stack;
});
