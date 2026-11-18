/**
 * Documented kitchen layout format, schemaVersion 1 (usWEB06 3.4.1, D2).
 * Single source of the property names, enumerations and limits used by the
 * validator, the layout value object and the OpenAPI description.
 */
export const SCHEMA_VERSION = 1;
export const UNITS = 'meters';

export const KitchenWall = Object.freeze(['NORTH', 'SOUTH', 'EAST', 'WEST']);
export const ElementCategory = Object.freeze({
  EQUIPMENT: 'EQUIPMENT',
  ASSEMBLY_LINE: 'ASSEMBLY_LINE',
});
export const ELEMENT_TYPES = Object.freeze({
  // VIS02
  EQUIPMENT: Object.freeze([
    'TABLE',
    'COUNTER',
    'WOOD_FIRED_OVEN',
    'DEEP_FRYER',
    'GRIDDLE',
    'GRILL',
    'REFRIGERATOR',
    'DISHWASHER',
    'EXHAUST_HOOD',
    'COOKING_TOOL',
  ]),
  // VIS03
  ASSEMBLY_LINE: Object.freeze([
    'ASSEMBLY_COUNTER',
    'RECEIVING_PLATFORM',
    'DISPENSER',
    'CONVEYOR_BELT',
    'ROBOTIC_ARM',
    'WOOD_FIRED_OVEN',
  ]),
});
export const ModelSource = Object.freeze({
  ASSET: 'ASSET',
  PROCEDURAL: 'PROCEDURAL',
});
export const PROCEDURAL_SHAPES = Object.freeze([
  'BOX',
  'CYLINDER',
  'SPHERE',
  'DOME',
]);
export const MAP_PROPERTIES = Object.freeze([
  'colorMapAssetId',
  'roughnessMapAssetId',
  'normalMapAssetId',
  'bumpMapAssetId',
]);

export const LIMITS = Object.freeze({
  width: Object.freeze({ min: 2, max: 100 }),
  depth: Object.freeze({ min: 2, max: 100 }),
  height: Object.freeze({ min: 2, max: 10 }),
  scale: Object.freeze({ min: 0.01, max: 100 }),
  size: Object.freeze({ min: 0.01, max: 50 }),
  rotation: Object.freeze({ min: -360, max: 360 }),
  unit: Object.freeze({ min: 0, max: 1 }),
  maxElements: 300,
  elementNameLength: 80,
  // VIS03 team interpretation (BR 17, section 7).
  lineMaxWallDistance: 1.5,
  minRoboticArms: 3,
  maxRoboticArms: 12,
  dispenserMaxOffset: 0.75,
});

export const ELEMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;