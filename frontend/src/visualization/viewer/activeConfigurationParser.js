const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isPositive = (value) => Number.isFinite(value) && value > 0;

function invalid() {
  throw new TypeError('Invalid active kitchen configuration');
}

function validateAsset(asset) {
  if (
    !isObject(asset) ||
    !['MODEL', 'TEXTURE'].includes(asset.kind) ||
    !isText(asset.format) ||
    !isText(asset.url)
  ) {
    invalid();
  }
  const url = new URL(asset.url);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    invalid();
}

function requireAsset(assets, id, kind) {
  if (!isText(id) || !Object.hasOwn(assets, id) || assets[id].kind !== kind)
    invalid();
}

function validateMaterial(holder, assets) {
  const material = holder?.material;
  if (material === undefined) return;
  if (!isObject(material)) invalid();
  for (const [key, id] of Object.entries(material))
    if (key.endsWith('MapAssetId')) requireAsset(assets, id, 'TEXTURE');
}

// WEB06 owns validation of the layout itself. Verify the response envelope,
// dimensions and asset references before handing the unchanged data to modules.
export function parseActiveConfiguration(body) {
  if (!isObject(body)) invalid();
  const { id, name, status, version, content, assets } = body;
  const dimensions = content?.kitchen?.dimensions;
  if (
    !isText(id) ||
    !isText(name) ||
    status !== 'ACTIVE' ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    content?.schemaVersion !== 1 ||
    content.units !== 'meters' ||
    !isObject(dimensions) ||
    !['width', 'depth', 'height'].every((axis) =>
      isPositive(dimensions[axis]),
    ) ||
    !Array.isArray(content.elements) ||
    !isObject(assets)
  ) {
    invalid();
  }

  Object.values(assets).forEach(validateAsset);
  validateMaterial(content.kitchen.floor, assets);
  validateMaterial(content.kitchen.walls, assets);
  for (const element of content.elements) {
    if (!isObject(element) || !isText(element.id) || !isObject(element.model))
      invalid();
    if (
      element.model.source === 'ASSET' ||
      Object.hasOwn(element.model, 'assetId')
    )
      requireAsset(assets, element.model.assetId, 'MODEL');
    validateMaterial(element, assets);
  }
  return body;
}
