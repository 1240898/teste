import { MaterialBuildError } from './MaterialBuildError.js';

// WEB06 MaterialProperties: the only keys accepted by the back end (usVIS04 BR 5).
const SCALAR_KEYS = Object.freeze(['color', 'roughness', 'metalness']);
export const MAP_KEYS = Object.freeze([
  'colorMapAssetId',
  'roughnessMapAssetId',
  'normalMapAssetId',
  'bumpMapAssetId',
]);
const DETAIL_MAP_KEYS = Object.freeze(MAP_KEYS.slice(1));

/** MeshStandardMaterial defaults: they keep the maps unchanged (BR 16, D14). */
export const DEFAULTS = Object.freeze({
  color: '#ffffff',
  roughness: 1,
  metalness: 0,
});

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const isUnitInterval = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/**
 * Light front-end validation of a WEB06 material (usVIS04 D1). The WEB06 back
 * end stays authoritative; texture existence is checked by VIS01 (BR 13).
 *
 * - roughness / metalness within [0, 1]; color as #RRGGBB (BR 15)
 * - colour map + one of roughness / normal / bump map when the material is
 *   required (floor, walls, procedural) or has any map (BR 6)
 * - defaults filled whenever the material has maps; a scalar-only override
 *   keeps only the given values (BR 16)
 *
 * @param {object | undefined} properties WEB06 MaterialProperties
 * @param {{ required?: boolean }} [options]
 * @returns {Readonly<object>} MaterialPropertiesDTO
 */
export function parse(properties, { required = true } = {}) {
  const source = properties ?? {};

  for (const key of ['roughness', 'metalness'])
    if (source[key] !== undefined && !isUnitInterval(source[key]))
      throw new MaterialBuildError(key, 'invalid-range');
  if (
    source.color !== undefined &&
    !(typeof source.color === 'string' && HEX_COLOR.test(source.color))
  )
    throw new MaterialBuildError('color', 'invalid-color');

  const hasMaps = MAP_KEYS.some((key) => source[key]);
  if (required || hasMaps) {
    if (!source.colorMapAssetId)
      throw new MaterialBuildError('colorMapAssetId', 'incomplete-maps');
    if (!DETAIL_MAP_KEYS.some((key) => source[key]))
      throw new MaterialBuildError('roughnessMapAssetId', 'incomplete-maps');
  }

    // Always the same key order, so equal materials give equal JSON (cache, D5).
  const dto = {};
  for (const key of SCALAR_KEYS) {
    const value = source[key] ?? (hasMaps ? DEFAULTS[key] : undefined);
    if (value !== undefined) dto[key] = value;
  }
  for (const key of MAP_KEYS) if (source[key]) dto[key] = source[key];
  return Object.freeze(dto);
}