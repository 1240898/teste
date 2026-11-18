export function isWebGLAvailable(
  createCanvas = () => document.createElement('canvas'),
) {
  try {
    const context = createCanvas().getContext('webgl2');
    if (!context || context.isContextLost?.()) return false;
    // The probe uses a disposable canvas, never the viewer's own canvas.
    context.getExtension?.('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
