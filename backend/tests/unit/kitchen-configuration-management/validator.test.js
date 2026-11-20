import { KitchenLayoutValidator } from '../../../src/modules/kitchen-configuration-management/domain/services/KitchenLayoutValidator.js';
import {
  assetContext,
  sample,
} from '../../helpers/kitchenConfigurationFixtures.js';

const validator = new KitchenLayoutValidator();
const validate = (content, assets = assetContext()) =>
  validator.validate(content, assets);
const codes = (result) => result.issues.map((issue) => issue.code);
const issue = (result, code) =>
  result.issues.filter((item) => item.code === code);
const element = (layout, id) => layout.elements.find((item) => item.id === id);

const indexOf = (layout, id) =>
  layout.elements.findIndex((item) => item.id === id);

describe('WEB06 KitchenLayoutValidator', () => {
  test('UT01 - the compact and extended samples are valid', () => {
    for (const name of ['compact', 'extended']) {
      const result = validate(sample(name));
      expect(result.issues).toEqual([]);
      expect(result.isValid()).toBe(true);
      expect(result.layout.elementCount).toBe(sample(name).elements.length);
    }
  });

  test('UT02 - missing required properties are reported with JSON Pointer paths', () => {
    const layout = sample('compact');
    delete layout.kitchen.dimensions.height;
    delete layout.elements[0].placement;
    delete layout.assemblyLine;
    const result = validate(layout);
    expect(issue(result, 'REQUIRED').map((item) => item.path)).toEqual(
      expect.arrayContaining([
        '/kitchen/dimensions/height',
        '/elements/0/placement',
        '/assemblyLine',
      ]),
    );
    expect(result.layout).toBeNull();
  });

  test('UT03 - dimensions out of range or of the wrong type', () => {
    const layout = sample('compact');
    layout.kitchen.dimensions = { width: 1, depth: 101, height: 0 };
    expect(
      issue(validate(layout), 'INVALID_DIMENSION').map((item) => item.path),
    ).toEqual([
      '/kitchen/dimensions/width',
      '/kitchen/dimensions/depth',
      '/kitchen/dimensions/height',
    ]);
    layout.kitchen.dimensions = { width: Number.NaN, depth: '5', height: 3 };
    expect(
      issue(validate(layout), 'INVALID_TYPE').map((item) => item.path),
    ).toEqual(['/kitchen/dimensions/width', '/kitchen/dimensions/depth']);
  });

  test('UT04 - scale, rotation and bounds', () => {
    const layout = sample('compact');
    const fridge = element(layout, 'fridge-1');
    fridge.placement.scale = { x: 0, y: -1, z: 101 };
    fridge.placement.rotation.y = 400;
    fridge.placement.position = { x: 7, y: 4, z: 0 };
    const result = validate(layout);
    expect(issue(result, 'INVALID_SCALE')).toHaveLength(3);
    expect(issue(result, 'INVALID_ROTATION')[0].path).toBe(
      '/elements/8/placement/rotation/y',
    );
    expect(issue(result, 'OUT_OF_BOUNDS').map((item) => item.path)).toEqual([
      '/elements/8/placement/position/x',
      '/elements/8/placement/position/y',
    ]);
  });

  test('UT05 - duplicate and malformed element ids', () => {
    const layout = sample('compact');
    element(layout, 'table-1').id = 'line-oven';
    element(layout, 'fridge-1').id = 'my fridge';
    const result = validate(layout);
    expect(issue(result, 'DUPLICATE_ELEMENT_ID')).toEqual([
      expect.objectContaining({
        path: '/elements/9/id',
        message: 'Element id "line-oven" is already used by /elements/7',
      }),
    ]);
    expect(issue(result, 'INVALID_ELEMENT_ID')[0].path).toBe('/elements/8/id');
  });

  test('UT06 - unknown asset, wrong kind and missing file', () => {
    const layout = sample('compact');
    element(layout, 'fridge-1').model.assetId = 'AST-MDL-OVEN-99';
    element(layout, 'line-oven').model.assetId = 'AST-TEX-STEEL-COLOR';
    element(layout, 'line-counter').material.colorMapAssetId =
      'AST-MDL-FRIDGE-01';
    const result = validate(layout, assetContext(['models/dispenser-02.glb']));
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'UNKNOWN_ASSET',
        'ASSET_KIND_MISMATCH',
        'ASSET_FILE_MISSING',
      ]),
    );
    expect(
      issue(result, 'ASSET_KIND_MISMATCH').map((item) => item.path),
    ).toEqual([
      '/elements/0/material/colorMapAssetId',
      '/elements/7/model/assetId',
    ]);
    expect(issue(result, 'ASSET_FILE_MISSING')[0].path).toBe(
      '/elements/2/model/assetId',
    );
  });

  test('UT07 - unknown properties, schema version and categories, all together', () => {
    const layout = sample('compact');
    layout.elements[0].placment = {};
    layout.$where = 'x';
    layout.schemaVersion = 2;
    layout.elements = layout.elements.filter(
      (item) => item.category !== 'EQUIPMENT',
    );
    const result = validate(layout);
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        'UNKNOWN_PROPERTY',
        'UNSUPPORTED_SCHEMA_VERSION',
        'MISSING_CATEGORY',
      ]),
    );
    expect(issue(result, 'UNKNOWN_PROPERTY').map((item) => item.path)).toEqual([
      '/$where',
      '/elements/0/placment',
    ]);
  });

  describe('UT16 - assembly line (VIS03)', () => {
    const lineIssues = (mutate, code) => {
      const layout = sample('compact');
      mutate(layout);
      return issue(validate(layout), code);
    };

    test.each([
      [
        'single-element line',
        (l) =>
          (l.elements = l.elements.filter(
            (e) => e.category === 'EQUIPMENT' || e.id === 'line-oven',
          )),
      ],
      [
        'no platform',
        (l) =>
          (l.elements = l.elements.filter((e) => e.id !== 'line-platform')),
      ],
      [
        'two ovens',
        (l) =>
          l.elements.push({
            ...structuredClone(element(l, 'line-oven')),
            id: 'line-oven-2',
          }),
      ],
      [
        'two robotic arms',
        (l) => (l.elements = l.elements.filter((e) => e.id !== 'line-arm-3')),
      ],
    ])('%s -> LINE_COMPOSITION', (_name, mutate) => {
      expect(lineIssues(mutate, 'LINE_COMPOSITION').length).toBeGreaterThan(0);
    });

    test('order: platform right of the oven, arm outside, belt beyond the oven, dispenser', () => {
      expect(
        lineIssues((l) => {
          element(l, 'line-platform').placement.position.x = 5;
        }, 'LINE_ORDER').map((item) => item.params.variant),
      ).toEqual(
        expect.arrayContaining([
          'platformAfterOven',
          'armOutside',
          'beltOutside',
        ]),
      );
      expect(
        lineIssues((l) => {
          element(l, 'line-arm-1').placement.position.x = -4.5;
        }, 'LINE_ORDER')[0].path,
      ).toBe('/elements/4/placement/position');
      expect(
        lineIssues((l) => {
          element(l, 'line-belt').placement.position.x = 5.5;
        }, 'LINE_ORDER')[0].params.variant,
      ).toBe('beltOutside');
      expect(
        lineIssues((l) => {
          element(l, 'line-dispenser').placement.position.y = 0.5;
        }, 'LINE_ORDER')[0].params.variant,
      ).toBe('dispenserLow');
    });

    test('an element 3 m from the wall -> LINE_NOT_AT_WALL', () => {
      const issues = lineIssues((l) => {
        element(l, 'line-arm-2').placement.position.z = -1;
      }, 'LINE_NOT_AT_WALL');
      expect(issues).toEqual([
        expect.objectContaining({
          path: '/elements/5/placement/position',
          params: expect.objectContaining({ distance: '3.00' }),
        }),
      ]);
    });

    test('oven rotated 45 degrees and belt across the wall -> LINE_ALIGNMENT', () => {
      expect(
        lineIssues((l) => {
          element(l, 'line-oven').placement.rotation.y = 45;
        }, 'LINE_ALIGNMENT')[0].params.variant,
      ).toBe('notRightAngle');
      expect(
        lineIssues((l) => {
          element(l, 'line-belt').placement.rotation.y = 90;
        }, 'LINE_ALIGNMENT')[0].params.variant,
      ).toBe('beltAcross');
    });

    test('belt between platform and oven touching neither -> two issues', () => {
      const issues = lineIssues((l) => {
        const belt = element(l, 'line-belt');
        belt.placement.position.x = 0;
        belt.placement.scale.x = 4;
      }, 'LINE_BELT_DISCONNECTED');
      expect(issues.map((item) => item.message)).toEqual([
        'The conveyor belt starts 1.10 m after the receiving platform',
        'The conveyor belt ends 1.70 m before the oven',
      ]);
    });

    test('belt touching the platform only, in front of the oven, or too high', () => {
      expect(
        lineIssues((l) => {
          element(l, 'line-belt').placement.scale.x = 5;
          element(l, 'line-belt').placement.position.x = -0.75;
        }, 'LINE_BELT_DISCONNECTED').map((item) => item.params.variant),
      ).toEqual(['endsBefore']);
      expect(
        lineIssues((l) => {
          element(l, 'line-oven').placement.position.z = -1.8;
        }, 'LINE_BELT_DISCONNECTED').map((item) => item.params.variant),
      ).toEqual(['depthOven']);
      expect(
        lineIssues((l) => {
          element(l, 'line-belt').placement.position.y = 1.3;
        }, 'LINE_BELT_DISCONNECTED').map((item) => item.params.variant),
      ).toEqual(['levelPlatform']);
    });

        test('oven raised to 2 m above a belt at 1 m -> belowOven (entrance height)', () => {
      const issues = lineIssues((l) => {
        element(l, 'line-oven').placement.position.y = 2;
      }, 'LINE_BELT_DISCONNECTED');
      expect(issues).toEqual([
        expect.objectContaining({
          path: '/elements/3/placement/position',
          message:
            'The top of the conveyor belt is 1.00 m below the oven entrance (at most 0.15 m)',
          params: { variant: 'belowOven', distance: '1.00', max: 0.15 },
        }),
      ]);
      expect(
        lineIssues((l) => {
          element(l, 'line-oven').placement.position.y = 1.1;
        }, 'LINE_BELT_DISCONNECTED'),
      ).toEqual([]);
      expect(
        lineIssues((l) => {
          element(l, 'line-oven').placement.position.y = 1.2;
        }, 'LINE_BELT_DISCONNECTED').map((item) => item.params.variant),
      ).toEqual(['belowOven']);
    });

    test.each([
      ['NORTH', (p) => p],
      ['SOUTH', ({ x, y, z }) => ({ x: -x, y, z: -z })],
      ['EAST', ({ x, y, z }) => ({ x: -z, y, z: x })],
      ['WEST', ({ x, y, z }) => ({ x: z, y, z: -x })],
    ])('the same valid line on the %s wall has no issue', (wall, rotate) => {
      const layout = sample('compact');
      layout.kitchen.dimensions = { width: 12, depth: 12, height: 3.2 };
      layout.assemblyLine.wall = wall;
      const turn = { NORTH: 0, SOUTH: 180, EAST: 270, WEST: 90 }[wall];
      for (const item of layout.elements) {
        const { x, y, z } = item.placement.position;
        // 12 x 12 kitchen: move the line next to the NORTH wall, then turn it.
        item.placement.position = rotate({ x, y, z: z - 2 });
        item.placement.rotation.y = (item.placement.rotation.y + turn) % 360;
      }
      expect(validate(layout).issues).toEqual([]);
    });
  });

  test('UT17 - texture sets (VIS04)', () => {
    const layout = sample('compact');
    layout.kitchen.floor.material = { colorMapAssetId: 'AST-TEX-TILES-COLOR' };
    element(layout, 'line-platform').material = {
      normalMapAssetId: 'AST-TEX-STEEL-NORMAL',
    };
    element(layout, 'line-counter').material = {
      roughnessMapAssetId: 'AST-TEX-STEEL-ROUGH',
      bumpMapAssetId: 'AST-TEX-STEEL-NORMAL',
    };
    // A procedural shape without a material (the sample counter is a model).
    const counter = element(layout, 'counter-1');
    counter.model = {
      source: 'PROCEDURAL',
      shape: 'BOX',
      size: { x: 2.4, y: 0.9, z: 0.7 },
    };
    delete counter.material;
    layout.kitchen.walls = {};
    element(layout, 'line-oven').material = {
      colorMapAssetId: 'AST-TEX-STEEL-COLOR',
      bumpMapAssetId: 'AST-TEX-STEEL-NORMAL',
    };
    layout.elements.push(
      {
        id: 'plain-1',
        category: 'EQUIPMENT',
        type: 'TABLE',
        model: { source: 'ASSET', assetId: 'AST-MDL-TABLE-PLAIN-01' },
        placement: structuredClone(element(layout, 'fridge-1').placement),
      },
      {
        id: 'plain-2',
        category: 'EQUIPMENT',
        type: 'TABLE',
        model: { source: 'ASSET', assetId: 'AST-MDL-TABLE-PLAIN-01' },
        placement: structuredClone(element(layout, 'fridge-1').placement),
        material: { colorMapAssetId: 'AST-TEX-WOOD-COLOR' },
      },
      {
        id: 'plain-3',
        category: 'EQUIPMENT',
        type: 'TABLE',
        model: { source: 'ASSET', assetId: 'AST-MDL-TABLE-PLAIN-01' },
        placement: structuredClone(element(layout, 'fridge-1').placement),
        material: {
          colorMapAssetId: 'AST-TEX-WOOD-COLOR',
          normalMapAssetId: 'AST-TEX-WOOD-NORMAL',
        },
      },
    );
    const result = validate(layout);
    expect(issue(result, 'INCOMPLETE_TEXTURE_SET')).toHaveLength(4);
    expect(issue(result, 'MATERIAL_REQUIRED').map((item) => item.path)).toEqual(
            [
        '/kitchen/walls/material',
        `/elements/${indexOf(layout, 'counter-1')}/material`,
      ],
    );
    expect(
      issue(result, 'MODEL_TEXTURES_MISSING').map((item) => item.path),
    ).toEqual([`/elements/${indexOf(layout, 'plain-1')}/material`]);
  });

  test('the invalid sample reports every documented issue together (MT02)', () => {
    expect(new Set(codes(validate(sample('invalid'))))).toEqual(
      new Set([
        'INCOMPLETE_TEXTURE_SET',
        'INVALID_SCALE',
        'DUPLICATE_ELEMENT_ID',
        'UNKNOWN_ASSET',
        'MODEL_TEXTURES_MISSING',
        'LINE_COMPOSITION',
        'LINE_BELT_DISCONNECTED',
      ]),
    );
  });

  test('a non-object content is one INVALID_TYPE issue at the root', () => {
    for (const value of [null, [], 'text', 3])
      expect(validate(value).issues).toEqual([
        expect.objectContaining({ path: '', code: 'INVALID_TYPE' }),
      ]);
  });
});
