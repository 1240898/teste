// Share one tracker across module cleanup, scene sweeps and loaded assets.
export function createResourceDisposer(attempt = (cleanup) => cleanup()) {
  const disposed = new WeakSet();
  return function release(resource, method = 'dispose') {
    if (typeof resource?.[method] !== 'function' || disposed.has(resource))
      return;
    disposed.add(resource);
    attempt(() => resource[method]());
  };
}

function releaseTexture(texture, release, closeImages) {
  if (!texture?.isTexture) return;
  release(texture);
  if (closeImages && typeof ImageBitmap !== 'undefined') {
    const images = Array.isArray(texture.image)
      ? texture.image
      : [texture.image];
    for (const image of images)
      if (image instanceof ImageBitmap) release(image, 'close');
  }
}

function releaseMaterial(material, release, closeImages) {
  if (!material) return;
  for (const value of Object.values(material)) {
    releaseTexture(value, release, closeImages);
  }
  for (const { value } of Object.values(material.uniforms ?? {})) {
    for (const entry of Array.isArray(value) ? value : [value])
      releaseTexture(entry, release, closeImages);
  }
  release(material);
}

export function disposeSceneResources(
  root,
  release,
  { closeImages = false } = {},
) {
  releaseTexture(root.background, release, closeImages);
  releaseTexture(root.environment, release, closeImages);
  root.traverse((object) => {
    release(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      releaseMaterial(material, release, closeImages);
    }
    release(object.skeleton);
    if (object.isInstancedMesh) release(object);
  });
}

export function disposeAsset(resource, release) {
  if (resource?.isTexture) {
    releaseTexture(resource, release, true);
  } else if (resource?.scene) {
    for (const scene of resource.scenes ?? [resource.scene]) {
      disposeSceneResources(scene, release, { closeImages: true });
    }
  }
}
