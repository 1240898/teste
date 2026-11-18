import { AssetKind } from '../model/KitchenAsset.js';
import {
  KitchenLayout,
  collectAssetReferences,
} from '../model/KitchenLayout.js';
import {
  COLOR_PATTERN,
  ELEMENT_ID_PATTERN,
  ELEMENT_TYPES,
  ElementCategory,
  KitchenWall,
  LIMITS,
  MAP_PROPERTIES,
  ModelSource,
  PROCEDURAL_SHAPES,
  SCHEMA_VERSION,
  UNITS,
} from '../model/KitchenLayoutFormat.js';
import { AssemblyLineFrame, isRightAngle } from './AssemblyLineFrame.js';

const EPSILON = 1e-9;
const SINGLE_LINE_TYPES = Object.freeze([
  'ASSEMBLY_COUNTER',
  'RECEIVING_PLATFORM',
  'DISPENSER',
  'CONVEYOR_BELT',
  'WOOD_FIRED_OVEN',
]);
// Elements of the line that must stand square to the wall (LINE_ALIGNMENT).
const ALIGNED_LINE_TYPES = Object.freeze([
  'ASSEMBLY_COUNTER',
  'RECEIVING_PLATFORM',
  'CONVEYOR_BELT',
  'WOOD_FIRED_OVEN',
]);
const MATERIAL_PROPERTIES = Object.freeze([
  'color',
  'roughness',
  'metalness',
  ...MAP_PROPERTIES,
]);
const AXES = Object.freeze(['x', 'y', 'z']);

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);
const metres = (value) => Number(value).toFixed(2);
const escapeToken = (token) =>
  String(token).replace(/~/g, '~0').replace(/\//g, '~1');
const pointer = (path, token) => `${path}/${escapeToken(token)}`;
const shortText = (value) => String(value).slice(0, 64);
const leaf = (path) => path.slice(path.lastIndexOf('/') + 1) || 'content';

/** One explained problem of the content (path = JSON Pointer, RFC 6901). */
export class ValidationIssue {
  constructor(path, code, message, params = {}) {
    this.path = path;
    this.code = code;
    this.message = message;
    this.params = params;
    Object.freeze(this.params);
    Object.freeze(this);
  }
}

export class LayoutValidationResult {
  constructor(layout, issues) {
    this.layout = layout;
    this.issues = Object.freeze([...issues]);
    Object.freeze(this);
  }
  isValid() {
    return this.issues.length === 0;
  }
}

/**
 * Domain service of WEB06 (usWEB06 2.4.1): validates a kitchen layout
 * (schemaVersion 1) and collects ALL issues. Pure: the referenced catalogue
 * entries and the availability of their files are supplied by the caller as
 * Map<assetId, { asset: KitchenAsset, fileAvailable: boolean }>.
 */
export class KitchenLayoutValidator {
  static referencedAssetIds(raw) {
    return collectAssetReferences(raw);
  }

  /**
   * @param {unknown} raw
   * @param {Map<string, {asset: import('../model/KitchenAsset.js').KitchenAsset, fileAvailable: boolean}>} [assets]
   * @returns {LayoutValidationResult}
   */
  validate(raw, assets = new Map()) {
    const run = new ValidationRun(assets);
    run.checkDocument(raw);
    return new LayoutValidationResult(
      run.issues.length ? null : KitchenLayout.fromValidated(raw),
      run.issues,
    );
  }
}

class ValidationRun {
  issues = [];
  elements = [];

  constructor(assets) {
    this.assets = assets;
  }

  issue(path, code, message, params = {}) {
    this.issues.push(new ValidationIssue(path, code, message, params));
  }

  // --- generic structure -------------------------------------------------

  object(value, path, { required = [], optional = [] } = {}) {
    if (!isPlainObject(value)) {
      this.issue(path, 'INVALID_TYPE', `${leaf(path)} must be an object`, {
        expected: 'object',
      });
      return false;
    }
    const allowed = new Set([...required, ...optional]);
    for (const key of Object.keys(value))
      if (!allowed.has(key))
        this.issue(
          pointer(path, key),
          'UNKNOWN_PROPERTY',
          `Unknown property "${shortText(key)}"`,
          { property: shortText(key) },
        );
    let complete = true;
    for (const key of required)
      if (value[key] === undefined) {
        this.issue(pointer(path, key), 'REQUIRED', `${key} is required`, {
          property: key,
        });
        complete = false;
      }
    return complete;
  }

  number(value, path) {
    if (isFiniteNumber(value)) return true;
    this.issue(path, 'INVALID_TYPE', `${leaf(path)} must be a finite number`, {
      expected: 'number',
    });
    return false;
  }

  range(value, path, code, { min, max }, unit = '') {
    if (value >= min - EPSILON && value <= max + EPSILON) return true;
    this.issue(
      path,
      code,
      `${leaf(path)} must be between ${min} and ${max}${unit}`,
      { min, max, value },
    );
    return false;
  }

  enumeration(value, path, allowed) {
    if (typeof value === 'string' && allowed.includes(value)) return true;
    this.issue(
      path,
      'INVALID_ENUM',
      `${leaf(path)} must be one of ${allowed.join(', ')}`,
      { value: shortText(value), allowed: allowed.join(', ') },
    );
    return false;
  }

  /** {x, y, z} of finite numbers; `each` adds the per-component rule. */
  vector(value, path, each) {
    if (!this.object(value, path, { required: AXES })) return null;
    let valid = true;
    for (const axis of AXES) {
      const componentPath = pointer(path, axis);
      if (!this.number(value[axis], componentPath)) valid = false;
      else if (each && !each(value[axis], componentPath, axis)) valid = false;
    }
    return valid ? value : null;
  }

  // --- assets --------------------------------------------------------------

  asset(id, path, expectedKind) {
    if (typeof id !== 'string' || !id) {
      this.issue(path, 'INVALID_TYPE', `${leaf(path)} must be an asset id`, {
        expected: 'string',
      });
      return null;
    }
    const entry = this.assets.get(id);
    if (!entry) {
      this.issue(
        path,
        'UNKNOWN_ASSET',
        `Asset "${shortText(id)}" does not exist`,
        {
          assetId: shortText(id),
        },
      );
      return null;
    }
    if (entry.asset.kind !== expectedKind) {
      this.issue(
        path,
        'ASSET_KIND_MISMATCH',
        `Asset "${id}" is not a ${expectedKind}`,
        { assetId: id, expected: expectedKind },
      );
      return null;
    }
    if (!entry.fileAvailable)
      this.issue(
        path,
        'ASSET_FILE_MISSING',
        `The file of asset "${id}" is not available`,
        { assetId: id },
      );
    return entry.asset;
  }

  /**
   * MaterialProperties (BR 18): colour, roughness, metalness and a texture set
   * (colour map + roughness / normal / bump map). Returns whether it has a map.
   */
  material(value, path, required) {
    if (value === undefined) {
      if (required)
        this.issue(
          path,
          'MATERIAL_REQUIRED',
          'A material with a texture set is required',
        );
      return { anyMap: false };
    }
    if (!this.object(value, path, { optional: MATERIAL_PROPERTIES }))
      return { anyMap: false };
    if (
      value.color !== undefined &&
      (typeof value.color !== 'string' || !COLOR_PATTERN.test(value.color))
    )
      this.issue(
        pointer(path, 'color'),
        'INVALID_MATERIAL',
        'color must be #RRGGBB',
        { variant: 'color' },
      );
    for (const property of ['roughness', 'metalness'])
      if (value[property] !== undefined) {
        const propertyPath = pointer(path, property);
        if (
          !isFiniteNumber(value[property]) ||
          value[property] < LIMITS.unit.min ||
          value[property] > LIMITS.unit.max
        )
          this.issue(
            propertyPath,
            'INVALID_MATERIAL',
            `${property} must be between 0 and 1`,
            { variant: 'range', min: 0, max: 1 },
          );
      }
    const present = MAP_PROPERTIES.filter(
      (property) => value[property] !== undefined,
    );
    for (const property of present)
      this.asset(value[property], pointer(path, property), AssetKind.TEXTURE);
    if (present.length === 0) {
      if (required)
        this.issue(
          path,
          'MATERIAL_REQUIRED',
          'The material needs a texture set (colour map and a roughness, normal or bump map)',
        );
      return { anyMap: false };
    }
    const hasColour = present.includes('colorMapAssetId');
    const hasSecondMap = present.some(
      (property) => property !== 'colorMapAssetId',
    );
    if (!hasColour)
      this.issue(
        path,
        'INCOMPLETE_TEXTURE_SET',
        'A texture set needs a colour map (colorMapAssetId)',
        { variant: 'noColor' },
      );
    else if (!hasSecondMap)
      this.issue(
        path,
        'INCOMPLETE_TEXTURE_SET',
        'A colour map needs a roughness, normal or bump map',
        { variant: 'colorOnly' },
      );
    return { anyMap: true };
  }

  // --- document ------------------------------------------------------------

  checkDocument(raw) {
    if (!isPlainObject(raw)) {
      this.issue('', 'INVALID_TYPE', 'The content must be a JSON object', {
        expected: 'object',
      });
      return;
    }
    this.object(raw, '', {
      required: [
        'schemaVersion',
        'units',
        'kitchen',
        'assemblyLine',
        'elements',
      ],
    });
    if (raw.schemaVersion !== undefined && raw.schemaVersion !== SCHEMA_VERSION)
      this.issue(
        '/schemaVersion',
        'UNSUPPORTED_SCHEMA_VERSION',
        `schemaVersion must be ${SCHEMA_VERSION}`,
        { expected: SCHEMA_VERSION },
      );
    if (raw.units !== undefined && raw.units !== UNITS)
      this.issue(
        '/units',
        'UNSUPPORTED_SCHEMA_VERSION',
        `units must be "${UNITS}"`,
        { expected: UNITS },
      );
    const dimensions =
      raw.kitchen === undefined ? null : this.checkKitchen(raw.kitchen);
    const wall =
      raw.assemblyLine === undefined
        ? null
        : this.checkAssemblyLineWall(raw.assemblyLine);
    if (raw.elements !== undefined)
      this.checkElements(raw.elements, dimensions);
    if (Array.isArray(raw.elements)) this.checkAssemblyLine(dimensions, wall);
  }

  checkKitchen(kitchen) {
    if (
      !this.object(kitchen, '/kitchen', {
        required: ['dimensions', 'floor', 'walls'],
      }) &&
      !isPlainObject(kitchen)
    )
      return null;
    let dimensions = null;
    if (kitchen.dimensions !== undefined) {
      const path = '/kitchen/dimensions';
      if (
        this.object(kitchen.dimensions, path, {
          required: ['width', 'depth', 'height'],
        })
      ) {
        let valid = true;
        for (const field of ['width', 'depth', 'height']) {
          const fieldPath = pointer(path, field);
          if (
            !this.number(kitchen.dimensions[field], fieldPath) ||
            !this.range(
              kitchen.dimensions[field],
              fieldPath,
              'INVALID_DIMENSION',
              LIMITS[field],
              ' metres',
            )
          )
            valid = false;
        }
        if (valid) dimensions = kitchen.dimensions;
      }
    }
    for (const surface of ['floor', 'walls']) {
      if (kitchen[surface] === undefined) continue;
      const path = `/kitchen/${surface}`;
      if (this.object(kitchen[surface], path, { optional: ['material'] }))
        this.material(kitchen[surface].material, `${path}/material`, true);
    }
    return dimensions;
  }

  checkAssemblyLineWall(assemblyLine) {
    if (!this.object(assemblyLine, '/assemblyLine', { required: ['wall'] }))
      return null;
    return this.enumeration(
      assemblyLine.wall,
      '/assemblyLine/wall',
      KitchenWall,
    )
      ? assemblyLine.wall
      : null;
  }

  checkElements(elements, dimensions) {
    if (!Array.isArray(elements)) {
      this.issue('/elements', 'INVALID_TYPE', 'elements must be an array', {
        expected: 'array',
      });
      return;
    }
    if (elements.length > LIMITS.maxElements)
      this.issue(
        '/elements',
        'MISSING_CATEGORY',
        `A layout has at most ${LIMITS.maxElements} elements`,
        { variant: 'tooMany', max: LIMITS.maxElements },
      );
    const seen = new Map();
    elements.forEach((element, index) => {
      const record = this.checkElement(element, index, dimensions);
      if (!record) return;
      this.elements.push(record);
      if (typeof record.id === 'string' && ELEMENT_ID_PATTERN.test(record.id)) {
        if (seen.has(record.id))
          this.issue(
            `/elements/${index}/id`,
            'DUPLICATE_ELEMENT_ID',
            `Element id "${record.id}" is already used by /elements/${seen.get(record.id)}`,
            { id: record.id, other: `/elements/${seen.get(record.id)}` },
          );
        else seen.set(record.id, index);
      }
    });
    if (
      !this.elements.some(
        (record) => record.category === ElementCategory.EQUIPMENT,
      )
    )
      this.issue(
        '/elements',
        'MISSING_CATEGORY',
        'The layout needs at least one EQUIPMENT element',
        { variant: 'noEquipment' },
      );
  }

  checkElement(element, index, dimensions) {
    const path = `/elements/${index}`;
    if (
      !this.object(element, path, {
        required: ['id', 'category', 'type', 'model', 'placement'],
        optional: ['name', 'material'],
      }) &&
      !isPlainObject(element)
    )
      return null;

    if (
      element.id !== undefined &&
      (typeof element.id !== 'string' || !ELEMENT_ID_PATTERN.test(element.id))
    )
      this.issue(
        `${path}/id`,
        'INVALID_ELEMENT_ID',
        'Element ids use 1 to 64 letters, digits, "_" or "-"',
        { value: shortText(element.id) },
      );
    if (
      element.name !== undefined &&
      (typeof element.name !== 'string' ||
        element.name.trim().length < 1 ||
        element.name.length > LIMITS.elementNameLength)
    )
      this.issue(
        `${path}/name`,
        'INVALID_TYPE',
        `name must be a text of 1 to ${LIMITS.elementNameLength} characters`,
        { expected: 'string' },
      );

    let category = null;
    if (
      element.category !== undefined &&
      this.enumeration(
        element.category,
        `${path}/category`,
        Object.values(ElementCategory),
      )
    )
      category = element.category;
    let type = null;
    if (
      category &&
      element.type !== undefined &&
      this.enumeration(element.type, `${path}/type`, ELEMENT_TYPES[category])
    )
      type = element.type;

    const model =
      element.model === undefined ? null : this.checkModel(element.model, path);
    const placement =
      element.placement === undefined
        ? null
        : this.checkPlacement(
            element.placement,
            `${path}/placement`,
            dimensions,
          );
    const material = this.material(
      element.material,
      `${path}/material`,
      model?.source === ModelSource.PROCEDURAL,
    );
    if (
      model?.asset?.isModel() &&
      model.asset.embeddedTextureSet === false &&
      !material.anyMap
    )
      this.issue(
        `${path}/material`,
        'MODEL_TEXTURES_MISSING',
        `Model "${model.asset.id}" has no complete texture set: define a material with a texture set`,
        { assetId: model.asset.id },
      );

    return {
      index,
      path,
      id: element.id,
      category,
      type,
      placement,
      size: model?.size ?? null,
    };
  }

  checkModel(model, elementPath) {
    const path = `${elementPath}/model`;
    if (!isPlainObject(model)) {
      this.object(model, path);
      return null;
    }
    const source = model.source;
    if (source === ModelSource.ASSET) {
      if (!this.object(model, path, { required: ['source', 'assetId'] }))
        return { source };
      const asset = this.asset(
        model.assetId,
        `${path}/assetId`,
        AssetKind.MODEL,
      );
      return { source, asset, size: asset?.size ?? null };
    }
    if (source === ModelSource.PROCEDURAL) {
      if (!this.object(model, path, { required: ['source', 'shape', 'size'] }))
        return { source };
      this.enumeration(model.shape, `${path}/shape`, PROCEDURAL_SHAPES);
      const size = this.vector(
        model.size,
        `${path}/size`,
        (value, componentPath) =>
          this.range(
            value,
            componentPath,
            'INVALID_SCALE',
            LIMITS.size,
            ' metres',
          ),
      );
      return { source, size };
    }
    this.object(model, path, {
      required: ['source'],
      optional: ['assetId', 'shape', 'size'],
    });
    if (source !== undefined)
      this.enumeration(source, `${path}/source`, Object.values(ModelSource));
    return null;
  }

  checkPlacement(placement, path, dimensions) {
    if (
      !this.object(placement, path, {
        required: ['position', 'rotation', 'scale'],
      })
    )
      return null;
    const bounds = dimensions && {
      x: { min: -dimensions.width / 2, max: dimensions.width / 2 },
      y: { min: 0, max: dimensions.height },
      z: { min: -dimensions.depth / 2, max: dimensions.depth / 2 },
    };
    const position = this.vector(
      placement.position,
      `${path}/position`,
      (value, componentPath, axis) =>
        !bounds ||
        this.range(
          value,
          componentPath,
          'OUT_OF_BOUNDS',
          bounds[axis],
          ' metres',
        ),
    );
    const rotation = this.vector(
      placement.rotation,
      `${path}/rotation`,
      (value, componentPath) =>
        this.range(
          value,
          componentPath,
          'INVALID_ROTATION',
          LIMITS.rotation,
          ' degrees',
        ),
    );
    const scale = this.vector(
      placement.scale,
      `${path}/scale`,
      (value, componentPath) =>
        this.range(value, componentPath, 'INVALID_SCALE', LIMITS.scale),
    );
    return position && rotation && scale ? { position, rotation, scale } : null;
  }

  // --- assembly line (VIS03, BR 17, 2.4.2, 2.4.3) ----------------------------

  checkAssemblyLine(dimensions, wall) {
    const line = this.elements.filter(
      (record) =>
        record.category === ElementCategory.ASSEMBLY_LINE && record.type,
    );
    const ofType = (type) => line.filter((record) => record.type === type);
    for (const type of SINGLE_LINE_TYPES) {
      const found = ofType(type).length;
      if (found !== 1)
        this.issue(
          '/elements',
          'LINE_COMPOSITION',
          `The assembly line needs exactly one ${type} (found ${found})`,
          { variant: 'exactlyOne', type, found },
        );
    }
    const arms = ofType('ROBOTIC_ARM');
    if (
      arms.length < LIMITS.minRoboticArms ||
      arms.length > LIMITS.maxRoboticArms
    )
      this.issue(
        '/elements',
        'LINE_COMPOSITION',
        `The assembly line needs ${LIMITS.minRoboticArms} to ${LIMITS.maxRoboticArms} ROBOTIC_ARM elements (found ${arms.length})`,
        {
          variant: 'arms',
          min: LIMITS.minRoboticArms,
          max: LIMITS.maxRoboticArms,
          found: arms.length,
        },
      );
    if (!dimensions || !wall) return;

    const frame = AssemblyLineFrame.of(wall, dimensions);
    const placed = line.filter((record) => record.placement);
    for (const record of placed) {
      const distance = frame.d(record.placement.position);
      if (distance > LIMITS.lineMaxWallDistance + EPSILON)
        this.issue(
          `${record.path}/placement/position`,
          'LINE_NOT_AT_WALL',
          `${record.type} is ${metres(distance)} m from the ${wall} wall (at most ${LIMITS.lineMaxWallDistance} m)`,
          { distance: metres(distance), wall, max: LIMITS.lineMaxWallDistance },
        );
    }
    const aligned = new Set();
    for (const record of placed.filter((item) =>
      ALIGNED_LINE_TYPES.includes(item.type),
    ))
      if (this.checkAlignment(record, frame)) aligned.add(record);

    const single = (type) => {
      const items = ofType(type);
      return items.length === 1 && items[0].placement ? items[0] : null;
    };
    const platform = single('RECEIVING_PLATFORM');
    const oven = single('WOOD_FIRED_OVEN');
    const belt = single('CONVEYOR_BELT');
    const dispenser = single('DISPENSER');
    const u = (record) => frame.u(record.placement.position);
    const order = (record, variant, message, params = {}) =>
      this.issue(`${record.path}/placement/position`, 'LINE_ORDER', message, {
        variant,
        ...params,
      });

    if (platform && oven) {
      if (!(u(platform) < u(oven) - EPSILON))
        order(
          oven,
          'platformAfterOven',
          'The receiving platform must be at the left end and the oven at the right end of the line',
        );
      for (const arm of arms.filter((item) => item.placement))
        if (!(u(platform) < u(arm) - EPSILON && u(arm) < u(oven) - EPSILON))
          order(
            arm,
            'armOutside',
            'Robotic arms must be between the receiving platform and the oven',
          );
      if (
        belt &&
        !(u(platform) <= u(belt) + EPSILON && u(belt) <= u(oven) + EPSILON)
      )
        order(
          belt,
          'beltOutside',
          'The conveyor belt must be between the receiving platform and the oven',
        );
    }
    if (dispenser && platform) {
      const offset = Math.abs(u(dispenser) - u(platform));
      if (offset > LIMITS.dispenserMaxOffset + EPSILON)
        order(
          dispenser,
          'dispenserFar',
          `The dispenser must be within ${LIMITS.dispenserMaxOffset} m of the receiving platform (it is ${metres(offset)} m away)`,
          { max: LIMITS.dispenserMaxOffset, distance: metres(offset) },
        );
      if (
        !(
          dispenser.placement.position.y >
          platform.placement.position.y + EPSILON
        )
      )
        order(
          dispenser,
          'dispenserLow',
          'The dispenser must be above the receiving platform',
        );
    }
    if (
      platform &&
      oven &&
      belt &&
      platform.size &&
      oven.size &&
      belt.size &&
      aligned.has(platform) &&
      aligned.has(oven) &&
      aligned.has(belt)
    )
      this.checkBeltConnection(frame, platform, belt, oven);
  }

  checkAlignment(record, frame) {
    const { rotation } = record.placement;
    const path = `${record.path}/placement/rotation`;
    let aligned = true;
    for (const axis of ['x', 'z'])
      if (Math.abs(rotation[axis]) > EPSILON) {
        this.issue(
          `${path}/${axis}`,
          'LINE_ALIGNMENT',
          `${record.type} may only be rotated around Y`,
          { variant: 'tilted' },
        );
        aligned = false;
      }
    if (!isRightAngle(rotation.y)) {
      this.issue(
        `${path}/y`,
        'LINE_ALIGNMENT',
        `${record.type} rotation.y must be a multiple of 90 degrees`,
        { variant: 'notRightAngle' },
      );
      aligned = false;
    } else if (
      record.type === 'CONVEYOR_BELT' &&
      !frame.isAlongWall(rotation.y)
    ) {
      this.issue(
        `${path}/y`,
        'LINE_ALIGNMENT',
        'The conveyor belt (model +X) must run along the wall',
        { variant: 'beltAcross' },
      );
      aligned = false;
    }
    return aligned;
  }

  checkBeltConnection(frame, platformRecord, beltRecord, ovenRecord) {
    const gap = AssemblyLineFrame.GAP_TOLERANCE;
    const level = AssemblyLineFrame.LEVEL_TOLERANCE;
    const P = frame.span(platformRecord.placement, platformRecord.size);
    const B = frame.span(beltRecord.placement, beltRecord.size);
    const O = frame.span(ovenRecord.placement, ovenRecord.size);
    const path = `${beltRecord.path}/placement/position`;
    const disconnected = (variant, message, params = {}) =>
      this.issue(path, 'LINE_BELT_DISCONNECTED', message, {
        variant,
        ...params,
      });

    if (B.uMin < P.uMin - EPSILON)
      disconnected(
        'startsBefore',
        `The conveyor belt starts ${metres(P.uMin - B.uMin)} m before the receiving platform`,
        { distance: metres(P.uMin - B.uMin) },
      );
    else if (B.uMin > P.uMax + gap + EPSILON)
      disconnected(
        'startsAfter',
        `The conveyor belt starts ${metres(B.uMin - P.uMax)} m after the receiving platform`,
        { distance: metres(B.uMin - P.uMax) },
      );
    if (B.uMax > O.uMax + EPSILON)
      disconnected(
        'endsAfter',
        `The conveyor belt ends ${metres(B.uMax - O.uMax)} m beyond the oven`,
        { distance: metres(B.uMax - O.uMax) },
      );
    else if (B.uMax < O.uMin - gap - EPSILON)
      disconnected(
        'endsBefore',
        `The conveyor belt ends ${metres(O.uMin - B.uMax)} m before the oven`,
        { distance: metres(O.uMin - B.uMax) },
      );
    const overlaps = (a, b) =>
      a.dMin < b.dMax - EPSILON && b.dMin < a.dMax - EPSILON;
    if (!overlaps(B, P))
      disconnected(
        'depthPlatform',
        'The conveyor belt does not reach the receiving platform in depth',
      );
    if (!overlaps(B, O))
      disconnected(
        'depthOven',
        'The conveyor belt does not reach the oven in depth',
      );
    if (Math.abs(B.top - P.top) > level + EPSILON)
      disconnected(
        'levelPlatform',
        `The top of the conveyor belt is ${metres(Math.abs(B.top - P.top))} m from the top of the receiving platform (at most ${level} m)`,
        { distance: metres(Math.abs(B.top - P.top)), max: level },
      );
    // The oven entrance opens at the base of the oven model (origin at the
    // bottom centre, 2.4.3): the belt must reach it, not pass under it.
    if (B.top < O.bottom - level - EPSILON)
      disconnected(
        'belowOven',
        `The top of the conveyor belt is ${metres(O.bottom - B.top)} m below the oven entrance (at most ${level} m)`,
        { distance: metres(O.bottom - B.top), max: level },
      );
    else if (!(B.top < O.top - EPSILON))
      disconnected(
        'levelOven',
        'The top of the conveyor belt must be below the top of the oven',
    );
  }
}